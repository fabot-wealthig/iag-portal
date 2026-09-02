# CHANGELOG

Narrative history of the IAG Portal, **newest entry first**.

Format: `## YYYY-MM-DD — headline`, followed by bullets describing what changed and why.

One change = one entry = one squashed commit on `main`. A change may span several chats; it still
gets exactly one entry. Superseded facts move here out of `docs/SESSION_REFERENCE.md` when the hub
is updated, so the hub only ever holds current state.

## 2026-09-02 — Chat 5: client payment requests (Phase C)

Phase C is the first time money is actually asked for. An admin can raise a payment request against
a client from the portal, the client gets an emailed link to a public page, and that page hands them
to Stripe Checkout for an ACH transfer. It is also the first time anything WRITES `client_payments`
— the table has existed unwritten since Phase A. The pipeline still stops at Stripe: every column
from `payment_status` onward stays empty until Phase D books it from the webhook. One additive
migration (14 total), and the backend went **v16 → v17** in one deploy. Full walk-through in
`docs/flows/client-payment-request.md`.

- **Four new actions (29 → 33).** `start_client_payment` (authed) raises the request: it inserts the
  `client_payments` row, creates a Stripe customer for it, mints the `checkout_token` and drafts the
  email carrying the link. `load_client_payments` (authed) is the client profile's payment history.
  `load_pay_link` and `pay_link_checkout` are the fourth and fifth PUBLIC pre-auth handlers, backing
  the new `/pay` page — one quotes the amount, the other charges it. `PUBLIC_HANDLERS` is now 5 and
  `AUTH_HANDLERS` 27, so the dispatch table reads 32 and the action count is 33 with `admin_login`.
- **The row is the pipeline, and it goes in first.** Nothing external can succeed against a payment
  that was never recorded. A Stripe customer failure DELETES the row — a payment with no customer
  can never be paid and would only sit on the screen looking live. A Gmail failure deliberately does
  NOT: the row stays with `payment_email_sent_at` null and the Payments tab shows a red "Email not
  sent", because the request is real and the link works. The stamp itself is written only after
  Gmail accepts the draft, and a stamp failure is logged rather than surfaced, exactly as in Phase B.
- **Cloned from VFO's tax chain, with the deviations recorded** so nobody "fixes" them back. VFO
  runs `automation_TAX_stripecustomer` → `paymentemail` → `/tax-pay` →
  `automation_TAX_stripecheckout`; IAG collapses the first two into ONE authed handler, because
  there is no BoldSign boundary to split the chain on. ACH only — no card option, and any `method`
  field in the body is ignored. No `setup_future_usage`: a client fee is a single payment, so
  storing bank details past the charge would keep data nothing will ever use. The public handlers
  answer failures 200 + `state` (`invalid` / `paid`) per IAG's token rule instead of VFO's 404/400.
  Stripe's return URLs sit on the validated request Origin so localhost testing works, while the
  EMAILED link always uses `PORTAL_BASE`. And a fresh Stripe customer is created per PAYMENT rather
  than per plan, so each payment's Stripe history reads on its own.
- **Metadata is written twice on purpose.** `payment_id`, `client_id`, `checkout_token`,
  `pipeline=CLIENT_PAYMENT` and `payment_kind=client_fee` ride on BOTH the PaymentIntent and the
  Checkout session, because `checkout.session.completed` carries only the session's own metadata —
  without the duplicate the first webhook to arrive could not tell which row completed. Phase D can
  then route on either event. Bank verification is `instant` (Financial Connections), not
  micro-deposits, which would stall a payment for days before it started clearing.
- **`/pay` is a sixth route**, public and session-less, and is registered in `ROUTES` in
  `scripts/emit-route-pages.mjs` (now 5 entries). It quotes the fee on one ACH card, redirects to
  Stripe, and renders a "Payment submitted" card on the `?done=1` return — a plain `AuthShell` card
  standing in until the WIG-branded success landing page lands. Like `/payout-setup` before it, the
  route only exists on the web at the NEXT `npm run deploy`; until then an emailed link 404s.
