# FLOW — The nightly sweep

How the payment pipeline finishes what it started. One PUBLIC action,
`run_payment_sweep`, fired by pg_cron + pg_net at 10:00, 12:00 and 14:00 UTC (v: 2026-09-24, migration 53), working through eighteen legs in a fixed
order — **R, A, T, H, P, Y, Z, B, C, D, E, E2, K, I, J, F, G, V** (v: 2026-10-07; R, E2, I and J are chat 17's
Phase 1, K its Phase 2 refunds, V its Phase 3 client vault; T, P, Y and Z the internal team share). It
spans no screen of its own — there is no button — though since chat 17 its heartbeat feeds the
superadmins' bell (*The heartbeat*, below); nearly every leg hands rows straight to the helpers the
live path already uses.

**It calls nothing of its own.** Every leg offers rows to a LATCHED helper — `reconcilePayment`,
`runRevenueShare`, `runHardCostTransfers`, `draftPaymentConfirmation`, `draftPaymentInvoiceReceipt`,
`draftPaymentRequestEmail`, `draftPaymentReminder`, `draftRefundEmail`, `draftPaymentFailedEmail`,
`draftConnectReminder`, `draftPayeeConnectReminder`, `refileDocumentsToVault` (whose latch is the
two `*_vault_path` columns), or `notifyPaymentEvent` with its dedupe — and
each of those owns its column and refuses to act twice. The sweep decides only WHICH rows to offer;
the helper decides whether anything happens. That is why it can run every night forever and never
double a transfer, a draft or a document number. **Two qualified exceptions, both deliberate:** the
sweep WRITES its own bookkeeping columns — `stripe_checked_at`, `sweep_a_at`, `sweep_h_at`,
`payout_followup_at`, when it last offered a row, which no helper reads — and leg R can end in a
`payment_status` write, but only through `reconcilePayment`, which books through
`book-client-payment.ts`, the sole writer.

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

Each leg selects **at most 50 rows** (leg V at most 10, `VAULT_LIMIT`) and processes them **sequentially** — a Stripe transfer and a
Gmail draft are real network calls, and the cap is what stops a backlog running the function past its
wall clock. Whatever is left over is picked up tomorrow night, because nothing here consumes its own
candidates. Every row runs inside its own `try`/`catch` and reports `{ leg, id, outcome, detail? }`
into `results`: one unpayable COI must not cost the other forty-nine their turn.

`cutoff2 = businessDelayCutoffIso(2)` — and since chat 17 `cutoff3`, `cutoff5` and a week-ago day —
are computed **once** for the run, so the reminder and follow-up legs cannot straddle a midnight and
disagree about what "two business days ago" means.

**A candidate query that ERRORS is recorded, not swallowed** (v: 2026-09-29). It used to read as
"nothing to do"; now `legError` records `{ leg, id: "query", outcome: "error", detail }`, and those
entries are what the heartbeat stores.

