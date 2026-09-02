# FLOW — COI Connect setup

How a COI gets a Stripe Connect account that the revenue-share sweep can pay. Spans the COI
Profile/Settings panes (frontend), one authed action that creates the account and drafts the email,
one PUBLIC action behind the emailed link, and one authed action that reads status back from Stripe.

**Nothing is sent and nothing expires.** The setup email is a Gmail DRAFT — there is no send path.
The emailed link is DURABLE: one permanent token per COI, reused by every resend, so an email
opened months later still works. Both are deliberate; see Traps.

## The path

1. **An admin opens a COI and presses the button.** "Set Up Payment Details" (Settings), "Send Setup
   Email" (Profile), "Resend setup email" once an account exists — one `StripeConnectCard`, one call.
2. **`coi_stripe_connect_request`** (authed; any admin session) refuses a COI with no `email`, then
   checks the resend guard BEFORE any side effect. If clear it creates a Stripe **Express** account
   — `country=US`, `capabilities[transfers][requested]=true`, product description "Wealth Innovation
   Group revenue share payouts", `metadata[member_number]` — and stamps
   `members.stripe_account_id`. An existing id is reused, never re-created.
3. **The durable token** comes from `ensureConnectSetupToken()`: one row per (`entity_type`,
   `entity_key`) in `connect_setup_tokens`, minted on first use and re-selected if a create race
   loses the unique. The emailed link is always `PORTAL_BASE` + `/payout-setup?token=…`.
4. **The draft.** Subject and body come from the `email_templates` row `COI_PAYOUT` /
   `coi_connect_setup` (fallback constants in the handler mirror the seed, so a deactivated row
   still produces a sane email). `[First Name]` and `[SETUP_LINK]` are replaced by global regex —
   there is no general renderer — with `[SETUP_LINK]` becoming a primary-blue button. Recipients resolve
   through `utils/email-recipients.ts` (`RECIPIENT` / `COI` / `CLIENT` role tokens, falling back to
   the COI's own address if To resolves empty). `WIG_SIGNATURE` is appended here. Only after Gmail
   accepts the draft is `connect_setup_email_sent_at` stamped — a stamp failure is logged, never
   surfaced, so nobody presses the button twice.
5. **The COI opens the link.** `/payout-setup` is public and session-less; the token IS the
   credential. It calls `connect_setup_link` and redirects to whatever URL comes back.
6. **`connect_setup_link`** (PUBLIC) looks the token up, loads the COI, and mints a **fresh** Stripe
   account link on every single click — `type=account_onboarding`,
   `collection_options[fields]=eventually_due`, `refresh_url` looping back to this page with the
   same token, `return_url` = `/payout-setup?done=1`. Those two use the request Origin when it is in
   `ALLOWED_ORIGINS` (so localhost works), else the production host. Failures answer 200 with
   `state: "invalid"` and one generic message; `last_used_at` is stamped fire-and-forget.
7. **Stripe hosts the onboarding** and returns the COI to `/payout-setup?done=1`, which renders the
   "Payment details submitted" card. We never see a bank or card detail.
8. **`coi_connect_status`** (authed) is what the admin's pill reads — a live GET of the account from
   Stripe on every open. Nothing about status is stored.

## Re-sending and status

- **The resend guard is `members.connect_setup_email_sent_at`**, and it sits above account creation
  and token minting. A second press returns `{ already_sent_at, to_email }` having done nothing at
  all; the card shows a `window.confirm`, and only if the admin accepts does it re-call with
  `force: true`. Cancelling is a true no-op. The resend carries the SAME token.
- **There is no polling and no `account.updated` webhook.** The pill refetches on profile open, COI
  switch, the manual **Refresh** link, and once after a successful send — matching VFO.
- **Six statuses.** `none` (no account id) · `pending` (red, "Setup pending") · `eligible_capped`
  (amber, "Account setup — payouts eligible to $3,000" — payouts and transfers live but fields still
  `eventually_due`, so payouts freeze later; the case this endpoint exists to expose) · `complete`
  (green, "Account Set up") · `mode_mismatch` (grey — not found on the active key but found by the
  other mode's) · `unavailable` (grey — any other failure).

## Where the pieces live

| Piece | File |
| --- | --- |
| Connect card (pill, Refresh, Send/Resend) | `iag-portal/src/components/CoiSearch.jsx` |
| Public setup page | `iag-portal/src/pages/PayoutSetup.jsx` |
| Route + emitted static page | `iag-portal/src/App.jsx`, `iag-portal/scripts/emit-route-pages.mjs` |
| Account create + email draft | `iag-admin-api/actions/members/stripe-connect-request.ts` |
| Live status read | `iag-admin-api/actions/members/connect-status.ts` |
| Public link handler | `iag-admin-api/actions/payouts/connect-setup-link.ts` |
| Durable token + emailed URL | `iag-admin-api/utils/connect-setup-token.ts` |
| Recipient role tokens | `iag-admin-api/utils/email-recipients.ts` |
| Stripe key/mode + `stripeFetch` | `iag-admin-api/utils/stripe.ts` |
| Guard column + seeded template | `supabase/migrations/20260902120000_coi_connect_setup.sql` |

## Traps

- **The token is meant to be permanent.** No expiry, no consumption, no rotation — that is what
  makes every email ever sent keep working. Adding an `expires_at` "for security" silently breaks
  old emails; the short-lived credential here is the Stripe account link, re-minted on every click.
- **`stripe_account_id` is NOT a "set up" signal.** It proves an account was created, nothing more.
  Only `coi_connect_status` can say whether onboarding finished — never infer it from the roster row.
- **The emailed link points at production**, so `/payout-setup` must be deployed on the frontend
  before any real COI is emailed, and it must stay in `ROUTES` in `scripts/emit-route-pages.mjs` or
  GitHub Pages serves a real 404 to someone arriving from an email.
- **A sandbox-created account is invisible to the live key** (and vice versa). That is what
  `mode_mismatch` reports; flipping `STRIPE_MODE` does not migrate accounts, it orphans them.
- **`update_coi` must never write `stripe_account_id` or `connect_setup_email_sent_at`.** Both are
  owned by the Connect flow; letting the Edit Profile form touch either would clear the resend guard
  or point a COI at someone else's payout account.
- **`connect_setup_link` must keep answering 200 with a `state`** on every failure, exactly like
  `/set-password`. A 404 or 410 turns the endpoint into an oracle for guessing tokens.