- **A revenue-share preview that is display only.** The request form recomputes the whole waterfall
  live from the strategy rules, the COI's level and whether its mothership is ERT — admin fee off
  the offset, the flat legal letter, then ERT's percentage, then the pool, the COI's cut and Wealth
  IG's net — and blocks submit if the pool goes negative. None of it is sent: only `strategy_key`,
  `offset_amount`, `total_fee` and `notes` cross the wire, and Phase F will compute the real
  waterfall server-side. **The ERT base was resolved this session** against Jake's "Understanding
  Revenue Share for the LEOS Strategy": step 2 reads "After the administrative fee and legal opinion
  letter have been deducted, ERT receives either 10% (affiliated) or 5% (not affiliated)" — so the
  10%/5% comes off what is left after the two hard costs, not off the whole client fee, and the
  preview was corrected to match. The seeded LEOS `explainer` and the Tax Strategies panel's step-3
  card still state the percentages without naming that base; rewording them is OWED, and Phase F
  must implement the resolved rule server-side. The same document defines the offset amount only as
  what the client fee is "based on" and what the 1.5% admin fee is charged on.
- **`checkout_token` never reaches the browser.** `load_client_payments` spends it composing a
  `pay_url` and strips the field, so the admin screen gets the link and not the credential inside
  it. And any non-null `payment_status` retires a link permanently — both public handlers answer
  `paid` — so a hand-written status kills the pay link with no way to re-open it.
- **Migration 14 seeds ONE `email_templates` row**, `CLIENT_PAYMENT` / `client_payment_request`,
  `to_list` `["RECIPIENT"]` and send_mode false: an email that asks a client to move money should
  not be sendable without a human reading the amount on it first. `email_templates` now holds two
  rows, and the panel's sections changed to match — the old `WIG` heading, which never had a row,
  is replaced by **Client Payments** and **COI Payouts**, so the Phase B row that had been rendering
  under "Other" now has a home. The COI role token is offered on this email so an admin can Cc the
  introducing COI from the panel. Advisor re-run after the migration: `"lints": []`, unchanged. Still
  12 tables, no RLS change.
- **Deployed and tested by click-through, all thirteen steps.** `iag-admin-api` is v17, ACTIVE, 51
  files; post-deploy smoke: both public pay handlers answer 200 `state: "invalid"` on a junk token,
  `start_client_payment` answers 401 with no session. Then, against the local frontend: a first
  client added under test COI `1.2.9999` (which had none), the form gated on the strategy select, the
  preview at offset 500,000 / fee 25,000 reading 7,500 / 7,500 / 1,000 / 9,000 / 1,800 / 7,200, a
  14,000 fee blocked in red, the draft in Gmail with the right subject, amount, button and
  signature, `/pay` on localhost showing one ACH card, Stripe Checkout in sandbox offering only a US
  bank account under the right product name, the Test (OAuth) bank paying through to the "Payment
  submitted" card, and `checkout.session.completed` landing in `stripe_events` carrying
  `pipeline=CLIENT_PAYMENT` / `payment_kind=client_fee` / the row's `payment_id` (session `unpaid`,
  as an ACH in flight should be). Re-opening the paid link still quotes the fee — correct for this
  phase, since nothing writes `payment_status` until D. One test expectation was wrong, not the
  form: a 15,000 fee lands at a pool of exactly zero, so it sent; that row was deleted by hand, and
  the preview gained a clamp so ERT takes nothing once the hard costs exceed the fee. `/pay` is not
  on the web until the next frontend deploy, and there is no "resend payment email" action yet.
- **New GOTCHA #15: in PowerShell, a bare `bash` is the WSL relay stub**, not Git Bash. It resolves
  to `C:\Windows\system32\bash.exe` and, with no Linux distro installed, dies with a
  `WSL (9 - Relay) ERROR: … execvpe(/bin/bash) failed` that reads like a broken deploy script. Git
  Bash here is a scoop install at `~\scoop\apps\git\current\usr\bin\bash.exe` and is not on PATH as
  `bash`, so from PowerShell the deploy is `& "$HOME\scoop\apps\git\current\usr\bin\bash.exe"
  scripts/deploy-function.sh`. Claude's own Bash tool IS Git Bash, which is why the plain command
  works for the agent and fails for Jake in the same repo. Both session prompts now print the
  PowerShell form — **re-copy `SESSION_STARTER.md` and `SESSION_WRAPUP.md`.**

