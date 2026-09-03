# CHANGELOG

Narrative history of the IAG Portal, **newest entry first**.

Format: `## YYYY-MM-DD — headline`, followed by bullets describing what changed and why.

One change = one entry = one squashed commit on `main`. A change may span several chats; it still
gets exactly one entry. Superseded facts move here out of `docs/SESSION_REFERENCE.md` when the hub
is updated, so the hub only ever holds current state.

## 2026-09-03 — Chat 8: payment success landing, overview panels, untested paths

- **`/pay?done=1` is a branded landing now, not a bare card.** The Stripe success return carries no
  token, so there is nothing client-specific to show — it gets a standalone WIG page instead of the
  split-panel auth shell: `src/components/shared/TokenShell.jsx`, the WIG port of VFO's `TokenShell`
  (58px navy-gradient header bar with the logo, centered white card with the 4px accent strip), holding
  a green check, "Payment successful", and a "What happens next" panel that promises the three things a
  client actually waits on — the transfer clearing in 2 to 4 business days, a confirmation email, then
  the invoice and receipt. `AuthShell` also grew optional `headline` / `tagline` props so the
  public token pages stop telling clients they are looking at the "team portal": `/pay` and
  `/payout-setup` each pass their own line, `/login` and `/set-password` keep the defaults.
- **Three read-only overview actions, and one place that decides where a client has got to.**
  `load_all_payments`, `load_client_overview` and `load_coi_overview` take the dispatch table from 37 to
  **40** entries (41 actions with `admin_login`). All three live under `actions/overview/`, and all three
  join clients, members, motherships and strategies in code rather than through nested PostgREST embeds —
  several flat reads beat teaching the query language two hops. The per-client summary is a single shared
  helper, `overview/shared.ts`'s `summarizeClientPayments`: the COI panel and the client panel answer "where
  is this client up to?" about the SAME clients, and two independent derivations is exactly how one panel
  starts calling a payment finished while the other still shows it waiting. `next_action` comes from
  `buildPaymentSteps` — the very step machine the detail screen draws — rather than a second reading of the
  same columns, because "what is next" is only meaningful if it agrees with the pipeline the admin then
  opens; a step marked inapplicable is skipped rather than reported as work waiting. Payments are read with
  `select "*"` for the same reason: the step machine reads the hard-cost ticks and their timestamps, and a
  narrowed select would make every payment look stalled at the first fee. **The `checkout_token` never
  leaves** — the summary shape has no field for it and no overview panel offers a pay link, exactly as in
  `load_client_payments`; `all_payments` spends it composing `pay_url` and drops it. `coi.ts` reduces
  `stripe_account_id` to a boolean and returns the id to nobody. All three went live **mid-session as
  `iag-admin-api` v24** (`scripts/deploy-function.sh`, HTTP 201) rather than at the wrap-up: the panels below
  read from them and Jake tests against the real project, so an undeployed backend would have made every new
  screen look broken. Post-deploy smoke held — the public pay handler answers 200 `state: "invalid"` on junk,
  authed actions 401 without a session.
