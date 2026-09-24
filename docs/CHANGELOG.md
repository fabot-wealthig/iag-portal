# CHANGELOG

Narrative history of the IAG Portal, **newest entry first**.

Format: `## YYYY-MM-DD — headline`, followed by bullets describing what changed and why.

One change = one entry = one squashed commit on `main`. A change may span several chats; it still
gets exactly one entry. Superseded facts move here out of `docs/SESSION_REFERENCE.md` when the hub
is updated, so the hub only ever holds current state.

## 2026-09-24 — Chat 16: the payout schedule — shares and payee fees paid on a pay date, with Pay now, Hold and a full history

- **Money no longer goes out the moment a payment clears** (IAG's request, Jake 2026-09-24). Clearing still
  stamps the waterfall at once, and now stamps a **pay date** with it in the same update
  (`payout_cleared_on`, `payout_due_on`); the COI's revenue share and the legal and administration fees to
  payees wait for that date. **ONE schedule** the admins set: **weekly** (business cleared Monday–Sunday pays
  the following chosen weekday) or **monthly** (business cleared in a month pays on the chosen day of the
  next). It starts **weekly on Friday** so IAG gets weekly repetitions before December, switched to monthly on
  the 15th by them after Q4. **The date is exactly the day named — no weekend or holiday shifting** (Jake:
  "easier and less confusion"); date windows were built, then dropped for one schedule (migration 54). Eastern
  calendar days throughout. Not Due and Via ERT are still
  settled at clearing, because neither moves money. `utils/payout-schedule.ts` holds the arithmetic;
  `flows/payout-schedule.md` is the new flow doc.
- **The gate.** `runRevenueShare` (new step e3) and `runHardCostTransfers` refuse an UNCLAIMED transfer
  before its date or while held, writing nothing (`deferred` / state `scheduled` | `on_hold`); a claim in
  flight and an owed email are never gated. Sweep legs A and H gained a third `.or()` (due and not held,
  or in flight, or owed an email) and order by pay date, so waiting rows can never crowd the 50-row cap.
  Both retry actions refuse a held or not-yet-due transfer and name Pay now / Release instead.
- **The controls, any admin (Jake).** `pay_payout_now` (date to today, hold lifted, `payout_early_by/_at`,
  transfers run at once without force — a double click cannot pay twice); `set_payout_hold` (a reason is
  required; a release keeps a future date or moves to the next pay date strictly after today — "joins the
  next scheduled run"); `load_payout_schedule` / `save_payout_schedule` (whole-schedule save with
  **`preview: true`** listing every waiting payment it would move, then re-dating only payments whose date
  is still ahead, not held, not paid early); `load_payouts` (every owed transfer by pay date with a live
  Stripe payout-account check, the recent changes, and the last 45 days paid). 55 → **60** actions.
- **Every date and every change is recorded** (Jake: "when payments are going, and if changed or edited,
  super clear"). **Migration 51** adds `payout_events`, append-only and deny-all: `scheduled`, `held`,
  `released`, `paid_now`, `redated`, `schedule_changed` (with before/after). **Migration 50** adds
  `payout_schedule` (deny-all; one row in use — the table still allows dated windows, unused) and the
  `client_payments` payout columns. **Migration 54** leaves the one schedule weekly on Friday and logs it.
- **Screens.** A **Payout** card on every payment detail (the date in words, On hold / Due now / Paid, a
  "Date changed: originally scheduled for…" line, what will be paid, Pay now and Hold/Release behind
  confirmations, the full history); **Accounting → Payouts** (next payout and current schedule up top;
  Upcoming grouped On hold / Due now / by pay date with totals and date notes; Paid; Changes);
  **Automation & Config → Payout Schedule** (plain-English rule, the Payment schedule, Review changes →
  confirm list → save, change log with before/after). Grids and receipts read "Share pays Fri Oct 2" / "On hold".
  New key `wigPayoutsView`, listed in BOTH key lists (#21); back links learn `accounting_payouts`.
- **The COI revenue share email** now says "today we sent your revenue share for the following payment"
  and gains a "Payment received on `[RECEIVED_DATE]`" row (wording approved by Jake). **Migration 52**
  edits the live body with two anchored `replace()`s and is applied WITH the backend deploy, since the old
  code would print the token raw. The payee fee email already said "today we sent" and is unchanged.
- **The sweep runs three times a morning** (**migration 53**, `0 10,12,14 * * *`), so a pay date over one
  run's 50-row cap still finishes the same morning; every leg is latched, so the extra runs are no-ops.
- **Also:** the hub's stale Backend line (v49 → v51) and the test roster (chat 15's payments and receipt
  are gone) corrected; `anon-probe.ps1` covers 20 tables; `smoke.ps1` gains `load_payouts` and
  `load_payout_schedule` (15 loaders).
- **Assessed, not built this chat:** a Wealthbox push of new clients (feasible — needs IAG's plan tier and
  an API token) and BILL paper checks (feasible — Corporate plan and a 30-day MFA renewal; a manual "paid
  by check" option offered as the simpler first step). Both wait on IAG's answers.

## 2026-09-22 — Chat 15: IAG rebrand, the Sandbox toggle, fee discounts, and the legal and admin fees paid to payees

- **The portal is the IAG Portal of Innovation Advisory Group.** Every visible "Wealth IG Portal" / "Wealth
  Innovation Group" became "IAG Portal" / "Innovation Advisory Group": the pages, the Connect accounts'
  product description, the invoice and receipt PDFs ("From: Innovation Advisory Group"), the email
  signature (`WIG_SIGNATURE`, name kept), every fallback email body and the `/pay` and `/payout-setup`
  refusals. New artwork — `src/assets/iag-logo-{color,white}.png` (the lockup),
  `iag-mark-{color,white}.png` (the mark), a new `public/favicon.png` — with the old `wig-*` images deleted;
  the portal header shows the FULL lockup at 30px, and `ChevronMotif`, the faint mark on the navy auth panels,
  is the new mark in outline drawn ONCE (Jake: the three nested scales read as a smear). Text the database
  holds is rows, not code, so **migration 45** (`20260922140000_rebrand_iag.sql`) rewrites `email_templates`
  subjects and bodies and `strategies.explainer` in place, longest phrase first and case-sensitive, leaving
  every other word an admin wrote alone. Infrastructure names do not change: `portal.wealthig.com`, the
  wealthig.com addresses, the `--wig-*` tokens, the `wig*` storage keys, `iag-admin-api`, both repo names.
- **The Stripe mode is a per-COI Sandbox toggle; names no longer matter** (Jake). The chat-9 rule — "Test"
  anywhere in the client's or the COI's name means sandbox — is gone. **Migration 44**
  (`20260922130000_coi_sandbox_toggle.sql`) adds `members.sandbox boolean not null default false` and switches
  it ON for the two test COIs, `1.2.9999` and `2.2.9999`, so nothing of theirs changed mode. `modeForCoi(coi)`
  reads only a literal `true`; `modeForNames` is deleted, and `start_client_payment` and
  `create_provider_receipt` stamp `client_payments.sandbox` from the COI alone — a client inherits their COI's
  mode, because the Connect account the share goes to is the COI's. Stamped-on-the-row is unchanged, so
  flipping the toggle moves future payments only. `add_coi` and `update_coi` accept `sandbox` (absent on an
  update means leave it), and **`update_coi` refuses a flip once the COI has a Connect account** (400 "This
  COI already has a Stripe payout account in <mode> mode; the sandbox setting cannot change."), because an
  account lives in one Stripe mode only — which retires GOTCHA #20's rename-orphans-the-account trap for
  anything done inside the portal. Add COI and Edit Profile carry the checkbox (`shared/SandboxToggle.jsx`,
  disabled with the reason when locked); the hero chip, the receipt form's chip and both forms' mode line
  read `isSandboxCoi(member)`. The hub's "PER ENTITY, BY NAME" Stripe paragraph is superseded by this.
- **An optional fee discount on every fee, RECORD ONLY** (Jake). **Migration 46**
  (`20260922150000_fee_discount.sql`) adds `client_payments.discount_amount` / `discount_reason`, NULL both
  when none. The fee typed is still the fee charged or received: the discount says what was knocked off a
  standard price and why, and it never reaches the waterfall, the pool guard, a Stripe amount, a receipt's sum
  check or a document's total. `utils/discount-note.ts` owns both halves — `parseFeeDiscount` (blank or zero
  is no discount and drops the reason; an amount REQUIRES a reason, 500 characters at most), used by
  `start_client_payment` (read after the pool guard) and per row by `create_provider_receipt` ("Row N: …"),
  and `discountNote`, the `[DISCOUNT_NOTE]` sentence ("A fee discount of $X was applied (<reason>). ", the
  reason HTML-escaped, empty without a discount) that migration 46 slots into the five bodies that state a fee
  — request, reminder, confirmation, invoice + receipt, COI revenue share — each `replace()` anchored on the
  fee sentence and guarded against a re-run, with the five fallback constants carrying the token at the same
  spot. The invoice prints "Standard Fee" and "Fee Discount -$X" (reason in italics) above Total Client Fee
  and a muted schedule row; the receipt one "Fee discount -$X (<reason>)" row; every total still states the
  fee charged. The payment and receipt loaders (`load_client_payment`, `load_client_payments`,
  `load_all_payments`, `load_provider_receipt`) carry the pair. Frontend:
  `shared/DiscountFields.jsx` — "+ Add a fee discount" under the fee on every request block (LEOS, the
  Implementation Fee, NBDT) and under every receipt line, compact and full width so the Allocated grid is
  untouched — and the read-outs in `PaymentDetail` (a **Fee discount** field), `ProviderReceiptDetail` (a
  sub-line under Amount) and `PaymentsGrid`. **Decision:** on every strategy, `pass_through` included.
- **Payees: the firms the LEOS and NBDT hard costs are owed to.** **Migration 47**
  (`20260922160000_payees_and_hard_costs.sql`) creates `payees` with RLS and deny-all in the same migration:
  `kind` (`legal_firm | admin_fee`, fixed at creation like a COI's type), `name` (unique on `lower(name)`),
  `contact_name`, `email` (NOT NULL `''`), `sandbox` (the payee's own Stripe mode, `modeForPayee`), `active`,
  `notes`, `stripe_account_id` and the two Connect stamps. It seeds **`GFX`** (live) and **`GFX (Sandbox)`**,
  both `admin_fee`, both with no email yet. `connect_setup_tokens`' CHECK widens to `'coi' | 'payee'` — the
  second kind the 2026-08-28 migration left room for — keyed by the payee's uuid. Four authed actions:
  `load_payees`, `save_payee` (add or edit; never writes `kind` after creation, `stripe_account_id` or the
  stamps; the sandbox lock exactly as `update_coi`), `payee_connect_request` and `payee_connect_status`, the
  payee twins of the COI pair. `connect_setup_link` serves payee tokens, so `/payout-setup` is the same page;
  the Stripe half of both status actions moved into `utils/connect-status.ts` (`readConnectStatus`, same six
  statuses; `connectAccountPayable`, the sweep's test), and **sweep leg F** reminds an ACTIVE payee once, on
  `payees.connect_reminder_sent_at`, after the COIs. **Migration 48**
  (`20260922170000_payee_connect_emails.sql`) gives payees their own pair, `COI_PAYOUT` /
  `payee_connect_setup` and `payee_connect_reminder`, in wording Jake approved in chat — fee payments, the
  firm's EIN and a representative's details, where the COI pair promises revenue share and asks for an SSN —
  with fallbacks in `actions/payees/connect-request.ts` and `actions/members/connect-reminder-email.ts`.
  Frontend: **Automation & Config → Payees** (`PayeesPanel.jsx`: a list, a detail that replaces the header,
  an Add form), the Connect card lifted to `shared/StripeConnectCard.jsx` and shared with the COI profile, and
  `wigPayeeSelected` in BOTH key lists (#21) — thirteen keys. `scripts/smoke.ps1` gains `load_payees`:
  thirteen loaders. **Decision:** Payees live under Automation & Config.
- **The legal letter and the admin fee are paid by Stripe transfer, after the COI's share.**
  `start_client_payment` takes `legal_fee_payee_id` — REQUIRED on LEOS unless the letter is waived and always
  on NBDT, a `legal_firm`, active, and in THIS payment's mode — and resolves `admin_fee_payee_id` itself on
  LEOS: the one active `admin_fee` payee in the payment's mode, NULL when there is none (the step stays a
  manual tick), 400 when there are two. Both land on the row (FK `payees`, ON DELETE SET NULL) beside
  `{cost}_paid`, `_transfer_id`, `_idempotency_key` and `_paid_at` for each cost. **Decision:** NBDT's attorney
  fee shares the legal-firm dropdown rather than a kind of its own — the attorney on the trust is the law firm
  writing the letter, and the fee sits on the same `legal_fee_amount` column. The new
  `actions/payments/hard-costs.ts` `runHardCostTransfers` runs in `chainRevenueShare` straight after
  `runRevenueShare`, reading both amounts off the waterfall that run stamped: the payee's mode and a live
  `connectAccountPayable` check first (`Awaiting Payout Account` + the `hard_cost_held` bell when not payable;
  `Failed` + `hard_cost_failed` on a mode mismatch or an unreadable account), then a claim that matches the
  **EXACT** state it read, never a list (new **GOTCHA #28**), writing `processing` and a per-attempt key
  `hardcost-<cost>-<payment>-<ms>`; a forced resume from `processing` skips the pre-checks and reuses the
  stored key. The transfer carries `source_transaction` = the client's charge and `pipeline=HARD_COST`
  metadata; success writes `succeeded`, the transfer id, `_paid_at` AND `{cost}_done` / `_done_at`, so
  done-ness is one column for a tick or a transfer; a refusal is `Failed` + the bell; a Stripe
  `idempotency_error` keeps the claim and bells "needs checking". `retry_hard_cost` (`{ payment_id, cost }`,
  always `force`) is the step's Retry, and **sweep leg H** runs right after leg A, before the Gmail probe.
  `update_payment_step` now refuses `legal_fee` / `admin_fee` on a row that names a payee (400 "This fee is
  paid by Stripe transfer — retry it from the step instead of ticking it."); the ERT `processing_fee` and
  `ert_share` stay manual ticks. Steps carry `transfer_state` and `payee_name` (`buildPaymentSteps(row,
  payees?)`, the detail loader passing the names), with state-driven actions. Frontend: the **Legal firm**
  select on LEOS (with the letter) and NBDT, filtered to active firms in the COI's mode; on the fee steps a
  state pill and **Retry** (Failed or Held) instead of a checkbox; the payee names and transfer ids in
  Details. The two bells — area Payment, sort 50 and 60 — make **nine** notification rules.
- **Each paid fee sends its payee a confirmation** (Jake; wording approved in chat). **Migration 49**
  (`20260922180000_payee_fee_email.sql`) adds `legal_fee_email_sent_at` / `admin_fee_email_sent_at` and the
  template `COI_PAYOUT` / `payee_fee_paid` — the COI revenue share email's layout, reworded ("Fee payment
  confirmation", "Your fee payment $X", `[FEE_TYPE]` = Legal Opinion Letter / Attorney Fee / Administration
  Fee), deliberately WITHOUT the client's total fee or the discount, since neither changes what a payee is
  owed. `hard-costs.ts` drafts it once per fee right after that fee's transfer succeeds, latched on the stamp,
  which is written only after Gmail accepts; a fee paid with its confirmation undrafted (Gmail down) is
  offered again by sweep leg H and accepted by `retry_hard_cost`. A "Draft email" button for that case was
  built and then REMOVED at Jake's call as out of place — the sweep finishes it, and the failure paths get
  their own pass in a later chat. The fallback constant is byte-identical to the seeded body.
- **The COI revenue share double-pay race is closed** (found by the chat-15 docs pass and Fable's review;
  discharges the WATCH line the docs pass had added). `revenue-share.ts` claimed `rev_paid` from a LIST of
  states under `force`, so a Retry and sweep leg A both starting from `Failed` could each claim and transfer
  under two keys; and a non-forced run that read another run's `processing` could write Held or Failed over
  it, so the live run's success write missed and a later retry paid again. Now: a non-forced run that reads
  `processing` stops without writing; the claim matches the exact state read (plus the stored key on a
  resume); a forced resume skips the live account check so its key is never dropped; a Stripe
  `idempotency_error` keeps the claim with a "needs checking" bell instead of going to `Failed`; and every
  post-claim write matches the run's own key. GOTCHA #28 records the shape.
- **Two UI corrections from the click-test.** A LOCKED Sandbox toggle draws its own solid blue box with a
  white tick (a disabled native checkbox read as unticked); the auth-panel motif draws the new mark once.
- **Click-tested by Jake, all PASS** on v51 (smoke 13/13): the rebrand, the toggle, payee onboarding in
  sandbox, a LEOS payment with a discount paying both fees by transfer against the client's charge (and both
  confirmations), the held-then-Retry path on an unonboarded firm, NBDT's 60% attorney fee by transfer, a
  receipt-line discount, and the manual ticks that remain.
- **Counts.** Actions **54** table entries (6 public + 48 authed) + `admin_login` = **55**; migrations
  **49**; tables **18**; notification rules **9**; email templates **10**; smoke loaders **13**; sessionStorage
  keys **13**; the function **96** `.ts` files; live **v51**. No SECURITY INVARIANT changed: `payees` shipped
  RLS + deny-all in its own migration and the advisor was green after each of 44–49.
- **The anon probe could not be run from Claude's shells.** The auto-mode classifier refused DERIVE #8's
  anon-key REST reads from both the Bash and the PowerShell tool; Jake ran it by hand. The probe is now one
  script, `scripts/anon-probe.ps1` in the backend (PowerShell 5.1; the key from `$env:IAG_ANON_KEY`; all 18
  tables; `Content-Range` per table and PASS / STOP), and DERIVE #8 names it. New **GOTCHA #29**. The re-run
  over all 18 tables, `payees` included, is OWED.

## 2026-09-22 — Chat 14: Film Deduction, R&D Credits, Oil & Gas and Closehaul (hourly_rate, event_pct)

- **Four strategies off Jake's PDFs, all PROVIDER-funded, and two of them need a model of their own.** Every one
  arrives as a provider receipt on the pipeline chat 11 built — no new table, no new column, no RLS change, no new
  action (the count stays 50). **Film Deduction** (`FILM`) and **R&D Credits** (`RD_CREDITS`) are ERT paying Wealth IG
  a revenue share per engagement, the amount on the receipt row IS the pool, so they are `pass_through` beside Cost
  Segregation and brought no arithmetic. **Oil & Gas** (`OIL_GAS`) is priced on a COUNT: ERT (Tracy Miller) supplies
  the client's chargeable hours and pays them at $450, three hours being $1,350. `contribution_pct` would have meant
  typing hours into a dollar box and calling $450 a percentage, and `pass_through` would have thrown away the one fact
  ERT reports, so it is the new model **`hourly_rate`** (`rules = {"hourly_rate": 450, "excluded_motherships": [1]}`,
  the row storing `strategy_inputs.chargeable_hours`, contribution NULL, expected = hours × rate). **Closehaul**
  (`CLOSEHAUL`) is one strategy with two events, two percentages and two DIFFERENT bases — Loan, 2% of the loan
  amount; Capital gains event, 20% of the interest fee — which one `pool_pct` cannot hold, so it is the new model
  **`event_pct`** (`rules.events: [{key, label, pct, base_label}]`, an editable list like Boxhouse's box sizes; the
  typed base is the row's `contribution_amount`, expected = base × the event's pct). Migration 42
  (`20260922100000_ert_provider_and_closehaul_strategies.sql`, its header stating each decision below) widens
  `strategies_model_check` to NINE and seeds all four ACTIVE with numbered explainers, `on conflict (key) do nothing`;
  `utils/strategy-models.ts` lists nine. `strategies` now holds eleven active rows. None of the four bills an
  implementation fee, so `implementation_fee_amount` is 0 on every row they raise.
- **`rules.excluded_motherships` is now read on PROVIDER rows, FIRST, and lands on Not Due rather than a $0 Via
  ERT.** On Film Deduction, R&D Credits and Oil & Gas ERT is THE PAYER and pays an ERT-affiliated COI directly; this
  portal owes them nothing. A Path A (`affiliated_via_ert` true) would be the wrong shape: it would work out a share,
  record it as `Via ERT` and put a "Paid by ERT" tick in front of an admin for money that is not part of this split.
  So all three list ERT (mothership 1) on the same list the Implementation Fee has carried since chat 12, with
  `affiliated_via_ert` false and `affiliated_share_pct` seeded 0 because nothing reads it. `computeProviderWaterfall`
  — and `computeProviderPreview`, line for line — decides `excluded` before anything else and lets it win:
  `affiliated` can never be true for an excluded COI, their `coi_share_pct` is 0, and the row lands on the existing
  `Not Due` state exactly as on the Implementation Fee. Cost Segregation's rules are still `{}`, which matches
  nothing, so its behaviour is unchanged: every COI on the ladder, by transfer.
- **Closehaul has a Path A, because Closehaul and not ERT is the payer.** ERT is not already paying those COIs
  outside the split, so it has to be handed their share: `affiliated_via_ert` true, `affiliated_share_pct` 60, a
  `Via ERT` row and the "Paid by ERT" tick, exactly as on Boxhouse, NBDT and DCD. Everyone else is on the
  0/20/30/40/50 ladder.
- **`save_strategy` validates the list in ONE place, and requires it.** A shared `validateExcludedMotherships`
  replaces the copy `client_fee_pool` had inline (0 to 20 entries, each checked against `motherships`, deduped and
  sorted), and the array is REQUIRED — never defaulted — on `pass_through`, `client_fee_pool` and `hourly_rate`,
  because "excludes nobody" and "forgot the list" must not look the same: the second, read as the first, would start
  paying ERT-affiliated COIs where ERT already pays them. Cost Segregation's edit form therefore now sends `[]`, and a
  `pass_through` row's rules are no longer `{}` by definition. `hourly_rate` must be greater than 0 (400 "Hourly rate
  must be a number greater than 0."): a zero rate prices every row at nothing and the receipt refuses every client.
  `event_pct` takes 1 to 10 events, each key lowercase letters, numbers and underscores and unique, the label and the
  `base_label` non-empty and at most 40 characters, the pct 0 to 100.
- **The row snapshots its event off the RULES, `base_label` included.** `resolveProviderInputs` gains two branches.
  `hourly_rate` parses `chargeable_hours` as a count, not money — part hours are real, zero is refused ("A valid
  number of chargeable hours is required.") — and stores it alone; the rate stays on the strategy. `event_pct`
  matches `event_key` against the rules ("Choose the event type."), parses the base as money with a refusal that
  names it ("A valid loan amount is required."), and stores `{event_key, event_label, base_label}` copied from the
  rules, never the body, exactly as a box size's label is. `base_label` rides along because the row is all the detail
  screen and the Basis column see: they must say "Loan amount", and renaming an event on the strategy must not
  rewrite what a recorded payment says.
- **The frontend.** `StrategyInputs` asks **Chargeable hours** on Oil & Gas, and on Closehaul an **Event** select
  plus an amount box labelled by the chosen event's `base_label`; the receipt form's "Expected $X" hint works for both
  (`computeProviderPreview` gained both branches). On `TaxStrategiesPanel` the pass-through card is now GENERIC —
  `passThroughSteps` opens "ERT pays per engagement", true of Cost Segregation, Film Deduction and R&D Credits alike —
  with the excluded motherships as chips named by MOTHERSHIP (a number the roster lacks shows as `#n` rather than
  vanishing) and the sentence about them only on a card that has any; `hourlyRateSteps` works the rate through once
  off the rule; `eventPctSteps` shows each event as a chip ("2% of Loan amount") above the Path A step. The ERT
  callout gains a FOURTH mode, `ert_pays`, for a provider strategy whose exclusion list contains ERT. Three edit forms
  — `EditPassThrough`, `EditHourlyRate` and the Implementation Fee's `EditClientFeePool` — share one
  `ExcludedMothershipsPicker`; `EditEventPct` is an events table (key, label, percentage, taken of; up to ten, the
  last never removable) over the ERT-affiliated share. `PaymentDetail` shows "Chargeable hours", or "Event" plus the
  amount under its `base_label`, and hides the implementation-fee field on both; `basisText` in `PaymentsGrid` and
  `ProviderReceiptDetail` prints "2.5 hrs" or "Loan $100,000.00".
- **A fresh worktree could not build: `@sentry/react` was missing from the node_modules it borrowed.** `npm run
  build` in this chat's frontend worktree failed with `Rollup failed to resolve import "@sentry/react"`. The worktree
  had no `node_modules` of its own, so resolution walked up to `C:\iag-react\node_modules`, which predates the Sentry
  wiring and has no `@sentry` directory at all — while `package.json` and `package-lock.json` both list it. The fix
  was `npm ci --no-audit --no-fund` INSIDE the worktree (`node_modules` is gitignored; the lockfile is untouched),
  after which the build passes. The same failure awaits `npm run dev` and `npm run deploy` from any checkout whose
  `node_modules` predates Sentry, the main checkout's included until it is reinstalled. New **GOTCHA #27**.
- **The `revenue_received` bell rule's description named only Boxhouse, 831(b) and DCD.** Found in the click-through:
  the Notification Editor showed an admin a list five strategies short. Migration 43
  (`20260922110000_revenue_received_rule_description.sql`) rewrites it to name the pipeline rather than its members
  ("the clearing event for every provider-funded strategy"); key, audience and enabled flag untouched. The bell itself
  goes to the row's tax planner and payment recipients only, so a receipt line that names nobody raises none, by design.
- **Click-tested by Jake on 2026-09-22 against v49**, both test COIs, all thirteen steps: the four cards, callouts and
  explainers; rule edits on Oil & Gas (rate), Closehaul (events), Cost Segregation (an empty save with the new required
  list) and Film Deduction (removing and re-adding ERT flips the callout); one receipt per strategy — Film Deduction and
  Oil & Gas leaving the ERT-affiliated COI `Not Due` and paying the Level 3 COI 40% by transfer, Closehaul's Loan row on
  Path A at 60% (`Via ERT`, then the "Paid by ERT" tick) beside a Capital gains row on the ladder; the payment detail and
  Basis columns ("3 hrs", "Loan $100,000.00"); and the `revenue_received` bell once a row names a tax planner. Backend
  **v49** deployed for the test. Superseded and recorded here: v48 as the live version; the hub's DERIVE rows stamped
  2026-09-17; its OWED line listing the NBDT payments alone as the test data (now chat 13's two plus chat 14's seven rows
  under four receipts); and the smoke line's "12/12 PASS on v48" as the latest run, v49's being owed at wrap-up.
- **Both session prompts changed.** `SESSION_STARTER.md` step 5 runs `npm ci` in the fresh frontend worktree before
  `npm run dev`, and `SESSION_WRAPUP.md` deploys the frontend from that worktree, both for GOTCHA #27.
- **Shipped and cleaned up.** Smoke 12/12 PASS on v49 (Jake); the frontend deployed from the chat worktree. Then, at
  Jake's request, the test PIPELINE was wiped: all ten `client_payments` (chat 13's three, chat 14's seven), the four
  receipts and their three notifications. The roster stays for future testing — three clients, two COIs, the Test
  Mothership — and so do all twenty `document_numbers` rows, which the registry never gives back. Deleting a test client
  would CASCADE its number rows away and restart the invoice run, which is why the roster was kept (Jake's choice).
  Superseded: the hub's OWED test-data line and "v49's run OWED".

## 2026-09-17 — Chat 13: the Nevada Bank Dynasty Trust (fee_pct_waterfall)

- **A SEVENTH model, because the fee has exactly ONE cost under it and it is a percentage.** Jake's PDF ("Understanding
  Revenue Share for the Nevada Bank Dynasty Trust") describes a fee structure "exactly like LEOS" and then an arithmetic
  neither existing client-funded model can hold: the attorney takes 60% OF THE CLIENT'S FEE and what is left is the pool.
  `fee_waterfall` is wrong because there is no offset for an administration fee to be a percentage OF and no opinion letter
  to waive; `client_fee_pool` is wrong because a cost genuinely does come off the fee first. So `NBDT` ("Nevada Bank Dynasty
  Trust", `funded_by = 'client'`, `affiliated_via_ert`, `affiliated_share_pct` 60, `rules = {"attorney_fee_pct": 60}`, the
  0/20/30/40/50 ladder) ships as model **`fee_pct_waterfall`**, seeded ACTIVE by migration 41
  (`20260917100000_nbdt_strategy.sql`), which widens `strategies_model_check` to seven. No new table, no new column, no RLS
  change, no new action — the count stays 50.
- **The arithmetic, and the first Path A that reads BOTH flags.** `computeWaterfall`'s new branch stamps
  `legal_fee_amount = round2(fee × attorney_fee_pct / 100)` and `available_pool = round2(fee − legal)`, with
  `admin_fee_amount`, `processing_pct` and `processing_fee_amount` **0** — zero rather than absent, so the screen can total
  them. Path A fires on `mothership_number === 1` **AND** the strategy's `affiliated_via_ert`, unlike the LEOS branch, which
  reads the mothership alone and was safe doing so while LEOS was the only client-funded shape: the PDF pays an
  ERT-affiliated COI through ERT at 60% of the POOL (`coi_paid_via_ert`, `rev_paid` = `Via ERT`, the manual `ert_share` tick
  the completion), while the Implementation Fee has no Path A at all — the column is the only thing telling the two apart,
  and `StrategyRules` gained it. Everyone else is on the ladder by transfer. `save_strategy` validates `attorney_fee_pct` as
  a 0-to-100 percentage (400 "Attorney fee must be a percentage between 0 and 100."), `affiliated_share_pct` through the
  existing affiliated block.
- **The attorney fee rides the LEGAL column, and the hard-cost block becomes ONE step.** It is stamped on the existing
  `legal_fee_amount` rather than a column of its own: it is the same kind of figure, a legal cost settled outside the portal,
  and two legal lines on one payment could disagree. `buildPaymentSteps` spreads a single step where LEOS has three — key
  `legal_fee` (already whitelisted in `update_payment_step`), label "Attorney fee paid", action "Pay attorney fee", manual,
  amount off that column — and `admin_fee` and `processing_fee` are **ABSENT** by standing rule 7. `start_client_payment`
  groups the model with `client_fee_pool` behind one `feeOnly` flag (`offset_amount` NULL, `legal_fee_waived` false, only
  `total_fee` read); `ClientPaymentForm` asks ONE **Fee amount** over a `FeePctWaterfallPreview`
  (`computeFeePctWaterfallPreview`); `TaxStrategiesPanel` renders the strategy in five steps with the level chips, the
  via-ERT callout and `EditFeePctWaterfall` for the attorney percentage and the ERT share; `PaymentDetail` hides "Offset
  amount" and shows **Attorney fee**.
- **Three product decisions taken straight off the PDF.** **ACH only** — `accepts_card` stays false, `pay_link_checkout`
  consults `body.method` on `client_fee_pool` and nowhere else, and `[PAYMENT_METHODS_NOTE]` prints the bank-only sentence.
  **The attorney fee is never waivable**: the opinion-letter waiver is LEOS's, and this trust always pays its attorney, so
  no waiver reaches the model and the step is never greyed. **No ERT processing fee**: the PDF takes internal shares out of
  the Net Profit Pool and names no percentage for ERT off the top, so that line stamps zero. Everything else is LEOS's
  pipeline untouched — "Nevada Bank Dynasty Trust Client Fee" on the documents, the same checkout, booking, invoice and
  receipt, revenue share, sweep, bell and Payments list under the strategy's card.
- **The backend deploy became one PowerShell command, because the caller rule was never about PowerShell.** Running the
  documented invocation from the terminal tab inside the Claude desktop app reproduced GOTCHA #24 exactly — `dirname:
  command not found`, then `fatal: not a git repository` — from a caller #24 had cleared: a real PowerShell. The cause is
  the same either way: `bash.exe` resolves by absolute path while `dirname`, `find` and `git` sit in `usr\bin` and
  `mingw64\bin` beside it and are found only via PATH, which that tab does not carry. `scripts/deploy.ps1` in the backend
  repo prepends both directories and hands `scripts/deploy-function.sh` to the same scoop binary from the repo root, so
  `.\scripts\deploy.ps1` now works from a console OR the app's terminal tab; Jake deployed v48 with it. Nothing else moved
  — same multipart upload (#13), same gitignored `.mcp.json` token, never printed, and the `supabase` CLI still untouched.
  From a Claude session the Bash tool remains the way. New **GOTCHA #26**, cross-referencing #15 and #24; the hub's curated
  line is now #5/#13/#15/#24/#26. Superseded: the hub's old "from a real PowerShell console, the scoop binary" phrasing,
  which was right about the binary and wrong about what made it work.
- **Client Overview merged Client # and Name into ONE Client column.** "Nevada Bank Dynasty Trust" in the Strategy column
  pushed the nine-column grid past the 1180px panel and produced a horizontal scrollbar, which standing rule 4 forbids. The
  fix follows the COI column's own pattern rather than truncating a name: the client name as the link with its number under
  it, one cell, eight columns (`ClientOverviewPanel.jsx`, with `Skeleton.jsx` dropped to match). Both names stay links —
  rule 2 is untouched, each is still a shortcut PAST the row's own destination.
- **Chat 12's pending restamp PR is folded in here.** `docs/chat-12-restamp` never merged, so the hub's DERIVE rows still
  read chat 11's values. Rows 2 and 3 take that PR's still-true lines — `live-12-cost-seg-impl-fee` and
  `backend-good-2026-09-15-v46`, both (v: 2026-09-15), which ARE the current tags until chat 13's are stamped — while row 1
  goes past it to **48** (v: 2026-09-17) and the Backend bullet to v48 with 12/12 smoke PASS on v48. That PR is superseded
  and can be closed. Superseded and recorded here: v45/v46, `live-11-provider-receipts`, `backend-good-2026-09-11-v43`, and
  the smoke line's "12/12 PASS on v45; v46 differs by one loader line".
- **The test pipeline is NOT empty any more, and the hub said it was.** Chat 13's click-through left two sandbox NBDT
  `client_payments` in the DB — `1.2.9999-001` on Path A (Via ERT, the `ert_share` tick) and `2.2.9999-001` on Path B (the
  ladder, by transfer) — both cleared and stamped, with one sandbox Stripe transfer and the Gmail drafts behind them. The
  hub's OWED bullet had said the test payments were gone as of 2026-09-15; they stay until Jake deletes them before
  go-live, alongside the test roster that bullet already tracked.

## 2026-09-15 — Chat 12: Cost Segregation and the Implementation Fee (card payments, absent steps)

- **Two strategies, and the two shapes the four existing models could not describe.** Paul Latham's PDFs added
  Cost Segregation and the Implementation Fee. **Cost Segregation** is a provider receipt like Boxhouse — ERT pays
  Wealth IG a fee per study — with nothing to derive the pool FROM: the amount typed on the receipt row IS the pool,
  so the row asks no inputs at all (`StrategyInputs` renders nothing, the receipt form drops the inputs column and
  the "Expected" hint, `resolveProviderInputs` takes the row amount as a fourth argument). That is model
  `pass_through`. **The Implementation Fee is client-funded through the portal by pay link exactly like LEOS and
  then none of LEOS's arithmetic applies**: no offset, no administration fee, no legal opinion letter, no ERT
  processing fee — the fee the client pays IS the pool. That is model `client_fee_pool`, and it is the case
  `20260909130000` anticipated when it kept `funded_by` and `model` as separate columns: billed here, and nothing
  like LEOS underneath. Migration 38 (`20260915100000_cost_seg_and_implementation_fee.sql`) widens the model CHECK
  to six, seeds both rows ACTIVE with numbered explainers, and adds two nullable columns to `client_payments`:
  **`strategy_model`**, a snapshot like `funded_by` (the step machine sees only the row) backfilled from each row's
  strategy, and **`card_processing_fee`**, the client's card fee, NULL unless a card was booked.
- **Who pays an ERT-affiliated COI, decided from the PDFs.** 831(b)'s sheet carries an explicit "IAG pays ERT COIs
  directly"; the Cost Segregation sheet names no ERT percentage and no exception, and ERT is the payer, so handing
  their share back to ERT would be circular. Cost Segregation therefore joins 831(b) as the strategies where this
  portal pays an ERT-affiliated COI on the ladder by transfer (`affiliated_via_ert` false). The Implementation Fee
  pays them NOTHING: the sheet says ERT, Tax Hive and DDP are not paid on implementation fees, so
  `rules.excluded_motherships` (ERT seeded; a dropdown of every mothership plus removable chips in the edit form,
  each number validated against `motherships` by `save_strategy`) makes a COI under any of them 0% — which lands on
  the existing `Not Due` state rather than inventing one. Tax Hive and DDP get ticked the day they exist as
  motherships. The ERT callout on the strategy card grew a third variant for it.
- **A card, for the first time — copied from VFO's accountant pay page.** The Implementation Fee sheet deducts 2.9%
  for a card; Jake's call was VFO's mechanics instead: the CLIENT pays the card fee, grossed up
  `(fee + 0.30) / (1 - 0.029)` at checkout so Wealth IG nets the whole fee, and nothing comes off the pool. So
  `/pay` offers ACH and, ONLY when `load_pay_link` answers `accepts_card` (a `client_fee_pool` strategy), a
  Credit/Debit Card option with the fee on its own line; `pay_link_checkout` honours `body.method` only on that
  model — LEOS stays ACH-only, a payload field cannot grow it a card — and mints a card session without the
  `us_bank_account` verification option Stripe would refuse. `book-client-payment.ts` reads `amount_received` off
  the PaymentIntent and stamps `card_processing_fee` as the settled charge minus the fee, clamped at zero, on a card
  only. The invoice prints VFO's "Card Processing Fee (2.9% + $0.30)" row and a "Total Charged" band when one was
  taken; the receipt prints the Card Fee Breakdown box; with no card fee both documents are byte-identical to before.
  `utils/fee-label.ts` keeps "Implementation Fee Client Fee" off every document, the pay page and the Stripe line.
- **A card gets no confirmation email, and that is VFO's rule carried over whole.** The "we have received your
  payment" email is for money still in flight. A booking that lands `succeeded` on the spot — a card at checkout, or
  a `payment_intent.succeeded` that beat its checkout event — is stamped `confirmation_status` **`Not Needed`**, the
  column's third value, and the instant invoice and receipt ARE its confirmation. An ACH still books `processing`
  with "Confirmation Needed" and gets the email. `draftPaymentConfirmation` and `resend_payment_email` refuse a
  `Not Needed` row outright ("No confirmation email is sent on a payment that settled on booking: the invoice and
  receipt are the confirmation."), `force` included; sweep leg B excludes it by construction; the detail screen
  hides the Resend confirmation button. The first cut had the confirmation carry `[CARD_FEE_TEXT]` and
  `[PROCESSING_TIME]` tokens for a card; those were reverted the same day once Jake chose VFO's rule.
- **A step a payment NEVER HAD is absent, not greyed (Jake, after the first card click-through).** The first cut
  greyed the three hard-cost steps on an Implementation Fee and the confirmation step on a card with a note each.
  Jake's rule: greyed-with-a-reason is for a step the pipeline HAS and this row lost along the way — a waived letter,
  a share never due — not for a stage that was never part of the journey. `buildPaymentSteps` now spreads the three
  hard costs into the list only off `client_fee_pool`, and the confirmation step only off `Not Needed`; the money
  steps still total to the fee because an absent step carries no amount. Standing UI rule 7 in the hub.
- **Four emails reworded, in VFO's voice.** The request and reminder templates promised "bank transfer"; both now
  carry one `[PAYMENT_METHODS_NOTE]` token (`utils/payment-methods-note.ts`) that names bank AND card, with the card
  fee, on a `client_fee_pool` strategy and bank only everywhere else — one row per template, the strategy deciding
  the sentence (migration 39, `20260915110000_payment_email_methods_note.sql`). The confirmation and the
  invoice-and-receipt emails dropped the document numbers and the account digits from the sentence, the way VFO's
  own seeds read: thank you, what arrived, what follows (migration 40, `20260915120000_client_email_wording.sql`).
  The senders' fallback copy mirrors every row.
- **Every client-funded strategy's card lists its Payments (Jake, mid-test).** The twin of the provider cards'
  Receipts: `StrategyPayments` puts the shared `PaymentsGrid` under LEOS and the Implementation Fee, over
  `load_all_payments` filtered by `strategy_key`, the row opening the payment inside its COI with a one-click trip
  back to the tab. `PaymentsGrid.basisText` prints a dash where nothing was measured (no offset on a fee-pool row,
  no contribution on a pass-through row) rather than "$—".
- **Click-tested by Jake on 2026-09-15 against v44 then v45**, both test COIs: a Cost Segregation receipt paying
  the ERT-affiliated COI by transfer; two Implementation Fees by card (gross-up $30.18 on $1,000, no confirmation,
  documents carrying the fee row, steps absent); one by ACH on the ERT-affiliated COI (confirmation drafted in the
  new wording, COI `Not Due` at 0%, $500 net); a LEOS request whose pay page still offered ACH only and whose draft
  carried the bank-only sentence; the grids' dashes. Every test payment, receipt and notification was then deleted;
  the roster and the fourteen detached `document_numbers` rows stay (hub OWED).
- **Discharged from OWED:** the obsolete `docs/chat-7-restamp` PR note (closed). **Added:** a live card gross-up
  has never run, beside the name rule's live branch. The smoke gate passed 12/12 on v45.

## 2026-09-11 — Chat 11: lump-sum provider receipts

- **A provider pays ONE transfer for several clients, and now the portal records that transfer.**
  Boxhouse, SRA and the DCD strategy each settle a batch — one bank line, one reference, a handful of
  clients — and what an admin is holding when they sit down is exactly that. Chat 10 gave those
  strategies a revenue record per client and an action to clear each one, which meant the same money
  took two gestures per client and **the one figure that actually arrived was never written down
  anywhere as itself**: reconciling a bank line against the portal was adding rows up by hand, and a
  half-paid batch looked identical to a fully paid one. So the shape was inverted. The lump sum is a
  **receipt** — new table `provider_receipts` (`id`, `strategy_key` FK, `amount_received` with a
  `> 0` check, `reference`, `notes`, `received_at`, `recorded_by`, `created_at`) — and the client
  records are its SPLIT, linked by a nullable `client_payments.receipt_id`. That link is what makes
  the money auditable in both directions, from a receipt to the clients it covered and from a client's
  record back to the transfer that paid it, which is the whole point of the table. Deny-all RLS ships
  in the same migration (`20260910120000_provider_receipts.sql`, the 37th), and the anon probe covers
  seventeen tables now.
- **A row is BORN RECEIVED, which is why `mark_revenue_received` no longer exists.** Every
  `client_payments` row `create_provider_receipt` inserts carries its `revenue_received` stamp from
  the first instant, because the money is already here — the receipt IS the clearing event. That
  retires the action outright: `mark_revenue_received` existed to add a stamp to a row raised BEFORE
  the money came, and a row raised by a receipt has never been in that state. Nothing below the pool
  had to change to make this work, and that is the best evidence the shape was right —
  `revenue-share.ts` already reads `revenue_received_at != null` as "cleared" on a provider row, so
  these rows are cleared the moment they exist, and the waterfall, Path A, the transfer, the hold, the
  failure, the retry and the COI's email are all untouched. The provider branch of
  `start_client_payment` went with it: that action now answers 400 "Boxhouse, 831(b) and DCD are
  recorded as provider receipts from the Tax Strategies tab.", because a per-client record raised on
  its own would be half of a split nobody could reconcile against the transfer that paid it. Its LEOS
  branch is unchanged. The per-model input validation was not deleted but LIFTED — verbatim, every
  error string included — into the pure helper `utils/provider-record-inputs.ts`, because a receipt
  runs it once per row inside a loop that has not written anything yet: it may not touch the database
  and it must be able to fail without leaving anything behind.
- **The sum rule is the one new business rule, and it lives in the action because it is a fact about
  a SET of rows.** The client amounts must add up to the money that arrived, to within half a cent —
  `|Σ rows − amount_received| < 0.005`, else 400 "The client amounts must add up to the payment
  received." Each row's COI share is computed off ITS amount and the total is what the bank says, so a
  split that does not add up is a typo whose cost lands on the COIs it would pay. Half a cent rather
  than an exact comparison because both sides are money rounded to cents and `===` would refuse a
  split that is right. It cannot be a CHECK constraint: the rows do not exist as a set at insert time,
  so the table's own constraint is only that a receipt is money at all.
- **Two statements, and a compensating delete is what makes them safe.** The receipt goes in first
  because the rows need its id, so there is a window where a receipt exists with nothing under it; if
  the rows insert fails the receipt is deleted and the admin gets a 500. That delete is safe
  **precisely because nothing has been paid at that point** — no notification, no transfer, no email —
  and every side effect was deliberately placed after both statements land. The new ids are then
  matched back to their prepared rows **by `client_id`, once**, because `.select()` on an insert does
  not promise the order rows were sent in and a share paid against the wrong row is a COI paid the
  wrong amount; the same client may legitimately appear TWICE on one receipt (two boxes, two records),
  so the rows are not deduped and each prepared row claims one id in order.
- **Then, per row and strictly sequentially: the bell, then the share, in process.** `revenue_received`
  now fires from `receipts/create.ts` **once per client row** rather than once per press — a bell is
  about one client's record, not about a transfer — and `runRevenueShare` is chained immediately
  after it, never throwing, exactly as the Stripe webhook chains it on a client payment clearing.
  Sequential and never parallel: each one is a Stripe transfer and a Gmail draft, and firing fifty at
  once is how a rate limit turns into fifty held shares. **A refused transfer is still a 200** with
  `error` on that row — the money arrived, the records are right, and the refusal is a fact about ONE
  COI's payout for the retry button to finish; failing the whole press would leave the admin believing
  nothing was recorded. And **a timeout mid-run self-heals**: what it leaves behind is rows that are
  cleared with their share unfinished, which is precisely the shape sweep leg A exists to pick up, so
  a half-finished press costs a night rather than a reconciliation. The form allows for the same wall
  clock on its side with `callApi(…, { timeoutMs: 90000 })` — a clock, not a retry, since writes are
  never retried.
- **The planner and the recipients are asked PER CLIENT ROW (Jake, 2026-09-10).** The first cut asked
  once for the whole receipt, which was the wrong shape: the receipt is one transfer, but the records
  under it are separate pieces of work owned by different people, and one list applied to the press
  put admins on records they had not chosen and gave a client's record a planner who does not work it.
  So every line carries its own tax planner and its own recipient chips, exactly as a payment raised
  on that client alone would. The roster is read ONCE for the whole press and only if some row named
  somebody — fifty rows must not be fifty directory reads — and every address is resolved against it
  in code before anything is written, lowercased and trimmed, never `.ilike()` (GOTCHA #8), with an
  unknown one answering 400 "Row N: Unknown admin: …" so the admin can fix it on the form in front of
  them. A row with no `recipient_emails` array names NOBODY, the same rule chat 9 settled. Every
  refusal in the action is prefixed `Row N: `, and the form outlines that line in red.
- **Every payment in the portal now starts on the Tax Strategies tab.** "Start payment" sits beside
  every ACTIVE strategy, because an admin arrives holding the STRATEGY rather than the client — that
  is true of a provider's batch by definition, and it turned out to be true of a LEOS request too. A
  provider strategy opens `ProviderReceiptForm`; LEOS opens the same `ClientPaymentForm` as ever with
  a `ClientPicker` as question 1 and the strategy fixed by the hero above it. The client's Payments
  tab lost **Start New Payment** entirely and is tracking only, which removes the one place two
  different kinds of record could have been raised from two different screens.
- **The receipt form is VFO's Specialist Payment Input mechanics on Jake's spec.** From VFO
  (standing rule 3): one `grid` string driving every row and the totals so the columns cannot drift,
  stable line ids from a module counter rather than array indexes, a submit button that says the
  figure it is about to record, and a disabled submit with the first missing answer named above it.
  Jake's spec is the rest: **the TOTAL is typed first**, because it is the fact being held, and the
  lines are what must add up to it; a green/red **Allocated / Remaining** line under the lines, on the
  same half-cent tolerance as the server. Each line is a searchable `ClientPicker` (hundreds of
  clients, and an admin knows the name, not the number) with **"+ Add a new client"** opening
  `AddClientForm` INLINE under the line — the provider has paid for somebody the portal has never
  billed, and sending the admin three screens away would lose the receipt they are halfway through
  typing — the strategy's own inputs, an Amount with a muted **"Expected $X"** from
  `computeProviderPreview` under it to be checked against rather than enforced, that line's own
  notification pickers, and a Sandbox chip when either name says "Test".
- **The receipt screen is the split as it SETTLED, and it carries the one action control this portal
  allows in a list row.** Each provider strategy's card lists its Receipts (Received, Reference,
  Amount, Clients, a one-line Shares summary, Recorded by; rows navigate), and a receipt opens on a
  hero, a Details card and a Clients table — Client → that payment, COI → the COI profile, Basis,
  Expected, Amount, COI share, Share status. Everything on it is stamped, so there is nothing to edit:
  a share that needs finishing is finished on that payment's own screen, one click away through the
  client's name. **The exception, granted deliberately (Jake, 2026-09-10): a `Via ERT` row shows ONLY
  a "Paid by ERT" checkbox until it is ticked**, then a green chip. ERT paying the COI happens outside
  the portal, so nothing but an admin can move that row on, and making them open the payment to do it
  is what leaves a receipt reading finished when it is not. The tick is `update_payment_step` with
  step `ert_share` — the same step, handler and column as the payment detail's own checkbox, not a
  second way to say the same thing — which is also why `load_provider_receipts`' share summary splits
  `via_ert` from `via_ert_done`: an unticked Path A row is money still owed and must not be counted
  with the paid ones.
- **The provider progress list is THREE steps now, not five.** "Revenue record created" and "Revenue
  received from provider" are gone, and their absence is the point: both were true the instant the row
  existed, and a step that is done before the list is first drawn tells a reader nothing. What the
  record was created from and what arrived on it are FACTS on the row, shown as such; the pipeline is
  for work that can still be outstanding — the COI's share, the revenue-share email, the internal team
  share. `PaymentDetail` lost the mark-received checkbox and its inline amount-and-reference confirm
  with them, and gained a **"View receipt"** link to the lump sum the record was one line of, shown
  only to an admin who may see the Tax Strategies tab (for anybody else it would be a trip to a screen
  the portal will not render).
- **Five shared extractions, all of them because a second screen now asks the same question.**
  `shared/MoneyInput.jsx` (the dollar field and its keystroke filter, previously two copies),
  `StrategyInputs.jsx` (the per-model questions plus ONE readiness rule, ONE missing-answer prompt and
  ONE payload mapping, so a strategy cannot be priced differently by the two screens that quote it),
  `shared/NotificationPickers.jsx` (with optional `admins` and `inline` props, so a caller holding the
  roster does not refetch it per row), `shared/ClientPicker.jsx`, `lib/revenuePreview.js` and
  `lib/revShareText.js` (`describeRevShare`, so the receipt summary and the payment detail's retry
  cannot describe one state two ways). Extraction rather than duplication was the rule throughout:
  every one of these had a copy about to be made.
- **One new sessionStorage key, listed twice.** `wigStrategyScreen` holds which of the tab's three
  screens is open — absent, `form:<key>` or `receipt:<id>` — so a refresh lands exactly where the
  admin was (standing rule 5). It went into `SUB_STATE_KEYS` in `Portal.jsx` (now eleven) AND
  AdminLogin's hand-written removal list (now twelve, `SUB_STATE_KEYS` + `wigActiveTab`), which is
  GOTCHA #21 and the reason that entry's counts are updated in this change. `openCoiProfile` and
  `returnToOrigin('tax_strategies')` read it before `goToTab` clears the sub-state and write it back
  after, so a trip out to a COI or a payment comes back to the RECEIPT the visit began on rather than
  to the strategy list. `tax_strategies` joined `WIDE_TABS` for the new grids.
- **Every step now carries TWO phrases, because two screens were asking it different questions.** A
  `PaymentStep` had one `label`, written for the progress list where a tick sits beside it — and the
  overview rows were surfacing that same string under **"Next action"**, on a step that is by
  definition NOT done. So an admin read "Payment request emailed" as the next thing to do, when the
  point of the column was that the email had not gone. `label` is now the STATE and `action` the WORK
  OUTSTANDING, side by side on every step: "Awaiting client payment", "Email payment request to
  client", "Send payment confirmation email", "Awaiting funds to clear", "Pay administration fee",
  "Pay legal opinion letter fee", "Pay ERT processing fee", "Confirm ERT has paid the COI", "Send
  revenue share email", "Retain internal team share". The COI-share step is the one whose not-done has
  kinds, so its action follows its state (`revShareAction`): Failed → "Retry COI revenue share",
  Awaiting Payout Account → "Awaiting COI payout account", processing → "COI revenue share transfer in
  progress", else "Pay COI revenue share". `summarizePayment` surfaces `action` as `next_action` (with
  `label` as belt-and-braces fallback); the progress list still renders `label`. Neither phrase is
  derived from the other, which is the trap: they are written side by side and have to be edited that
  way.
- **Client Overview rows became the work queue they were already almost describing.** The whole row now
  opens that row's payment — hover tint plus a card shadow, which needed the table moved to
  `borderCollapse: separate` so a `<tr>` can carry a shadow at all — and the two NAMES stay links
  precisely because the row itself navigates: each is a shortcut PAST the row's destination, the
  client's name to their profile and the COI's to the COI's, which is the reading of standing UI rule 2
  when the row has a destination of its own (`NameLink` stops the click propagating, so a name never
  also fires the row). An **Admin**-owned next action reads in orange beside an orange Admin chip, a
  settled row says **"Nothing outstanding"** in words rather than wearing an em dash that would read as
  missing data, and a **"Needs admin action"** toggle beside the Status filter (`ListFilterToggle`,
  reading "Admin action only" once on) narrows the list to Admin-owned rows. The toggle is a latching
  pill rather than a dropdown because it has no "which of these" to ask.
- **A visit that deep-links past the COI now returns to its origin in one click.** An overview row
  names a payment and a receipt row names the payment it paid for, so those clicks land the admin two
  or three screens down, inside a COI and a client they never chose to open — and walking back out one
  screen at a time was a trip through somebody else's navigation. `coi_overview`, `client_overview`,
  `accounting` and `tax_strategies` are now `DEEP_RETURN_TOS` (`CoiSearch.jsx`): from one of them,
  `CoiSearch` builds a single `originBack` (`{ label, onClick }`) and hands it down whole, so the client
  screen and the payment screen do not each have to know how a return marker becomes a destination —
  `CoiClients` uses it for its own back link and passes it to `PaymentDetail` as `backLabel` + `onBack`.
  The FIRST back link the admin sees therefore names the origin. `mothership_search` is excluded on
  purpose: it opens the COI profile itself, so its back link is already the first one, and an ordinary
  walk in from COI Search is untouched.
- **GOTCHA #24, found the hard way on 2026-09-10.** Invoking the deploy script from Claude's
  PowerShell tool exactly as #15 documents it failed with `dirname: command not found` and then
  `fatal: not a git repository` — that `bash.exe` had no coreutils on its PATH. The same deploy from
  Claude's Bash tool, which IS Git Bash, worked first try. The rule is by CALLER, not by shell name,
  and the hub's curated gotcha line and the session starter's safety rule now say so.
- **Superseded by this entry, and trimmed out of the hub:** `iag-admin-api` was v39 with 84 `.ts`
  files, ~650 KB, 48 actions and 36 migrations, its smoke gate ELEVEN checks; there were 16 public
  tables and no `provider_receipts`; **`mark_revenue_received` was the 48th action and the CLEARING
  EVENT on a provider-funded record** — one conditional claim stamping the amount, the reference and
  who recorded it, raising the bell and running the revenue share in process, refusing a
  `funded_by = 'client'` row and a second clear, and not undoable — and the `revenue_received` bell
  fired from it, once per record; `start_client_payment` had a PROVIDER branch that raised a
  per-client revenue record with no Stripe customer, no token and no email, and the request form had
  the matching provider half with its "Create revenue record" button; a provider record's progress
  list was FIVE steps, its `revenue_received` row wearing a checkbox that opened an inline
  amount-and-reference confirm with an orange irreversibility warning, sent `manual: false` so
  `update_payment_step` could not reach it; the client's Payments tab carried **Start New Payment**
  and was where every payment began; the signed-in screen was ELEVEN `wig*` keys, ten in
  `SUB_STATE_KEYS`; and `update_payment_step` was described as ticking four steps "never
  `revenue_received`", a step that no longer exists.
- **Shipped as v43** (v40, then v41 for the per-row planner and recipients, v42 for the `via_ert` /
  `via_ert_done` split, v43 for the step `action` phrases), **86 `.ts` files, ~677 KB, 50 actions**
  (49 dispatch-table entries + `admin_login`), **37 migrations**, **17 public tables**, smoke gate
  **12/12 on v43** with `load_provider_receipts` added as the twelfth check. One migration in this
  entry, applied via MCP with the advisor green (`"lints": []`) and the anon probe `*/0` re-run across
  all 17 tables; `deno check` 0 errors and `npm run build` exit 0. Tested end to end on 2026-09-10/11
  against real data — three receipts, six client rows and every share outcome the summary can report —
  and **the test data was then WIPED** (Jake, 2026-09-11): every `client_payments` row, every
  `provider_receipts` row and every payment notification deleted from the live DB. What survives is
  three clients, the two test COIs, motherships 1 and 2, and **eight `document_numbers` rows with a
  NULL `payment_id`** — the registry is never deleted, so those eight numbers stay issued and the next
  invoice continues past them, which is the whole point of it. The sandbox Stripe transfers and the
  Gmail drafts that testing produced live outside the database and are untouched.

## 2026-09-10 — Chat 10: three provider-funded strategies (Boxhouse, 831(b), DCD), revenue received as the clearing event

- **The portal sells four strategies now, and `strategies` had to stop being a LEOS row.** Until this
  chat every rule column on that table was a LEOS column — an administration fee, a legal opinion
  letter, an ERT processing percentage — and every one of them NOT NULL because every one of them
  applied. Boxhouse, 831(b) and DCD have none of the three. What actually differs between the four is
  not the numbers but **how the Available Revenue Pool is arrived at**, so that is what the table now
  records: `model` (`fee_waterfall` | `fixed_commission` | `retention_share` | `contribution_pct`, a
  CHECK constraint rather than an enum type so a fifth model is one ALTER), `rules` jsonb for the
  figures each model needs, and `affiliated_via_ert`. The four LEOS-only columns became NULLABLE — on
  a Boxhouse row there is no administration fee, not a zero one, none, and 0 is a claim the waterfall
  would happily act on. `utils/strategy-models.ts` holds the four model names and the two funding
  sources as tuples, so the CHECK constraint, the save handler's per-model validation and the Tax
  Strategies panel all mean the same list. Migration `20260909120000_strategy_models.sql`, which also
  seeds the three rows with Jake's figures and their full explainer text — INACTIVE, because an active
  strategy appears in the request form and the path that spends their rules did not exist yet.
- **The three rule sets, from Jake's three PDFs (2026-09-09).** **Boxhouse** — a fixed commission by
  box size, MiniBox $9,750 / Bungalow $15,000 / Duplex $19,500, plus a $2,500 implementation fee.
  **831(b)** — the client's premium goes to SRA, SRA keeps a retention fee tiered by the size of the
  premium (10 / 8 / 7 / 6 / 5 / 4 / 3% from $0 / $400k / $650k / $900k / $1.15M / $1.5M / $2M, a floor
  list where a premium landing exactly on a threshold takes that threshold's tier), and Wealth IG
  takes 30% of that retention fee for a first-year client or 20% for a returning one; $1,800
  implementation fee. **DCD** — the pool is 15% of the client's investment; the implementation fee is
  5% capped at $10,000 and is waivable per record. Every figure lives in `rules` and is editable in
  the Tax Strategies panel, because the Boxhouse commissions are already expected to move for 2026.
- **`affiliated_via_ert` splits what used to be one rule, and 831(b) is the exception.** Path A — an
  ERT-affiliated COI's share handed to ERT outside the portal, ERT paying the COI — used to be true of
  every strategy because LEOS was every strategy. It holds for Boxhouse (ERT takes 60% of the pool)
  and DCD (55% charged, **60% when the implementation fee is waived** — waiving the fee moves ERT's
  cut, which is why that second figure sits in `rules` beside the first). It does NOT hold for
  831(b): there the portal pays an ERT-affiliated COI on the level ladder exactly like anyone else,
  which makes it **the only strategy where this portal pays an ERT-affiliated COI**. So Path A now
  needs BOTH flags — `mothership_number === 1` AND the strategy's `affiliated_via_ert` — and the
  mothership alone would send an 831(b) COI down the wrong path. `affiliated_share_pct` stays NOT NULL
  and carries each strategy's Path A split (LEOS 50, Boxhouse 60, DCD 55); 831(b) is seeded 0 and
  never reads it.
- **The implementation fees are INFORMATIONAL, and that was a decision.** All three strategies bill
  one, all three bill it through their own automation, and nobody shares in it. It is computed and
  stored on the record (`implementation_fee_amount`) so a human can see what was charged, and it is
  never part of the split. Its one consequence is DCD's Path A: the waiver moves ERT's cut, so the
  answer is snapshotted onto the record as an input rather than recomputed later.
- **A "payment" on those three strategies is a REVENUE RECORD, because the client never pays through
  this portal.** They pay the provider — Boxhouse, SRA, the DCD strategy — and the provider later pays
  Wealth IG its revenue, often as one lump sum covering several clients. No money for those three ever
  passes through Stripe here, so there is no customer, no pay link, no request email, no confirmation,
  no invoice and no receipt on them. `strategies.funded_by` says who pays and
  `client_payments.funded_by` snapshots it onto the row — deliberately a column of its own rather than
  read off `model`: the two agree today, but they are different facts, and a fifth strategy could
  compute its pool like Boxhouse and still be billed here. It is a snapshot for the same reason
  `coi_paid_via_ert` is: the step machine sees the payment ROW and nothing else, so which pipeline a
  record walks has to be written on it. Migration `20260909130000_provider_funded_records.sql` adds
  that column plus `strategy_inputs` (jsonb, the shape fixed per model and written from the RULES
  rather than from the request body, so a body free to name its own label could not call a MiniBox a
  Duplex), `contribution_amount`, `revenue_expected`, `implementation_fee_amount`, `revenue_received`
  / `_at` / `_by` and `revenue_reference` — and drops NOT NULL from `offset_amount` and `total_fee`,
  because a provider-funded record has no client fee, not a zero one, none. Same table, because it is
  the same question — what is owed to whom on this client's strategy, and has it been settled — and
  one table is what keeps the accounting screens, the step machine and the revenue share from growing
  a second copy of themselves.
- **`start_client_payment` grew a second branch, and the two share everything that is not money.**
  `strategies.funded_by` is the whole switch. The provider branch validates the model's own inputs (a
  box size that exists in the rules; a literal boolean for first-year, because there is no safe
  direction to default it in; a positive premium or investment), computes `revenueExpected` through
  the same pure function the clearing stamp will use, refuses a zero pool with "These inputs leave no
  revenue to share.", stores the informational implementation fee, snapshots `coi_paid_via_ert` off
  the expected pool so the progress list shows the ERT path from the day the record is raised — and
  then does NOTHING external: no Stripe customer, no checkout token, no email, and the client's
  address is not even required, because nobody is being written to. The tax planner, the recipients,
  the notes, the Stripe mode and the insert itself are the same code as LEOS. The mode is still
  decided from both names, because the COI's share will be transferred on it.
- **`mark_revenue_received` is the clearing event, and it is the 48th action.** There is no Stripe
  webhook to say a provider's money is here, so an admin says it. One conditional claim
  (`.is("revenue_received_at", null)`) writes the amount, the timestamp, who recorded it and the
  provider's optional reference; then it raises the bell and calls `runRevenueShare` IN PROCESS,
  exactly as the webhook chains it on a client payment clearing — because this IS that moment for
  these records. It answers the same body as `load_client_payment` plus a `rev_share` block carrying
  the run's outcome, so the screen can say what happened to the COI's money in the same breath, and a
  transfer Stripe refused comes back as a 200 whose reason is the only thing worth reading. **It
  cannot be undone**, and that is the point rather than an omission: the stamp is what the COI's share
  is computed from and transferred against, so an editable received amount would be a payout sized by
  a figure that no longer exists. A wrong amount is a conversation with whoever moved the money, not a
  button. Any admin session may run it; the claim is conditional because two admins can press it at
  the same moment and exactly one may clear the record.
- **Below the pool, nothing is new — and that is the design.** `revenue-share.ts` reads "cleared" as
  `revenue_received_at != null` on a provider row and `payment_status === "succeeded"` on a client
  one, then stamps the waterfall through `computeProviderWaterfall` instead of `computeWaterfall`.
  Same `Waterfall` shape, same ten columns, same one conditional `.is("available_pool", null)` update,
  never recomputed. The three hard-cost figures and the processing percentage come back ZERO rather
  than absent, so the screen can still total them; **the pool IS the money** — whatever the provider
  actually paid, not what the record expected, because a lump sum rarely matches a per-client
  expectation to the cent. Not Due, Via ERT, the transfer, the hold, the failure, the retry and the
  COI's email are all the LEOS code on the LEOS columns. `retry_revenue_share` accepts a provider row
  on the same clearing rule, with its own wording for a record whose revenue has not arrived. In the
  nightly sweep, legs B to E filter `funded_by = 'client'` explicitly — nobody was emailed and nothing
  was charged on these records, and several of those legs would exclude them today only by ACCIDENT of
  a null column — while **leg A takes both pipelines**: once a record has cleared, however it cleared,
  the COI is owed the same share by the same helper.
- **A latent Stripe bug, found by Jake's testing and fixed: the transfer's idempotency key is now per
  ATTEMPT.** The key was `revshare-client-<payment_id>`, fixed per payment. Stripe replays the first
  response it saw for a key for 24 hours and **a refusal is a response**, so a transfer Stripe declined
  — an "insufficient available funds" on 2026-09-09 — left the row Failed and could never be retried
  into a success: every press of the retry button and every sweep was handed the cached refusal back,
  even after the balance had been funded. The share became payable again the next day only by accident
  of the cache expiring. The key is now minted per attempt and written by the SAME conditional update
  that claims the transfer, into `client_payments.rev_idempotency_key`
  (`20260909150000_rev_idempotency_key.sql`), so the key and the in-flight state land together or not
  at all. It is reused in exactly one case — a mid-flight resume from `"processing"`, reachable only
  under `force`, where a transfer may already exist at Stripe. Both guards are intact: the claim stops
  two concurrent deliveries, the key stops a committed transfer whose response was lost. LEOS was
  always exposed to this; it had simply never been refused. GOTCHA #22.
- **One neutral COI revenue-share email, not one per strategy.** The email now covers two kinds of
  record — a client fee the client paid us, and a provider-funded record the PROVIDER paid us — so
  every line has to be true of both. `20260909160000_coi_revenue_share_email_neutral.sql` rewrites the
  seeded body and the fallback constants that mirror it: "Payment received" rather than "Client fee
  received", a **Reference** row rather than "Receipt number", and the "Paid in full" line dropped.
  `[RECEIPT_NUMBER]` resolves to the client's receipt on LEOS and to the provider's revenue reference
  on the other three (an em dash when neither exists), and `[TOTAL_FEE]` to whichever amount actually
  arrived, because `total_fee` is NULL on a provider-funded record. `email_templates` still holds
  SEVEN rows — this was a rewrite, not an eighth.
- **A seventh notification rule, `revenue_received`.** Payment area, sort 15, between "Client
  submitted payment" (10) and "Funds cleared" (20), because that is where it happens in the life of a
  record: it is both of those events at once for a pipeline that has neither.
  `20260909140000_revenue_received_rule.sql`, shipped with the same
  `["TAX_PLANNER","PAYMENT_RECIPIENTS"]` default every other rule carries and `recipients` NULL. It is
  deliberately NOT folded into `funds_cleared` — one is Stripe telling us a client's money settled, the
  other is a colleague telling us a provider paid up, and an admin has to be able to switch off one
  without silencing the other. `utils/notify.ts` composes the headline amount from
  `revenue_received ?? revenue_expected` on a provider row, since there is no client fee to name.
- **The Tax Strategies tab renders each model with its own rules form and its own explainer.**
  `TaxStrategiesPanel.jsx` branches on `model`: the box-size table for Boxhouse, the retention tiers
  plus the two Wealth IG percentages for 831(b), the pool percentage plus the capped implementation
  fee and BOTH Path A splits for DCD, the six LEOS fields as before. Every strategy carries an **ERT
  callout** that says out loud who pays an ERT-affiliated COI on it — Jake's ask, and the only place
  the 831(b) exception is legible without reading a rule set.
- **The request form asks the strategy's own questions, and the preview mirrors the server.**
  `ClientPaymentForm.jsx` reads `funded_by` off the chosen strategy: a provider strategy hides the
  offset, the fee and the legal-letter tick and asks for a box size, or a premium plus first-year /
  returning, or an investment plus an "Implementation fee charged" box (held as CHARGED, like the
  legal letter, so the box reads as the thing being turned off). `computeProviderPreview` mirrors
  `expectedRevenue`, `implementationFee` and `computeProviderWaterfall` step for step, exactly as
  `computePreview` mirrors `computeWaterfall` — the admin is shown what the provider will owe before
  the record is raised, so the server has to arrive at the same figure — and it is DISPLAY ONLY: the
  inputs go to the server, not the arithmetic. The implementation fee shows as a note under the pool,
  never as a line in the split. The button reads **Create revenue record**.
- **The grids and the overviews stopped speaking LEOS.** `PaymentsGrid`'s two money columns are now
  **Basis** and **Amount**: Basis is the offset on LEOS, the box label on Boxhouse and the
  contribution on the other two; Amount is the client fee, or the received revenue, or the expected
  revenue with a muted "expected" beside it. A provider record's two stages are its own — "Awaiting
  provider payment" and "Revenue received" — because it has no Stripe state to report and never had a
  request emailed. Client Overview carries the same fields, and its cells may wrap so the table still
  fits 1180px without horizontal scroll.
- **The payment detail screen tells the truth about which record it is showing.** A provider record
  shows the inputs it was raised on, the expected and received revenue, the received date and the
  reference, and hides the client fee, the payment method, the documents and every email action —
  each of which would otherwise be an em dash claiming something is missing. Its progress list is five
  steps: the record created, **Revenue received from provider**, the COI's share, the revenue-share
  email and the internal team share. The clearing step wears the same checkbox as the LEOS manual
  ticks, but ticking it OPENS an inline confirm — amount pre-filled with the expected figure, an
  optional reference, and an orange line saying the share is paid out the moment Confirm lands and
  cannot be undone — because it carries an amount and pays the COI. The server keeps sending
  `manual: false` on it, which is what keeps `update_payment_step` unable to reach it: a tick with no
  amount would clear a record and pay nobody.
- **New standing UI rule (Jake): a step whose amount is not calculated yet is greyed AND unclickable.**
  Nothing can have been paid that has not been calculated, so a money step carrying a null amount now
  reads at the same 0.45 opacity as an inapplicable one, its manual checkbox is locked, and "Pending
  calculation" beside the label says why. The entry step that supplies the figure is the one exemption
  — it is the step the admin is meant to click, and it reads "Pending" rather than "Pending
  calculation", because nothing is being calculated there.
- **The creator is no longer auto-seeded as a notification recipient** (Jake, 2026-09-09). The form's
  chip row starts EMPTY, nobody pre-selected, and `start_client_payment` inserts exactly whoever the
  body named — a body with no list at all now names NOBODY, where it used to seed the raising admin.
  Whoever should hear about a payment is a decision the form asks for, and seeding the admin who
  happened to raise it put people on records they had not chosen. The insert is still non-fatal.
- **Superseded by this entry, and trimmed out of the hub:** `iag-admin-api` was v33 with 82 `.ts`
  files, ~600 KB, 47 actions and 30 migrations; `strategies` held LEOS alone, its rule columns all NOT
  NULL and its `affiliated_share_pct` the one Path A split; `notification_rules` held six rows;
  `client_payments.offset_amount` and `total_fee` were NOT NULL and every payment was a client fee;
  the COI revenue-share email named a client fee, a receipt number and "Paid in full"; the
  revenue-share transfer's idempotency key was fixed per payment (`revshare-client-<payment_id>`); the
  hub carried the **DB-driven sandbox toggle** as parked, which the by-name mode rule has superseded
  outright; and
  both `start_client_payment` and `20260904120000_payment_notification_assignments.sql` seeded the
  creator as a notification recipient.
- **Shipped as v39** (deployed 2026-09-09), 84 `.ts` files, ~650 KB, 48 actions, 36 migrations, still
  16 public tables, smoke gate 11/11 against v39, and all NINE of this chat's Phase 3 checks run
  against real data. Six migrations in this entry, all applied via MCP with the advisor green
  (`"lints": []`) and the anon probe `*/0` re-run on the two tables they alter, `client_payments` and
  `strategies`;
  `20260910100000_activate_provider_strategies.sql` is the last of them and switches the three
  strategies ACTIVE — a migration rather than a dashboard toggle, because the moment these became
  sellable belongs in the history the repo carries.

## 2026-09-04 — Chat 9: per-payment assignments, the LEOS waiver, the notification bell, Stripe mode by name

- **The Stripe mode is now decided PER ENTITY, BY NAME — which means real clients go LIVE the moment
  this deploys.** `utils/stripe.ts` no longer holds a `STRIPE_MODE` constant and `getStripeMode()` is
  gone. In its place a new `utils/stripe-mode.ts` carries Jake's rule (2026-09-04): anyone with "Test"
  anywhere in their name runs in Stripe sandbox, everyone else runs live. `isTestName`, `modeForNames`,
  `modeForCoi` and `modeForPaymentRow` are the whole of it, and `getStripeKey(mode)` and
  `stripeFetch(path, params, { mode })` now REQUIRE the mode — not for tidiness but so the type gate
  refuses a caller that forgot to say which money it is moving. The model is VFO's: a payment's mode is
  decided ONCE, from the client's AND the COI's names, stamped on `client_payments.sandbox` at request
  time, and read back OFF THE ROW by `pay_link_checkout`, the webhook booking and the revenue share —
  exactly what `coi_level_at_payment` does with a level, and for the same reason: a client renamed after
  they paid must not be able to flip a live payment onto a test key. The COI's name counts for a client's
  payment because the client's test-ness is inherited from whoever referred them, and because the Connect
  account the share is transferred to is the COI's. A COI's own objects follow their own name
  (`coi_stripe_connect_request`, `connect_setup_link`, `coi_connect_status`, sweep leg F). Consequently
  the webhook's GLOBAL `livemode` guard could not stay — there is nothing global left to compare against
  — so it moved into `bookClientPayment`, where it runs after the payment row is read and before any
  write: `event.livemode === !!row.sandbox` IS the mismatch, and it answers Stripe the same 200
  `skipped: "mode_mismatch"` with nothing written, because a 4xx would make Stripe retry forever. The
  `stripe_events` upsert still happens BEFORE booking — record first, act second. The traps this rule
  brings are GOTCHA #20; no migration was needed for any of it, and the secret NAMES are unchanged.
  Three surfaces now SAY the mode out loud: an orange "Sandbox" chip on the payment hero and in the
  payments list (from `payment.sandbox`, the stamped row), the same chip on a COI's hero (from their
  name), and a line under the request form's fee box — "Sandbox payment — test names never move real
  money." or, in orange, "Live payment — real money." — read from a one-function
  `src/lib/stripeMode.js` that names the backend file as the authority.
- **The two chat-1 test actions are gone.** `create_test_checkout` and `admin_test_draft` proved the
  Stripe and Gmail wiring on day one and have been dead weight since the real pipelines landed; both
  also said "IAG Portal" in outbound content, which was an open OWED item. `actions/stripe/` and
  `actions/admin/` are deleted along with their dispatch lines, taking the table from 48 to **46**
  entries (**47** actions with `admin_login`). Nothing in the frontend ever called either.
- **A scripted smoke gate, ported from VFO's `smoke-pipelines.ps1`.** `scripts/smoke.ps1` in the backend
  repo logs in (or takes `$env:IAG_SMOKE_TOKEN`) and fires eleven read-only loaders — one per area of
  the portal — asserting 200 and no top-level `error`. It is a WIRING check: it catches what a shared
  edit to `router/`, `index.ts`, `middleware/auth.ts` or `utils/` breaks, and replaces nothing.
  PowerShell 5.1-safe throughout (no `&&`, a BOM-free temp file, `curl.exe -w "HTTPSTATUS:%{http_code}"`
  because 5.1 has no `-SkipHttpErrorCheck`), credentials from the environment and never from the file.
  Exit 0/1/2. It is named in the backend README and has replaced the `<SMOKE_GATE>` placeholder in
  `SESSION_WRAPUP.md` Part 2.
- **Sentry on the frontend, wired but silent.** `@sentry/react`, `Sentry.init` in `src/main.jsx`, and a
  new `src/components/ErrorBoundary.jsx` wrapping the app so a React render crash — which React
  swallows before the global handler ever sees it — is reported explicitly from `componentDidCatch`
  instead of leaving a blank white screen. Error monitoring ONLY: no Session Replay (it would record the
  DOM and inputs, which here means client PII) and no tracing. `enabled` is
  `import.meta.env.PROD && SENTRY_DSN !== ''`, so dev sessions report nothing and the empty DSN keeps
  the whole thing switched off until Jake pastes the project's in. A DSN is a public ingest-only
  address, safe in source the way the anon key is, which is why it is a literal rather than an env var.
  `docs/integrations/sentry.md` is the new doc, and a DOC MAP row points at it.

- **One payment now names the people around it, and the two kinds of naming are stored differently
  on purpose.** The **tax planner** — the single admin who earns on a payment — is a COLUMN,
  `client_payments.tax_planner_email`, a hard FK to `admins.email` with `ON DELETE SET NULL`:
  exactly one is a property a column enforces for free, it is money-bearing, and a later revenue
  rule has to be able to trust that reading the payment row IS reading the answer, with no aggregate
  in between. An admin who leaves must not take the payment with them, hence SET NULL rather than
  cascade. The **notification recipients** are a SET, so they get a table —
  `payment_notification_recipients`, `(payment_id, admin_email)` UNIQUE, CASCADE from both sides,
  carrying `added_by`. No ordering, no cardinality limit, no money: nothing downstream asks who the
  third recipient is, only whether somebody is on the list. A `text[]` would have answered that too,
  but it could not carry the FK, the `added_by`, or the unique constraint that makes a double-add a
  no-op. Migration `20260904120000_payment_notification_assignments.sql`, taking the count to **24**
  and the schema to **14 tables**; deny-all RLS ships in the same migration, the anon probe answers
  `*/0` and the advisor stayed green.
- **Two new actions, and one loader that got a roster.** `set_payment_tax_planner` (empty email
  unassigns) and `update_payment_recipient` (`subscribed: true|false`, idempotent in BOTH
  directions — a re-add swallows the 23505 and a remove of somebody absent is a no-op, because a
  double-click is not an error) take the dispatch table from 40 to **42** entries (43 actions with
  `admin_login`). Both are open to every admin: an assignment is a workload decision the team makes
  among themselves, not a rank. Both re-read through `loadPaymentDetail` and answer the SAME body as
  `load_client_payment`, which is now composed by one shared `paymentDetailBody` helper rather than
  spelled out per handler — a field added to the detail and forgotten in one write is exactly how a
  click starts blanking half a screen. The loader also ships the admin ROSTER (email and name ONLY,
  never the passcode, rank or tab grants) with every payment, because any admin may open a payment
  while `load_admins` is superadmin-only. Recipients are joined to that roster in code, not through
  a PostgREST embed, matching the rest of the codebase.
- **A Notifications card sits between Progress and Details, and the list starts populated.**
  `PaymentDetail.jsx` gained a single-select tax planner (`Unassigned` plus every admin) and an
  "Other notification recipients" chip row with an `Add admin…` picker that empties out to a disabled `All admins added`.
  Both write optimistically with rollback and an inline red error, the way the Admin Editor's tab
  checkboxes do, behind one `busyAssign` flag mirroring `busyStep` — two writes to the same payment
  would race, and each answers with the whole detail. Every response that carries a detail is
  applied through one `applyDetail` helper, so the load and all three writes re-render the screen
  from server truth instead of patching state. `start_client_payment` seeds the raising admin as the
  first recipient, NON-FATALLY — the payment request and the Stripe wiring are what that action is
  for, and a convenience row anybody can re-add must never cost a client their payment link — and
  the migration backfills the same for existing payments, joining `admins` so a `created_by` that no
  longer matches anyone is skipped rather than breaking the FK. **Nothing is sent.** There is no
  notifications table, no bell backend and no fan-out yet; Phase 3 is what turns these rows into
  bell notifications.
- **A greyed-out step now says why it is greyed out, and the people are named on the request form.**
  Two edits from Jake's testing. `PaymentStep` gained an optional `note`, set ONLY on the steps this
  payment does not have and rendered by `StepRow` as muted 12px text after the label — "Waived on
  the request form" on a waived legal letter, "No share was due" on an `ert_share` or revenue-share
  email the waterfall left nothing for, and "ERT pays the COI, so no email from the portal" on a
  Path A payment. Greyed out was already a fact; on its own it was not an answer, and the reason is
  a property of the row rather than something the admin should have to infer from a strategy rule.
  Second, `ClientPaymentForm` now asks for the **tax planner** and the **notification recipients**
  at request time, with the same two controls the detail screen's Notifications card carries, so a
  payment is never raised with nobody named on it. That needed a roster an ordinary admin may read:
  `load_admin_directory` (a 43rd dispatch entry, **44** actions), email and name only, deliberately
  NOT superadmin-gated the way `load_admins` is, because any admin assigns planners and recipients.
  `loadAdminDirectory` in `actions/admins/directory.ts` is now the ONE place that read happens —
  `load-client-payment.ts` calls it too rather than selecting its own columns off `admins`.
  `start_client_payment` validates every address against that roster BEFORE the insert (400 `Unknown
  admin: <email>`, compared as lowercased trimmed strings in code, never `.ilike()`), stamps
  `tax_planner_email` in the roster's own spelling, and seeds the recipients as the UNION of what
  the form named and the raising admin, in one insert, still non-fatal. The form loads the roster on
  mount with both controls inert until it lands — it is far too small for a skeleton and "Loading
  admins…" is not allowed — and a roster that never arrives leaves the form fully submittable behind
  one red line, since the server seeds the creator on its own.
- **The Progress list now accounts for every dollar of the fee, in the order things happen.** A
  final step, `net_profit` ("Internal team share retained", owner Wealth IG, no checkbox — nothing
  moves, WIG simply keeps it), closes the list with `net_profit_pool` as its amount, done once the
  COI's share is settled. The confirmation step moved ahead of clearing (it is drafted when the
  client submits, while an ACH is still in flight) and the separate "Funds cleared" tick was folded
  into "Invoice and receipt — funds cleared", since the documents are drafted at the very moment the
  money clears and the two ticks could only ever agree — ten steps, Jake's call during Phase 4.
  With it the five money steps — admin fee, legal letter, ERT processing, COI share, internal team
  share — sum to `total_fee` by construction, and the card shows that sum as a **Total** line under
  the steps once every amount is stamped: it is the sum of what is on screen, not the fee column,
  so the two disagreeing would be visible rather than hidden.
- **A browser refresh now lands on exactly the screen it was fired from, at every depth.** It did not:
  refreshing on a payment detail fell back one or two screens, because the open payment was React
  state that died with the page, and the two drill-in keys — `wigSelectedClient` and
  `wigClientFeatureTab` — were read ONCE by the profile screens and deleted on the spot, so the client
  underneath the payment went with it. Read-once was a real concern badly answered: a later remount
  had to land on the LIST, not on whoever was open last. The answer is the discipline VFO's
  `MembersPanel` already uses — the key stays put and EXPLICIT navigation clears it. `goToTab` still
  wipes the sub-state on any nav click, the back links now clear the level they leave, and opening a
  different COI, client or payment overwrites the level below it, so nothing stale survives a move
  while everything survives a reload. The open payment joins them as an eleventh key,
  `wigSelectedPayment`, written by BOTH places `PaymentDetail` is mounted — a client's Payments tab
  and Accounting → Payments — and cleared on sign-in with the rest. A key pointing at something
  deleted cannot wedge a screen: the detail still renders its not-found card, and its back link is
  what clears the key.
- **Two LEOS revenue-share rules the waterfall could not previously express, and a sixth `rev_paid`
  state to carry the second.** From Jake's "Understanding Revenue Share for the LEOS Strategy".
  **(1) The legal opinion letter can be WAIVED, per payment.** A repeat client running the exact
  same strategy as last year may not need a new one — the tax advisor's call — so the flag belongs
  on the payment, not on the strategy: `client_payments.legal_fee_waived`, decided ONCE on the
  request form (a "Legal opinion letter required" checkbox, ticked by default) because the client is
  invoiced a fee that already assumes the answer. Waived zeroes that line for that payment alone; the
  strategy's flat fee is untouched and the next payment asks again. The step stays in the pipeline
  as a greyed, untickable "Legal opinion letter waived" at **$0.00** rather than dropping out, so
  the money steps still sum to the client fee and the screen's Total stays honest.
  **(2) ERT-affiliated COIs are on Path A.** A COI whose mothership is ERT (`mothership_number = 1`)
  does not earn by level at all: after ERT's processing fee the Available Revenue Pool is split with
  Wealth IG at the new, editable `strategies.affiliated_share_pct` (50 today, a form field rather
  than a constant so a renegotiation is not a deploy). Their share is paid to ERT OUTSIDE the portal
  and ERT pays the COI, so the portal computes it, records it, moves no money, sends the COI no
  revenue-share email, and an admin ticks it off exactly like the three hard costs. `rev_paid` gains
  **`Via ERT`** — terminal for the transfer pipeline, and the one state whose completion lives
  somewhere else: `rev_completed_at` stays NULL because the manual `ert_share_done_at` IS the
  completion. `retry_revenue_share` refuses it outright ("paid to ERT outside the portal — tick it
  off on the payment"), and **the nightly sweep can never re-attempt one for free**: leg A spells its
  candidate states out rather than using `.neq`, so a value that is not on the list is not a
  candidate — a property of the list, which is why widening that predicate would silently undo it.
- **The five new columns, and why two of them are snapshots.** Migration
  `20260904150000_leos_waiver_and_ert_path.sql` takes the count to **25**: `strategies.affiliated_share_pct`
  plus `client_payments.legal_fee_waived`, `coi_paid_via_ert`, `ert_share_done` and
  `ert_share_done_at`. No new table, so no new RLS — both tables already carry deny-all from the
  migrations that created them, and a new column inherits it; the advisor stayed green. Every column
  is NOT NULL with a default, so **existing payments are untouched**: a booked row reads false for
  both flags, which is exactly what it was. `coi_paid_via_ert` is a SNAPSHOT for the same reason
  `coi_level_at_payment` is one — a COI can move mothership, and more to the point the step machine
  sees only the payment ROW, with no COI and no strategy in front of it, while a stamped waterfall is
  never recomputed. `computeWaterfall` therefore returns a tenth key alongside the nine figures and
  the whole object is spread into the one conditional stamp, and it now takes `legalFeeWaived` as a
  REQUIRED input so no caller can forget it and quietly charge for a letter nobody ordered.
  `update_payment_step` gains `ert_share` by adding one string to its whitelist — the columns follow
  the existing `${step}_done` / `${step}_done_at` shape — and the COI Overview counts a Path A share
  as earned only once that tick is on, never at `Via ERT` alone, which would credit a COI for money
  still sitting with us.
- **Adjacent bug, fixed: saving a strategy's fee boxes was blanking its explainer.**
  `save_strategy` treated a missing `explainer` as `""` and wrote it, while the Edit Rules form has
  never sent the field — so every percentage change wiped the strategy's write-up, which only a
  migration puts there and nothing would have put back. An OMITTED explainer now leaves the column
  alone; one that arrives as a string is still validated and may still be deliberately empty. The
  two strategy selects were also collapsed from `"a, b, " + "c"` into single string literals
  (GOTCHA #16) while the new column was added to them.
- **Every email to or about a client names the client in the subject.** Jake's rule, and VFO's
  standing shape — brand prefix, what the email is about, then the client's full name after a dash.
  The four client emails (request, reminder, confirmation, invoice and receipt) now end in
  `[Client Name]`, by migration `20260904152000_client_email_subjects_client_name.sql` plus the four
  `FALLBACK_SUBJECT` constants edited with the seeds; no handler code changed, since every one of
  those helpers already ran `applyTokens` over the subject. The COI revenue-share subject already
  carried `[COI Name]: [Client Name] ([CLIENT_NUMBER])`, and the two COI payout-setup emails have no
  client in scope, so those three stand. Migrations: 27.
- **Client Overview is ONE ROW PER PAYMENT, reversing chat 8's one row per client — Jake's call on
  2026-09-04.** A client with three payments was showing one and hiding two behind whichever was
  newest, which is the opposite of what the panel is for: spotting the payment that has been sitting
  on an unsent confirmation for a fortnight. `load_client_overview` now answers a row per payment —
  the client and COI fields repeated on each, plus `payment_id`, `strategy`, `total_fee`,
  `payment_created_at`, `stage`, `next_action` and `next_owner` — ordered client number ascending
  and, within a client, newest payment first; a client with NO payment still gets exactly one row,
  every payment field null. The stage and next-action derivation came out of
  `summarizeClientPayments` into `summarizePayment(row)` in `actions/overview/shared.ts`, which the
  per-client summary calls on its newest payment, so the COI panel's expanded client list and this
  panel read one rule or none. Payments are still read with `select("*")` (the step machine needs
  columns the response never returns) and `checkout_token` is still named by no field, so it cannot
  escape. On the panel the **Payments count column is gone and Fee takes its slot** — Client # ·
  Name · Status · COI · Strategy · Fee · Stage · Next action · Owner, still nine, still all
  left-aligned, with `moneyText` copied verbatim from `PaymentsGrid` so this fee and the fee on the
  payment it links to read identically, and a no-payment row showing em dashes in Strategy, Fee and
  Stage. The client's name now opens THAT payment: `openClientProfile` takes a `paymentId` and seeds
  `wigSelectedPayment` beside the client and its tab, which `CoiClients` reads on mount, and the
  existing `wigCoiReturnTo` marker still walks the back links out to Client Overview.
- **The bell is real: six payment events now raise in-portal notifications.** Migration
  `20260904160000_notifications.sql` (**28**, **16 tables**, deny-all RLS in the same migration, anon probe `*/0`, advisor
  green) adds `notifications` — one row per admin per event, so `read` is a per-person fact and two admins watching the same
  payment each clear their own copy — and `notification_rules`, seeded with twelve rows carrying an on/off switch and an
  audience, **trimmed to six the same day** (see below). Each row is stamped with `member_number`, `client_id` and `payment_id` at insert time, because the portal is one
  route whose navigation is three sessionStorage keys and a click must write them without a lookup of its own.
  `utils/notify.ts` is the single fan-out: it composes the headline itself (`Funds cleared - Test Client ($15,000.00 LEOS)`)
  so no call site can raise a bell that fails to name the client, resolves the rule's audience for that payment, skips
  anyone already holding an UNREAD row for that `(payment_id, rule_key)` — the resend button, the sweep and a redelivered
  webhook all pass through it — and NEVER throws: every failure is a `console.warn` and a return, because a notification is
  an annotation on money that has already moved. The calls sit in the payment helpers, each AFTER the latch write
  that made the outcome true. Five actions (`load_notifications` with its pre-limit `unread_count`,
  `mark_notification_read`, `mark_all_notifications_read`, `load_notification_rules`, `save_notification_rule`) take the
  dispatch table to **48** entries, **49** actions; all three notification handlers scope on `auth.email` and never on a
  payload field, and the single-row mark puts the ownership check in the same statement as the id. The header bell polls
  every 30s, badges the unread count in WIG orange, marks read BEFORE navigating (the destination's own poll would otherwise
  resurrect the row) and deep-links straight to the payment; `NotificationEditorPanel` replaces the last placeholder.
  `docs/flows/notifications.md` carries the whole flow.
  **The editor asks for a TITLE, not a list of people — the first cut asked the wrong question and was replaced.** Jake's
  words on it: "I don't like how this notification editor is formatted. See how it's done for VFO portal. It should just
  have general titles for who is notified — I don't want to add each admin individually." The first version offered an "Also
  notify" chip row of individual admins layered ON TOP of an audience the code worked out for itself, which is stale the day
  somebody joins and needs twelve rules walked to fix. So `20260904161000_notification_rules_audiences.sql` (**29**, no RLS
  change — the deny-all policy ships with the table) adds `area`, a NULLABLE `recipients` and `default_recipients`
  (`["TAX_PLANNER","PAYMENT_RECIPIENTS"]`) and **drops `extra_recipients`**, which shipped in the same session still holding
  its seeded empty list, so there was nothing to preserve and a column kept "just in case" is a second answer to who hears
  an event. `recipients` now holds four general titles — `TAX_PLANNER`, `PAYMENT_RECIPIENTS`, `ALL_ADMINS`, `SUPERADMINS`
  (`is_superadmin` plus the floor superadmin) — plus a literal address as the one-off escape hatch, resolved at fan-out time
  against today's roster and today's payment, so a new admin is inside `ALL_ADMINS` the moment their row exists. The tokens
  live in ONE backend constant, `constants/notification-tokens.ts`, imported by both `notify.ts` and the save action: a
  token can never be storable but unresolvable. `recipients` is **NULL until edited** and an override **REPLACES** the
  default rather than adding to it — "only the superadmins hear about a failed transfer" has to be expressible, and an
  additive list can never take anybody away — while Reset to default writes the NULL back, and an empty array stores NULL
  for the same reason. An override that resolves to NOBODY falls back to the default, VFO's rule: an editing mistake must
  not silently lose news about money, and only a disabled rule is silence. `save_notification_rule`'s body is now
  `{ key, enabled?, recipients? }`, 400 `Invalid recipient:` for anything that is neither token nor email and 400 `Unknown
  admin:` for an address off the roster, still compared as lowercased trimmed strings in code, never `.ilike()`. The panel
  is a port of VFO's `NotificationEditorPanel` on WIG tokens: the rules in four collapsible areas (Payment request,
  Payment, Paperwork, Revenue share) with a count badge and an orange "N edited"; each card collapsed to one line — label,
  `OFF` flag, the effective audience as labels, an orange **· edited** — and expanded to the description, the audience chips
  (tokens filled, addresses outlined, each with a ×), an `Add recipient…` select with **Audiences** and **Admins**
  optgroups, an "or any email…" box, a `Default: …` footnote, the Enabled tick, and Save / Reset to default with an inline
  confirmation for 2.5s. Advisor stayed green.
  **Then twelve came down to six — the count was the bug.** Jake, on the finished editor: "we don't need THAT many
  notifications — see how VFO portal does it, only the important stuff; the rest they can see in the email they are CC'd
  in. Just: they have paid, the money has arrived, and if anything went wrong." A bell is an INTERRUPTION, and an
  interruption spends attention whether or not it earns it, so twelve per payment is a bell nobody reads — the same as no
  bell at all. The six that went (`payment_request_sent`, `confirmation_drafted`, `invoice_receipt_drafted`,
  `rev_share_paid`, `rev_share_via_ert`, `payment_reminder_sent`) were all announcements of ROUTINE SUCCESS, and every one
  of them already put an email in front of the same admins, who are CC'd on it: the bell was repeating their inbox. The six
  that stay are the two facts they want without asking — `client_paid`, `funds_cleared` — and the four somebody has to act
  on: `payment_request_failed`, `invoice_receipt_failed`, `rev_share_held`, `rev_share_failed`.
  `20260904162000_notification_rules_trim.sql` (**30**, no RLS change — the deny-all policy ships with the tables and
  deleting rows does not touch it) drops those six rules AND the `notifications` log rows carrying their keys: `rule_key` is
  loose text on purpose, so an orphaned row would sit on a bell forever with no switch anywhere that could turn it off, the
  one case where deleting history is kinder than keeping it. The five call sites lose their calls and each gains a comment
  saying the silence is deliberate; `confirmation-email.ts` and `reminder-email.ts` drop the `notifyPaymentEvent` import
  entirely, and the reminder is now the one step with no bell in either direction — an undrafted reminder leaves its latch
  unset and tomorrow night's sweep retries the same row, so nobody has to act on it. `sort` is left gappy on purpose: it is
  an ordering, not a position. All four editor areas still hold a rule (Paperwork keeps `invoice_receipt_failed`), and the
  panel filters `AREA_ORDER` against the rules it actually received, so an emptied area would vanish rather than render a
  heading with nothing under it. Advisor green, `deno check` clean.
- **Every untested path from chat 8 has now run against real data.** A second test COI, `2.2.9999`, under a new
  mothership 2 (an ERT-affiliated COI can no longer reach these states), took one payment through the whole Path B
  ladder: cleared with no payout account → `Awaiting Payout Account` (held line, Retry button, "Revenue share held"
  bell); a bogus account id → `Failed` (Stripe's reason now in RED on the detail — a refused transfer answers 200 with
  `error`, and the message had been going through the green success line); the first COI's sandbox account copied over
  → `succeeded`, transfer, Level 3 · 40% email. Then the sweep, fired through the cron job's own command: a dry run
  named exactly the expected candidates, run one drafted the confirmation (B), the invoice and receipt with the SAME
  numbers (C), the request email (D) and the Connect reminder (F, with the payable COI marked complete and unmailed),
  run two drafted the payment reminder (E) and offered nothing else because every latch held. The zero-pool guard
  answered 400 to a DevTools call the form itself would have blocked. Mid-test Jake reordered the Progress list —
  confirmation before clearing, clearing folded into the invoice step, ten steps — and cut the bell rules from twelve to
  six.
- **Where the branch lands.** The backend was deployed through the chat and is live at **v33**; migrations went 24 → 30,
  all applied via MCP and committed under `supabase/migrations/`; the dispatch table went 40 → 48 → **46** entries (**47**
  actions with `admin_login`) as five phases added handlers and the last one deleted the two chat-1 test actions. Gates at
  wrap-up: `deno check` 0 errors, `npm run build` exit 0, security advisor `"lints": []`, the anon probe `*/0` on all
  **16** tables, and the new `scripts/smoke.ps1` **11/11 PASS against v33**, run by Jake. With the testing finished Jake
  then deleted all four test `client_payments` and their `notifications` by SQL, so both tables are empty; the two test
  COIs, mothership 2 and the two test clients stay for the next chat, and `document_numbers` deliberately keeps its eight
  issued numbers, because a registry that reissues a number is not a registry. The frontend has NOT been deployed yet —
  it ships on Jake's word after the merge.
- **The wrap-up audit turned up one trap, now GOTCHA #21.** The refresh rule made the drill-in sessionStorage keys
  outlive a reload, which is what makes clearing them at SIGN-IN load-bearing — and `AdminLogin.jsx` clears them by
  re-listing every key as a string literal, because importing `SUB_STATE_KEYS` would pull `Portal.jsx` into the login
  bundle. The two lists agree today (eleven keys: `wigActiveTab` plus the ten in `SUB_STATE_KEYS`) and nothing enforces
  that they keep agreeing; a key added to one and forgotten in the other would leak one admin's open payment to the next
  person signing in on the same browser. Adding a `wig*` key is TWO edits, the same shape as the routes trap. The hub's
  Portal UI line now says so out loud; the audit also corrected that line's claim that all eleven keys live in
  `SUB_STATE_KEYS`, when ten do.

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