## 2026-09-02 — Chat 4: Stripe Connect onboarding for COIs (Phase B)

Phase B wires the first half of the payout pipeline: a COI can now be given a Stripe Connect Express
account and walked through Stripe's own onboarding, and the portal can say what Stripe actually
thinks of that account. Money still does not move — no transfers, no `client_payments` writes — but
the accounts the sweep will pay into now exist and can be created from the UI. Backend went
v15 → v16 in one deploy, with one additive migration. Proven end to end in Stripe **sandbox**;
live mode stays blocked on Stripe's platform review.

- **Three new actions (26 → 29).** `coi_stripe_connect_request` (authed) creates the Express account
  — `country=US`, transfers capability requested, product description "Wealth Innovation Group
  revenue share payouts", `member_number` in metadata — stamps `members.stripe_account_id`, and
  drafts the email carrying the setup link. `coi_connect_status` (authed) reads the account back
  from Stripe live. `connect_setup_link` is the third PUBLIC pre-auth handler, backing the new
  `/payout-setup` page. Full walk-through in `docs/flows/coi-connect-setup.md`.
- **The emailed link is DURABLE, the Stripe link is not.** One permanent, reusable
  `connect_setup_tokens` row per COI — no expiry, never consumed — and a FRESH Stripe account link
  minted on every click of it, with `refresh_url` looping back to the same page for another. That is
  what makes an email opened weeks later still work, and what makes a resend re-use the same token
  so every message ever sent keeps working. Account links are requested with
  `collection_options[fields]=eventually_due`, so Stripe collects everything up front rather than
  letting a half-set-up account through and freezing its payouts later. Cloned from VFO deliberately.
- **The resend guard sits above every side effect.** `members.connect_setup_email_sent_at` is checked
  before the account is created and before the token is minted, so an unconfirmed second click does
  nothing at all; only `force: true`, sent after the UI's confirm dialog, gets past it. The stamp is
  written only after Gmail accepts the draft, and a stamp failure is logged rather than surfaced —
  telling the admin it failed would just produce a second draft.
- **Status is read, never stored.** No `account.updated` webhook and no polling: the pill refetches
  on profile open, COI switch, the manual Refresh link, and once after a send, matching VFO. Six
  states — `none`, `pending`, `eligible_capped`, `complete`, `mode_mismatch`, `unavailable`.
  `eligible_capped` is the one worth having: payouts and transfers are live but fields are still
  eventually due, which is indistinguishable from `complete` if you look at the database. Having a
  `stripe_account_id` is explicitly NOT a "set up" signal. A missing account triggers one retry with
  the other mode's key, because a sandbox-created account is invisible to the live key and reporting
  that as a plain failure would paint a false red on a healthy account.
- **The first production Gmail flow.** Migration 13 seeds ONE `email_templates` row, `COI_PAYOUT` /
  `coi_connect_setup`, send_mode false and `to_list` `["RECIPIENT"]` — drafts only, which matters
  when the email asks a COI for their SSN and date of birth. `[First Name]` and `[SETUP_LINK]` are
  global regex replacements, not a general renderer; role tokens RECIPIENT / COI / CLIENT resolve
  through a new `utils/email-recipients.ts` that validates and dedupes addresses (one malformed Cc
  makes Gmail reject the whole message). Fallback subject/body constants in the handler mirror the
  seed so a deactivated row still drafts a sane email.
- **IAG-specific deviations from the VFO original**, recorded so nobody "fixes" them back: every
  Stripe call goes through the shared `stripeFetch` with its pinned API version, which gained an
  optional `{ mode }` purely for the cross-mode retry; sandbox comes from `getStripeMode()`; there is
  no sandbox recipient redirect, because IAG only ever drafts; the public handler answers failures as
  200 + `state: "invalid"` following IAG's `/set-password` rule rather than VFO's 404/410; Stripe's
  refresh/return URLs use the validated request Origin so localhost testing works, while the EMAILED
  link always uses `PORTAL_BASE`; and there is no borrowed-account logic.