- **The three placeholder panels are real screens now, and the overview names are doors.** `CoiOverviewPanel`
  (every COI with firm, level, joined, status, client count, paid-of-total and revenue share to date, each
  row expanding into its own client list) and `ClientOverviewPanel` (ONE ROW PER CLIENT — Jake's call — with
  the COI, the latest strategy, the payment stage, the next action and its owner) are the WIG ports of VFO's
  Member and Client Overview: navy/blue grid cards, a 10px uppercase header band on `var(--wig-input)`, an
  `overflowX` wrapper over a min-width, pills for status. Neither says anything about a payout ACCOUNT — an
  account id is not proof of onboarding, only the live Connect status call is. `AccountingPaymentsPanel`
  lists every payment newest-first and opens the same `PaymentDetail`, taking over the whole area the way
  the client's own Payments tab does. To get there without a second copy of the list, `PaymentRow` and its
  grid moved out of `CoiClients.jsx` into `src/components/PaymentsGrid.jsx`, which the client tab renders
  unchanged and the accounting list renders with `showClient` for a leading Client / COI column; and VFO's
  `useHeaderSort` / `sortByColumn` / `SortHeader` were ported into `ListFilterKit.jsx` (`--wig-*` tokens,
  `#1D64A8` for VFO's blue) so a clicked column header overrides the dropdown sort and a dropdown change
  resets it. Every name on an overview row is a `NameLink` shortcut — the rows do not navigate on click —
  and each one seeds a **return marker**: `openCoiProfile(n, { returnTo })` and
  `openClientProfile(n, id, { clientTab, returnTo })` in `Portal.jsx` write `wigSelectedCoi` /
  `wigSelectedClient` / `wigClientFeatureTab` / `wigCoiReturnTo` after `goToTab` has cleared the sub-state,
  and `returnToOrigin(returnTo)` sends the back link to whichever of the four origins it names. The two new
  client keys are read ONCE in a `useState` initialiser that removes them in the same breath, so a later
  remount lands on the list like any other way in — the same discipline the mothership round trip already
  used.
- **The lists are real tables now, and every "Loading..." is a skeleton.** `CoiOverviewPanel`,
  `ClientOverviewPanel` and `PaymentsGrid` each render a `<table>` on `tableLayout: 'auto'` inside their one
  card, in place of the CSS grid and its min-width wrapper: the browser measures every column against its own
  content and shares the leftover width across all of them, so no single stretchy column can hoard the slack
  and open a gap beside a short value, and the header always sits over the cells it names. Every column is
  left-aligned, money included. The Client Overview row order follows the COI panel's — Client # · Name ·
  Status · COI · Strategy · Payments · Stage · Next action · Owner — and the payments list **drops its "Copy
  pay link" column**: the link is still on the payment's detail screen, one click away through the row, and a
  list is for scanning rather than for firing actions from. Alongside that, VFO's skeleton primitives are
  ported into `src/components/shared/Skeleton.jsx` (`Skeleton`, `SkeletonText`, `SkeletonRow`, `CardShell`,
  `SkeletonCard`, `HeroSkeleton`, `ListHeaderSkeleton`, `SearchFilterSkeleton`, `TableSkeleton`,
  `ProfileTabSkeleton`, `TokenFormSkeleton` on `--wig-*` tokens and the `.wig-skeleton` shimmer that had been
  sitting unused in `styles.css`), with the page-shaped compositions in the same file — `CoiOverviewSkeleton`,
  `ClientOverviewSkeleton`, `PaymentsListSkeleton`, `PaymentDetailSkeleton`, `DirectoryListSkeleton`. Every
  "Loading..." string is gone from the portal. The rule they follow is VFO's: whatever the page already knows
  — the hero, the tab pills, the section eyebrow, the Start New Payment card — renders instantly, and only the
  part still waiting on data is drawn as a skeleton shaped like what is about to arrive.
- **Phase 3 was not started and carries over.** It is the run against real data that the OWED list has been
  asking for: sweep legs B-F, and `rev_paid`'s `Awaiting Payout Account` and `Failed` branches, which no
  live payment has ever taken. The plan is agreed — a second test COI inserted by SQL at `1.1.9999`, the
  slot the allocator reserves, with no payout account for the held path and a bogus account id for the
  failed one; legs B-F exercised by resetting each latch on a test row; the zero-pool guard by a DevTools
  fetch. Nothing about it is blocked; the chat simply ran out before it began.

## 2026-09-03 — Chat 7 (continued): nightly sweep (Phase G)

Phase F finished the money; Phase G finishes the FLOW. Everything the pipeline does happens inside a
webhook or a button press, and both can be interrupted — a Gmail outage swallows a draft, a COI has no
payout account yet, a client simply does not pay. One new PUBLIC action, `run_payment_sweep`, fired
nightly by pg_cron at 10:00 UTC, walks seven legs and re-offers every stalled row to the SAME latched
helper the live path uses. One new action (37 → 38), three migrations (20 → 23), four new `.ts` files,
no new function secret but one new Vault secret, and the backend went **v22 → v23**, deployed live
this session. Full walk-through in `docs/flows/nightly-sweep.md`.

- **The sweep calls nothing of its own.** Every leg hands rows to `runRevenueShare`,
  `draftPaymentConfirmation`, `draftPaymentInvoiceReceipt`, `draftPaymentRequestEmail` or one of the two
  new reminder helpers, each of which owns its column and refuses to act twice. The sweep decides only
  WHICH rows to offer; the helper decides whether anything happens. That is the entire safety argument,
  and it is why the doc's first trap is "never add a leg that writes a state a helper owns" — a second
  writer on `rev_paid` or `invoice_email_sent` would undo it in one commit.
- **Two new reminders, both two BUSINESS days late.** A pay link emailed on a Friday afternoon has not
  been ignored by Sunday morning, so `utils/business-days.ts` ports VFO's `businessDelayCutoffIso`
  verbatim — walk back N weekdays in UTC first, subtract any fractional part as hours after, which is
  what keeps a larger delay from landing later than a smaller one. Latches
  `client_payments.payment_reminder_sent_at` and `members.connect_reminder_sent_at`; neither helper has a
  force flag, because nothing automated should ever raise a second reminder.
- **A reminder carries the SAME link, over the SAME markup.** `paymentLinkButton` moved out of
  `request-email.ts` and `connectSetupButton` into `utils/connect-setup-token.ts`, and the original
  senders now use them too, so the follow-up cannot drift into looking like a second, competing request.
  The COI reminder reuses `ensureConnectSetupToken` — the durable token, unchanged since the first email.
- **The COI leg asks Stripe, not the roster.** `stripe_account_id` proves an account was created and
  nothing more, so each candidate gets a live `GET /v1/accounts/{id}` and is chased only when
  `capabilities.transfers` and `payouts_enabled` say it still cannot be paid. A COI who is already payable
  gets the stamp WITHOUT an email — otherwise a finished row is re-queried at Stripe every night forever —
  and a failed Stripe read gets no stamp at all, because we do not know the answer.
- **`admin_sessions` finally has a cleanup.** Leg G deletes expired sessions, plus `login_attempts` and
  spent `login_setup_tokens` older than 30 days (the throttle window is fifteen MINUTES; the rest is audit
  headroom). It never touches `connect_setup_tokens`, `stripe_events` or `document_numbers` — durable by
  design, the replay guard, and the promise that an issued number is never reissued. That WATCH item is
  gone from the hub.
- **The cron job reads its bearer from Vault at run time.** VFO's `accountant-sweep.sql` pastes the
  service-role key into the schedule, which puts the secret in the repo AND in `cron.job` forever; this
  one selects `iag_service_role_key` out of `vault.decrypted_secrets` inside the job body, so the
  committed file names only the secret and Jake sets the value himself in the Dashboard. A missing secret
  sends an empty bearer, gets the sweep's 401 and does nothing — a no-op, not a half-run. That 401 is the
  only one outside the two credential checks, `admin_login` and `middleware/auth.ts`, and like both of them
  it fires only for a bad credential — so GOTCHA #12 does not apply: no browser can hold a valid bearer,
  and a bad credential is exactly what #12 says SHOULD be a 401.
- **What VFO does that we deliberately did NOT copy.** VFO runs six sweeps; most of what they chase has no
  IAG counterpart. Quarterly charges, membership dues, check reminders, growth plans and personal
  reminders are all VFO product surface we do not have. The 96-hour "bell tier" — a second escalation that
  inserts a notification row — was assessed and dropped because the IAG bell is still visual-only, with no
  table behind it. And the 14-day auto-decline was dropped on principle: VFO closes a stalled onboarding
  by writing `Auto-Declined`, but an unpaid client fee is a debt, not a decision, and nothing automated
  should ever write it off. What survived is the payment-link reminder tier and the sweep skeleton itself.
- **Proved live through the cron command path — which discharges one OWED and opens a narrower one.**
  After GOTCHA #17's key-format fix the job body was run by hand three times: a dry run (candidates
  listed, nothing written), a real run, and a replay. The real run drafted the test payment's
  revenue-share email (leg A) and purged 20 expired `admin_sessions` (leg G); the replay found nothing
  to do, which is the latches doing exactly what the whole design rests on. The hub's "no sweep leg has
  yet run against real data" is therefore DISCHARGED. What replaces it is narrower and still owed: legs
  **B-F** — confirmation, invoice/receipt, request-email and the two reminders — have never had a real
  row to work on, and neither have `rev_paid` `Awaiting Payout Account` or `Failed`, since only
  `succeeded` and `Not Due` have run. The zero-pool guard in `start_client_payment` is code review only.

