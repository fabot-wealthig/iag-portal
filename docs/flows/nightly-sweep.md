# FLOW — The nightly sweep

How the payment pipeline finishes what it started. One PUBLIC action,
`run_payment_sweep`, fired once a night by pg_cron + pg_net, working through seven legs in a fixed
order. It spans no frontend at all — there is no screen for it and no button — and touches almost no
new code: five of its seven legs hand rows straight to the helpers the live path already uses.

**It calls nothing of its own.** Every leg offers rows to a LATCHED helper — `runRevenueShare`,
`draftPaymentConfirmation`, `draftPaymentInvoiceReceipt`, `draftPaymentRequestEmail`,
`draftPaymentReminder`, `draftConnectReminder` — and each of those owns its column and refuses to act
twice. The sweep decides only WHICH rows to offer; the helper decides whether anything happens. That
is why it can run every night forever and never double a transfer, a draft or a document number.

## The gate

`run_payment_sweep` sits in `PUBLIC_HANDLERS`, which means it is dispatched BEFORE the session gate —
but it is not a page. Its credential is a **service-role bearer**: the handler's first act is to
compare `Authorization` against `Bearer ` + `SUPABASE_SERVICE_ROLE_KEY` with `constantTimeEqual`, and
anything else — a wrong key, no header, an unset env var — answers **401
`{ error: "Service-role authorization required" }`**. It is VFO's sweep gate, unchanged.

That 401 is the only one in the system outside the two credential checks — `admin_login`, which answers
401 "Invalid credentials" on a bad passcode, and `middleware/auth.ts` — and, like both of them, it
answers 401 ONLY for a bad credential. So it does not contradict GOTCHA #12: #12 forbids a 401 for a
SERVER-SIDE failure, because `lib/api.js` signs the admin out on any 401, and this one is a bad
CREDENTIAL, which is exactly what #12 says should be a 401. No portal screen calls this action, and the
browser has no way to hold a valid bearer, so no admin session can ever see it.

## The legs

Each leg selects **at most 50 rows** and processes them **sequentially** — a Stripe transfer and a
Gmail draft are real network calls, and the cap is what stops a backlog running the function past its
wall clock. Whatever is left over is picked up tomorrow night, because nothing here consumes its own
candidates. Every row runs inside its own `try`/`catch` and reports `{ leg, id, outcome, detail? }`
into `results`: one unpayable COI must not cost the other forty-nine their turn.

`cutoff2 = businessDelayCutoffIso(2)` is computed **once** for the run, so the two reminder legs
cannot straddle a midnight and disagree about what "two business days ago" means.

| # | Leg | Predicate | Calls |
| --- | --- | --- | --- |
| A | `revenue_share` | `payment_status = 'succeeded'` AND (`rev_paid` is null OR in `Awaiting Payout Account` / `Failed` / `processing` OR (`= 'succeeded'` AND `rev_email_sent_at` is null)) | `runRevenueShare(id, { force: rev_paid === "processing" })` |
| B | `confirmation` | `payment_status` is not null AND `confirmation_status = 'Confirmation Needed'` | `draftPaymentConfirmation` |
| C | `invoice_receipt` | `payment_status = 'succeeded'` AND `invoice_email_sent = false` | `draftPaymentInvoiceReceipt` |
| D | `request_email` | `payment_status` null AND `checkout_token` not null AND `payment_email_sent_at` null AND `created_at` older than 10 minutes | `draftPaymentRequestEmail(…, { logLabel: "payment_sweep" })` |
| E | `payment_reminder` | `payment_status` null AND `checkout_token` not null AND `payment_email_sent_at` not null and `< cutoff2` AND `payment_reminder_sent_at` null | `draftPaymentReminder` |
| F | `connect_reminder` | `members.connect_setup_email_sent_at` not null and `< cutoff2` AND `connect_reminder_sent_at` null AND `email` present AND `status = 'Active'` | live Stripe check, then `draftConnectReminder` |
| G | `housekeeping` | three retention deletes — see below | nothing; the sweep deletes directly |

**A runs first and runs regardless of Gmail**, because money owed to a COI does not need a mailbox to
move. `force` is passed for one state only: a claim stuck at `processing` is a run that died
mid-flight, and the deterministic idempotency key is what makes repeating that transfer safe. Every
other state goes through the normal conditional claim.

**Gmail is asked once.** After leg A the sweep calls `getGmailAccessToken()` a single time; a null
sets `gmail_unavailable: true` and legs **B, C, D, E and F are skipped wholesale** for the run rather
than each rediscovering the outage fifty times. Nothing is stamped, so the next night picks all of it
up.

**D's ten-minute floor** exists because `start_client_payment` creates the row and drafts its email in
the same call. A row created seconds ago with no `payment_email_sent_at` is far more likely to be a
request in flight than one that failed.