- **Frontend: a fifth route.** `/payout-setup` is public and session-less, redirects straight to
  Stripe, and renders a "Payment details submitted" card on the `?done=1` return. It is registered in
  `ROUTES` in `scripts/emit-route-pages.mjs` (now 4 entries) — a path people reach from an email has
  to serve a real 200. The Connect card on the COI Profile and Settings panes is now live: account
  id, status pill, Refresh, and Send/Resend.
- **Deploys changed path.** The MCP `deploy_edge_function` tool takes every file of the function
  inline in one call, and at **47 files / ~155 KB** `iag-admin-api` is past what one response can
  carry — an attempt stalled 16 minutes with no version bump. Deploys now run
  `bash scripts/deploy-function.sh`, which streams the same files as a multipart upload to the same
  Supabase Management API endpoint the MCP server calls, reading the access token from the gitignored
  `.mcp.json` and never printing it. Under 10 seconds, HTTP 201. The `supabase` CLI remains forbidden
  for the original reason. New GOTCHAS #13 (the deploy path) and #14 (Windows Python cannot open a
  Git-Bash `/c/` path, which is why the script asks git for the `C:/` form).
- **Tested by click-through**, all ten steps: send from Profile, draft in Gmail with the right
  subject, greeting, button and signature, link → Stripe hosted onboarding → done card, pill reading
  "Account Set up" after Refresh, the resend confirm dialog cancelling cleanly and then producing a
  second draft carrying the SAME token, and the template row visible in the Email Templates panel.
  Test COI `1.2.9999` now carries a sandbox Connect account and stays as the reserved test row.

## 2026-08-28 — Chat 3: the LEOS revenue-share foundation (Phase A)

Phase A of the revenue-share build: the database, the numbering, and the whole UI scaffold that the
payment phases (B–F) will fill in. Nothing takes money yet — no checkout, no webhooks, no email
sending — but every table, identifier and screen those phases need now exists. Backend went
v13 → v15 across two deploys, with six additive migrations.

- **Motherships and a new COI numbering scheme.** A `motherships` table (number PK, `ERT` = 1) names
  the firm a COI sits under, and `member_number` became **`M.T.NNNN` with dots** — mothership, type
  digit, then a GLOBAL zero-padded 4-digit sequence, with `9999` reserved for test rows. Dots
  because the DASH now separates a client's own sequence (`1.1.0007-001`); `utils/coi-number.ts`
  accepts either separator on input and normalises to dots. `coi_type` gained a third value,
  `Other` (digit 3), so the CHECK was dropped and rebuilt. Mothership and type are immutable after
  creation — they are baked into the number, so `update_coi` refuses a change to either with a
  message saying why, rather than ignoring it. `coi_level` (0–4) is editable and drives the payout.
- **Clients, and the payment pipeline's shape.** `clients` hangs off a COI by `member_number` with
  `ON UPDATE CASCADE` (so a renumber follows) and `ON DELETE CASCADE`. `client_payments` was created
  in full — checkout state, the hard costs, the ERT processing fee, the available pool, the COI's
  share and the net profit pool, each stage with its own done/at pair — but nothing writes it yet.
  Two columns are deliberate snapshots: `coi_level_at_payment` and `coi_share_pct`, because a
  payment must keep paying at the level that applied when it was taken.
- **Strategies as editable rule sets.** `strategies` holds the waterfall numbers as data, so tuning
  them never needs a deploy. LEOS is seeded: admin fee 1.5% of the client's offset, a flat $7,500
  legal opinion letter, ERT processing 10% if the COI's mothership is ERT and 5% otherwise, then the
  COI's level share of what remains (0/20/30/40/50%), balance retained by WIG. The Tax Strategies
  panel renders that waterfall as a numbered walk-through with the CURRENT numbers substituted in,
  behind an accordion, with an "Edit Strategy" card that validates every percentage server-side —
  a blank fee box is refused, never coerced to zero.
