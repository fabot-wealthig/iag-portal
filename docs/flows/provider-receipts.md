# FLOW — Provider receipts

How the money Boxhouse, SRA, the DCD strategy, Closehaul and ERT (for Cost Segregation studies, Film
Deduction, R&D Credits and Oil & Gas) pay IAG is recorded, split across the clients it covered, and paid out to those clients' COIs. Spans the
**Tax Strategies** tab (frontend), one authed write and two authed loaders, the `provider_receipts`
table and the `client_payments` rows that hang off it.

**ONE INPUT DRIVES EVERYTHING.** A provider settles a batch: one transfer, one reference, several
clients. What an admin has in front of them is that transfer, so that is what they type — the total,
the reference, and the list of clients it was for — and the portal derives every record under it.
Before this the same money took two gestures per client: raise a revenue record, come back later and
mark it received. Which meant the one figure that actually arrived was never written down anywhere as
itself, and reconciling a bank line against the portal was adding rows up by hand.

**A ROW IS BORN RECEIVED.** Every `client_payments` row created here carries its `revenue_received`
stamp from the first instant, because the money is ALREADY HERE — the receipt IS the clearing event.
That is why there is no clearing action any more: `mark_revenue_received` existed to add a stamp to a
row raised before the money came, and a row raised by a receipt has never been in that state. The rule
`revenue-share.ts` reads is unchanged and is exactly what makes this work — `revenue_received_at != null`
is cleared — so these rows are cleared the moment they exist.

**LEOS and the Implementation Fee are not this.** A client-funded payment is still raised per client,
on its own strategy's form, and clears when the client pays through Stripe:
`docs/flows/client-payment-request.md`. That flow's *Provider-funded records* section points here for
everything above the Available Revenue Pool; everything BELOW the pool — the waterfall, Path A, the
transfer, the hold, the failure, the COI's email — is the same code on the same columns for both
pipelines, and is documented there.

**Cost Segregation is the fourth provider strategy, and it asks nothing.** `COSTSEG` (model
`pass_through`, `funded_by = 'provider'`, `affiliated_via_ert` false, seeded active by
`20260915100000_cost_seg_and_implementation_fee.sql`) is ERT paying IAG a fee per study. The
amount typed against the client on the receipt row IS the pool — there is no box size, premium or
investment to derive it from — so the row carries no strategy inputs, no contribution, no "Expected"
hint and no implementation fee, and the details below say where each of those absences is handled.
Because `affiliated_via_ert` is false there is no Path A on it: an ERT-affiliated COI is paid on the
level ladder by this portal, by transfer, exactly as on 831(b).

**There are eight provider strategies now, and three of them are paid by ERT for its own COIs.**
Migration 42 (`20260922100000_ert_provider_and_closehaul_strategies.sql`) seeded four more, all
active. **Film Deduction** (`FILM`) and **R&D Credits** (`RD_CREDITS`) are `pass_through` exactly like
Cost Segregation — ERT pays a revenue share per engagement and the row amount IS the pool. **Oil &
Gas** (`OIL_GAS`, model `hourly_rate`) is ERT paying for the client's chargeable hours at
`rules.hourly_rate` ($450): the row asks the HOURS, and hours × rate is what it is expected to be worth.
**Closehaul** (`CLOSEHAUL`, model `event_pct`) asks which event the row records and the amount that
event is measured by — a Loan pays 2% of the loan amount, a Capital gains event 20% of the interest
fee, both off `rules.events`. On Film Deduction, R&D Credits and Oil & Gas **ERT is the payer and pays
an ERT-affiliated COI itself**, so this portal owes them nothing: all three list ERT (mothership 1) in
`rules.excluded_motherships`, which `computeProviderWaterfall` now reads on a provider row too, FIRST —
an excluded COI earns 0%, is never on Path A, and lands on the existing `Not Due` state rather than on
a `Via ERT` acknowledgement of $0.00. Cost Segregation's rules exclude nobody, so it is unchanged.
**Closehaul has a Path A**: Closehaul, not ERT, pays, so ERT is handed an ERT-affiliated COI's share —
`affiliated_via_ert` true, `affiliated_share_pct` 60, a `Via ERT` row and the "Paid by ERT" tick,
exactly as on Boxhouse and DCD. None of the four bills an implementation fee.