**F asks Stripe, never the roster row.** `members.stripe_account_id` proves an account was created
and nothing more — the same reason `coi_connect_status` exists. For each candidate the sweep GETs
`/v1/accounts/{id}` and treats the COI as payable only on `capabilities.transfers === "active"` AND
`payouts_enabled === true`. Three outcomes:

- **not payable** → `draftConnectReminder`, which stamps `connect_reminder_sent_at` after Gmail accepts.
- **payable** → outcome `complete`, and `connect_reminder_sent_at` is stamped **anyway, with no
  email**. Without that stamp a COI who finished onboarding would be re-read and re-queried at Stripe
  every night for the life of the portal; the latch is what retires a finished row from the leg.
- **Stripe read failed** → outcome `stripe_error` and **no stamp**. We do not KNOW the COI is
  unpayable, so the row comes back tomorrow night.

## Why every leg is safe to repeat

Nothing in the sweep is guarded by the sweep. Each latch belongs to the helper that owns the column,
and is checked inside it:

| Leg | Latch | Owner |
| --- | --- | --- |
| A (transfer) | `rev_paid` claim + a deterministic Stripe `Idempotency-Key` per payment | `revenue-share.ts` |
| A (email) | `rev_email_sent_at` | `revenue-share.ts` |
| B | `confirmation_status = 'Sent'` | `confirmation-email.ts` |
| C | `invoice_email_sent = true` (and the numbers, written back the instant they are allocated) | `invoice-receipt.ts` |
| D | `payment_email_sent_at` — the sweep's predicate IS the latch, and the helper stamps it | `request-email.ts` |
| E | `payment_reminder_sent_at` | `reminder-email.ts` |
| F | `connect_reminder_sent_at` | `connect-reminder-email.ts` |

Both reminder helpers **NEVER THROW** and re-check their own state before drafting: the sweep reads
its candidates minutes before it reaches any given row, and a client who pays inside that window is
exactly the race a reminder must not lose. Neither has a `force` flag — nothing automated should ever
raise a second reminder, and an admin who wants to chase again has "Resend payment email" on the
payment detail screen or "Resend setup email" on the Connect card.

## The two reminders

Both fire **two business days** after the email they follow up. Business days, not calendar days: a
pay link emailed on a Friday afternoon has not been ignored by Sunday morning, and chasing it then
reads as nagging. `utils/business-days.ts` walks back one weekday at a time in UTC, then subtracts any
fractional part as plain hours — walking first, so a larger `days` is always an earlier cutoff.

Both carry the **same link the original did**. The payment reminder renders `[PAYMENT_LINK]` through
`paymentLinkButton()` exported from `request-email.ts`; the Connect reminder renders `[SETUP_LINK]`
through `connectSetupButton()` in `utils/connect-setup-token.ts`, over the durable token
`ensureConnectSetupToken` returns. Neither mints anything new — a fresh link would turn a follow-up
into a second, competing request — and both builders are shared precisely so the two emails cannot
drift apart.

Wording lives in `email_templates`: `CLIENT_PAYMENT` / `client_payment_reminder` (tokens
`[First Name]`, `[Client Name]`, `[STRATEGY]`, `[TOTAL_FEE]`, `[PAYMENT_LINK]`) and `COI_PAYOUT` /
`coi_connect_reminder` (`[First Name]`, `[SETUP_LINK]`). Both are `send_mode false`, both go To the
`RECIPIENT` role token, and the fallback constants in the two helpers mirror the seed exactly, so a
deactivated row still produces a sane email.

## Housekeeping

Leg G always runs — it needs neither Gmail nor Stripe, and its work grows whether or not anybody is
paying anybody. Three deletes, each reported with a real count (the `.select(…)` on the delete is what
makes the count real; without it PostgREST returns no representation and the sweep would report zero
however much it removed):

- **`admin_sessions`** where `expires_at < now()`. Until now expired rows were deleted only when that
  session was presented, or per-admin by `update_passcode` / `delete_admin` — they accumulated forever.
- **`login_attempts`** older than **30 days**. The throttle window is fifteen MINUTES, so thirty days
  is pure audit headroom: a question about a lockout can still be answered a month later.
- **`login_setup_tokens`** whose `expires_at` is more than **30 days** past — a spent or lapsed
  `/set-password` link nobody can use, kept a month for the same reason.

Three tables are never touched, and that is a hard rule: **`connect_setup_tokens`** (durable by
design — deleting one breaks every payout-setup email ever sent to that COI), **`stripe_events`** (the
webhook replay guard) and **`document_numbers`** (an issued invoice or receipt number must never be
reissued).

## The cron job