- **Per-admin tab grants.** `admins.allowed_tabs text[]` plus `admin_update_tabs` (superadmin-only,
  validated against a shared `constants/tabs.ts`, refusing the superadmin floor). The portal grew
  five muted secondary tabs behind a divider — COI Overview, Client Overview, Tax Strategies,
  Automation & Config, Accounting — each gated by the grant list, collapsing to a **More ▾** menu
  under 1180px. A grant takes effect at the grantee's next login, since `allowed_tabs` is baked into
  the session at `admin_login`. This discharges the PARKED "per-admin permission tiers" item.
- **Eleven new actions** (15 → 26): mothership load/add, client CRUD, strategy load/save, email
  template load/save, and `admin_update_tabs`. `save_email_template` serves three payload shapes —
  full edit, single Draft/Send flip, bulk flip — kept disjoint so a bulk flip can never blank a
  subject.
- **UI scaffold.** COI ▾ became two hover flyout sections (COI ▸ and Mothership ▸, each Search /
  KPIs / Add), Mothership Search drills into a firm's COI list and back out again, and every COI now
  has a Clients tab whose open client REPLACES the COI header. Email Templates is functional (the
  table is deliberately empty pending approved copy); COI Overview, Client Overview, Notification
  Editor and Accounting → Payments are honest "coming soon" placeholders.
- **Three standing UI rules**, now recorded in the hub: back links sit UNDER the hero, not above it;
  a name is a link only where it is a genuine shortcut, so rows that already navigate keep plain
  names; and interaction mechanics copy the VFO portal exactly where one exists there — which is how
  a 180ms hover grace timer that VFO does not have got removed again.
- **Auth hardened against transient DB errors.** `middleware/auth.ts` ignored the `error` on both of
  its Supabase reads, so a database blip returned null data, read as "no such session", and answered
  401 — and because the frontend treats any 401 as a dead session, that signed a working admin out.
  Jake hit it twice. Both queries now check their error and return 500 instead, and every 401 path
  logs its reason and action. The VFO portal still carries the same bug across six queries, recorded
  as OWED. New GOTCHAS #10 (the Supabase MCP PAT expires), #11 (MCP writes need a machine-local
  allowlist entry) and #12 (never 401 a server-side failure).

## 2026-08-27 — Chat 2: Wealth IG rebrand + the COI portal

The portal stopped being a bootstrap and became the product: rebranded to Wealth Innovation Group,
restyled as a clone of the VFO admin portal, and given a real COI (Centre of Influence) management
surface plus superadmin-managed admin accounts. Backend went v11 → v13 across two deploys, with two
additive migrations.

- **Rebrand to Wealth IG Portal.** Nothing user-facing says "IAG Portal" any more. Palette sampled
  from the supplied logo file rather than guessed: navy `#0F355A`, orange `#EE6A33`, with
  `#1D64A8` / `#2E86C7` / `#3D9BE0` filling out the blues. The logo JPG was processed into
  transparent PNGs — full lockup and mark-only, each in white and colour — plus a favicon; the
  header uses the mark alone so it can be sized up in a 58px bar. "IAG" survives only as
  infrastructure names (repo slugs, the `iag-admin-api` function, the `iag_session` storage key)
  and in two chat-1 test actions, now recorded as OWED.
- **VFO look, cloned.** Ported VFO's whole visual system to `--wig-*` CSS variables: light and dark
  palettes, Inter, the radial page halo, skeleton shimmer, scrollbars, and the inline-style-object
  convention its components use. Dark mode is signed-in only, remembered per device in
  `localStorage`. New landing page (navy gradient, single Admin card), split-screen sign-in, and a
  portal shell with a sticky navy header — bell, name, Settings, Sign Out — over a tab bar whose
  **COI ▾** dropdown carries COI Search / COI KPIs / Add COI. The decorative rosette VFO uses was
  replaced with a chevron motif echoing the WIG mark.