## 2026-09-03 — Chat 7: automatic COI revenue share (Phase F)

Phase F is the end of the money. The Stripe webhook already booked the payment and issued the
paperwork; now the same clearing moment stamps the whole revenue waterfall onto the `client_payments`
row and TRANSFERS the COI's share to their Stripe Connect account, with a fourth Gmail draft telling
them so. The row is written end to end — Phase C the front half, D the checkout block and
confirmation, E the numbered invoice and receipt, F the nine waterfall columns plus `rev_paid`,
`rev_transfer_id`, `rev_completed_at` and `rev_email_sent_at`. One new action (36 → 37), two
migrations (18 → 20), three new `.ts` files, no new secret, and the backend went **v20 → v21**, then
**v22** for the email layout below — both deployed live this session. Full walk-through in
`docs/flows/client-payment-request.md`.

- **Stamp before money.** `runRevenueShare` writes all nine waterfall columns FIRST, in one update
  conditioned `.is("available_pool", null)`, and every later run reuses what it finds — it never
  recomputes. That ordering is the design, not a convenience: a COI's level moves and a strategy's
  rules are editable in the portal, so a retry that re-snapshotted would pay a share the payment was
  never assessed for, and a transfer sized by numbers nobody kept is a payout with no record of why.
  Losing the stamp claim means another delivery got there first, so the row is re-read, not
  overwritten. `coi_level_at_payment` and `coi_share_pct` finally earn the comment the Phase-C
  migration gave them.