`supabase/migrations/20260903142000_payment_sweep_cron.sql` enables `pg_cron` and `pg_net`,
unschedules any existing job of the same name, and registers **`payment-sweep-daily`** at
**`0 10 * * *`** — 10:00 UTC, 06:00 Eastern, so the night's drafts are already in the mailbox when
somebody opens it. It POSTs `{"action": "run_payment_sweep"}` at the function with a 120-second
timeout.

**The bearer is read from Vault at run time.** VFO's equivalent file pastes the service-role key into
the schedule, which puts the secret in the repo AND in `cron.job` forever. This one selects it from
`vault.decrypted_secrets` inside the job body, so the committed file names only the **Vault secret
name `iag_service_role_key`** and `cron.job` stores only the query. Jake creates that secret himself
in the Dashboard; nobody types the value into a chat. If it is missing the subquery returns NULL, the
bearer collapses to empty, the sweep answers 401 and **nothing happens** — a missing secret is a
no-op, not a half-run.

## Dry run and firing it now

`{"action": "run_payment_sweep", "dry_run": true}` lists what each leg WOULD take — including
housekeeping row counts — and does nothing: no Stripe call, no Gmail draft, no delete. It does not
even probe Gmail, so `gmail_unavailable` reads false. It is the safe way to look at a night's work
before letting it run.

Both snippets are in the migration's operational reference block, alongside disable / re-enable /
remove / view-recent-runs: fire the real job with

```sql
do $$ declare cmd text; begin select command into cmd from cron.job where jobname = 'payment-sweep-daily'; execute cmd; end $$;
```

then poll `select * from net._http_response order by created desc limit 1;`. The dry-run variant posts
the same request with `"dry_run": true` in the body.

A run answers 200 with `{ success, dry_run, ran_at, gmail_unavailable, results, counts }` and logs one
summary line: `payment_sweep: <n> candidates, <leg>=<n>, …`.

## Where the pieces live

| Piece | File |
| --- | --- |
| The sweep itself (all seven legs) | `iag-admin-api/actions/payments/sweep.ts` |
| Business-day cutoff | `iag-admin-api/utils/business-days.ts` |
| Payment reminder email (latched) | `iag-admin-api/actions/payments/reminder-email.ts` |
| Connect reminder email (latched) | `iag-admin-api/actions/members/connect-reminder-email.ts` |
| Shared "Complete Payment" button | `iag-admin-api/actions/payments/request-email.ts` (`paymentLinkButton`) |
| Shared "Set Up Payment Details" button + durable token | `iag-admin-api/utils/connect-setup-token.ts` (`connectSetupButton`) |
| Bearer comparison | `iag-admin-api/utils/crypto.ts` (`constantTimeEqual`) |
| Dispatch entry (the one bearer-gated public action) | `iag-admin-api/router/dispatch.ts` |
| The two reminder latches | `supabase/migrations/20260903140000_sweep_reminder_columns.sql` |
| The two seeded templates | `supabase/migrations/20260903141000_sweep_reminder_emails.sql` |
| The cron job + operational reference | `supabase/migrations/20260903142000_payment_sweep_cron.sql` |
| What each leg finishes | `docs/flows/client-payment-request.md`, `docs/flows/coi-connect-setup.md` |

## Traps

- **Never add a leg that writes a state a helper owns.** The sweep's safety is entirely borrowed: it
  is safe because `rev_paid`, `confirmation_status`, `invoice_email_sent`, `payment_email_sent_at` and
  the two reminder stamps are each written in exactly one file. A leg that stamped one of them itself
  would be a second writer, and the next replayed Stripe event or the next night's run would double
  whatever it guarded.
- **Never purge `connect_setup_tokens`, `stripe_events` or `document_numbers`.** The first is durable
  by design; the second is the webhook replay guard; the third guarantees a number is never reissued.
  "Old rows" in any of the three are the point of the table, not debris.
- **The bearer gate must stay server-to-server.** Its 401 is the only one outside the two credential
  checks (`admin_login` and `middleware/auth.ts`), it fires only for a bad credential exactly as they do,
  and it is legitimate only because no browser can reach it. Exposing this action to a portal screen —
  even behind an admin session — would put an action that transfers money and deletes rows one bug
  away from a signed-in user, and would put a 401 in front of `lib/api.js` (#12).
- **`force` belongs to `processing` and nothing else.** It is passed only to unstick a claim from a
  run that died mid-flight, where the idempotency key makes the repeat safe. Widening it would let the
  sweep re-drive states the helpers deliberately treat as terminal.
- **Legs are capped at 50 and processed sequentially on purpose.** Raising the cap or fanning them out
  in parallel trades the function's wall clock — and Stripe's and Gmail's rate limits — for a backlog
  that would have cleared tomorrow anyway.
- **The 10-minute grace on leg D is a race guard, not a tuning knob.** Shrinking it lets the sweep
  draft a second request email for a payment that is being raised at that moment.