- **COI management.** `members` gained `coi_type` (Advisor|Accountant), `status` (Active|Lost),
  `personal_email`, `join_date`, `notes` and later `stripe_account_id`, all CHECK-constrained or
  nullable so no backfill was needed. COI Search clones VFO's advisor directory — live search,
  multi-select filter, sort, card rows with a status dot; COI KPIs clones the gradient hero with
  clickable status lenses, a type breakdown and a donut; Add COI clones the add form. Opening a COI
  gives a hero plus a **Profile ▾** pill dropdown: Profile (details + Stripe Connect card), Edit
  Profile, and Settings (Stripe Connect + a red Danger Zone with a two-step delete). Backed by
  `add_coi`, `update_coi` and `delete_coi`, which share validation wording so the add and edit forms
  cannot disagree about what a valid COI is.
- **Admin Editor.** A superadmin-only header pill opens a roster with Superadmin and Setup-pending
  chips, an Add Admin form, per-row "New setup link", and a guarded delete. Four new actions —
  `load_admins`, `add_admin`, `issue_setup_link`, `delete_admin` — each 403-gated on
  `auth.isSuperadmin` inside the handler, because the auth gate proves a session, not a rank. New
  admins are created with a NULL passcode and activate themselves through a 14-day single-use
  `/set-password` link, copied by hand from the UI. Documented end-to-end in
  `docs/flows/admin-invite.md`.
- **Settings.** VFO's exact two-card layout: Account Settings (readonly email, new + confirm
  passcode) and Appearance (light/dark). `update_passcode` takes its target from the SESSION and
  never from the payload, hashes with the same salted PBKDF2 helper as the setup flow, and revokes
  the admin's OTHER sessions on success — VFO documents client-only logout as an accepted gap, so
  this is deliberately stricter.