| # | Leg | Predicate | Calls |
| --- | --- | --- | --- |
| R | `reconcile` | FIRST, and regardless of Gmail. Two queries, `funded_by = 'client'` both: **in flight** — `payment_status = 'processing'` AND `payment_date` more than six days ago (an ACH clears in 2–4 business days, so Stripe has an answer); **open** — `payment_status` null OR `failed`, AND `stripe_customer_id` and `payment_email_sent_at` not null, AND `created_at` within 120 days, AND `stripe_checked_at` null or more than six hours ago. Each ordered by `stripe_checked_at` ascending, NULLs first; every row offered is stamped `stripe_checked_at`. | `reconcilePayment(id)` → `booked` / `failed` / `unchanged` / `error` (`flows/client-payment-request.md`, *When the money does not arrive*) |
| A | `revenue_share` | **cleared, either way** — (`funded_by = 'client'` AND `payment_status = 'succeeded'`) OR (`funded_by = 'provider'` AND `revenue_received_at` not null) — AND (`rev_paid` is null OR in `Awaiting Payout Account` / `Failed` / `processing` OR (`= 'succeeded'` AND `rev_email_sent_at` is null)). **`Via ERT` is not on that list, so a Path A share is never a candidate** — nothing here to re-attempt, since the portal moved no money and the outstanding item is an admin's `ert_share` tick. | `runRevenueShare(id, { force: rev_paid === "processing" })` |
| T | `team_shares` | `available_pool` not null (the waterfall is stamped: it cleared) AND `team_shares_at` null. `runRevenueShare` writes the shares in process, so this only finishes a run that died between the waterfall and the shares (chat 18, `flows/internal-team-share.md`). Moves no money; runs straight after A. | `stampTeamShares(id)` → `written N` / `already` / `not cleared` / `error` |
| H | `hard_costs` | `funded_by = 'client'` AND `payment_status = 'succeeded'` AND `available_pool` not null AND ((`legal_fee_payee_id` not null AND `legal_fee_waived` false AND `legal_fee_paid` null or ≠ `succeeded`) OR (`admin_fee_payee_id` not null AND `admin_fee_paid` null or ≠ `succeeded`)) — the null spelled out beside `neq`, as on leg A. Runs SECOND, straight after A, because the fees are read off the waterfall A stamps. | `runHardCostTransfers(id, { force: either cost is "processing" })` (`flows/hard-cost-payees.md`) |
| P | `team_payouts` | Team shares paid by Stripe transfer (Phase C, v: 2026-10-06): `payment_team_shares` rows with `pay_method = 'stripe'` AND (`status` in `owed` / `held` / `failed` / `processing` OR (`paid` AND `email_sent_at` null)), least recently offered first (`sweep_at`, the leg's own stamp), up to 200 shares grouped into at most 50 payments. Candidates are SHARES, not payments — the helper asks the PAYMENT's `payoutGate` (pay date, hold, refund) before claiming anything, so a share not yet due costs one read. Runs straight after H. | `runTeamShareTransfers(paymentId, { force: any share "processing" })` (`flows/internal-team-share.md`, *Phase C*) |
| Y | `payroll_report` | The payroll report (Phase D2, v: 2026-10-07), straight after P and before the Gmail probe. Reads `team_payroll_settings`; when today (Eastern) is on or after the current period's report day (`duePeriod`), that period's LIVE report is built and drafted once (`runPayrollReport`: a drafted or `empty` report is left alone, one left `building` by a dead run is finished). Then up to 5 live reports in `draft_failed` are re-drafted. Sandbox reports are never drafted here (by hand only, Accounting → Team Payroll). Moves no money. | `runPayrollReport` → `drafted` / `empty` / `existing <status>` / `error`; `draftPayrollReport` → `re-drafted` / `error` (`flows/internal-team-share.md`, *Phase D2*) |
| Z | `curator_reminder` | The curator review reminder (Phase D3, v: 2026-10-07), straight after Y and before the Gmail probe, EVERY run: no candidate query — the helper reads this month's latch (`team_payroll_settings.curator_reminder_period`) and, if unstamped, the COIs whose curator's tax year has ended. Nothing behind = nothing sent and no stamp, so a COI falling behind mid-month is caught by the next run. Moves no money. | `runCuratorReminder()` → `already this month` / `none overdue` / `drafted N` / `error` — one email + one summary bell (`flows/internal-team-share.md`, *Phase D3*) |
| B | `confirmation` | `funded_by = 'client'` AND `payment_status` is not null AND ≠ `failed` (a failed row is told by leg I's email; "we have received your payment" would contradict it) AND `confirmation_status = 'Confirmation Needed'` | `draftPaymentConfirmation` (the verify-bank twin on a manual entry) |
| C | `invoice_receipt` | `funded_by = 'client'` AND `payment_status = 'succeeded'` AND `invoice_email_sent = false` | `draftPaymentInvoiceReceipt` |
| D | `request_email` | `funded_by = 'client'` AND `payment_status` null AND `checkout_token` not null AND `payment_email_sent_at` null AND `created_at` older than 10 minutes | `draftPaymentRequestEmail(…, { logLabel: "payment_sweep" })` |
| E | `payment_reminder` | `funded_by = 'client'` AND `payment_status` null AND `checkout_token` not null AND `payment_email_sent_at` not null and `< cutoff2` AND `payment_reminder_sent_at` null | `draftPaymentReminder` |
| E2 | `payment_reminder_2` | `funded_by = 'client'` AND `payment_status` null AND `checkout_token` not null AND `payment_reminder_sent_at` not null and `< cutoff3` AND `payment_reminder2_sent_at` null | `draftPaymentReminder(…, { second: true })` — the same email on its own latch |
| K | `refund_email` | `refund_status` in `pending` / `refunded` / `recorded` AND `refund_email_sent_at` null — BOTH pipelines (a provider-funded refund emails the client too). A failed refund's webhook re-arms the latch, so the next successful refund is told again. | `draftRefundEmail` (`flows/client-payment-request.md`, *Refunds*) |
| I | `failed_email` | `funded_by = 'client'` AND `payment_status = 'failed'` AND `payment_failed_email_sent_at` null | `draftPaymentFailedEmail` |
| J | `payment_overdue`, `bank_verification_stalled`, `payout_followup` | Runs regardless of Gmail (a bell needs neither Gmail nor Stripe). Four queries: **unpaid after the reminders** — client, `payment_status` null, `payment_reminder2_sent_at` `< cutoff2`; **failed and not retried** — client, `failed`, `payment_failed_email_sent_at` `< cutoff5`; **verification stalled** — client, `processing`, `bank_verification_pending_at` `< cutoff5`, not refunded; **weekly follow-up** — (`rev_paid = 'Check Due'` AND `payout_due_on` a week or more ago) OR (`rev_paid = 'Via ERT'` AND `ert_share_done` not true AND `payout_cleared_on` a week or more ago), AND `payout_followup_at` null or more than seven days ago, AND not refunded (both "not refunded" conditions are coded, live from v65 — *A refunded row*, below) | `notifyPaymentEvent` — the first three with `dedupe: "ever"` (told once per payment, ever); the weekly one on the default unread dedupe, timed by stamping `payout_followup_at` |
| F | `connect_reminder`, then `payee_connect_reminder` | COIs: `members.connect_setup_email_sent_at` not null and `< cutoff2` AND `connect_reminder_sent_at` null AND `email` present AND `status = 'Active'`; then payees: the same three on `payees` AND `active = true` | live Stripe check **in the row's own mode** (`modeForCoi(row)` / `modeForPayee(row)`, the `sandbox` toggle), then `draftConnectReminder` / `draftPayeeConnectReminder` |
| G | `housekeeping` | four retention deletes — see below | nothing; the sweep deletes directly |
| V | `client_vault` | LAST, after G and just before the heartbeat, and regardless of Gmail and Stripe (v: 2026-09-29, backend v64). `funded_by = 'client'` AND `invoice_email_sent = true` AND (`invoice_vault_path` null OR `receipt_vault_path` null); ordered `invoice_email_sent_at` DESCENDING (newest paperwork first); capped at **`VAULT_LIMIT` = 10**, because each row is two PDF renders. | `refileDocumentsToVault(id)` → `filed` / `existing` / `error` — re-renders the ISSUED documents from the row and files them; sends nothing (`flows/client-vault.md`) |

**A refunded row is out of the money and paperwork legs** (v: 2026-09-29, backend v63). R (the
in-flight query), A, H, B and C each add `.or("refund_status.is.null,refund_status.eq.failed")`: a
refunded payment is paid nothing, invoiced for nothing and told nothing more, and an ACH cancelled
by its refund — still `processing` underneath, on purpose — is never reconciled into a failure.
`failed` stays IN, because a refund that failed may be retried and the payment's own work may still
be owed; its payouts are held instead (`flows/payout-schedule.md`). The helpers refuse a refunded
row on their own too (`payoutGate`, `reconcilePayment`), so the predicate is what keeps the rows out
of the 50-row caps. D, E, E2 and I chase unpaid or failed rows, which `refundCheck` never lets be
refunded. **Leg J's `bank_verification_stalled` and `payout_followup` queries carry the same
condition** (coded 2026-09-29 after Phase 2 left them without it; **NOT yet deployed — live from the
next deploy, v65**): a refunded payment whose share was `Check Due` or an unticked `Via ERT` (both
refundable, with a warning) no longer gets the weekly bell asking for a check or a tick the portal
now refuses. And a refund that CANCELS an in-flight ACH now also clears
`bank_verification_pending_at` in `refund.ts` (same v65), so a cancelled manual entry cannot read as
"awaiting bank verification" either. J's other two queries (unpaid, failed) need nothing:
`refundCheck` never lets those rows be refunded. **Leg V deliberately carries no refund condition**:
it only files documents that were already issued and emailed, and a refunded payment's documents stay
filed (`flows/client-vault.md`); a refunded row that never had paperwork is never a candidate.

**Only leg A, leg J's weekly follow-up and leg K are shared with the provider-funded records.** A provider-funded record (Boxhouse, 831(b), DCD and the rest) clears
when an admin records the provider's lump sum: `revenue_received_at` is written by the insert that
creates the row (`flows/provider-receipts.md`), not by a Stripe status, and nobody was ever emailed or
charged on it, so the email, paperwork and Stripe legs must never touch one: each of R, B, C, D, E,
E2, I and J's three client queries names `funded_by = 'client'` outright (J's weekly follow-up is
the exception on purpose — a provider row's Via ERT tick is owed too) rather than leaving those rows out by accident, on a null
`payment_status` or an absent `checkout_token` that the next column added to the record could quietly
undo. Leg A has to be the exception — once a record has cleared, however it cleared, the COI is owed
the same share by the same helper, and a transfer held for a missing payout account has to come back
tomorrow night whichever pipeline raised it. In PostgREST that is two separate `.or()` calls, which
are ANDed together: "cleared, either way" AND "unfinished". Leg A is also what makes a receipt whose
shares timed out part way through self-healing: the rows it left behind are cleared with their share
unattempted, which is exactly this predicate.

**The payout schedule gates A and H** (v: 2026-09-24, `flows/payout-schedule.md`). A third `.or()`
offers an UNCLAIMED transfer only when `payout_due_on <= today` (Eastern) or is NULL, and never while
`payout_hold` is set; a claim in flight (`processing`) and a paid transfer still owed its email are
offered regardless. **Rotation ordering (v: 2026-09-29):** both legs order FIRST by the sweep's own
stamp — `sweep_a_at` / `sweep_h_at` ascending, NULLs first, stamped on every row offered — and only
then by `payout_due_on` ascending, NULLs first. Ordering by pay date alone let rows no run can
finish (a COI who never set up payouts) sort first on their old dates and fill the 50-row cap every
run, starving a row that fell due today; least-recently-offered first means every candidate gets its
turn. The helpers gate again on their own, so a row that slips through comes back `scheduled` /
`on_hold` untouched.

**R, A and H run first and run regardless of Gmail**, because asking Stripe what happened and moving
money owed to a COI or a payee need no mailbox. R goes before A so that a payment whose clearing
webhook was missed is booked `succeeded` in time for A to pay its share in the same run. `force` is passed for one state only: a claim stuck at `processing` is a run
that died mid-flight, and reusing the idempotency key that run STORED on the row is what makes
repeating that transfer safe (#22). Every other state goes through the normal conditional claim,
which mints a fresh key. Leg H passes `force` for the ROW when either cost is `processing`; the
module still claims each cost on the exact state it read (#28), so the other cost is unaffected. Leg H also offers a paid fee whose payee confirmation is still undrafted
(`{cost}_email_sent_at` NULL), for which the helper drafts only the email; a payee with no address
comes back each night as `email=no_email` until one is added.

**Gmail is asked once.** After legs R, A and H the sweep calls `getGmailAccessToken()` a single time; a
null sets `gmail_unavailable: true` and legs **B, C, D, E, E2, K, I and F are skipped wholesale** for the
run rather than each rediscovering the outage fifty times. Nothing is stamped, so the next night picks
all of it up — and the heartbeat records `gmail_unavailable`, so the superadmins' bell says so. Leg J
(bells), leg G (deletes) and leg V (filing, which sends nothing) run either way. Legs Y and Z run before
the probe and ask Gmail themselves: a report whose draft fails is left `draft_failed` (its shares stay
`reported`) and the next run re-drafts it; a curator reminder that cannot draft leaves its latch unset.

**Leg V runs last on purpose** (v: 2026-09-29). It waits on the PDF service twice per row, so it sits
after every bell and delete, just before the heartbeat insert, and takes at most ten rows: a slow or
failing PDF service can cost only the filing, never the bells or the heartbeat. A row that fails is
recorded `error` in `results` but NOT in `sweep_runs.errors` (a per-row refusal, not a query error),
so it raises no system alert — it is simply offered again next run, and the client already has the
documents by email. That self-heal is proven: the first real run after deploy filed six historical
pairs, one upload failed with a transient "connection reset" (GOTCHA #39), and the next run filed it.
**Caveat — its ordering is by business date, not a bookkeeping stamp**: newest `invoice_email_sent_at`
first, with no `sweep_v_at`. Ten rows that fail EVERY run would hold the whole cap and starve older
rows (see the rotation trap below). Harmless while failures are transient; if a permanent one ever
appears, give the leg its own stamp.

**D's ten-minute floor** exists because `start_client_payment` creates the row and drafts its email in
the same call. A row created seconds ago with no `payment_email_sent_at` is far more likely to be a
request in flight than one that failed.

**F asks Stripe, never the roster row.** `members.stripe_account_id` proves an account was created
and nothing more — the same reason `coi_connect_status` exists. The leg selects `sandbox` alongside
the account id because the MODE is derived from it: `modeForCoi(row)` (or `modeForPayee(row)`), the
same rule that created the account (`utils/stripe-mode.ts`; names stopped mattering in chat 15,
GOTCHA #20). For each candidate one shared `remindConnect` step asks `connectAccountPayable`
(`utils/connect-status.ts`) on that mode, which treats the account as payable only on
`capabilities.transfers === "active"` AND `payouts_enabled === true`. Three outcomes, for a COI and a
payee alike:

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
| R | the booking's own conditional claims (`.is(null)`, the failed intent it replaces, `processing`) — `reconcilePayment` books through the webhook's functions | `book-client-payment.ts` |
| A (transfer) | `rev_paid` claim + a Stripe `Idempotency-Key` deterministic per ATTEMPT, stored in `rev_idempotency_key` by that claim and reused only on a mid-flight resume (#22) | `revenue-share.ts` |
| A (email) | `rev_email_sent_at` | `revenue-share.ts` |
| A (Path A) | `rev_paid = 'Via ERT'`, which the leg's own predicate does not name — the candidate list is the latch | `revenue-share.ts` |
| H | `{cost}_paid` claimed on the EXACT state read (#28) + a per-attempt key in `{cost}_idempotency_key`, reused only on a forced resume | `hard-costs.ts` |
| P | the share's `status` claimed on the EXACT status read + a per-attempt key in `payment_team_shares.idempotency_key` (`teamshare-<share id>-<ms>`), reused only on a forced resume; `email_sent_at` for the confirmation | `team-transfers.ts` |
| Y | `team_payroll_reports.period_key` UNIQUE with `sandbox` (a second run finds the first's row) + the report's `status` (`drafted` / `empty` = done); each share claimed by the conditional flip `owed` → `reported` | `utils/payroll-report.ts` |
| Z | `team_payroll_settings.curator_reminder_period` = this month (`YYYY-MM`), stamped only AFTER the draft (a failed draft is retried next run; two runs racing the same morning could both draft — the cron runs are two hours apart) | `utils/curator-reminder.ts` |
| B | `confirmation_status = 'Sent'` | `confirmation-email.ts` |
| C | `invoice_email_sent = true` (and the numbers, written back the instant they are allocated) | `invoice-receipt.ts` |
| D | `payment_email_sent_at` — the sweep's predicate IS the latch, and the helper stamps it | `request-email.ts` |
| E | `payment_reminder_sent_at` | `reminder-email.ts` |
| E2 | `payment_reminder2_sent_at` (and it refuses before the first has gone) | `reminder-email.ts` |
| K | `refund_email_sent_at`, one per refund (a failed refund's webhook clears it) | `refund-email.ts` |
| I | `payment_failed_email_sent_at`, one per failure (the next checkout clears it) | `payment-failed-email.ts` |
| J | `dedupe: "ever"` on `(payment_id, rule_key)` for the three one-off bells; `payout_followup_at` (the sweep's stamp) + the unread dedupe for the weekly one | `utils/notify.ts` |
| F | `connect_reminder_sent_at`, on `members` and on `payees` | `connect-reminder-email.ts` |
| V | `invoice_vault_path` / `receipt_vault_path`, stamped only for a file that landed; and the FIXED path with `upsert`, so even a repeat files the same object, never a second one | `utils/client-vault.ts` (`fileDocumentsToVault`) |

The reminder helpers and the failed-payment email **NEVER THROW** and re-check their own state
before drafting: the sweep reads its candidates minutes before it reaches any given row, and a client
who pays inside that window is exactly the race a reminder must not lose. None has a `force` flag —
nothing automated should ever raise a reminder beyond its latches, and an admin who wants to chase
again has "Resend payment email" on the payment detail screen or "Resend setup email" on the Connect
card.

## The three payment reminders (v: 2026-09-29)

A client who has not paid is chased on a fixed ladder, then handed to a person: the **first
reminder** two business days after the request (leg E), the **second** three business days after
that — five after the request — as the same `client_payment_reminder` email on its own latch
`payment_reminder2_sent_at` (leg E2), and two business days after the second, no third email but
the **`payment_overdue`** bell to the payment's people: "somebody should contact them" (leg J, told
once per payment). A FAILED payment is not on this ladder — the reminders chase a request never
attempted — so leg J gives it its own `payment_overdue` five business days after the failed email.

## The Connect reminder and the first payment reminder

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
`[First Name]`, `[Client Name]`, `[STRATEGY]`, `[TOTAL_FEE]`, `[PAYMENT_LINK]`, and since migration 59
`[BANK_SIGNIN_TIP]` under the button; both reminders use this one row) and `COI_PAYOUT` /
`coi_connect_reminder` (`[First Name]`, `[SETUP_LINK]`), plus its payee twin `COI_PAYOUT` /
`payee_connect_reminder` (migration 48, same tokens, `[First Name]` the contact or the firm's name).
All are `send_mode false`, all go To the `RECIPIENT` role token, and the fallback constants in the
helpers mirror the seed exactly, so a deactivated row still produces a sane email.

## Housekeeping

Leg G always runs — it needs neither Gmail nor Stripe, and its work grows whether or not anybody is
paying anybody. Four deletes, each reported with a real count (the `.select(…)` on the delete is what
makes the count real; without it PostgREST returns no representation and the sweep would report zero
however much it removed):

- **`admin_sessions`** where `expires_at < now()`. Until now expired rows were deleted only when that
  session was presented, or per-admin by `update_passcode` / `delete_admin` — they accumulated forever.
- **`login_attempts`** older than **30 days**. The throttle window is fifteen MINUTES, so thirty days
  is pure audit headroom: a question about a lockout can still be answered a month later.
- **`login_setup_tokens`** whose `expires_at` is more than **30 days** past — a spent or lapsed
  `/set-password` link nobody can use, kept a month for the same reason.
- **`sweep_runs`** older than **90 days** (v: 2026-09-29) — the heartbeat only ever reads its newest
  row; three months is history enough to see when the check stopped or Gmail went down.

## The heartbeat — `sweep_runs` and the superadmins' system alerts (v: 2026-09-29)

A sweep that stops running — the cron job disabled, the Vault secret gone (a 401 no-op, #17) —
cannot announce its own absence. So every REAL run (never a dry run) ends by inserting one
`sweep_runs` row: `ran_at`, `gmail_unavailable`, `counts`, and `errors` — ONLY the query errors
(`id = "query"`, at most 50), never a helper refusing one row ("client has no email"), which that
row's own bell or screen already shows and which would otherwise pin a permanent alert. A failed
insert is logged only; the run's work is done either way. The table (migration 58) is deny-all RLS,
seeded with one row so the staleness alert measures from the day it shipped.

`actions/notifications/system-alerts.ts` reads the NEWEST row on every bell poll, for superadmins
only (`load_notifications` → `system_alerts`), and computes — never stores — up to three alerts:
**`sweep_stale`** when the newest run is more than **26 hours** old (three runs a morning make the
longest normal gap twenty hours; twenty-six means a whole day was missed — "Daily payment check has
stopped", which names the job and its Vault key), **`gmail_unavailable`** when that run could not
reach Gmail ("Gmail is not connected", naming `GMAIL_REFRESH_TOKEN`), and **`sweep_errors`** when it
recorded query errors (the first three quoted). A failed read of the table is itself an alert,
`sweep_unreadable`. Each clears by itself the moment its cause does — the next good run replaces the
row read — which is why none is stored and none is dismissible (`flows/notifications.md`).

Three tables are never touched, and that is a hard rule: **`connect_setup_tokens`** (durable by
design — deleting one breaks every payout-setup email ever sent to that COI), **`stripe_events`** (the
webhook replay guard) and **`document_numbers`** (an issued invoice or receipt number must never be
reissued).

## The cron job

`supabase/migrations/20260903142000_payment_sweep_cron.sql` enables `pg_cron` and `pg_net`,
unschedules any existing job of the same name, and registers **`payment-sweep-daily`** at
**`0 10 * * *`** — 10:00 UTC, 06:00 Eastern, so the night's drafts are already in the mailbox when
somebody opens it. **Migration 53 (v: 2026-09-24) moved it to `0 10,12,14 * * *`** with `cron.alter_job`:
a pay date can carry a week's or a month's payouts, over one run's 50-row cap, and the 08:00 and 10:00
Eastern runs finish them the same morning. Every leg is latched, so the extra runs are no-ops on a quiet day. It POSTs `{"action": "run_payment_sweep"}` at the function with a 120-second
timeout.

**The bearer is read from Vault at run time.** VFO's equivalent file pastes the service-role key into
the schedule, which puts the secret in the repo AND in `cron.job` forever. This one selects it from
`vault.decrypted_secrets` inside the job body, so the committed file names only the **Vault secret
name `iag_service_role_key`** and `cron.job` stores only the query. Jake creates that secret himself
in the Dashboard; nobody types the value into a chat. If it is missing the subquery returns NULL, the
bearer collapses to empty, the sweep answers 401 and **nothing happens** — a missing secret is a
no-op, not a half-run.

**The Vault value is the `sb_secret_…` key, NOT the legacy `service_role` JWT.** Project Settings →
API → **Publishable and secret API keys**, not **Legacy API keys**: on this project the edge runtime's
`SUPABASE_SERVICE_ROLE_KEY` env var holds the new-format secret key, and the two are different strings
even though both are genuine credentials for the same project. Filling Vault with the legacy JWT is
what the first live run actually did, and it answered 401 with the header arriving perfectly intact.
Diagnosis and fix in **GOTCHA #17** — read it before wiring any other service-role caller.

## Dry run and firing it now

`{"action": "run_payment_sweep", "dry_run": true}` lists what each leg WOULD take — including
housekeeping row counts — and does nothing: no Stripe call, no Gmail draft, no bell, no delete, no
bookkeeping stamp and no heartbeat row. It does not even probe Gmail, so `gmail_unavailable` reads
false. It is the safe way to look at a night's work
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
| Leg V's helpers (re-render from the row; upload and stamp) | `iag-admin-api/actions/payments/invoice-receipt.ts` (`refileDocumentsToVault`), `iag-admin-api/utils/client-vault.ts` (`fileDocumentsToVault`) |
| Leg Z's helper (who is behind, the email, the summary bell, the latch) | `iag-admin-api/utils/curator-reminder.ts` (`overdueCurators`, `runCuratorReminder`); rule + template by `supabase/migrations/20261007160000_curator_review_reminder.sql` |
| The sweep itself (all eighteen legs, the bookkeeping `touch`, `legError`, the heartbeat insert) | `iag-admin-api/actions/payments/sweep.ts` |
| Leg Y's helpers (periods, claim, PDFs, draft) | `iag-admin-api/utils/payroll-report.ts` (`duePeriod`, `runPayrollReport`, `draftPayrollReport`); tables by `supabase/migrations/20261007120000_team_payroll_report.sql` |
| Leg R's helper (asks Stripe, books through the webhook's functions) | `iag-admin-api/actions/payments/book-client-payment.ts` (`reconcilePayment`) |
| Leg I's helper (the failed-payment email) | `iag-admin-api/actions/payments/payment-failed-email.ts` |
| Leg K's helper (the refund email) and the refund rule the exclusions follow | `iag-admin-api/actions/payments/refund-email.ts`, `iag-admin-api/utils/refund.ts`; columns and template by `supabase/migrations/20260929140000_refunds.sql` |
| Leg J's bells and their `dedupe` option | `iag-admin-api/utils/notify.ts` |
| The superadmins' system alerts (read the newest `sweep_runs` row) | `iag-admin-api/actions/notifications/system-alerts.ts` |
| The chat-17 columns, `sweep_runs` (deny-all, seeded), the new rules | `supabase/migrations/20260929100000_payment_failure_paths.sql` |
| Leg H's helper (the hard-cost transfers) | `iag-admin-api/actions/payments/hard-costs.ts` |
| Leg F's Stripe read | `iag-admin-api/utils/connect-status.ts` (`connectAccountPayable`) |
| Business-day cutoff | `iag-admin-api/utils/business-days.ts` |
| Payment reminder email (latched) | `iag-admin-api/actions/payments/reminder-email.ts` |
| Connect reminder emails, COI and payee (latched) | `iag-admin-api/actions/members/connect-reminder-email.ts` |
| Shared "Complete Payment" button | `iag-admin-api/actions/payments/request-email.ts` (`paymentLinkButton`) |
| Shared "Set Up Payment Details" button + durable token | `iag-admin-api/utils/connect-setup-token.ts` (`connectSetupButton`) |
| Bearer comparison | `iag-admin-api/utils/crypto.ts` (`constantTimeEqual`) |
| Dispatch entry (the one bearer-gated public action) | `iag-admin-api/router/dispatch.ts` |
| The `client-vault` bucket and the two `*_vault_path` columns (migration 63) | `supabase/migrations/20260929150000_client_vault.sql` |
| The two reminder latches | `supabase/migrations/20260903140000_sweep_reminder_columns.sql` |
| The two seeded templates | `supabase/migrations/20260903141000_sweep_reminder_emails.sql` |
| The cron job + operational reference | `supabase/migrations/20260903142000_payment_sweep_cron.sql` |
| What each leg finishes | `docs/flows/client-payment-request.md`, `docs/flows/coi-connect-setup.md`, `docs/flows/hard-cost-payees.md`, `docs/flows/client-vault.md` |

## Traps

- **Never add a leg that writes a state a helper owns.** The sweep's safety is entirely borrowed: it
  is safe because `payment_status`, `rev_paid`, `legal_fee_paid` / `admin_fee_paid`,
  `confirmation_status`, `invoice_email_sent`, `payment_email_sent_at`, the reminder stamps,
  `payment_failed_email_sent_at`, `refund_status` and `refund_email_sent_at` are each written in exactly one file
  (`refund_status` in two: `refund.ts` and the refund webhook branch). A leg that stamped one of
  them itself would be a second writer, and the next replayed Stripe event or the next night's run
  would double whatever it guarded. **What the sweep MAY write** is its own bookkeeping —
  `stripe_checked_at`, `sweep_a_at`, `sweep_h_at`, `payout_followup_at`, "when did I last offer this
  row" — read by nothing but the sweep's own ordering and predicates, plus the `sweep_runs` row. Leg
  R reaching `payment_status` is not an exception: it calls `reconcilePayment`, which books through
  `book-client-payment.ts`, the sole writer, under that file's claims.
- **Order the re-met legs by the bookkeeping stamp, never by business date alone.** A leg whose
  candidates include rows no run can finish (A, H, R) must rotate least-recently-offered first, or a
  backlog of the unfinishable fills the 50-row cap every run and a newly due row never gets a turn.
  Leg V is ordered by `invoice_email_sent_at` alone (newest first) — acceptable while its failures
  are transient, but it is exactly this shape if one ever becomes permanent (*Leg V runs last*).
- **Keep leg V last and small.** It waits on the PDF service; moved earlier or given the 50-row cap,
  a slow render eats the wall clock the bells and the heartbeat need, and a missing heartbeat is a
  false "Daily payment check has stopped".
- **A new leg that pays, drafts paperwork or reconciles must carry the refund condition in its
  predicate** (`.or("refund_status.is.null,refund_status.eq.failed")`, GOTCHA #37). The helpers
  refuse a refunded row anyway, but without the predicate refunded rows re-meet the leg every run,
  fill its 50-row cap, and starve the rows that are owed. The same goes for a bell leg whose ask a
  refund makes moot: leg J's `bank_verification_stalled` and `payout_followup` carry it (the gap
  Phase 2 left there is closed in code, v: 2026-09-29, **live from v65** — until that deploy the
  live v64 still bells a refunded `Check Due` / unticked `Via ERT` row weekly). Leg V is the
  deliberate exception: it files documents already issued, and those stay filed after a refund.
- **The heartbeat stores QUERY errors only.** Putting a helper's per-row refusal into
  `sweep_runs.errors` would pin a superadmin alert for as long as one client has no email; that row
  already has its own bell or screen.
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