- **The arithmetic moved into `utils/revenue-waterfall.ts`** — pure, IO-free, and a step-for-step
  mirror of `computePreview` in `ClientPaymentForm.jsx`: `round2` at every stage, the admin fee off
  the OFFSET, the flat legal letter, then ERT's percentage off WHAT REMAINS. The admin is shown a
  figure before the client is ever asked for money, so the server has to arrive at the same one, and
  keeping both in one shape means they can be compared by reading them side by side. Numbers from
  PostgREST arrive as strings and a NaN reads as 0, so one unset rule cannot poison the column below
  it.
- **`rev_paid` has four values and one owner.** `succeeded` and `Not Due` are terminal; `Awaiting
  Payout Account` and `Failed` are NOT, deliberately, and leave `rev_completed_at` null — the client
  paid in full and the share is still owed, so it must not read as finished. (VFO's tax pipeline
  learned this the hard way: a due share with no payout account used to fall through to the terminal
  "N/A — No Share Due" and was never paid, never alerted, never retried.) `processing` is the
  in-flight claim. `actions/payments/revenue-share.ts` is the only writer of any of them.
- **Two guards on the transfer, because one is not enough.** The CLAIM moves `rev_paid` to
  `processing` conditioned on the states it expects and asks with `select` what it changed, which
  stops two concurrent webhook deliveries. The `Idempotency-Key` — `revshare-client-<payment_id>`,
  deterministic, never a uuid — stops a transfer that COMMITTED but whose response was lost from
  being created twice on the retry, which the claim cannot help with because from our side that call
  never finished. `stripeFetch` grew one optional header for it and nothing else. The transfer also
  carries `source_transaction` (the PaymentIntent's `latest_charge`), so the payout is traceable to
  the charge the client paid on — but a PaymentIntent that cannot be read is logged and the transfer
  goes ahead without it, because holding a COI's money over a diagnostic lookup is worse.
- **The destination is checked live, not inferred.** `GET /v1/accounts/{id}` and pay only on
  `capabilities.transfers === "active"` AND `payouts_enabled === true` — an id on `members` proves an
  account was created, never that the COI finished onboarding, which is the same reason
  `coi_connect_status` exists. Anything else holds. Note that a held or failed share still answers
  ok: it is an outcome, not a request failure, and a Stripe retry of the clearing event would change
  nothing.
- **A fourth Gmail draft, latched on `rev_email_sent_at`,** from new template row
  `COI_PAYOUT` / `coi_revenue_share` (`send_mode` false, `["RECIPIENT"]`); `email_templates` now holds
  FIVE rows. It is the one payment email addressed to the COI rather than the client, so `RECIPIENT`
  and `COI` resolve to the same address and `CLIENT` is offered for a Cc. `[COI_LEVEL]` and
  `[SHARE_PCT]` read the SNAPSHOT columns, so the email explains the figure that was actually
  transferred. It is drafted only after a transfer succeeds — never for a share that was never due.
- **The COI email was then rebuilt as a WIG-styled layout** (migration 20,
  `20260903130000_coi_revenue_share_email_layout.sql` — an UPDATE in full against the applied seed,
  with `revenue-share.ts`'s fallback constants moved in step). It carries the same information in the
  same order as VFO's member revenue-share email, so a COI who sees both does not have to learn two
  shapes, but none of its styling: a white card on a light ground with a slim navy top rule and an
  orange eyebrow, hairline detail rows, a green received pill and a green-accented share card — a
  sibling of the invoice and receipt PDFs rather than a recolour of somebody else's template. It also
  now quotes the RECEIPT NUMBER (new `[RECEIPT_NUMBER]` token, `receipt_number` added to the literal
  select), which is what lets the COI tie the share to the paperwork the client already has.
- **`retry_revenue_share`** (the one new action) finishes a share the webhook could not, and covers
  all three ways it can be unfinished — held, failed, or transferred with the email undrafted —
  because they are one sequence and the helper decides how far to get. 400 unless the payment
  cleared, 400 on `Not Due`, 400 once it is both transferred and emailed; past those, `force: true`
  always, which the idempotency key makes safe. The payment screen grows **Retry revenue share** and
  **Send revenue share email**, the payments list grows orange "Revenue share held" / "failed" lines
  beside "Invoice not sent", and the detail card now shows the pool, the level, the share, the net
  profit pool, the status and the transfer id.
- **`start_client_payment` refuses a fee that leaves nothing to share.** Before the row is inserted
  it loads the client's COI and the strategy's five rule columns, runs the same `computeWaterfall`,
  and answers 400 "The client fee must cover the hard costs and the processing fee." on a pool of
  zero or less. The form already blocks it, which is exactly why the server does too: the preview is
  DISPLAY ONLY and never trusted, and a fee the hard costs swallow is a typed amount that is wrong —
  a missing digit, or the offset and the fee the wrong way round. Catching it now costs a 400;
  catching it at clearing means a client has already paid.

## 2026-09-02 — Chat 6: payment booking, confirmation, invoice and receipt (Phases D and E)

Phase D closes the loop money opened in Phase C; Phase E puts the paperwork on the end of it. The
Stripe webhook stops being a recorder and becomes a BOOKER: it writes the payment onto its
`client_payments` row, drafts the client's confirmation, and — the moment the money actually CLEARS —
issues a numbered invoice and receipt as PDFs attached to a third draft. All of it survives Stripe
delivering the same event twice. Beside it, the portal grows a real payment screen: the client's
Payments tab is an aligned list whose rows open a detail view with a server-built progress checklist.
Three new actions in Phase D and none in Phase E (33 → 36), four additive migrations (14 → 18),
eleven new `.ts` files (51 → 62), one new secret, and the backend went **v17 → v18** (Phase D code)
→ **v19** (setting `HTML2PDF_API_KEY`, which bumps the version by itself — GOTCHA #3) → **v20**
(Phase E code). Full walk-through in `docs/flows/client-payment-request.md`.

- **The webhook books the payment.** `router/webhooks.ts` still owns only the envelope — signature,
  replay window, mode guard, `stripe_events` upsert — and calls `bookClientPayment` once the raw
  event is durably on file, so a booking bug can never lose the payload it choked on. The call is
  **in process, not over HTTP**: the auth gate would reject a service-role bearer, so a self-call
  would be a 401 dressed up as a chain. Routing is by the metadata Phase C deliberately wrote twice —
  `pipeline=CLIENT_PAYMENT` plus `payment_id`, on both the session and the PaymentIntent — and
  anything else is logged and dropped, so the booker is safe to leave wired up while other Stripe
  work lands beside it.
- **Two branches, one row.** `checkout.session.completed` cross-checks the session's `checkout_token`
  against the row (they can only differ if the link was reissued, in which case that session is
  billing a superseded request), reads the PaymentIntent with `expand[]=payment_method`, and writes
  the checkout block: `payment_status` — **"processing" for ACH**, because an ACH session completes
  with the money still in flight, "succeeded" for a card, which settles inside the session —
  `payment_intent_id`, `payment_method_type`, `acct_last4`, `payment_date`, `confirmation_status`
  "Confirmation Needed". An unknown method is treated as ACH: claiming money has cleared when it has
  not is the more expensive mistake. `payment_intent.succeeded` is the clearing days later —
  "processing" → "succeeded", `payment_date` re-stamped, only the still-null columns backfilled so a
  thinner later read cannot erase the digits the confirmation quotes — and, because Stripe orders
  nothing, it books the row in full itself if it arrives first.
- **Idempotence is a claim, not a hope.** Every write names the status it expects to replace
  (`.is("payment_status", null)`, `.eq("payment_status","processing")`) and asks with `select` which
  rows it actually changed; the loser of that race stops rather than chaining a second confirmation
  email. Which is why the ONLY 500 is a failed `client_payments` read or write — a read that failed
  cannot even tell us whether the payment is booked, so Stripe should retry. A foreign pipeline, an
  unknown row, a token mismatch, an already-booked row, a lost claim, a failed Stripe read and a
  Gmail outage all answer 200, because retrying those forever would change nothing and the raw event
  is already on file for a human to replay.
- **A confirmation email that cannot be sent twice.** New template row `CLIENT_PAYMENT` /
  `client_payment_confirmation` (draft, `["RECIPIENT"]`, `send_mode` false — nobody should be able to
  tell a client their money arrived without a human having seen that it did); `email_templates` now
  holds THREE rows. Tokens `[First Name]`, `[Client Name]`, `[STRATEGY]`, `[TOTAL_FEE]` and
  `[ACCT_LAST4]`, which falls back to `"----"` — obviously unknown, rather than a plausible account
  number. The exactly-once guarantee is a LATCH inside the helper (`confirmation_status === "Sent"`),
  not a property of its caller, and the helper never throws: a Gmail failure leaves the row on
  "Confirmation Needed", the Payments tab shows an orange "Confirmation not sent", and an admin
  resends. A stamp failure after a successful draft is logged only — surfacing it would draft twice.
- **The request email moved into `actions/payments/request-email.ts`.** `start_client_payment` and
  the new resend both call it, so an original and a resend are byte-identical, and the
  `payment_email_sent_at` stamp — the thing the resend guard reads — is written inside the helper
  rather than by whichever caller remembered.
- **Three new actions (33 → 36).** `load_client_payment` returns one payment plus a server-built
  ordered `steps` list. `update_payment_step` ticks `admin_fee` / `legal_fee` / `processing_fee`
  against a whitelist that names the two columns it interpolates — and is **COSMETIC**: those costs
  are settled outside the portal, the tick is an acknowledgement, and nothing downstream reads
  `*_done`. `resend_payment_email` re-drafts either email (`kind` `request|confirmation`) behind the
  same `already_sent_at` + `force` guard as `coi_stripe_connect_request`; a `request` is refused once
  `payment_status` exists, because the link is spent and mailing a dead button is worse than mailing
  nothing. `PUBLIC_HANDLERS` stays 5, `AUTH_HANDLERS` is 30, the dispatch table reads 35 and the
  action count is 36 with `admin_login`.
- **The step machine is server-side, and there is exactly one.** `utils/payment-steps.ts` turns a
  `client_payments` row into the ten-step pipeline in the real order of events — request emailed,
  client submitted, funds cleared, confirmation, invoice and receipt, the three hard costs, COI
  revenue share, revenue-share email — each carrying `done`, `at`, `owner`, `manual`, `applicable`
  and, on the money steps, an `amount` that is null until Phase F. Cloned from VFO's tax step
  builder for the same reason: what "done" means is a property of the row, and two readers deriving
  it independently is how a screen starts lying about whether a client has been paid.
  `update_payment_step` answers the same `{ payment, steps }` shape from the same loader, so the
  screen re-renders from server truth instead of patching its own copy.
- **The Payments tab is a real list, and rows open a real screen.** An aligned CSS grid under a
  column header (Date | Strategy | Offset | Fee | Method | Status | Copy pay link), whose whole row
  is clickable. `PaymentDetail` REPLACES the client hero and pills exactly as an open client replaces
  the COI's — the same nested takeover, one level down — with its own hero, a "← Back to payments"
  `BackLink` under it, a Progress card rendering the server's steps (a done mark, or a real checkbox
  on the three manual ones) and a Details card carrying the email actions: Send payment email, Resend
  payment email, Resend confirmation. The status pill (Awaiting payment / Email not sent / Processing
  / Succeeded in green) and `methodText` are exported from `PaymentDetail` so the row and the detail
  can never disagree, and the shared `Field` moved into `TrackKit` beside `BackLink` and `TrackHero`,
  where CoiSearch, CoiClients and PaymentDetail all read it from.
- **Two migrations (14 → 16), both applied via MCP and committed.** `client_payment_confirmation`
  seeds the template row; `leos_explainer_ert_base` rewrites step 3 of the seeded LEOS explainer to
  say the percentage is taken **from what remains after the hard costs, not from the whole client
  fee** — written as an UPDATE against the live row, and set in full rather than patched with
  `replace()`, so the text in the file is the text in the database. `TaxStrategiesPanel`'s step-3
  card says the same thing now. That clears the OWED item raised in chat 5; Phase F still has to
  implement the rule server-side. Advisor re-run: `"lints": []`, unchanged. Still 12 tables, no new
  tables and no RLS change, so the anon probe is unchanged.
- **A payment that clears now issues an invoice and a receipt.** Every route to
  `payment_status === "succeeded"` — the normal `payment_intent.succeeded` clearing, the out-of-order
  branch, and a card that settled inside checkout — chains `draftPaymentInvoiceReceipt` in process,
  the same way the booking chains the confirmation. For an ACH the two emails are days apart on
  purpose: the confirmation says the transfer started, the invoice and receipt say the money arrived.
  The exactly-once guarantee is a second LATCH, `invoice_email_sent` (+ `invoice_email_sent_at`),
  read inside the helper; the helper refuses outright while the payment is still "processing",
  because an invoice states what was charged and a receipt states that it was paid, and money in
  flight supports neither. Like the confirmation helper it never throws — its caller only has to
  answer Stripe 200.
- **Numbers live in a table, not a sequence — and the insert IS the allocation.** New
  `document_numbers` (uuid id, `type` CHECK `invoice|receipt`, UNIQUE `number`, `client_id` →
  `clients` ON DELETE CASCADE, `payment_id` → `client_payments` ON DELETE SET NULL, an index on
  (`type`, `client_id`), deny-all RLS in the same migration). `allocateDocNumber` counts the rows of
  that type, adds one, zero-pads to four and INSERTS; a `23505` means the number was taken, so it
  bumps and retries. A count alone would collide in two ways a sequence would never notice — a
  `client_number` reused by a renumbered test client, and two payments clearing in the same instant.
  Invoices are numbered on a GLOBAL count (`INV-<client_number>-NNNN`, one continuous business-wide
  run), receipts PER CLIENT (`REC-<client_number>-NNNN`), matching the VFO scheme. Each number is
  written back to the payment row the INSTANT it is allocated, before either PDF is rendered, so a
  retry or a forced resend reuses it rather than burning a second one — a resend never re-allocates.
  And a number is never reissued: deleting a payment leaves its `document_numbers` rows behind with a
  null `payment_id`, so the count still knows the number is spent.
- **Two PDFs, rendered by a service.** `utils/payment-documents-html.ts` builds both documents as
  standalone inline-styled HTML — the same pair VFO issues for a tax engagement (header band,
  From / Bill To row, details panel, schedule table, total band, footer), rebranded and simplified to
  what a client fee is: navy `#0F355A` invoice with `#1D64A8` eyebrows, green `#1b9254` receipt, From
  "Wealth Innovation Group / portal.wealthig.com", the client by name with `Ref: <client_number>` and
  their email, exactly one schedule row and it always reads `✓ Paid`, and on the receipt "Via ACH
  Bank Transfer · Account ending ****<last4>" with a Date Received of `payment_date` while the
  document's own date is today. Every client string is HTML-escaped. `utils/html2pdf.ts` POSTs each
  one to `api.html2pdf.app` and hands back base64. There is no PDF library because there is no room
  for one in the Deno edge runtime, and there is exactly one file that knows the endpoint and the
  key. **New secret `HTML2PDF_API_KEY`** (value set by Jake): read at call time so a rotation needs
  no deploy, never logged — and the service's error BODY is never logged either, because it can echo
  the request and the request carries the key. That secret is what v19 was, and its NAME is now in
  `supabase/.env.local.template` beside the other seven — names only, never a value.
- **Gmail drafts can carry attachments now, and Gmail attachments leave PARKED.** `draftGmail` gained
  an `attachments` option: with any, the message becomes `multipart/mixed` — the HTML body first,
  then one `application/pdf` / base64 part per document, filenames `<INV>.pdf` and `<REC>.pdf` so the
  client can match the sentence to the files. With none, the MIME is byte-identical to what it was,
  which is what made this safe to add underneath two working emails. Still drafts only; still no send
  path anywhere in this system.
- **One new template row and one new `kind`.** `CLIENT_PAYMENT` / `client_payment_invoice_receipt`
  (draft, `["RECIPIENT"]`, `send_mode` false — it carries the client's numbered financial records, so
  nobody should be able to mail it without seeing what is attached); `email_templates` now holds
  FOUR rows. Tokens `[First Name]`, `[Client Name]`, `[STRATEGY]`, `[TOTAL_FEE]`, `[INVOICE_NUMBER]`,
  `[RECEIPT_NUMBER]`, with fallback constants mirroring the seed. Phase E added NO action:
  `resend_payment_email` simply grew a third `kind`, `invoice_receipt`, refused with 400 unless the
  payment has cleared, 503 when Gmail is unreachable and 502 otherwise, behind the same
  `already_sent_at` / `force` prompt as the other two. The action count stays 36.
- **A PDF or Gmail failure is not a lost payment.** The row stays "succeeded" with
  `invoice_email_sent` false and its numbers already stamped; the payments list shows an orange
  "Invoice not sent" under the green pill (stacked with "Confirmation not sent" when a payment owes
  both), and the detail screen's **Send invoice and receipt** button re-runs the helper on the
  numbers it already has. Once they have gone the button reads **Resend invoice and receipt**.
  `PaymentDetail`'s Details card grew Invoice number and Receipt number, the success message names
  them, and `load_client_payments` now returns `invoice_email_sent` / `invoice_email_sent_at` (with
  both numbers) so the list can draw that line without a second read.
- **Two more migrations (16 → 18), both applied via MCP and committed.** `document_numbers` and the
  invoice/receipt template row. The database is now **13 public tables**, so the anon probe covers 13
  — re-run today, `Content-Range: */0` on every one — and the advisor is still `"lints": []`.
- **Proven end to end today on Test Client 1.2.9999-001.** A manual send on an already-cleared row
  produced the 0001 pair; a forced resend re-drafted the same email with the SAME two numbers; then a
  fresh payment run start to finish produced the confirmation and, on clearing, the invoice and
  receipt (the 0002 pair) automatically, with no manual step. The three test rows were deleted
  afterwards — and the 0001 numbers are still on file, unlinked, which is the never-reissued rule
  doing its job.
- **GOTCHA #16: a supabase-js `.select()` must be ONE string literal.** Wrapping a long select with
  `"a, b, " + "c"` widens its type to `string`, collapses the row type to `GenericStringError` and
  turns every property read into a TS2339 — 32 at once, none of them pointing at the select.
  `load-client-payments.ts` gets away with a concatenated select only because its rows are consumed
  as `any`.
- **Superseded hub facts, recorded here.** The OWED item "no resend payment email action" is gone —
  `resend_payment_email` is that action. The OWED item "Phase C frontend is NOT deployed" was stale:
  Phase C shipped as `live-5-client-payments`, `/pay` and the Payments tab are live, and what is now
  worktree-only is the Phase D frontend (the list, the detail screen, the reworded step 3), which
  goes live at the next `npm run deploy` — as does Phase E's (the two number fields, the invoice
  buttons and the "Invoice not sent" line). The OWED item about the unstated ERT base is resolved by
  the migration above. `client_payments` now has Phase D's columns written — `payment_status`,
  `payment_intent_id`, `payment_method_type`, `acct_last4`, `payment_date`, `confirmation_status`,
  `confirmation_sent_at` and the three `*_done`/`*_done_at` pairs — and Phase E's `invoice_number`,
  `receipt_number`, `invoice_email_sent` and `invoice_email_sent_at`, leaving only the waterfall
  amounts and `rev_*` to Phase F. PARKED lost Gmail attachments; the hub's Secrets list gained
  `HTML2PDF_API_KEY`. And the hub's GitHub bullet dropped
  the history behind squash-only: both repos disabled merge commits and rebase after two Phase-1 PRs
  went in as merge commits. Ripple: the backend README's "at 51 files" — the reason MCP
  `deploy_edge_function` no longer fits — now reads 62; the hub's Portal UI bullet was reflowed back
  to the file's wrap width, no fact changed; the SECURITY INVARIANTS box is re-confirmed UNCHANGED at
  this wrap-up, all four invariants identical, wording tightened only.

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