## The path

1. **An admin opens the Tax Strategies tab and presses "Start payment" beside a strategy.** The button
   sits on every ACTIVE strategy's row (`TaxStrategiesPanel.jsx`), beside the name and outside the
   accordion's click target — an admin heading for the form must not also open the rules underneath
   it. **Every payment in the portal now starts here**, whichever strategy it is: the client Payments
   tab is tracking only. A strategy whose `funded_by` is `provider` opens `ProviderReceiptForm`; LEOS
   opens the same `ClientPaymentForm` as ever, with a `ClientPicker` as question 1 and the strategy
   fixed by the hero above it.
2. **The TOTAL is typed first.** Amount received, an optional reference (the provider's own remittance
   or batch reference), optional notes. It is first because it is the fact the admin is holding, and
   because the client lines are what has to add up to IT rather than the other way round.
3. **Then one line per client.** Each line is: a **ClientPicker** (a searchable single-select over
   every client in the portal — there are hundreds, and an admin recording a batch knows the name, not
   the number — with **"+ Add a new client"** at the bottom of the panel, which opens `AddClientForm`
   INLINE under the line, COI select included, because the provider has paid for somebody the portal
   has never billed and sending the admin three screens away would lose the receipt they are halfway
   through typing); **the strategy's own inputs** (`StrategyInputs`, shared with the LEOS request form
   — a box size, or a premium plus first-year/returning, or an investment plus "Implementation fee
   charged", or **Chargeable hours** on `hourly_rate`, or on `event_pct` an **Event** select plus an
   amount box labelled by the chosen event's `base_label` ("Loan amount", "Interest fee"), so the box
   says what the percentage is taken of; on a `pass_through` strategy the component renders **null**, `providerInputsReady` is
   true before anything is typed, `providerRowPayload` sends `strategy_inputs: {}` and no
   contribution, and `ProviderReceiptForm` drops the inputs column from its `grid` string
   altogether — `'1.5fr 140px 36px'` rather than `'1.5fr 1.6fr 140px 36px'` — so there is no cell
   that reads as a question the admin has missed); an **Amount**, with a muted **"Expected $X"**
   UNDER the box from `computeProviderPreview`,
   which is what the strategy's rules say that line should be worth, sitting directly beneath the
   figure it is there to be checked against — and never enforced (not on a `pass_through`, where it
   would print the amount back at itself); and that line's **own Notifications**,
   laid out `inline` so the tax planner select, the chosen chips and the "Add admin…" dropdown sit on
   one row beside each other (`NotificationPickers`, the same two controls as the payment detail's
   Notifications card). A **Sandbox** chip sits under the client's COI name when that COI's
   **Sandbox toggle** is on (`isSandboxCoi`; names stopped mattering in chat 15, GOTCHA #20).
   Under each line, full width so the grid shared with the totals is untouched, **"+ Add a fee
   discount"** opens `DiscountFields` (compact): a **Discount amount** and a **Reason**, the reason
   REQUIRED once an amount is typed ("Row N: enter a reason for the discount." blocks the submit).
   **Record only** (migration 46, v: 2026-09-22): the line's Amount is still what arrived for that
   client, and Allocated / Remaining never read the discount.

   **Every control wears its own compact label** — Client, the model's own label, Amount — and there is
   **no column header strip** above the lines. A header strip would have to line up with controls that
   differ per model and per row, and it leaves the first line unreadable while the eye is still on the
   header; one label per control, at one size and one height, is also what puts the three controls on a
   single baseline.
4. **Allocated / Remaining, live.** Under the lines, from the one `grid` string that also lays out
   every row, so a total always sits under the amounts it totals. A green line says the client amounts
   add up; a red one names both figures. The submit button reads **"Record payment — $<total>"** and is
   DISABLED until there is a total, at least one line, every line complete, and the sum matching; the
   block reason above it names the first thing missing, by row number ("Row 2: choose a client.").
5. **`create_provider_receipt`** (authed; any admin session may run it) revalidates every one of those
   answers, because the form is display and the server is truth — see *What the action does*, below.
6. **The screen goes straight to the receipt it just made**, carrying a one-line summary of what the
   shares did ("Payment recorded. 3 shares paid, 1 held"), composed through `describeRevShare` — the
   same helper the payment detail reports a retry with, so one state is never described two ways.

## What the action does

In order, and the order is the design:

1. **Refuses what it is not for.** The strategy must exist, be `active`, and be `funded_by = 'provider'`
   (400 "Only provider-funded strategies are recorded as receipts."). The amount received must
   parse to a finite positive number out of form text (`"25,000.00"`, `" $25000 "`). The reference is
   trimmed and capped at 200 characters, the notes at 2000; absent is a real answer for both. `rows`
   must be an array of **1 to 50** — a provider settling a batch sends a handful, not a spreadsheet,
   and every row below runs a Stripe transfer and a Gmail draft in sequence, so the cap is what keeps
   one press inside the function's wall clock.
2. **Prepares each row, refusing by ROW NUMBER.** Every refusal is prefixed `Row N: `, so it points at
   the line that is wrong rather than at the press as a whole, and the form outlines that line in red.
   Per row: the client is read (400 "Row N: Unknown client."), their COI is read (400 "Row N: The
   client's COI could not be found."), the amount is parsed the same way as the total, and the model's
   own inputs go through **`utils/provider-record-inputs.ts`** — `resolveProviderInputs(strategy,
   rawInputs, rawContribution, rowAmount)`, the pure helper that owns every per-model error string,
   so an admin sees the same wording for the same mistake on every row. It answers the four values a
   row needs (`strategy_inputs` built **from the RULES rather than from the body**,
   `contribution_amount`, `revenue_expected`, `implementation_fee_amount`) or the message to put in
   front of the admin. **The fourth argument is the row's own amount**, and only `pass_through` reads
   it: on Cost Segregation, Film Deduction and R&D Credits the "Strategy inputs are required." guard does not apply — an absent or
   empty input set is the CORRECT request — `strategy_inputs` is stored as `{}`, `contribution_amount`
   is NULL, and `revenue_expected` is the row amount itself, because `expectedRevenue`'s
   `baseAmount` is the contribution on the contribution-shaped models and the row amount on this one.
   **`hourly_rate`** parses `chargeable_hours` as a COUNT, not money — part hours are real, zero or
   less is refused ("A valid number of chargeable hours is required.") — stores
   `{chargeable_hours}` alone, and leaves `contribution_amount` NULL: hours × `rules.hourly_rate` is the
   figure, and the rate stays on the strategy. **`event_pct`** matches `event_key` against
   `rules.events` ("Choose the event type."), parses the base as money with a refusal that names it
   ("A valid loan amount is required."), stores it as `contribution_amount`, and writes
   `{event_key, event_label, base_label}` **off the RULES, never the body**, exactly as a box size's
   label is — `base_label` included, because the row is all the detail screen and the Basis column
   see, and renaming an event on the strategy must not rewrite what a recorded payment says; expected
   is base × the event's pct. `implementation_fee_amount` is 0 on all three — nothing is billed
   alongside them — rather than absent, so the column can be totalled.
   `coi_paid_via_ert` is then snapshotted by running `computeProviderWaterfall` **off the ROW's
   amount** — the same figure the revenue share will stamp from, so the flag on the row and the payout
   it describes can never disagree — and `sandbox` from `modeForCoi(coi)`, the COI's toggle. The
   row's optional `discount_amount` / `discount_reason` go through `parseFeeDiscount`
   (`utils/discount-note.ts`, shared with `start_client_payment`): absent, blank or zero is no
   discount and drops the reason; an amount needs a reason ("Row N: A reason is required when a
   discount is entered."), 500 characters at most. The sum check below never sees it.
3. **Checks the SUM.** `|Σ row amounts − amount_received| < 0.005`, else 400 "The client amounts must
   add up to the payment received." Half a cent of tolerance, because both sides are money rounded to
   cents and an exact float comparison would refuse a split that is right.
4. **Resolves the people, once.** If ANY row named anybody, the admin roster is read ONCE
   (`loadAdminDirectory`) and every row's planner and recipients are matched against it in code, as
   lowercased trimmed strings — never `.ilike()`, which reads the caller's string as a PATTERN
   (GOTCHA #8). An unknown address is 400 "Row N: Unknown admin: …", before anything is written,
   because that has to be a mistake the admin can fix on the form in front of them. Each match
   resolves to the ROSTER's spelling, so the column and the recipient rows always equal `admins.email`
   exactly. Recipients are capped at 50 per row; a row with no `recipient_emails` ARRAY names NOBODY.
5. **Inserts the receipt**, then **ALL the client rows in ONE insert**. Each row is born with
   `receipt_id`, `funded_by: "provider"`, `strategy_model` (the strategy's model, snapshotted for the
   same reason `funded_by` is: the step machine and the screens see the row and nothing else), the
   resolved inputs and figures, `revenue_received` = that
   row's amount, `revenue_received_at` = **ONE shared timestamp** (they were paid by one transfer, so
   they cleared at one moment), `revenue_received_by` = the session's email, `revenue_reference` = the
   RECEIPT's reference, the `coi_paid_via_ert` snapshot, `sandbox` from that row's COI,
   `discount_amount` / `discount_reason` (NULL both when none),
   `tax_planner_email` from that row, `legal_fee_waived: false` (no provider-funded strategy carries
   a legal opinion letter, so the column says "not waived" rather than claiming one was skipped),
   `notes: null` (the note belongs to the receipt, where it was typed), and `offset_amount` /
   `total_fee` **NULL, not zero** — there is no client fee here, not a zero one, none, and zero is a
   figure the waterfall would act on.
6. **Or deletes the receipt and answers 500.** If the rows insert fails, or comes back the wrong
   length, the receipt is deleted and the admin is told nothing was saved. That compensating delete is
   safe precisely because **NOTHING HAS BEEN PAID at that point** — no notification, no transfer, no
   email; every side effect happens after both statements have landed.
7. **Matches the new ids back to the prepared rows by `client_id`, once.** `.select()` on an insert
   does not promise to return rows in the order they were sent, and a share paid against the wrong row
   is a COI paid the wrong amount. Matched into one map that both the recipient insert and the shares
   below read, so there is a single answer to which id belongs to which row.
8. **Seeds the notification recipients**, each payment getting the people ITS row named and nobody when
   its row named nobody. Deliberately NON-FATAL, exactly as on a payment request: convenience rows
   anybody can re-add from the detail screen must never cost a COI their share.
9. **Then, per row and strictly SEQUENTIALLY:** the `revenue_received` bell
   (`flows/notifications.md` — this action is now the only place it fires, once per row, with the
   reference in the message when there is one), then **`runRevenueShare` IN PROCESS**, never throwing,
   exactly as the Stripe webhook chains it on a client payment clearing, because the receipt IS that
   moment for these rows. Sequential and never in parallel: each one is a Stripe transfer and a Gmail
   draft, and firing fifty at once is how a rate limit turns into fifty held shares.
10. **Answers 200** with the receipt and one entry per row carrying the client, the amounts, and that
    row's `rev_share` block (`rev_paid`, `share_amount`, `transfer_id`, `to_email`, `error`). **A
    refused transfer is a 200 with an `error` on that row**: the money arrived, the records are right,
    and the refusal is a fact about ONE COI's payout that the row carries for the retry button to
    finish. Failing the whole press would leave the admin believing nothing was recorded. Stripe's own
    reason is passed straight through rather than replaced with "try again shortly".

**A timeout mid-run is self-healing.** The shares run one client at a time and the function could die
on the fortieth. What is left behind is a set of rows that are CLEARED with their share unfinished —
precisely the shape **leg A of the nightly sweep** exists to pick up, offering each to the same latched
`runRevenueShare` until it resolves (`flows/nightly-sweep.md`). So a half-finished press costs a night,
not a reconciliation: nothing is lost and nothing is paid twice. The form allows for the wall clock on
its side too — `callApi(..., { timeoutMs: 90000 })`, the batch's clock rather than a request's, and
still never retried, because this is a write.

## The three steps a row gets

`buildPaymentSteps` branches on the row's `funded_by` snapshot and gives a provider record **three
steps**: the COI's share, the revenue-share email, and the internal team share — the three every
payment ends on. The seven client-facing and hard-cost steps are ABSENT rather than inapplicable:
"greyed out with a reason" is for a step this pipeline HAS and this row does not, not for a stage that
was never part of the journey.

**"Revenue record created" and "Revenue received from provider" are gone, and their absence is the
point.** Both were true the instant the row existed, and a step that is done before the list is first
drawn tells a reader nothing. What the record was created from and what arrived on it are FACTS on the
row, shown as such; the pipeline is for work that can still be outstanding.

## The receipts list, and one receipt

- **Every provider strategy's card carries its Receipts**, loaded when the card is expanded
  (`load_provider_receipts`, optionally narrowed by `strategy_key`, newest first — an admin
  reconciling Boxhouse is not looking at DCD). Columns: **Received · Reference · Amount · Clients ·
  Shares · Recorded by**, the whole row navigating to the receipt. `row_count` and `rows_total` come
  off ONE read of every row belonging to the receipts on the page, aggregated in code; `share_summary`
  counts them into eight buckets — `succeeded`, `processing`, `not_due`, `held`, `failed`, `via_ert`,
  `via_ert_done` and `pending` — and the Shares cell prints only the buckets that actually happened, so
  a clean receipt reads "4 paid" rather than a row of zeros. **The two Path A buckets are counted and
  worded apart**: an UNTICKED `Via ERT` row reads "N ERT to pay" and a ticked one "N paid via ERT",
  because until an admin says ERT has paid the COI that share is still owed and must not be totalled
  with the ones that landed. `pending` is a row whose share was never attempted, which after a normal
  press means the run is still going or died part way and tonight's sweep will finish it.
- **The receipt screen** (`ProviderReceiptDetail`, behind `load_provider_receipt`) is the hero (the
  amount, with the date, the reference and who recorded it), the back link UNDER it, a **Details**
  card, and a **Clients** table: **Client → that payment**, **COI → the COI profile**, **Basis**
  (the box label, or the contribution, or the hours as "2.5 hrs" on Oil & Gas, or the event and its
  base as "Loan $100,000.00" on Closehaul — an em dash on the pass-through strategies, where the
  amount IS the figure and there was never a basis to miss; `PaymentsGrid.basisText` prints the same
  on the payments list), **Expected**, **Amount** — with a muted **"Discount -$X"** sub-line under
  it when the row carries one, the reason on hover; the footing still sums the amounts, never the
  discount — **COI share**, **Share status**.
  "Sandbox" is small orange text under the COI, read off the row's stamped `sandbox`. The table foots
  with the rows' own total and "of $X received" beside it — the sum of what is ON SCREEN, not the
  receipt's stored figure, so if the two ever disagree that is exactly what the admin should see. A
  row whose client has since been deleted still ships, with null names, rather than being dropped: a
  split that quietly loses a line no longer adds up to the receipt above it.
- **Share status** is `rev_paid`, in this screen's words: **Paid** (green), **Failed** (red),
  **Awaiting payout account**, **Not due**, **Processing**, **Pending**. `load_provider_receipt`
  never selects `checkout_token` AT ALL, rather than selecting it and stripping it — a provider row
  has never had one, but the token is the credential for the public `/pay` page and a column nobody
  asks for cannot leak.

## The ERT tick, in the row

A **Via ERT** row shows ONLY a **"Paid by ERT" checkbox** in its Share status cell until it is ticked;
once ticked, the checkbox is gone and the cell shows ONLY the green **"Paid by ERT"** chip. The
checkbox IS the status while the share is outstanding, which is why there is no pill beside it — the
untouched state is the news. It is the **ONE deliberate exception** to standing UI rule 4's "no action
controls in list rows" (Jake, 2026-09-10): ERT paying the COI happens outside the portal, so nothing
but an admin can move that row on, and making them open the payment to do it is what leaves the
receipt reading finished when it is not.

The tick is `update_payment_step` with step `ert_share` — **the same step, the same handler and the
same column as the checkbox on the payment detail's progress list**, not a second way to say the same
thing. It only ever sends `done: true`: **unticking stays on the payment detail**, where the whole
progress list is, because a receipt row is a summary and undoing an acknowledgement belongs on the
record it was made against. Only one row may be mid-write at a time; after the write the whole receipt
is re-read, so the row re-renders from server truth rather than being patched in place.

## The three screens, and the trips out

The Tax Strategies tab is three screens behind **one** sessionStorage key, `wigStrategyScreen`:
absent = the strategy list, `form:<key>` = that strategy's payment form, `receipt:<id>` = one recorded
receipt. One key, so a browser refresh lands on exactly the screen the admin was on (standing UI rule
5). Adding it was TWO edits, as always — `SUB_STATE_KEYS` in `Portal.jsx` (now **eleven**) AND the
literal removal list in `AdminLogin.jsx` (now **twelve** = `SUB_STATE_KEYS` + `wigActiveTab`) — which
is GOTCHA #21. `tax_strategies` also joined `WIDE_TABS`, because these grids need the 1180px panel.

Three round trips preserve it:

- **A client's name on the receipt** opens that payment inside its COI, with `returnTo: 'tax_strategies'`.
- **A COI's name** opens the COI profile, same marker.
- Both go through `openCoiProfile`, which READS `wigStrategyScreen` before `goToTab` wipes the
  sub-state and writes it back after; `returnToOrigin('tax_strategies')` does the same in reverse. So
  the back link out of a COI or a payment lands on the RECEIPT the visit began on, not on the strategy
  list.
- **A provider payment's own detail screen** carries a **"View receipt"** field — `payment.receipt_id`
  through `openReceipt`, which sets `receipt:<id>` and goes to the tab. It is handed out ONLY to an
  admin who may see the Tax Strategies tab; for anybody else the link would be a trip to a screen the
  portal will not render, so the payment detail leaves it out entirely.

**And the trip back is ONE click, not three.** A receipt row names a payment, so the click lands the
admin two screens below a COI and a client they never chose to open, and walking back out one screen at
a time would be a trip through somebody else's navigation. `tax_strategies` is therefore one of the
four **deep origins** — with `coi_overview`, `client_overview` and `accounting` — listed in
`DEEP_RETURN_TOS` (`CoiSearch.jsx`). When the visit began on one of them, `CoiSearch` builds an
`originBack` (`{ label, onClick }`) once and hands it down whole, so neither the client screen nor the
payment screen has to know how a return marker turns into a destination: `CoiClients` uses it for the
client's back link and passes it to `PaymentDetail` as `backLabel` + `onBack`. The FIRST back link the
admin sees therefore reads **"← Back to Tax Strategies"** and goes straight to the receipt. An ordinary
walk in from COI Search is untouched, and `mothership_search` is excluded on purpose — that drill-in
opens the COI profile itself, so its back link is already the first one.

## Where the pieces live

| Piece | File |
| --- | --- |
| Tax Strategies tab: three screens, "Start payment", the receipts list, each model's card steps and edit form (`ExcludedMothershipsPicker`) | `iag-portal/src/components/TaxStrategiesPanel.jsx` |
| The receipt form (total first, rows sum to it; no inputs column on `pass_through`) | `iag-portal/src/components/ProviderReceiptForm.jsx` |
| The receipt screen (the split as it settled, the ERT tick) | `iag-portal/src/components/ProviderReceiptDetail.jsx` |
| The per-line fee discount (record only), shared with the request form | `iag-portal/src/components/shared/DiscountFields.jsx` (`discountAmountText`, `discountBlockReason`, `discountPayload`) |
| The strategy's own inputs, shared with the LEOS form (null on `pass_through`; hours on `hourly_rate`; event + base on `event_pct`) | `iag-portal/src/components/StrategyInputs.jsx` (`providerInputsReady`, `providerInputPrompt`, `providerRowPayload`) |
| Searchable client select + "+ Add a new client" | `iag-portal/src/components/shared/ClientPicker.jsx`, `CoiClients.jsx` (`AddClientForm`) |
| Tax planner + recipient chips (`admins`, `inline`) | `iag-portal/src/components/shared/NotificationPickers.jsx` |
| The dollar field and its keystroke filter | `iag-portal/src/components/shared/MoneyInput.jsx` |
| The previews (display only; exclusion first, mirroring the backend) | `iag-portal/src/lib/revenuePreview.js` (`computeProviderPreview`) |
| `rev_paid` in words, one place | `iag-portal/src/lib/revShareText.js` (`describeRevShare`) |
| `wigStrategyScreen`, `openReceipt`, the return trips | `iag-portal/src/pages/Portal.jsx` (`SUB_STATE_KEYS`, `openCoiProfile`, `returnToOrigin`) |
| The same key, re-listed by hand (GOTCHA #21) | `iag-portal/src/pages/AdminLogin.jsx` |
| The per-call clock for a batch write | `iag-portal/src/lib/api.js` (`opts.timeoutMs`) |
| The one-click trip back to the receipt | `iag-portal/src/components/CoiSearch.jsx` (`DEEP_RETURN_TOS`, `BACK_LABELS`, `originBack`), `CoiClients.jsx`, `PaymentDetail.jsx` (`backLabel`) |
| The whole write: receipt, rows, people, shares | `iag-admin-api/actions/receipts/create.ts` |
| The two loaders | `iag-admin-api/actions/receipts/load.ts` |
| Discount parsing and the `[DISCOUNT_NOTE]` sentence | `iag-admin-api/utils/discount-note.ts` (`parseFeeDiscount`, `discountNote`); columns by `supabase/migrations/20260922150000_fee_discount.sql` |
| Per-model input validation (pure, shared; `rowAmount` fourth argument; the `hourly_rate` and `event_pct` branches) | `iag-admin-api/utils/provider-record-inputs.ts` (`resolveProviderInputs`) |
| Three steps for a provider row | `iag-admin-api/utils/payment-steps.ts` (`providerSteps`) |
| The refusal that sends LEOS's form here | `iag-admin-api/actions/payments/start-client-payment.ts` |
| The waterfall arithmetic (pure; `fixed_commission`, `retention_share`, `contribution_pct`, `pass_through`, `hourly_rate` and `event_pct` in `expectedRevenue`; `excluded_motherships` read FIRST in `computeProviderWaterfall`) | `iag-admin-api/utils/revenue-waterfall.ts` (`expectedRevenue`, `implementationFee`, `computeProviderWaterfall`, `isExcludedMothership`) |
| The rules each provider model may carry (`excluded_motherships` required on `pass_through` and `hourly_rate`) | `iag-admin-api/actions/strategies/save.ts` (`validateExcludedMotherships`) |
| `pass_through` in the model CHECK, `client_payments.strategy_model`, `COSTSEG` seeded active | `supabase/migrations/20260915100000_cost_seg_and_implementation_fee.sql` |
| `hourly_rate` and `event_pct` in the model CHECK (nine); `FILM`, `RD_CREDITS`, `OIL_GAS`, `CLOSEHAUL` seeded active | `supabase/migrations/20260922100000_ert_provider_and_closehaul_strategies.sql` |
| Stamp, transfer, email — shared with LEOS | `iag-admin-api/actions/payments/revenue-share.ts` |
| The `revenue_received` bell | `iag-admin-api/utils/notify.ts`, rule seeded by `20260909140000_revenue_received_rule.sql` |
| Dispatch entries (3 of the 54) | `iag-admin-api/router/dispatch.ts` |
| Smoke gate check 12 | `iag-edge-functions/scripts/smoke.ps1` (`load_provider_receipts`) |
| The table + `client_payments.receipt_id` + deny-all RLS | `supabase/migrations/20260910120000_provider_receipts.sql` |

## Traps

- **NEVER un-receive a row, and never add a way to.** The stamp is what the COI's share is computed
  from and transferred against, so a hand-edit of `revenue_received` — or a "correction" screen —
  leaves a transfer sized by a figure that is no longer on the row, and re-opening the record cannot
  un-send the money. It is the exact shape of the `payment_status` trap on the client-funded flow, for
  the same reason. A wrong amount is a conversation with whoever moved the money, not a button.
- **The compensating delete is safe ONLY because nothing has been paid before it.** The receipt goes
  in first because the rows need its id, so there is a window where a receipt exists with nothing under
  it; the rollback closes that window. Move ANY side effect — the bell, the transfer, the email, the
  recipient insert — above the rows insert, and that delete starts erasing the provenance of money
  that has already moved.
- **The sum check lives in the ACTION, not in a CHECK constraint.** It is a fact about a SET of rows,
  and the rows do not exist as a set at insert time. The table's own constraint is only that
  `amount_received > 0` — a zero or negative lump sum is not a receipt. Anything that inserts a
  `client_payments` row with a `receipt_id` from outside this action is making the receipt stop adding
  up, silently.
- **The same client may appear TWICE on one receipt**, deliberately: a client can buy two boxes, and
  each is its own record with its own inputs and its own share. The rows are NOT deduped by client, and
  the id matching after the insert takes one id per prepared row in order for exactly that reason. Any
  "tidy-up" that keys rows by `client_id` alone collapses two records into one.
- **`client_payments.receipt_id` is `ON DELETE RESTRICT`, not SET NULL.** The rows ARE the receipt's
  split, so a receipt with client rows still hanging off it is not something to unpick silently — a row
  whose provenance had been quietly blanked would read as money that arrived from nowhere. Deleting
  test data means deleting the payments first, then the receipt.
- **The roster is read ONCE per press, and only if some row named somebody.** Fifty rows must not be
  fifty directory reads. And every address is resolved BEFORE the first insert: a 400 the admin can
  fix on the form is the whole point, and a row created and then found to name somebody who does not
  exist is not.
- **The "Paid by ERT" checkbox is the ONE action control allowed in a list row on these screens.** It
  is an exception granted once, for a state nothing but an admin can move on. Every other unfinished
  share is finished on its own payment's detail screen, one click away through the client's name — do
  not grow a retry button, a resend or an edit into this table.
- **The form's 90 s clock is a clock, not a retry.** `opts.timeoutMs` raises the wall clock for that
  ONE call and changes nothing else; `create_provider_receipt` is a write and writes are NEVER
  retried (`src/lib/api.js`). A retried receipt would be a second lump sum, a second set of records and
  a second set of transfers. If the call times out, the records may well exist — read the receipts list
  before pressing anything again, and let sweep leg A finish the shares.
- **A supabase-js `.select()` must be ONE string literal** (GOTCHA #16), including the long one in
  `load_provider_receipt`. Wrapping it with `+` collapses the row type and turns every property read
  into a TS2339, none of them pointing at the select.