- **Security parity audit.** Extracted all 73 documented security requirements from the VFO docs and
  diffed them against this portal. Already matching: the four invariants, PBKDF2-210k with
  constant-time compare, 32-byte session tokens with 8h expiry and delete-on-discovery,
  sessionStorage-only sessions, the 5-per-identifier / 20-per-IP throttle checked before the
  credential lookup, CORS origin allowlist, the 2MB body cap, and Stripe HMAC with a 5-minute replay
  window. Stricter here on three counts: passcode minimum 8 vs 6, constant-time webhook signature
  compare vs `===`, and session revocation on passcode change. Two real gaps found and closed — the
  password-manager autofill trap on the login form (GOTCHA #9) and clearing portal UI state on a
  fresh sign-in. Self-service password reset stays absent, which is itself VFO parity: they exclude
  admins from that flow by design.
- **Fixed: the anon RLS probe was a check that could never fail.** The chat-1 hub documented it as a
  `curl -I` HEAD request expecting `Content-Range: */0`; HEAD actually answers `*/*` on a locked and
  an open table alike. Replaced with a GET carrying `Prefer: count=exact`, which returns a genuine
  `*/0` (GOTCHA #7). All six tables re-verified clean under the corrected command after both
  migrations.
- **Also recorded:** `.ilike()` is unsafe for email matching because `_` and `%` are LIKE wildcards
  (GOTCHA #8) — caught in review before it shipped.

## 2026-08-21 — Chat 1: bootstrap complete

The IAG Portal went from nothing to live in one chat: two repos, a Supabase project, a deployed
edge function, a public frontend on its own domain, and proven Stripe and Gmail integrations.

**A note on the one-entry rule.** This entry covers the whole bootstrap, but it did NOT ship as one
commit. Chat 1's Phase 1 produced two PRs that were merged before the repo was locked to squash-only
— and both went in as merge commits, which is what prompted that setting. The remaining work is the
`claude/chat1-build` branch in each repo, which squash-merges normally. So: three merges to `main`
per repo for this one entry, honestly recorded rather than pretended away.

- **Repos and auth.** `fabot-wealthig/iag-portal` (public, frontend) and
  `fabot-wealthig/iag-edge-functions` (private, backend). HTTPS remotes through Git Credential
  Manager, with per-repo `credential.useHttpPath true` and a global scoped
  `credential.https://github.com/fabot-wealthig.useHttpPath true`. The global one is not optional:
  `gh-pages` pushes from its own cache clone, which ignores repo-local config (GOTCHA #2). After the
  two Phase-1 merge commits, both repos were set to **squash-only** — merge commits and rebase
  merging are now disabled in GitHub repo settings.
- **Docs.** Seeded `docs/`: this changelog, `GOTCHAS.md`, the `SESSION_REFERENCE.md` hub, and the
  two hand-pasted prompts in `docs/prompts/`. The hub shipped as a skeleton and was rewritten into
  the real hub at wrap-up. Established the worktree workflow every later chat uses: work happens in
  `<repo>\.claude\worktrees\<branch>` and `main` is written only by a squashed merge — the bootstrap
  base commits being the one deliberate exception.
- **Supabase and MCP.** Project `gqznnyccridnpipjipeq`. Wired a project-scoped MCP server
  `supabase-iag` via a gitignored `.mcp.json`. All SQL and all function deploys go through MCP; the
  `supabase` CLI is deliberately never used here, because its single machine-wide login belongs to
  the VFO account (GOTCHA #5). First MCP load needed two app restarts (GOTCHA #6).
- **Schema, RLS, advisor.** Four migrations, each applied via MCP and committed as a file:
  `admin_auth`, `lock_down_rls_auto_enable`, `members`, `stripe_events`. Six public tables —
  `admins`, `admin_sessions`, `login_attempts`, `login_setup_tokens`, `members`, `stripe_events` —
  every one RLS-enabled with a deny-all policy in the same migration that creates it. An anon-key
  probe returns `Content-Range: */0` on all six, and the security advisor is green with zero
  findings. `lock_down_rls_auto_enable` exists because a Supabase-provisioned SECURITY DEFINER
  function arrived without a pinned `search_path`; it now pins it and revokes EXECUTE from `public`.
- **Edge function.** `iag-admin-api`, Deno 2, `verify_jwt: false` because authentication is custom
  and handled inside the function. Seven actions: `admin_login` (dispatched directly in `index.ts`,
  since it needs the client IP for throttling), the pre-auth pair `load_login_setup` and
  `submit_login_setup`, and the authed `ping`, `load_members`, `create_test_checkout`, and
  `admin_test_draft`. Auth is custom sessions (8h, `login_type` `"admin"`) over PBKDF2 210k salted
  passcodes, with a 5-per-identifier / 20-per-IP-per-15-min login throttle and a superadmin floor of
  `fabot@wealthig.com`. Jake's admin row was bootstrapped through the `/set-password` one-time-token
  flow. Live at version 11 — which is not a deploy count: Supabase bumps the version on secret
  writes too, and only three of those eleven bumps were code (GOTCHA #3).
- **Frontend live.** Vite + React portal (admin login, set-password, members) deployed to
  https://portal.wealthig.com via GitHub Pages from the `gh-pages` branch, custom domain through a
  Squarespace CNAME `portal` → `fabot-wealthig.github.io`, HTTPS cert provisioned and Enforce HTTPS
  on. `npm run deploy` IS the production deploy.
- **Stripe proven.** A brand-new account, wholly separate from VFO's. Test-mode and live-mode
  webhook endpoints both registered against the function URL. Signature verification is done by hand
  (HMAC with a constant-time compare) rather than via the SDK. End-to-end proof: a $5.00 test
  checkout paid with the 4242 card produced `checkout.session.completed` and
  `payment_intent.succeeded`, both verified and upserted into `stripe_events`. `STRIPE_MODE` in
  `utils/stripe.ts` is hardcoded `"sandbox"`, so live-mode events are skipped with a logged mode
  mismatch. Stripe Connect is enabled but its platform verification is still pending review.
- **Gmail proven.** Google Cloud project "IAG Portal" in the wealthig.com org with an INTERNAL
  consent screen, which is what makes the refresh token non-expiring. OAuth client minted a refresh
  token scoped to `gmail.compose`, and `admin_test_draft` created a real draft in
  `fabot@wealthig.com`'s Drafts. Drafts only — nothing is ever sent.
- **Fixed: the `apikey` CORS bug.** The frontend API client sent a Supabase `apikey` header out of
  habit, but this function is not PostgREST and its `Access-Control-Allow-Headers` allows only
  `Content-Type, Authorization` — so every call died at preflight with an opaque browser error. The
  header was removed from `src/lib/api.js` (GOTCHA #4).
- **Changed: passcode minimum raised to 8** characters, up from the 6 that VFO uses.
