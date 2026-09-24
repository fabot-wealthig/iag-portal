# FLOW — Client payment request

How a client is asked for a strategy fee, pays it by ACH — or, on the Implementation Fee, by card —
and gets booked. Spans the **Tax Strategies** tab, where the request is raised, the client
**Payments** tab and the payment detail screen, where it is tracked (frontend), the authed actions
that raise the request and read it back, the public `/pay` page, the two PUBLIC actions behind the
emailed link — one quotes the amount, one charges it — and the Stripe webhook that books the money
onto the row and then issues the paperwork for it.

**Nothing is SENT; the money IS booked — and now paid out.** All four emails are Gmail DRAFTS —
there is still no send path anywhere in this system. But the pipeline no longer stops at Stripe:
since Phase D the webhook writes `payment_status` and the rest of the checkout block onto the row and
drafts the confirmation on an ACH booking, since Phase E a payment that CLEARS is also issued a
numbered invoice and receipt, rendered to PDF and attached to a third draft, and since Phase F that
same clearing stamps the whole revenue waterfall onto the row and TRANSFERS the COI's share to their
Stripe Connect account — and, since chat 15, the legal letter (or NBDT's attorney fee) and the
administration fee to the PAYEES the request named (*Hard costs by transfer*, step 40;
`flows/hard-cost-payees.md`). The row is now written end to end.

**And a second kind of record shares the pipeline.** On Boxhouse, 831(b), DCD, Cost Segregation,
Film Deduction, R&D Credits, Oil & Gas and Closehaul the client pays the PROVIDER, never this portal — nothing is charged here and nothing is emailed to
the client — and the records are raised by recording the provider's lump sum as a RECEIPT, which is
its own flow: `docs/flows/provider-receipts.md`. Everything below the Available Revenue Pool is then
the same code on the same columns. What the two pipelines share is *Provider-funded records*, below;
everything between here and it is the client-funded path — LEOS, and the two strategies that are
LEOS's pipeline with a different fee block under it: the Implementation Fee, where the fee IS the
pool (*The Implementation Fee*, next), and the Nevada Bank Dynasty Trust, where ONE percentage hard
cost comes off it first (*The Nevada Bank Dynasty Trust*, after that).

## The Implementation Fee — the second client-funded shape

**One fee, nothing under it.** `IMPL_FEE` ("Implementation Fee", model `client_fee_pool`,
`funded_by = 'client'`, seeded active by `20260915100000_cost_seg_and_implementation_fee.sql`) is
billed through this portal exactly as LEOS is — the same request form, the same pay link, the same
webhook, the same documents — and then takes NONE of LEOS's arithmetic: the fee the client pays IS
the Available Revenue Pool. It is the strategy's `model` that says so, not `funded_by` — the client
funds both — and `client_payments.strategy_model` snapshots the answer onto the row when
`start_client_payment` inserts it, for the same reason `funded_by` is snapshotted: the step machine
is handed the row and nothing else. A NULL `strategy_model` reads as LEOS, which is what every row
raised before the column existed is and what the migration backfilled them to.

- **The form asks ONE field.** On a `client_fee_pool` strategy `ClientPaymentForm` renders a "Fee
  details" block with a single **Fee amount** — no offset, no "Legal opinion letter required"
  checkbox — above a `ClientFeePoolPreview` (`computeClientFeePoolPreview` in
  `src/lib/revenuePreview.js`, DISPLAY ONLY like the other two) showing the fee, the pool (the same
  figure, said twice on purpose — the second line is what the COI's share is a percentage of), the
  COI's ladder share and the net. The body carries `total_fee` and nothing else. `start_client_payment`
  does not read `offset_amount` or `legal_fee_waived` on that model: the row goes in with
  `offset_amount` **NULL** — not zero, which is a figure the waterfall would act on — and
  `legal_fee_waived` **false**, because there was no letter and the column must not claim one was
  skipped.
- **`computeWaterfall` has a `client_fee_pool` branch.** `admin_fee_amount`, `legal_fee_amount`,
  `processing_pct` and `processing_fee_amount` all come back **0** — zero rather than absent, so the
  screen can total them — `available_pool` is `round2(total_fee)`, the COI takes pool × the level's
  entry in `level_percentages`, and `coi_paid_via_ert` is **false**: there is no Path A on this model
  at all. Its one rule of its own is the **excluded motherships**. `isExcludedMothership(rules,
  mothership)` answers true when the COI's `mothership_number` is in
  `strategies.rules.excluded_motherships` — compared as NUMBERS, because the list is edited through a
  form; a COI with no mothership matches nothing — and then `coi_share_pct` is **0**, which lands on
  the existing `"Not Due"` state rather than a new one. ERT (`1`) is seeded on that list, so an
  ERT-affiliated COI earns nothing on an Implementation Fee, neither from this portal nor through
  ERT. The list is edited on the Tax Strategies edit form as a mothership dropdown plus chips, and
  `save_strategy` checks every entry against `motherships` (400 `Unknown mothership number: <n>`),
  deduping and sorting before it stores — a typo there would quietly pay a COI their full share.
  Since chat 14 the rule is not this model's alone: `computeProviderWaterfall` reads the same list,
  first, on provider rows, where Film Deduction, R&D Credits and Oil & Gas list ERT because ERT pays
  those COIs itself; one `validateExcludedMotherships` helper in `save_strategy` checks it on
  `client_fee_pool`, `pass_through` and `hourly_rate`, and requires the array on all three
  (*Provider-funded records*, below).
- **The pay page offers two ways to pay.** `load_pay_link` answers `accepts_card: true` only when
  the strategy's `model` is `client_fee_pool`, and `PayPage.jsx` then draws a second `OptionCard` —
  "Credit / Debit Card", badge "2.9% + $0.30 Fee" — under an "— or —" divider beside the ACH card,
  copied from VFO's AccountantPayPage. **A card is grossed up**: the headline is
  `Math.round((fee + 0.30) / (1 - 0.029) * 100) / 100`, with the difference on its own "Card
  Processing Fee (2.9% + $0.30)" line, so the CLIENT pays Stripe's fee and IAG nets the whole
  fee. `pay_link_checkout` reads `body.method` **only on that model** — `"card"` is the one value
  that changes anything; anything else, on any model, is ACH — mints the session with
  `payment_method_types[]=card` and the same grossed-up `unit_amount`, and omits the
  `us_bank_account` verification option, which Stripe refuses on a session that does not offer that
  method. The `[PAYMENT_METHODS_NOTE]` token in the request and reminder emails
  (`utils/payment-methods-note.ts`) tells the client before they choose: the card sentence, fee
  included, on `client_fee_pool`; the bank-only sentence everywhere else.
- **`card_processing_fee` is what Stripe actually took.** `bookClientPayment` reads `amount_received`
  off the PaymentIntent and stamps `card_processing_fee = round2(amount_received − total_fee)`,
  clamped at 0, on a card only; an ACH leaves the column NULL rather than writing a zero fee nobody
  charged. It is the CLIENT'S cost and never revenue: it appears on the two documents and on the
  detail screen ("Card processing fee $X (paid by the client)") and nowhere in the waterfall,
  whose pool is `total_fee`.
- **A card skips the confirmation email.** A card settles inside the session, so the checkout branch
  books it `"succeeded"` on the spot with `confirmation_status` **`"Not Needed"`** — the third value
  beside "Confirmation Needed" and "Sent" — and chains the invoice, the receipt and the revenue share
  immediately; those two documents ARE the confirmation (VFO's rule: that email is written for money
  still in flight). An ACH books `"processing"` with "Confirmation Needed" and is confirmed as before.
  The out-of-order `payment_intent.succeeded` branch stamps "Not Needed" for the same reason.
  `draftPaymentConfirmation` and `resend_payment_email` both refuse a "Not Needed" row with "No
  confirmation email is sent on a payment that settled on booking: the invoice and receipt are the
  confirmation." — `force` does NOT get past it, because force is for an email that was owed and went
  astray — the detail screen hides the Resend confirmation button on such a row, and sweep leg B,
  whose predicate names "Confirmation Needed" exactly, excludes it by construction.
- **Steps that never happened are ABSENT.** `buildPaymentSteps` drops the three hard-cost steps on a
  `client_fee_pool` row and the confirmation step on a "Not Needed" row — absent, not greyed: "greyed
  out with a reason" is for a step this pipeline HAS and this row lost (a waived letter, a share
  never due), not for a stage that was never part of the journey. A card-paid Implementation Fee
  therefore lists six steps and an ACH-paid one seven; the money steps still sum to `total_fee`,
  because an absent step carries no amount and on this strategy the fee is the pool.
- **The documents carry the card fee.** When a card fee was actually taken, the invoice's schedule
  grows a "Card Processing Fee (2.9% + $0.30)" row and a **Total Charged** row — the `✓ Paid` badge
  moves down to it — and its total band reads "Total Charged"; the receipt's band reads "Total
  Charged (incl. card fee)" over a **Card Fee Breakdown** box (the fee, the card fee, the total). With
  no card fee both documents are byte-identical to an ACH's. The receipt's method line reads "Via
  Credit/Debit Card · ending ****<last4>".
- **The fee is called what it is.** `utils/fee-label.ts` `clientFeeLabel(strategy, fallback)`
  appends " Client Fee" to the strategy's name — "LEOS Client Fee" — EXCEPT on `client_fee_pool`,
  where the name already is the charge and would otherwise print "Implementation Fee Client Fee" on a
  document a client keeps. The pay page label, the Stripe line item ("Implementation Fee -
  (<client_number>) <Name>") and both documents all ask it.
- **Tax Strategies lists its payments.** Every client-funded strategy's card carries a **Payments**
  list (`StrategyPayments` in `TaxStrategiesPanel.jsx`: the shared `PaymentsGrid` over
  `load_all_payments`, filtered by `strategy_key`), the twin of the provider cards' Receipts. A row
  opens the payment inside its COI with `returnTo: 'tax_strategies'`, so the first back link the
  admin sees returns to the tab.

## The Nevada Bank Dynasty Trust — the third client-funded shape

**One hard cost, and it is a PERCENTAGE of the fee.** `NBDT` ("Nevada Bank Dynasty Trust", model
`fee_pct_waterfall`, `funded_by = 'client'`, seeded active by `20260917100000_nbdt_strategy.sql`,
which also widens `strategies_model_check` to SEVEN) is billed through this portal exactly as LEOS is
— the same request form, the same pay link, the same webhook, the same documents — and then takes
almost none of LEOS's arithmetic: the attorney takes `rules.attorney_fee_pct` (60 today) percent OF
THE CLIENT'S FEE, and what is left IS the Available Revenue Pool. It fits neither shape already here,
which is WHY it is a seventh `model` rather than a rules tweak: `fee_waterfall` cannot describe it
because there is no offset for an administration fee to be a percentage OF and no letter to waive,
and `client_fee_pool` cannot because a cost genuinely does come off the fee first. Jake's PDF says
the fee structure is "exactly like LEOS"; what sits under it is not.

- **The form asks ONE field, like the Implementation Fee.** On a `fee_pct_waterfall` strategy
  `ClientPaymentForm` renders the "Fee details" block with a single **Fee amount** — no offset, no
  "Legal opinion letter required" checkbox — above a `FeePctWaterfallPreview`
  (`computeFeePctWaterfallPreview` in `src/lib/revenuePreview.js`, DISPLAY ONLY like the other
  three): the client fee, the attorney's line, the pool, the COI's share — carrying the "Paid to ERT
  outside the portal" note on Path A — and the net. Since chat 15 the block also asks the **Legal
  firm** the attorney fee is transferred to (always: nothing here is waivable) and carries the
  optional fee discount; the body is `total_fee`, `legal_fee_payee_id` and any discount.
  `start_client_payment` groups this model with `client_fee_pool` behind one **`feeOnly`** flag: only
  `total_fee` is read, `offset_amount` goes in **NULL** — not zero, which is a figure the waterfall
  would act on — and `legal_fee_waived` **false**, because the attorney fee is not the opinion letter
  and nothing was skipped. The pool guard applies unchanged.
- **`computeWaterfall` has a `fee_pct_waterfall` branch.** `legal_fee_amount` is `round2(total_fee ×
  attorney_fee_pct / 100)` and `available_pool` is `round2(total_fee − legal_fee_amount)`;
  `admin_fee_amount`, `processing_pct` and `processing_fee_amount` all come back **0** — zero rather
  than absent, so the screen can total them. The attorney fee is stamped on the EXISTING
  `legal_fee_amount` column because it is the same kind of figure, a legal cost — transferred to the
  chosen legal firm since chat 15 — and a second legal column would give one payment two legal lines that could disagree.
  **Path A here needs BOTH flags** — `mothership_number === 1` AND the strategy's `affiliated_via_ert`
  (the field `StrategyRules` gained for this), unlike the LEOS branch, which reads the mothership
  alone and was safe doing so while LEOS was the only client-funded shape. On Path A the COI takes
  `affiliated_share_pct` (60) of the POOL, `coi_paid_via_ert` is **true**, `rev_paid` is `"Via ERT"`
  and the manual `ert_share` tick is the completion; everyone else takes the level's entry in
  `level_percentages` (0/20/30/40/50) and is paid by transfer. `save_strategy` validates
  `rules.attorney_fee_pct` as a 0-to-100 percentage (400 "Attorney fee must be a percentage between 0
  and 100.") and writes `rules = { attorney_fee_pct }`; `affiliated_share_pct` is checked by the
  existing `affiliated_via_ert` block.
- **The hard-cost block is ONE step, and it is never waived.** On a row whose `strategy_model`
  snapshot is `fee_pct_waterfall`, `buildPaymentSteps` spreads a single step where LEOS has three:
  key **`legal_fee`** — already in `update_payment_step`'s whitelist, so there is no new tick to
  allow — label "Attorney fee paid", action "Pay attorney fee", manual, owner **Admin**, amount
  `legal_fee_amount`; on a row that names a legal firm (every NBDT request since chat 15) it is the
  transfer form instead — a state pill and Retry, never a tick (step 40). `admin_fee` and `processing_fee` are **ABSENT**, by standing rule 7: this
  pipeline never had them, and greyed-with-a-reason is for a step a row LOST. There is no waiver on
  this model at all — the PDF's attorney fee is a percentage the trust always pays — so the step is
  never greyed either, and `legal_fee_waived` stays false on every row.
- **The detail screen hides the offset and names the attorney.** `PaymentDetail` drops the "Offset
  amount" field on this model — there is no offset, and a dash there would read as one nobody typed —
  and renders an **Attorney fee** field from `legal_fee_amount` beside the rest of the waterfall. On
  the Tax Strategies tab the strategy renders BY ITS MODEL like every other: `feePctWaterfallSteps`
  in `TaxStrategiesPanel.jsx` explains it in five steps with the level chips and the via-ERT variant
  of the ERT callout, and `EditFeePctWaterfall` edits the attorney percentage and the ERT-affiliated
  share above the ladder — both live in `strategies`, so tuning either never needs a deploy.
- **Everything else is LEOS's pipeline, untouched.** It is **ACH only** — `load_pay_link` answers
  `accepts_card` **false**, `pay_link_checkout` consults `body.method` on `client_fee_pool` and
  nowhere else, and `[PAYMENT_METHODS_NOTE]` prints the bank-only sentence — which is the PDF's
  decision, not a limitation. `clientFeeLabel` appends " Client Fee" as it does on LEOS, so every
  document, the pay page and the Stripe line item read "Nevada Bank Dynasty Trust Client Fee".
  Checkout, the booking, the confirmation, the invoice and receipt, the revenue share, the sweep, the
  bell and the **Payments** list under the strategy's card are the same code on the same columns.
  There was no new table and no RLS change, and the action count stayed **50** (it is 55 since
  chat 15's payee actions and `retry_hard_cost`, v: 2026-09-22).

## The path

1. **An admin opens the Tax Strategies tab and presses "Start payment" beside LEOS.** Every payment
   in the portal starts there now (`TaxStrategiesPanel.jsx`) — an admin arrives holding the STRATEGY,
   not the client — and the client's Payments tab is tracking only. The strategy is already answered
   by the card that was pressed, so `ClientPaymentForm` renders with `fixedStrategyKey` set, its
   strategy select hidden and a `ClientPicker` as question 1 instead. A strategy whose `funded_by` is
   `provider` opens the receipt form rather than this one (*Provider-funded records*, below, and
   `flows/provider-receipts.md`), and a `client_fee_pool` strategy swaps the fee block for the
   one-field version (*The Implementation Fee*, above), so the fee block described here is the LEOS
   fee block. The admin
   enters the **offset amount**, the **total client fee** and optional notes, ticks or unticks
   **"Legal opinion letter required"** (ticked by default), and watches a read-only **Revenue share
   preview** recompute on every keystroke. The letter checkbox sits with the amounts because it IS
   one: unticking it takes the flat legal fee out of the preview, and the fee the client is invoiced
   is quoted on the strength of the answer. It is decided ONCE, here — a repeat client running the
   exact same strategy as last year may not need a new letter, which is the tax advisor's call — and
   is never revisited afterwards. **With the letter required, the form asks the Legal firm** it is
   transferred to — a select of ACTIVE `legal_firm` payees in the COI's Stripe mode, submit blocked
   until one is chosen (`flows/hard-cost-payees.md`); unticking the letter removes the question.
   Under the fee, **"+ Add a fee discount"** (`shared/DiscountFields.jsx`) opens an optional
   **Discount amount** and **Reason** — the reason required once an amount is typed, the whole thing
   **RECORD ONLY**: the fee typed is still the fee charged, and no preview, guard or total reads the
   discount (migration 46, v: 2026-09-22). Below the notes the form also asks WHO: a **Tax planner** select
   (Unassigned plus every admin) and an **Other notification recipients** chip row with an "Add
   admin…" picker. The chip row starts **EMPTY** — nobody is pre-selected, not even the admin filling
   the form in (Jake, 2026-09-09), because whoever should hear about a payment is a decision the form
   asks for rather than a side effect of who happened to raise it.
   They are the same two controls the detail screen's Notifications card carries, deliberately — an
   admin should meet one control twice rather than two that behave differently — and they are asked
   here because both are known when the request is raised, and a payment nobody was assigned is a
   payment nobody chases. Both render INERT until `load_admin_directory` answers: the form is four
   fields and a preview, far too small to wear a skeleton, so the controls arrive disabled and come
   alive. A roster that never loads leaves them disabled behind a red "Could not load admins —
   assign them on the payment afterwards." with the rest of the form still fully submittable.
2. **The preview is DISPLAY ONLY.** Nothing it computes is sent — only `strategy_key`,
   `offset_amount`, `total_fee`, `legal_fee_waived`, `legal_fee_payee_id` (when a legal firm is
   asked), `discount_amount` / `discount_reason` (only when a discount was entered), `notes`,
   `tax_planner_email` and `recipient_emails` go to the server. It mirrors the
   strategy rules rather than replacing them, in the order Jake's "Understanding Revenue Share for
   the LEOS Strategy" sets out: the two **hard costs** come off the client fee first — admin fee =
   offset × `admin_fee_pct`, plus `legal_fee_flat` as a flat line, **or $0.00 when the letter is
   waived** (the line still shows, labelled "Legal opinion letter (waived)") — and **ERT's
   percentage is then taken off what remains, not off the whole fee** (`processing_pct_affiliated`
   when the COI's `mothership_number` is 1, else `processing_pct_unaffiliated`). Available Revenue
   Pool = after-hard-costs − ERT. The COI's share is where the **two paths** part: an ERT-affiliated
   COI (`mothership_number === 1`) takes pool × `affiliated_share_pct`, shown as "ERT affiliated
   share (50%)" with no level and a muted line reading *Paid to ERT outside the portal; ERT pays the
   COI*; everyone else takes pool × the level's entry in `level_percentages`. Net profit pool = pool
   − share. A **negative pool blocks submit** with "The client fee must cover the hard costs and the
   processing fee."
3. **`start_client_payment`** (authed; any admin session) refuses a strategy that is missing or
   `active !== true`, and — on this client-funded branch, where an email is the whole point — a client
   with no `email` — a deactivated strategy is one the portal has
   stopped offering, and its name is what the client is invoiced for. Money is parsed out of form
   text (`"25,000.00"`, `" $25000 "`) and must come back a finite positive number; notes are capped
   at 2000 characters. The discount goes through `parseFeeDiscount` (`utils/discount-note.ts`)
   AFTER the pool guard, so it can never reach it: blank or zero is no discount, an amount needs a
   reason (400 "A reason is required when a discount is entered."), 500 characters at most. The
   legal firm and the admin-fee payee are resolved here too — required, active, and in this
   payment's mode (`flows/hard-cost-payees.md`).
4. **The row goes in FIRST**, before any external side effect: `client_id`, `strategy_key`,
   `funded_by`, `strategy_model` (the strategy's model, snapshotted), `offset_amount`, `total_fee`,
   `legal_fee_waived` (anything but a literal `true` is false — a body
   that omits the field charges the letter, which is the safe direction: charging one that was not
   needed is a conversation, skipping one that was is a missing legal document), `discount_amount` /
   `discount_reason` (NULL both when none), `legal_fee_payee_id` / `admin_fee_payee_id`, `notes`,
   `sandbox` and `created_by` (the admin's email, from the session).

   **The Stripe mode is decided here and only here.** `modeForCoi(coi)` — the COI's **Sandbox
   toggle** (`members.sandbox`, migration 44; only a literal `true` is sandbox), everyone else live
   (`utils/stripe-mode.ts`, Jake's rule since 2026-09-22 — names no longer matter, GOTCHA #20). The
   answer is stamped as `sandbox: mode === "sandbox"` and echoed in the response, and everything
   downstream reads it back off the row instead of asking the COI again. The client has no mode of
   their own: they inherit their COI's, because the Connect account their share is transferred to
   is the COI's.

   Then a **fresh Stripe customer per payment**, created on that mode —
   metadata `payment_id`, `client_id`, `client_number`, `pipeline=CLIENT_PAYMENT` — and the row is
   updated with `stripe_customer_id` and a freshly generated `checkout_token`. A Stripe failure
   **deletes the row**: a payment with no customer can never be paid and would only sit on the
   screen looking live. `tax_planner_email` IS stamped on the row now, in the ROSTER's spelling of
   the address rather than the caller's — the FK would refuse anything else, with a message no admin
   could act on — and the notification recipients go in beside it: the UNION of whoever the form
   named and the raising admin, deduped, as ONE insert of many rows and still non-fatally (see
   **Notifications** below). Every address is resolved BEFORE the insert, against the roster, as
   lowercased trimmed strings compared in code — never `.ilike()`, which would read the caller's
   string as a PATTERN (GOTCHA #8) — and an unknown one is a 400 `Unknown admin: <email>`, because
   that has to be a mistake the admin can fix on the form in front of them rather than a row that
   was created and then found to name somebody who does not exist. Recipients are capped at 50; an
   empty planner means UNASSIGNED, which is a real state.
5. **The draft**, raised by `actions/payments/request-email.ts` — the shared helper, not the handler:
   `start_client_payment` and `resend_payment_email` both call it, so an original and a resend are
   byte-identical, and the `payment_email_sent_at` stamp the resend guard reads is written INSIDE it
   rather than by whichever caller remembered. Subject and body come from the `email_templates` row
   `CLIENT_PAYMENT` / `client_payment_request` (fallback constants in the helper mirror the seed, so
   a deactivated row still produces a sane email). Six global regex replacements: `[First Name]`,
   `[Client Name]`, `[STRATEGY]`, `[TOTAL_FEE]` (en-US grouping, two decimals), `[DISCOUNT_NOTE]`
   (`discountNote` in `utils/discount-note.ts`: empty without a discount, else "A fee discount of $X
   was applied (<reason>). ", the reason HTML-escaped, through a function replacement for the same
   "$" reason as the next token; the same token sits in the reminder, the confirmation, the invoice
   and receipt email and the COI revenue share, placed by migration 46 and mirrored in all five
   fallback bodies),
   `[PAYMENT_METHODS_NOTE]` (the one sentence naming what the client can pay with, from
   `utils/payment-methods-note.ts` off the strategy's `model` — substituted through a FUNCTION
   replacement, because the card sentence carries a "$" that a plain replacement string would read
   as a capture group), plus
   `[PAYMENT_LINK]` becoming a primary-blue "Complete Payment" button pointing at
   `PORTAL_BASE` + `/pay?token=…`. Recipients resolve through `utils/email-recipients.ts` with
   `RECIPIENT` / `CLIENT` / `COI` offered — the COI role token lets an admin Cc the introducing COI
   from the Email Templates panel, and it resolves to null when that COI has no address. An empty To
   falls back to the client. `WIG_SIGNATURE` is appended here.
6. **`payment_email_sent_at` is stamped only after Gmail accepts the draft.** A Gmail failure leaves
   the row in place with the stamp null — the request is real and the link works, so the admin
   should see it exists and that the email did not go. A *stamp* failure is logged and never
   surfaced, or the admin presses the button again and raises a second payment.
7. **The client opens the link.** `/pay` is public and session-less; the token IS the credential.
   The page calls `load_pay_link`, which quotes the client name, the strategy, a `payment_label`
   from `clientFeeLabel` (`"LEOS Client Fee"`; `"Implementation Fee"` on `client_fee_pool`), the
   amount and `accepts_card`, and renders an ACH `OptionCard` ("No Fee", `$0.00` processing) — plus,
   when `accepts_card` is true, a Credit / Debit Card one at the grossed-up figure (*The
   Implementation Fee*, above). The token states sit in `AuthShell`, whose left panel carries a
   per-page `tagline` — here the client-facing "Secure payment of your strategy fee" line, not the
   team-portal default.
8. **`pay_link_checkout`** (PUBLIC) mints a Stripe Checkout session on the mode read back off the
   payment row (`modeForPaymentRow`) — the Stripe customer it bills against was created under that
   same key: `mode=payment`,
   `payment_method_types[]=us_bank_account` (`card` when the body says `method: "card"` on a
   `client_fee_pool` strategy — on every other model the body is not consulted), one `price_data`
   line item at `round(total_fee × 100)` cents (the grossed-up figure on a card) named
   `"<Strategy> - (<client_number>) <Name> - Client Fee"` (`"<clientFeeLabel> - (<client_number>)
   <Name>"` on `client_fee_pool`), and, on an ACH session only,
   `payment_method_options[us_bank_account][verification_method]=instant` (Financial Connections
   rather than micro-deposits, which would stall the payment for days before it even started
   clearing). `success_url` is `/pay?done=1`, `cancel_url` is `/pay?token=…` so a cancel can try
   again. Both sit on the request Origin when it is in `ALLOWED_ORIGINS` — so localhost works — else
   production.
9. **Five metadata keys go on BOTH the PaymentIntent and the session**: `payment_id`, `client_id`,
   `checkout_token`, `pipeline=CLIENT_PAYMENT`, `payment_kind=client_fee`. `checkout.session.completed`
   carries only the session's own metadata, so without the duplicate the first webhook to arrive
   could not tell which payment row completed.
10. **Stripe hosts the checkout** and returns the client to `/pay?done=1`. That return carries NO
    token, so the page has no client data to show: it renders a standalone WIG success landing in
    `TokenShell` (navy gradient header bar, centered accent-strip card) — a green check, "Payment
    successful", and a "What happens next" panel promising three things, method-neutral because the
    page cannot know which was used: a bank transfer clears in 2 to 4 business days while a card
    settles immediately, an email as soon as the payment is received, and the invoice and receipt
    once it has settled. We never see a bank or card detail.

## Phase D — booking, confirmation, detail

11. **The webhook books it.** `router/webhooks.ts` still owns only the ENVELOPE — signature, replay
    window, mode guard, the `stripe_events` upsert. Once the raw event is durably on file it calls
    `bookClientPayment` **IN PROCESS**, not over HTTP: the auth gate would reject a service-role
    bearer, so a self-call would be a 401 dressed up as a chain. Routing is by metadata —
    `pipeline === "CLIENT_PAYMENT"` plus a `payment_id`, which both handled events carry — and
    anything else (a test checkout, a future pipeline) is logged and dropped.
12. **`checkout.session.completed`** is normally the first news. It reads the row, cross-checks the
    session's `checkout_token` against the row's (they can only differ if the link was reissued, in
    which case this session is billing a superseded request), then reads the PaymentIntent with
    `expand[]=payment_method` and writes the whole checkout block at once: `payment_status`
    (**"processing"** for ACH, because an ACH session completes with the money still in flight;
    "succeeded" for a card, which settles inside the session), `payment_intent_id`,
    `payment_method_type` (`"ach"` or `"card"`), `acct_last4`, `payment_date`, `confirmation_status`
    (`"Confirmation Needed"` on a processing booking, **`"Not Needed"`** on a succeeded one) and, on
    a card only, `card_processing_fee` from the PaymentIntent's `amount_received`. An unknown method
    is treated as ACH — claiming money has cleared when it has not is the more expensive mistake.
    Then, on an ACH booking, it drafts the confirmation; a card gets no confirmation and goes
    straight to the invoice, the receipt and the revenue share (*The Implementation Fee*, above).
13. **`payment_intent.succeeded`** is the ACH clearing, days later: `"processing"` → `"succeeded"`,
    `payment_date` re-stamped with the clearing moment, and any of `payment_intent_id` /
    `payment_method_type` / `acct_last4` still null backfilled — only those, so a later, thinner read
    cannot erase what the checkout branch already saw. It drafts NO second confirmation. If the row
    has no status at all (Stripe orders nothing, so this event can arrive first) it books the payment
    in full right there, straight to `"succeeded"` with `confirmation_status` `"Not Needed"`, and
    chains the paperwork itself: there was never a moment where money was in flight, so the invoice
    and receipt are what tell the client it arrived.
14. **Every write is a CONDITIONAL claim.** The update names the status it expects to replace —
    `.is("payment_status", null)` for a booking, `.eq("payment_status", "processing")` for the
    clearing — and asks with `.select("id")` which rows it actually changed. Losing that race means
    another delivery already did the work, and the loser stops rather than drafting a second email.
    That is what makes at-least-once delivery safe, not luck about timing.
15. **500 means exactly one thing: a `client_payments` read or write FAILED.** Stripe then retries,
    which is harmless because the claims are idempotent. Everything else answers 200 — a foreign
    pipeline, an unknown payment id, a token mismatch, an already-booked row, a lost claim, a failed
    Stripe read, a Gmail outage. Retrying those forever would change nothing, and the raw event is
    already in `stripe_events` for a human to replay.
16. **The confirmation email** (`confirmation-email.ts`) is the same shape as the request: template
    row `CLIENT_PAYMENT` / `client_payment_confirmation` (reworded in VFO's short voice by
    `20260915120000_client_email_wording.sql` — no account digits in the sentence), fallback
    constants mirroring the seed, a Gmail DRAFT, recipients through the same role tokens. Its tokens
    are `[First Name]`, `[Client Name]`, `[STRATEGY]`, `[TOTAL_FEE]`, `[DISCOUNT_NOTE]` and
    `[ACCT_LAST4]` — the seeded
    body does not carry the last, but it is still substituted so an admin can add it through
    the editor, falling back to `"----"` when Stripe gave us no digits: obviously unknown, rather
    than a plausible account number. The latch is `confirmation_status === "Sent"` (+
    `confirmation_sent_at`), checked inside the helper so the webhook cannot draft twice, and a
    **second guard refuses `"Not Needed"`** for every caller, `force` included ("No confirmation
    email is sent on a payment that settled on booking: the invoice and receipt are the
    confirmation.") — the email is written for money still in flight, and a card-paid client told to
    allow 2-4 business days would be waiting on a transfer that never existed. It NEVER throws, and
    on a Gmail failure it deliberately leaves the row on "Confirmation Needed" for an admin to
    resend. A *stamp* failure after a successful draft is logged only — surfacing it would get the
    email drafted twice.
17. **`resend_payment_email`** (authed) re-drafts either email: `kind` `request` or `confirmation`,
    guarded exactly like `coi_stripe_connect_request` — an already-sent email answers 200 with
    `already_sent_at` and `to_email` so the screen can ask "resend anyway?", and only `force: true`
    gets past it. The refusals are about the PAYMENT's state: a `request` is refused once
    `payment_status` exists, because the link is spent and mailing a dead button is worse than
    mailing nothing; a `confirmation` is refused while `payment_status` is null, because there is
    nothing to confirm, and refused again — 400, ahead of the already-sent check, with the same
    sentence as the helper — when `confirmation_status` is `"Not Needed"`, because there is nothing
    here to do a second time. Both delegate to the same helpers the original callers use.
18. **The payment detail screen.** `load_client_payment` returns the row (with `checkout_token`
    spent composing `pay_url` and stripped in the LOADER, so no caller can forget), the client and
    strategy names, and an ordered `steps` list built SERVER-SIDE by `utils/payment-steps.ts`. On a
    LEOS payment that is ten
    steps in the real order of events — request emailed, client submitted, confirmation (drafted at
    submission, so it precedes clearing), "Invoice and receipt — funds cleared" (one step: the
    documents are drafted at the moment the money clears), the three hard costs, the COI's share, revenue-share email,
    and last the internal team share IAG retains (`net_profit`, no checkbox, `net_profit_pool`
    as its amount, done once the COI's share is settled; the five money amounts sum to `total_fee`,
    which the screen shows as a Total line once all are stamped). Two of those stages can be ABSENT
    rather than greyed, because the row never had them: the three hard costs on a
    `strategy_model === "client_fee_pool"` row, and the confirmation on a `confirmation_status ===
    "Not Needed"` row (*The Implementation Fee*, above). Every step carries
    `done`, `at`, `owner`, `manual` and `applicable` — plus, on the INAPPLICABLE steps
    ONLY, a `note` giving the reason in one line, which the screen renders as muted 12px text after
    the label ("Waived on the request form", "No share was due", "ERT pays the COI, so no email from
    the portal"): greying a step out says it does not apply, but on its own that is not an answer,
    and the reason is a property of the row rather than something the admin should have to infer
    from a strategy rule — an `amount` on the money steps (null
    until the payment clears and stamps the waterfall, rendered as "Pending calculation" until then)
    and, on the COI's-share step alone, a `state` carrying the raw `rev_paid` — the one step whose
    not-done has kinds. **The COI's-share step has two forms, and the ROW decides which** (the
    builder sees nothing else): on Path B it is `rev_share`, "COI revenue share paid", owner System,
    no checkbox; on Path A (`coi_paid_via_ert`) it is replaced IN PLACE — same position, because the
    money moves at the same point either way — by `ert_share`, "COI share paid to ERT", owner Admin,
    `manual: true`, done from `ert_share_done`, and the revenue-share email step below it goes
    `applicable: false` since the portal sent none. A **waived** legal letter likewise stays in the
    list, relabelled "Legal opinion letter waived" and marked `applicable: false` with its amount
    pinned to **0 rather than null**, so it greys out without blanking the screen's Total. What
    "done" means is a property of the row, and two readers deriving it independently is how a screen
    starts lying about whether a client has been paid.
19. **`update_payment_step`** ticks the FOUR whitelisted `manual` steps — `admin_fee`, `legal_fee`,
    `processing_fee` and, on Path A, `ert_share` — and nothing else. A provider record's
    `revenue_received` step is deliberately NOT among them: it carries an amount and pays the COI, so
    it has an action of its own. The whitelist is load-bearing twice: the value is
    interpolated into two COLUMN names (`<step>_done`, `<step>_done_at`), and every other step is
    proved by something that happened. Un-ticking clears the timestamp. It answers the SAME
    `{ payment, steps }` shape from the SAME loader, so the screen re-renders from server truth
    instead of patching its own copy. **The tick is COSMETIC**: the portal moves no money for a
    ticked cost, and nothing downstream reads `*_done`. **Except a fee paid by transfer**: on a row
    that names a payee for `legal_fee` or `admin_fee`, the handler reads the row first and answers 400
    "This fee is paid by Stripe transfer — retry it from the step instead of ticking it."; the
    transfer writes that `*_done` itself (step 40). The ERT `processing_fee` and `ert_share` are
    always ticks.

## Phase E — invoice and receipt

20. **Clearing chains the paperwork.** Every route to `payment_status === "succeeded"` calls
    `draftPaymentInvoiceReceipt` **IN PROCESS**, exactly as the booking calls the confirmation:
    the normal `payment_intent.succeeded` clearing, the out-of-order branch that books a row it has
    never seen before, and a card that settled inside checkout. For an ACH the confirmation and the
    invoice therefore go out days apart, which is the whole point — the confirmation says the
    transfer started, the invoice and receipt say the money arrived.
21. **The latch is `invoice_email_sent`** (+ `invoice_email_sent_at`), read INSIDE the helper so two
    deliveries of the same clearing event cannot issue two sets of documents. The helper refuses
    outright unless `payment_status` is `"succeeded"`: an invoice states what was charged and a
    receipt states that it was paid, and money still in flight supports neither. Like the
    confirmation helper it NEVER throws — its caller only has to answer Stripe 200.
22. **Two numbers, two scopes.** `utils/doc-numbers.ts` counts the existing rows of the type, adds
    one, zero-pads to four and INSERTS into `document_numbers` — **the insert IS the allocation**.
    `number` is UNIQUE, so a collision comes back `23505`, the sequence bumps and it tries the next
    one (up to 100 times). A count alone would hand the same number to two documents, in two ways a
    sequence would never notice: a `client_number` can be reused by a renumbered test client, and two
    payments can clear in the same instant. Invoices are counted **GLOBALLY** —
    `INV-<client_number>-NNNN`, one continuous business-wide run — and receipts **PER CLIENT** —
    `REC-<client_number>-NNNN`, a series the client reads as their own 1, 2, 3.
23. **Each number is stamped on the row the instant it is allocated**, before either PDF exists.
    Allocation is the one step here that cannot be undone, so every later attempt reads what is
    already on the row and reuses it: a retry after a failed render, and the admin's force resend,
    both carry the ORIGINAL numbered documents. A resend never re-allocates.
24. **Numbers are never reissued.** `document_numbers.payment_id` is ON DELETE SET NULL, so deleting
    a payment leaves behind the evidence that its numbers were issued — the row survives with a null
    `payment_id` and the number stays spent. `client_id` cascades, because a deleted client takes
    their whole history with them by design.
25. **Two PDFs.** `utils/payment-documents-html.ts` builds both documents as standalone,
    inline-styled HTML: the same pair VFO issues for a tax engagement — header band, From / Bill To
    row, details panel, schedule table, total band, footer — rebranded to Innovation Advisory Group
    and simplified to what a client fee actually is. Navy `#0F355A` invoice with `#1D64A8` eyebrows;
    green `#1b9254` receipt. From is "Innovation Advisory Group / portal.wealthig.com"; the client
    appears by name with `Ref: <client_number>` and their email (Bill To on the invoice, Received
    From on the receipt). The service line is named by `clientFeeLabel` (`utils/fee-label.ts`), so
    the documents call the charge what the pay page and the Stripe line item called it. The
    schedule table has ONE payment row and it always reads `✓ Paid`, because a client fee is one
    payment — the sole addition is a card that was grossed up, which puts a "Card Processing Fee
    (2.9% + $0.30)" row and a "Total Charged" row under it, the badge moving down to the total, and
    the receipt's "Card Fee Breakdown" box under its band (*The Implementation Fee*, above). **A
    discount is printed, never subtracted** (v: 2026-09-22): the invoice's details panel gains
    "Standard Fee" (fee + discount) and "Fee Discount -$X" with the reason in italics above Total
    Client Fee, and the schedule a muted "Fee discount applied — <reason>" row under the payment; the
    receipt's details gain one "Fee discount -$X (<reason>)" row. Every total still states the fee
    charged. The
    receipt adds "Via ACH Bank Transfer · Account ending ****<last4>" (or "Via Credit/Debit Card ·
    ending ****<last4>") and a **Date Received** of `payment_date`, while the document's own date is
    TODAY — conflating the two would date a receipt to the day it was re-issued. Every
    client-supplied string goes through `esc()`. Then `utils/html2pdf.ts` POSTs each document to
    `api.html2pdf.app` and
    returns it base64-encoded, ready to drop into a MIME part. Its key is `HTML2PDF_API_KEY`, read at
    call time so a rotation needs no code change, never logged — and the service's error BODY is
    never logged either, because it can echo the request, and the request carries the key.
26. **The email carries them as attachments.** `draftGmail` grew an `attachments` option: given any,
    the message becomes `multipart/mixed` — the HTML body as the first part, then one
    `application/pdf` / `Content-Transfer-Encoding: base64` part per document, named
    `<INV-…>.pdf` and `<REC-…>.pdf` so the client can match the sentence in the email to the files
    without opening them. Given none, the MIME is byte-identical to what it was before, which is what
    makes this safe to add under the two existing emails. Still a DRAFT. Subject and body come from
    `CLIENT_PAYMENT` / `client_payment_invoice_receipt` (reworded in VFO's short voice by
    `20260915120000_client_email_wording.sql`: the document numbers are not spelled out in
    the sentence — they are on both PDFs and in both attachment names, which is where a client looks
    for them) with fallback constants mirroring the seed, tokens `[First Name]`, `[Client Name]`,
    `[STRATEGY]`, `[TOTAL_FEE]`, `[DISCOUNT_NOTE]`, `[INVOICE_NUMBER]` and `[RECEIPT_NUMBER]` (the last two still
    substituted, so an admin can put them back through the editor), recipients through the same
    `RECIPIENT` / `CLIENT` / `COI` role tokens.
27. **A failure leaves the row succeeded, and the numbers stamped.** A PDF or Gmail failure comes
    back as a value the webhook logs; `payment_status` stays `"succeeded"`, `invoice_email_sent`
    stays false, the payments list shows an orange "Invoice not sent" under the green pill, and the
    detail screen's **Send invoice and receipt** button re-runs the whole helper — reusing the
    numbers it already stamped. Once they have gone the button reads **Resend invoice and receipt**
    and goes through the `already_sent_at` / `force` prompt the other two emails use.
28. **`resend_payment_email` kind `invoice_receipt`.** Phase E added no action; it added a third
    `kind`. It answers 400 unless `payment_status` is `"succeeded"` — there is no invoice for money
    that has not cleared — 503 when Gmail is unreachable (try again in a minute) and 502 for anything
    else, and its success payload names both numbers so the screen can quote them back.

## Phase F — revenue share

29. **Clearing chains the payout too.** Every route to `payment_status === "succeeded"` now calls
    `runRevenueShare` **IN PROCESS**, immediately after the invoice and receipt, on all three
    branches — the ACH clearing days later, the out-of-order clearing event, and the card that
    settled inside checkout. Like the two email helpers it **NEVER THROWS**: its caller only has to
    answer Stripe 200. **Since 2026-09-24 clearing stamps and DATES the share but pays it only on its
    pay date** (or Pay now) — `flows/payout-schedule.md`; the chain still runs here, and returns
    `deferred` until the date comes.
30. **The waterfall is STAMPED BEFORE ANY MONEY MOVES**, in ONE update conditioned
    `.is("available_pool", null)`, writing all ten columns at once: `admin_fee_amount`,
    `legal_fee_amount`, `processing_pct`, `processing_fee_amount`, `available_pool`,
    `coi_level_at_payment`, `coi_share_pct`, `coi_share_amount`, `net_profit_pool` and
    `coi_paid_via_ert`. The last is a boolean rather than a figure and it rides with the figures on
    purpose: `computeWaterfall` returns it, the whole object is spread into this one update, and
    a stamped waterfall is never recomputed — so which PATH a payment settled by has to be written
    down beside the numbers it produced, or nothing downstream could tell the two apart. Losing that claim
    means another delivery stamped first, so the row is RE-READ rather than overwritten. **Every
    later run reuses the stamped numbers and never recomputes.** That is the whole design: a COI's
    level moves and a strategy's rules are editable, so a retry that re-snapshotted would pay a share
    the payment was never assessed for — and a transfer sized by numbers nobody kept is a payout with
    no record of why it was that size.
31. **The arithmetic lives in `utils/revenue-waterfall.ts`** — pure, no IO, and the ONE place the
    order and the rounding are written down. It mirrors `computePreview` in `revenuePreview.js`
    step for step (`round2` at every stage, admin fee off the OFFSET, ERT's percentage off WHAT
    REMAINS, affiliated = `mothership_number === 1`), because the admin was shown a figure before the
    client was ever asked for money and the server has to arrive at the same one. Values from
    PostgREST are coerced with `Number()` and a NaN reads as 0, so one unset rule cannot poison every
    figure below it. `StrategyRules` carries `model` and `rules` beside the six fee columns, and
    `strategy.model === "client_fee_pool"` takes the branch described in *The Implementation Fee*
    before any of this runs (mirrored by `computeClientFeePoolPreview`); everything from here on is
    the LEOS arithmetic. Two rules bend the middle of it. **`legalFeeWaived` is a REQUIRED input**, not
    an optional one, precisely so no caller can forget it and quietly charge a client for a letter
    nobody ordered; waived makes the legal line 0 and leaves `legal_fee_flat` alone. And
    `mothership_number === 1` now decides TWO things: ERT's higher processing percentage as before,
    and **Path A** — an affiliated COI's `coi_share_pct` comes from `strategies.affiliated_share_pct`
    instead of the level ladder. Their level is still snapshotted, because it is a fact about the COI
    at the moment of payment that a human reads on the payment screen; it simply does not decide
    their money.
32. **`rev_paid` has five values plus one in-flight claim, and `revenue-share.ts` owns all of them.**
    `"succeeded"` (the transfer exists at Stripe — terminal), `"Not Due"` (the waterfall left the COI
    nothing — terminal), `"Awaiting Payout Account"` and `"Failed"` (owed, and NON-terminal on
    purpose, the same shape as VFO's "Awaiting Connect Setup"), `"Via ERT"` (**Path A**: the share is
    settled outside the portal — terminal for this pipeline), plus `"processing"` while a run holds
    the claim. A held or failed share leaves `rev_completed_at` NULL: the client paid in full and the
    money is still owed, so it must not read as finished. **`"Via ERT"` leaves it NULL too, for a
    different reason** — the state is not the completion. What is still outstanding is an admin's
    acknowledgement that ERT was paid, and that lives on `ert_share_done` / `ert_share_done_at` like
    the three hard-cost ticks, which is where the payment's finishing date comes from.
33. **Path A short-circuits the run, after the stamp and after the "Not Due" check.** If
    `coi_paid_via_ert` is true and a share is actually due, `rev_paid` is moved to `"Via ERT"`
    through the same conditional `writeRevPaid` every other non-succeeded state uses (null, held,
    failed and processing are all valid starting points, since a Path A payment may have parked in
    one of them before this rule existed), one line is logged, and the run returns — **no account
    read, no transfer, no email**. The COI hears from ERT, who actually paid them; telling them twice,
    once from a system that moved no money, would be worse than not telling them. The ordering
    matters: a Path A payment whose pool left the COI nothing is still `"Not Due"`, because marking
    it `"Via ERT"` would put a $0.00 acknowledgement in front of an admin.
34. **Two guards on the transfer, and BOTH are required.** The **claim** moves `rev_paid` to
    `"processing"` conditioned on the states it expects
    (`.or("rev_paid.is.null,rev_paid.in.(\"Awaiting Payout Account\",\"Failed\")")`, plus
    `"processing"` under `force`) with `.select("id")`; a run that changes no rows stops. The
    **Idempotency-Key** — what `stripeFetch` grew an option for — is deterministic **per ATTEMPT**,
    `revshare-client-<payment_id>-<timestamp>`, minted by the claim update itself and stored in
    `client_payments.rev_idempotency_key` so the key and the in-flight state land together or not at
    all. It is REUSED in exactly one case: a mid-flight resume, previous state `"processing"`, reached
    only with `force`, where a transfer may already exist at Stripe under that key. From null,
    `"Awaiting Payout Account"` or `"Failed"` a FRESH key is minted, because no transfer exists to be
    duplicated — and because a key held fixed per payment made a REFUSED transfer unretryable for 24
    hours, Stripe replaying the cached refusal at every press of the retry button (GOTCHA #22). A claim
    without the key double-pays when a committed transfer's response is lost, because from this side
    that call never finished; the key without a claim double-pays on two concurrent deliveries.
35. **Destination is checked LIVE**, `GET /v1/accounts/{id}`, and pays only on
    `capabilities.transfers === "active"` **and** `payouts_enabled === true` — an id on `members`
    proves an account was created, never that the COI finished onboarding, which is the same reason
    `coi_connect_status` exists. No id, or an id that is not payable, is **Awaiting Payout Account**.
    A read that fails outright is **Failed**, because we do not know the COI is unpayable; Stripe's
    message is logged, never the key that fetched it.
36. **The transfer** POSTs `/v1/transfers` for `Math.round(share × 100)` cents in USD to the COI's
    account, described `Revenue Share - Client: (<client_number>) <Name> - COI: (<member_number>)
    <Name> - <Strategy>`, with metadata `payment_id`, `client_id`, `member_number` and
    `pipeline=COI_PAYOUT`. `source_transaction` is the PaymentIntent's `latest_charge`, so the payout
    is traceable to the charge the client's money arrived on and draws on those funds rather than the
    platform balance at large — but a PaymentIntent that cannot be read is logged and the transfer
    goes ahead WITHOUT it, because holding a COI's money over a diagnostic lookup is worse.
37. **The email is latched on `rev_email_sent_at`** and drafted only after a transfer actually
    succeeds. Template `COI_PAYOUT` / `coi_revenue_share` with fallback constants mirroring the seed —
    ONE template for both kinds of record, deliberately neutral since chat 10 (*Provider-funded
    records*, below);
    tokens `[First Name]`, `[COI Name]`, `[Client Name]`, `[CLIENT_NUMBER]`, `[RECEIPT_NUMBER]`,
    `[STRATEGY]`, `[TOTAL_FEE]`, `[DISCOUNT_NOTE]` (opening the closing paragraph, the first prose
    after the figures), `[SHARE_AMOUNT]`, `[COI_LEVEL]` and `[SHARE_PCT]` — the last two read
    from the SNAPSHOT columns, so the email explains the figure that was actually transferred. The
    body is a WIG-styled HTML layout — white card on a light ground, slim navy top rule, orange
    eyebrow, hairline detail rows, a green received pill and a green-accented share card — carrying
    the same information in the same order as VFO's member revenue-share email but none of its
    styling. It is the one
    payment email addressed to the COI, so `RECIPIENT` and `COI` both resolve to their address and
    `CLIENT` is offered for a Cc. A COI with no address on file is logged and skipped with the
    transfer standing and `rev_email_sent_at` still null. The stamp is written only after Gmail
    accepts; a stamp failure is logged only, or the next reader drafts a second copy.
38. **`retry_revenue_share`** (authed) finishes a share the webhook could not, and one action covers
    every way it can be unfinished — held, failed, transferred with the email undrafted, or
    `rev_paid` still NULL because nothing ever ran (a payment that cleared before Phase F shipped, or
    a webhook run that died before writing a state) — because they are one sequence and the helper
    decides how far to get. It answers 400 unless the
    payment cleared — `payment_status = "succeeded"` on a client payment, `revenue_received_at` set on
    a provider record, each with its own wording — 400 on `"Not Due"` (there is nothing to retry into), 400 on `"Via ERT"` ("This
    share is paid to ERT outside the portal — tick it off on the payment", which says where to go
    rather than just saying no) and 400 once the share is
    both transferred AND emailed; 503 for Gmail unreachable, 502 for Gmail refusing the draft. It
    always passes `force: true`, which is safe precisely because of the idempotency key: past those
    four refusals, every call is a deliberate "finish this". A retry that stays held or failed still
    answers 200 with the state — that is the truth about the payment, not a failure of the request.
    The frontend matches it: the "Run/Retry revenue share" button does not render on a `"Via ERT"`
    payment at all.
39. **`start_client_payment` refuses a fee that leaves nothing to share.** Before the row is
    inserted it loads the client's COI (400 "The client's COI could not be found.") and the
    strategy's six rule columns, runs the same `computeWaterfall` — with the waiver from the body, so
    the guard is assessed against the fee the client will actually be quoted — and answers 400 "The
    client fee
    must cover the hard costs and the processing fee." when `available_pool <= 0`. The form already
    blocks that case, which is exactly why the check belongs here too: the preview is DISPLAY ONLY,
    the server does not trust the form, and a fee that cannot cover the hard costs is a typed amount
    that is wrong — a missing digit, or an offset and a fee the wrong way round. On a
    `client_fee_pool` strategy the guard runs with `offsetAmount` 0 (the branch reads nothing off
    it) and can only trip on a non-positive fee, which the money parser has already refused. The
    receipt action carries the same guard against the provider arithmetic: 400 "Row N: These inputs
    leave no revenue to share." from `resolveProviderInputs` when `expectedRevenue` comes back zero
    or less.
40. **Hard costs by transfer — after the share.** `chainRevenueShare` (`book-client-payment.ts`) runs
    `runHardCostTransfers` straight after `runRevenueShare` on every clearing branch, and it pays
    the stamped `legal_fee_amount` and `admin_fee_amount` to the payees the row names, off the same
    charge (`source_transaction`), with its own claim, per-attempt key and states on
    `legal_fee_paid` / `admin_fee_paid` (the `rev_paid` vocabulary). A row naming no payee for a
    cost — a waived letter, a LEOS request raised before any active GFX row in its mode, anything
    raised before chat 15 — keeps the manual tick. `retry_hard_cost` is the step's Retry; sweep leg H
    is the nightly finisher. The whole of it is `flows/hard-cost-payees.md` (v: 2026-09-22).

## Phase G — the sweep

Every stage above can stall: a Gmail outage swallows a draft, a COI has no payout account yet, a
client simply does not pay. Phase G adds one PUBLIC action, `run_payment_sweep`, fired nightly by
pg_cron at 10:00 UTC, that re-offers the stalled rows to the SAME latched helpers this flow already
uses — the revenue share, the confirmation, the invoice and receipt, and the request email — and adds
one new email of its own: a **payment reminder** two business days after the request went out, latched
on `client_payments.payment_reminder_sent_at`. It changes nothing in this flow; it just finishes it.
Leg **H**, right after A, re-offers the hard-cost transfers (step 40). Legs B to E filter
`funded_by = 'client'` explicitly — none of what they chase exists on a
provider-funded record — while **leg A chases both pipelines**, because once a record has cleared,
however it cleared, the COI is owed the same share by the same helper. Leg B's predicate names
`confirmation_status = 'Confirmation Needed'` exactly, so a row that settled on booking ("Not
Needed") is never chased for an email it was never owed.
Full walk-through in `docs/flows/nightly-sweep.md`.

## Notifications — who on the team owns this payment

A payment is money, and money has an owner and an audience. Two things get named on the detail
screen's **Notifications** card, which sits between Progress and Details, and both are open to EVERY
admin — an assignment is a workload decision the team makes among themselves, not a rank.

- **The tax planner** is the ONE admin who earns on this payment, stored as a column,
  `client_payments.tax_planner_email` — a hard FK to `admins.email`, `ON DELETE SET NULL`. Exactly
  one is a property a column enforces for free, and a later revenue rule reading the payment row must
  find the answer there rather than behind an aggregate. An admin who leaves does not take the
  payment with them; the field simply empties and can be re-named. `set_payment_tax_planner` writes
  it, refusing an email that is not an admin (400 "Unknown admin", compared as lowercased trimmed
  strings in code, never `.ilike()`), and an empty email UNASSIGNS — a real state, since a payment
  can be raised before anyone has decided who plans it.
- **The notification recipients** are a SET, so they get a table:
  `payment_notification_recipients`, `(payment_id, admin_email)` UNIQUE, CASCADE from both sides,
  carrying `added_by`. `update_payment_recipient` takes `subscribed: true|false` and is idempotent in
  both directions — an add that hits the unique violation is success, and removing somebody who is
  not there is success — because the caller is a chip that flips, and a double-click must not be an
  error.

**The list starts as whatever the form named, and NOBODY when it named nobody** (Jake, 2026-09-09).
`start_client_payment` inserts exactly the addresses the body carried, right after the row lands; a
chip removed on the form stays removed, and a body with no list at all — the form when its roster
failed to load, or an older caller — seeds no one. It used to seed the raising admin in that case, and
that put people on records they had not chosen. The insert is deliberately NON-FATAL: the payment
request and the Stripe wiring are what that action exists for, and convenience rows anybody can re-add
from this card must never cost a client their payment link. Migration
`20260904120000_payment_notification_assignments.sql` backfilled the creator onto payments that
already existed when the join table was created, joining `admins` so a `created_by` that no longer
matched a live admin was skipped rather than breaking the foreign key.

Both actions re-read through `loadPaymentDetail` and answer the SAME body as `load_client_payment`
(one shared `paymentDetailBody` helper), which also ships the admin roster — **email and name only**
— with every payment, because any admin may open one while `load_admins` is superadmin-only. That
roster is ONE read, `loadAdminDirectory` in `actions/admins/directory.ts`, shared with the authed
action `load_admin_directory` the request form calls before the payment exists. Neither is
superadmin-gated, for the same reason the two controls are not: any admin assigns planners and
recipients. Two files selecting their own columns off `admins` is how a rank, a tab grant or a
passcode hash eventually rides along on a payload every admin can fetch.

**NOTHING IS EMAILED FROM ANY OF THIS.** These two facts are what the in-portal bell resolves: every
fan-out addresses `TAX_PLANNER` ∪ `PAYMENT_RECIPIENTS` by title, against today's roster and this
payment. `flows/notifications.md` is the whole of it — seven rules now, including the
`revenue_received` one a provider record raises.

## What the admin sees afterwards

- The Payments tab is where a payment is TRACKED, never started (`ClientPayments` in
  `CoiClients.jsx`): an auto-layout table, **newest first**, under a column header: Date |
  Strategy | **Basis** | **Amount** | Method | Status. The two money columns are named for what they
  MEAN rather than for what LEOS calls them, because a provider-funded record has neither an offset
  nor a client fee: Basis is the offset here and the box label, the contribution, the hours ("2.5
  hrs") or the event and its base ("Loan $100,000.00") there, Amount is
  the client fee here and the received (or, in muted "expected", the forecast) revenue there.
  `basisText` prints an em dash where the basis is null — an Implementation Fee has no offset and a
  pass-through row (Cost Segregation, Film Deduction, R&D Credits) no contribution, because each is its own figure — rather than `$—`, which
  would claim a missing amount where there was never one to miss. The pay
  link is not on the list — it is on the
  payment's own detail screen, which the row opens. The date is `payment_date` once the
  money has moved and `created_at` before that — always the row's most recent fact. Method reads
  `ACH ····1234` (`Card ····1234` on a card), or nothing at all while there is no payment (a dash
  would read as "paid, method unknown"). The status pill reads `payment_status` capitalised — **Processing**, **Succeeded** in
  green — and before Stripe has produced one, **Awaiting payment** if the email went or a red
  **Email not sent** if the draft failed. An orange "Confirmation not sent" sits under the pill while
  `confirmation_status` is "Confirmation Needed", and an orange "Invoice not sent" under a green
  Succeeded pill while `invoice_email_sent` is false — joined by "Revenue share held" on
  `rev_paid === "Awaiting Payout Account"` and "Revenue share failed" on `"Failed"`. A cleared
  payment can owe several of those, and the lines stack.
- **The whole row is clickable** and opens `PaymentDetail`, which REPLACES the client hero and its
  pills exactly as an open client replaces the COI's — the standing "nested detail takes over the
  parent header" rule, one level down. Inside: its own hero, a "← Back to payments" `BackLink`
  under it (never above the hero) — or the origin's own back link in ONE click when the visit
  deep-linked in from an overview, a receipt or Accounting (*Two phrases, two screens*, below), a
  **Progress** card
  rendering the server's `steps` (done mark or a real checkbox, **`label`**, owner chip, date), an
  **Notifications** card (the tax planner select and the "Other notification recipients" chips — see above) and a
  **Details** card of fields — the invoice and receipt numbers, the available pool, the COI's level
  and share, the net profit pool, the revenue-share status and the transfer id among them; on a
  `client_fee_pool` payment the Offset amount and Legal opinion letter fields are not drawn at all,
  and a stamped `card_processing_fee` adds "Card processing fee $X (paid by the client)" — plus the
  actions: **Send payment email** while the request has never gone, **Resend payment email** once it
  has, **Resend confirmation** once there is a payment (hidden on a "Not Needed" row, where the
  server would only ever answer with its refusal), and, on a SUCCEEDED payment only, **Send
  invoice and receipt** (reading **Resend invoice and receipt** once they have gone), **Retry revenue
  share** while `rev_paid` is held / failed / processing — reading **Run revenue share** when
  `rev_paid` is still NULL, because then nothing has run at all — and **Send revenue share email**
  once the transfer landed with `rev_email_sent_at` still null. The invoice message names both numbers; the
  revenue-share message is composed from what came BACK, not from what the button said, because one
  action covers three outcomes. In the Progress list the rev-share row shows its state in orange
  after the amount ("$1,147.50 · Awaiting Payout Account") and reads "No share due" instead of an
  amount when the waterfall left the COI nothing — in which case the rev-share EMAIL step drops out
  as not applicable — and the greyed row says so, "· No share was due".
  Coming back re-reads the list, because a step ticked in the detail changes the row it came from.
- **Accounting → Payments lists the same rows across every client.** The `AccountingPaymentsPanel` renders
  every payment in the portal, newest first, through the SAME `PaymentsGrid` the client's Payments tab uses
  (with a leading Client / COI column switched on) and opens the SAME `PaymentDetail` behind every row.

### Two phrases, two screens — `label` and `action`

**Every step carries BOTH, and neither is derived from the other.** `label` is the STATE — what is true
once the tick beside it is on ("Payment request emailed", "Client submitted payment", "COI share paid
to ERT"). `action` is the WORK OUTSTANDING, phrased to read correctly while the step is UNTICKED
("Email payment request to client", "Awaiting client payment", "Confirm ERT has paid the COI",
"Awaiting funds to clear", "Pay administration fee", "Pay legal opinion letter fee", "Pay ERT
processing fee", "Send payment confirmation email", "Send revenue share email", "Retain internal team
share"). They exist because two screens ask different questions of the same list: the **progress list**
renders `label` beside a tick, where a past tense is a fact; the **overview rows** surface the first
unticked step under **"Next action"**, where a past tense reads as if the work were already done. The
two are written side by side in `utils/payment-steps.ts` and must be kept in step when either changes.

**The COI-share step's action follows its state**, because that is the one step whose not-done has
kinds (`revShareAction`): `Failed` → "Retry COI revenue share", `Awaiting Payout Account` → "Awaiting
COI payout account", `processing` → "COI revenue share transfer in progress", and otherwise — null,
`succeeded` or `Not Due` — "Pay COI revenue share".

**`summarizePayment` (`actions/overview/shared.ts`) is the only reader**, and it deliberately calls
`buildPaymentSteps` rather than keeping a rule of its own: "what is next" is only meaningful if it
agrees with the pipeline the detail screen draws. It takes the first step that is applicable and not
done, and answers `next_action` (that step's `action`, falling back to its `label` as belt and braces)
plus `next_owner`. An INAPPLICABLE step is skipped rather than reported — a revenue share that was
never due is not work waiting — so a fully settled payment answers `next_action: null`.

**On Client Overview that answer is the row's point.** A null reads **"Nothing outstanding"** in words
rather than an em dash (a dash reads as missing data, and this is the opposite), with the Owner cell
left blank because there is nobody to wait on; an **Admin**-owned action reads in orange beside an
orange Admin chip, so the work this team owes stands out from the work it is waiting on somebody else
for; and a **"Needs admin action"** toggle beside the Status filter (`ListFilterToggle` — it reads
"Admin action only" once on) narrows the list to exactly those rows. **The whole row opens that row's
payment** (hover tint plus a card shadow; the table moved to `borderCollapse: separate` so a `<tr>` can
carry a shadow at all), and both NAMES stay links because each is a shortcut PAST the row's own
destination — the client's name to their profile, the COI's to the COI's — which is the reading of
standing UI rule 2 when a row itself navigates. `NameLink` stops the click propagating, so a name never
also fires the row.

**A row opened that way comes back in ONE click.** `coi_overview`, `client_overview`, `accounting` and
`tax_strategies` are the four deep origins (`DEEP_RETURN_TOS` in `CoiSearch.jsx`): from them, the first
back link the admin sees — on the payment detail, or on the client profile — returns to the origin,
with the origin's own wording, rather than walking back out through a COI and a client they never chose
to open. `CoiSearch` builds one `originBack` (`{ label, onClick }`) and hands it down whole to
`CoiClients`, which uses it and passes it on to `PaymentDetail` as `backLabel` + `onBack`.
`mothership_search` is excluded on purpose: that drill-in opens the COI profile itself, so its back
link is already the first one. An ordinary walk in from COI Search is unchanged.
- `load_client_payments` and `load_client_payment` both return `pay_url` composed from the token and
  **never the `checkout_token` itself** — the admin screen needs the link, not the secret inside it.

## Provider-funded records — Boxhouse, 831(b), DCD, Cost Segregation, Film Deduction, R&D Credits, Oil & Gas, Closehaul

**On eight of the eleven strategies the client never pays through this portal.** They pay the provider —
Boxhouse, SRA, the DCD strategy, Closehaul, ERT for a cost segregation study, a film deduction, R&D
credits or oil and gas — and the provider later pays
IAG its revenue, as ONE LUMP SUM covering several clients (Jake, 2026-09-09). No money for
those eight passes through Stripe here, so a
"payment" on them is a **revenue record**: the same `client_payments` row and the same screens, because
it is the same question — what is owed to whom on this client's strategy, and has it been settled.
`strategies.funded_by` decides which pipeline a strategy runs, and `client_payments.funded_by`
snapshots that answer onto the row for the same reason `coi_paid_via_ert` is snapshotted: the step
machine is handed the row and nothing else.

**THE ENTRY POINT IS THE RECEIPT, AND IT IS NOT THIS FLOW.** Since chat 11 those records are not
raised one at a time and cleared later; the lump sum itself is recorded on the **Tax Strategies** tab
as a `provider_receipts` row, split across the clients it covered, and every client row is **born
received** — its `revenue_received` stamp is written by the insert that creates it. `start_client_payment`
REFUSES a provider strategy outright, with 400 "`<name>` is recorded as a receipt from the Tax
Strategies tab.", and `mark_revenue_received` no longer exists: it was the action
that added a stamp to a row raised before the money came, and a row raised by a receipt has never been
in that state. The whole of it — the form, the sum rule, the per-row people, the three steps, the
receipts list and the receipt screen — is **`docs/flows/provider-receipts.md`**.

What stays true of this flow, and is what the two pipelines share:

- **`revenue-share.ts` branches in exactly two places.** First, **"cleared" has two spellings**:
  `payment_status === "succeeded"` on a client row, `revenue_received_at != null` on a provider one —
  a provider record has no `payment_status` and never will, and on these rows that column is set by the
  insert, so they are cleared the moment they exist. Second, the STAMP reads
  `computeProviderWaterfall` with `pool: revenue_received` — **what actually arrived on THIS client's
  line, not what the record expected**, because a lump sum rarely matches a per-client expectation to
  the cent. Everything below the pool is the LEOS code on the LEOS columns: `Not Due`, `Via ERT`, the
  live account check, the transfer, the hold, the failure, the email, the ten stamped columns and the
  rule that they are never recomputed. `retry_revenue_share` applies the same clearing test, with its
  own wording for a record whose revenue has not arrived.
- **The pool arithmetic is shared, and the previews mirror it.** `expectedRevenue`,
  `implementationFee` and `computeProviderWaterfall` (`utils/revenue-waterfall.ts`) are what
  `computeProviderPreview` (`src/lib/revenuePreview.js`) mirrors on screen, exactly as `computePreview`
  mirrors `computeWaterfall` here — and both previews are DISPLAY ONLY: the inputs go to the server,
  never the arithmetic. **Expected revenue** is the commission for the box size, or the premium ×
  SRA's premium-tiered retention percentage × IAG's 30% first-year / 20% returning cut (two
  roundings, not one — the retention fee is real money SRA keeps before it is a base for anything), or
  a straight 15% of the investment — or, on Cost Segregation, Film Deduction and R&D Credits
  (`pass_through`), the row's own amount; or, on Oil & Gas (`hourly_rate`), the chargeable hours ×
  `rules.hourly_rate`; or, on Closehaul (`event_pct`), the base × the chosen event's `pct` (2% of a
  loan amount, 20% of an interest fee): `expectedRevenue`'s third argument is a `baseAmount` that is
  the contribution on 831(b) and DCD, the event's base on Closehaul and the receipt row's amount on a
  pass-through, which asks no inputs at all. **The implementation
  fee** ($2,500 / $1,800 / 5% capped at
  $10,000, waivable on DCD; none on the pass-through, hourly and per-event strategies) is **informational only**: billed by its own
  automation, shared by nobody,
  never off the pool — its ONE consequence is DCD's Path A percentage, 55% charged and 60% waived,
  which is why the waiver is snapshotted onto the record as an input rather than recomputed later.
  **Path A needs BOTH flags** — `mothership_number === 1` AND `strategies.affiliated_via_ert` —
  because on 831(b) and Cost Segregation an ERT-affiliated COI is paid by this portal on the level
  ladder like anyone else (Closehaul, like Boxhouse and DCD, has a Path A at 60%). **An excluded
  mothership comes before either path**: `computeProviderWaterfall` reads
  `rules.excluded_motherships` first, and a listed mothership's COI earns 0%, is never on Path A, and
  lands on `Not Due` — ERT on Film Deduction, R&D Credits and Oil & Gas, where ERT pays its COIs
  itself and this portal owes them nothing.
- **The progress list is THREE steps**, not ten: the COI's share, the revenue-share email, the
  internal team share (`providerSteps` in `utils/payment-steps.ts`). The seven client-facing and
  hard-cost steps are absent rather than inapplicable, and "Revenue record created" / "Revenue
  received from provider" are gone because both were true the instant the row existed.
- **In the nightly sweep, leg A takes both pipelines** — one `.or()` per question, so the pair reads
  "cleared, either way, AND unfinished" — while legs B to E filter `funded_by = 'client'` explicitly,
  because nobody was emailed and nothing was charged on these records. Several of those legs would
  exclude them today anyway, but only by ACCIDENT of a null column (`flows/nightly-sweep.md`). Leg A is
  also what finishes a receipt whose run timed out part way through.
- **One COI email covers both kinds of record.** Rather than a template per strategy,
  `20260909160000_coi_revenue_share_email_neutral.sql` rewrote the `COI_PAYOUT` / `coi_revenue_share`
  row — and the fallback constants that mirror it — until every line is true of both: **"Payment
  received"** rather than "Client fee received", a **Reference** row rather than "Receipt number", and
  the "Paid in full" line gone. `[RECEIPT_NUMBER]` resolves to the client's receipt number on LEOS and
  to `revenue_reference` on a provider record (an em dash when neither exists), and `[TOTAL_FEE]` to
  whichever amount actually arrived, because `total_fee` is NULL on a provider row. `email_templates`
  still holds SEVEN rows: this was a rewrite, not an eighth.
- **What the admin sees.** The payments grid's money columns read **Basis** and **Amount** — Basis is
  the box label on Boxhouse, the contribution on 831(b) and DCD, "2.5 hrs" on Oil & Gas, "Loan
  $100,000.00" on Closehaul and an em dash on the pass-through strategies,
  Amount is the received revenue or
  the expected one with a muted "expected" beside it — and the status pill is one of two stages of its
  own, **Awaiting provider payment** or **Revenue received**, because there is no Stripe state to
  report and no request was ever emailed. The detail screen shows the inputs the record was raised on,
  the expected and received revenue, the received date and the reference, and hides the client fee, the
  method, the documents and every email action; it also carries a **"View receipt"** link to the lump
  sum this record was one line of, shown only to an admin who may see the Tax Strategies tab.

## Where the pieces live

| Piece | File |
| --- | --- |
| Payments tab + grid rows | `iag-portal/src/components/CoiClients.jsx` (`ClientPayments`), `PaymentsGrid.jsx` (`PaymentRow`) |
| Payment detail + status pill | `iag-portal/src/components/PaymentDetail.jsx` (also exports `StatusPill`, `methodText`) |
| Shared `Field` / `BackLink` / `TrackHero` | `iag-portal/src/components/shared/TrackKit.jsx` |
| Tax planner + recipient chips (shared with the receipt form) | `iag-portal/src/components/shared/NotificationPickers.jsx` |
| Request form (client picker + fixed strategy, Legal firm select) | `iag-portal/src/components/ClientPaymentForm.jsx` |
| The fee discount fields (record only) and their read-outs | `iag-portal/src/components/shared/DiscountFields.jsx` (used by the two forms, `PaymentDetail`, `ProviderReceiptDetail`, `PaymentsGrid`) |
| Where every payment now starts | `iag-portal/src/components/TaxStrategiesPanel.jsx` |
| The four previews (display only) | `iag-portal/src/lib/revenuePreview.js` (`computePreview`, `computeClientFeePoolPreview`, `computeFeePctWaterfallPreview`, `computeProviderPreview`) |
| Public pay page (one `OptionCard` per method; card grossed up) | `iag-portal/src/pages/PayPage.jsx` (`OptionCard`) |
| Payments under each client-funded strategy's card | `iag-portal/src/components/TaxStrategiesPanel.jsx` (`StrategyPayments`) |
| Route + emitted static page | `iag-portal/src/App.jsx`, `iag-portal/scripts/emit-route-pages.mjs` |
| Row + customer + token + draft | `iag-admin-api/actions/payments/start-client-payment.ts` |
| Request-email helper (shared) | `iag-admin-api/actions/payments/request-email.ts` (also exports `paymentLinkButton`) |
| Payment-reminder helper (latched, sweep only) | `iag-admin-api/actions/payments/reminder-email.ts` |
| Payment history (composes `pay_url`) | `iag-admin-api/actions/payments/load-client-payments.ts` |
| One payment + its `steps` | `iag-admin-api/actions/payments/load-client-payment.ts` |
| Step builder (the ONE step machine; `label` + `action`) | `iag-admin-api/utils/payment-steps.ts` |
| First outstanding step → `next_action` / `next_owner` | `iag-admin-api/actions/overview/shared.ts` (`summarizePayment`) |
| One-click return from a deep origin | `iag-portal/src/components/CoiSearch.jsx` (`DEEP_RETURN_TOS`, `originBack`), `CoiClients.jsx`, `PaymentDetail.jsx` (`backLabel`) |
| Row filters and the admin-action toggle | `iag-portal/src/components/ListFilterKit.jsx` (`ListFilterToggle`) |
| Manual step toggle (refuses a fee with a payee) | `iag-admin-api/actions/payments/update-payment-step.ts` |
| Hard-cost transfers, their retry | `iag-admin-api/actions/payments/hard-costs.ts`, `retry-hard-cost.ts` (`flows/hard-cost-payees.md`) |
| Discount parsing + the `[DISCOUNT_NOTE]` sentence | `iag-admin-api/utils/discount-note.ts` (`parseFeeDiscount`, `discountNote`) |
| Tax planner (the ONE earner) | `iag-admin-api/actions/payments/set-payment-tax-planner.ts` |
| Notification recipients (a set) | `iag-admin-api/actions/payments/update-payment-recipient.ts` |
| Admin roster (the ONE picker read) | `iag-admin-api/actions/admins/directory.ts` (`loadAdminDirectory` + `load_admin_directory`) |
| Webhook envelope → booking call | `iag-admin-api/router/webhooks.ts` |
| Booking (the ONLY `payment_status` writer) | `iag-admin-api/actions/payments/book-client-payment.ts` |
| Confirmation-email helper (latched) | `iag-admin-api/actions/payments/confirmation-email.ts` |
| Resend any of the three emails | `iag-admin-api/actions/payments/resend-payment-email.ts` |
| Invoice + receipt chain (latched) | `iag-admin-api/actions/payments/invoice-receipt.ts` |
| Revenue share: stamp, transfer, email | `iag-admin-api/actions/payments/revenue-share.ts` (owns `rev_paid` and `rev_idempotency_key`) |
| The waterfall arithmetic (pure) | `iag-admin-api/utils/revenue-waterfall.ts` — `computeWaterfall` (with its `client_fee_pool` and `fee_pct_waterfall` branches and `isExcludedMothership`) plus `expectedRevenue`, `implementationFee`, `computeProviderWaterfall` |
| The nine models and the two funding sources | `iag-admin-api/utils/strategy-models.ts` |
| Strategy rules: read, and validate per model (`excluded_motherships` checked against `motherships` by one helper, `validateExcludedMotherships`) | `iag-admin-api/actions/strategies/load.ts`, `save.ts` (the ONLY writer of `model` and `rules`) |
| Strategy rules editor, one form per model | `iag-portal/src/components/TaxStrategiesPanel.jsx` |
| Overview grids (Basis / Amount, provider rows) | `iag-admin-api/actions/overview/shared.ts`, `clients.ts`, `all-payments.ts`; `iag-portal/src/components/ClientOverviewPanel.jsx` |
| Provider lump sum → client rows born received (the ONLY `revenue_received*` writer) | `iag-admin-api/actions/receipts/create.ts` (`flows/provider-receipts.md`) |
| Those receipts back: the list and one receipt | `iag-admin-api/actions/receipts/load.ts` |
| Per-model provider inputs (pure, shared) | `iag-admin-api/utils/provider-record-inputs.ts` |
| The receipt form and the receipt screen | `iag-portal/src/components/ProviderReceiptForm.jsx`, `ProviderReceiptDetail.jsx` |
| Finish an unfinished revenue share | `iag-admin-api/actions/payments/retry-revenue-share.ts` |
| Number allocation (insert = claim) | `iag-admin-api/utils/doc-numbers.ts` |
| The two documents, as HTML | `iag-admin-api/utils/payment-documents-html.ts` |
| HTML → PDF (only reader of the key) | `iag-admin-api/utils/html2pdf.ts` |
| Gmail draft + MIME attachments | `iag-admin-api/utils/gmail-draft.ts` |
| Public quote handler | `iag-admin-api/actions/payments/load-pay-link.ts` |
| Public checkout handler | `iag-admin-api/actions/payments/pay-link-checkout.ts` |
| Recipient role tokens | `iag-admin-api/utils/email-recipients.ts` |
| What the fee is called, everywhere the client reads it | `iag-admin-api/utils/fee-label.ts` (`clientFeeLabel`) |
| The `[PAYMENT_METHODS_NOTE]` sentence, by model | `iag-admin-api/utils/payment-methods-note.ts` (`paymentMethodsNote`) |
| Stripe key + `stripeFetch` (mode REQUIRED) | `iag-admin-api/utils/stripe.ts` |
| The mode rule (the COI's toggle, then by row) | `iag-admin-api/utils/stripe-mode.ts` (`modeForCoi`, `modeForPaymentRow`) |
| Pipeline table (all columns) | `supabase/migrations/20260828123000_client_payments.sql` |
| Issued-number registry | `supabase/migrations/20260902150000_document_numbers.sql` |
| Assignments: column + join table + backfill | `supabase/migrations/20260904120000_payment_notification_assignments.sql` |
| Strategy models: `model`, `rules`, `affiliated_via_ert`, the three seeded rows | `supabase/migrations/20260909120000_strategy_models.sql` (activated by `20260910100000_activate_provider_strategies.sql`) |
| Provider-funded columns (`funded_by`, `strategy_inputs`, `revenue_*`) | `supabase/migrations/20260909130000_provider_funded_records.sql` |
| `provider_receipts` + `client_payments.receipt_id` (ON DELETE RESTRICT) | `supabase/migrations/20260910120000_provider_receipts.sql` |
| The per-attempt transfer key | `supabase/migrations/20260909150000_rev_idempotency_key.sql` |
| Two more models in the CHECK, `client_payments.strategy_model` (backfilled) + `card_processing_fee`, `COSTSEG` and `IMPL_FEE` seeded active | `supabase/migrations/20260915100000_cost_seg_and_implementation_fee.sql` |
| `NBDT` seeded ACTIVE, `fee_pct_waterfall` added to the model CHECK (seven) | `supabase/migrations/20260917100000_nbdt_strategy.sql` |
| `members.sandbox` | `supabase/migrations/20260922130000_coi_sandbox_toggle.sql` |
| `discount_amount` / `discount_reason` + `[DISCOUNT_NOTE]` in five templates | `supabase/migrations/20260922150000_fee_discount.sql` |
| `payees`, the payee and hard-cost columns, the two hard-cost rules | `supabase/migrations/20260922160000_payees_and_hard_costs.sql` |
| `[PAYMENT_METHODS_NOTE]` in the request and reminder templates | `supabase/migrations/20260915110000_payment_email_methods_note.sql` |
| Confirmation and invoice-receipt templates in VFO's voice | `supabase/migrations/20260915120000_client_email_wording.sql` |
| Seeded template rows | `supabase/migrations/20260902130000_client_payment_request.sql`, `20260902140000_client_payment_confirmation.sql`, `20260902151000_client_payment_invoice_receipt.sql`, `20260903120000_coi_revenue_share_email.sql`, `20260903130000_coi_revenue_share_email_layout.sql`, `20260909160000_coi_revenue_share_email_neutral.sql` |

## Traps

- **The two public handlers MUST agree on what a token means.** `load_pay_link` quotes the amount
  and `pay_link_checkout` charges it, from the same row by the same lookup, with identical `invalid`
  and `paid` answers. Letting them drift shows the client one figure and bills another.
- **NEVER hand-write `payment_status`.** It does two irreversible things at once. Both public
  handlers refuse a row whose `payment_status` is non-null with `state: "paid"`, so the pay link is
  permanently retired — there is no way to re-open one, the admin raises a new payment. And the
  webhook's claims are conditional on that column, so a booking that arrives afterwards finds
  nothing to claim and SKIPS the row: Stripe takes the money and the portal never records the
  PaymentIntent, the method or the digits. A manual fix or a reconciliation script that touches this
  column is doing both.
- **`bookClientPayment` must stay the ONLY writer of `payment_status`.** Every idempotence guarantee
  in this flow is one function claiming one column; a second writer anywhere — a repair handler, an
  admin "mark as paid" button, a future sweep — removes the guarantee rather than adding a feature.
  If a payment ever has to be corrected by hand, that is a decision to make with the reasoning
  written down, not a column to poke.
- **A step's `label` and its `action` are two phrases, and BOTH must be edited together.** Neither is
  derived from the other: the progress list renders the label beside a tick, the overview renders the
  action under "Next action". Change one and the other quietly starts describing a different step —
  and the failure is silent, because each screen reads only its own field. Every step the machine
  builds carries an action; `summarizePayment`'s fallback to `label` is belt and braces for one added
  without, not a licence to omit it.
- **The four `*_done` flags are acknowledgements, never gates.** (Since chat 15 a `legal_fee_done` /
  `admin_fee_done` on a row with a payee is written by the successful TRANSFER instead — still read by
  nothing that moves money.) They record that a cost was settled OUTSIDE the portal — the three hard costs, and on Path A the COI's share handed to ERT
  (`ert_share_done`, which the whitelist in `update_payment_step` reaches through the same
  `${step}_done` / `${step}_done_at` shape as the other three). Nothing reads them, and nothing
  should start: the revenue share works
  from the calculated waterfall alone, so wiring a payout to a checkbox would let a click move money.
  The ticks are not inputs to the waterfall, before or after it is stamped. `ert_share_done` is the
  one that also carries a DATE the screen leans on — a `"Via ERT"` payment has no `rev_completed_at`,
  so `ert_share_done_at` is what finishes it — but it still moves nothing.
- **NEVER recompute a waterfall that is already stamped.** The ten columns are written once, in one
  conditional update, and every later run reads them back. `coi_level_at_payment`, `coi_share_pct`
  and `coi_paid_via_ert` exist BECAUSE a COI's level moves, a COI can change mothership and a
  strategy's rules are editable in the
  portal, so a "helpful" recalculation on a retry pays a share this payment was never assessed for,
  quietly, against numbers no longer on the row. If the numbers on a booked payment are wrong, that
  is a decision to make with the reasoning written down, not a function to re-run.
- **`rev_paid`'s values are owned by `revenue-share.ts`.** SIX strings, listed in that file:
  `succeeded`, `processing`, `Not Due`, `Awaiting Payout Account`, `Failed`, `Via ERT`. The step
  machine, the payments list, the detail screen, the sweep's leg-A predicate and
  `retry_revenue_share` all branch on those exact strings, so a
  seventh state invented anywhere else is a payment that shows as neither done nor retryable. And the
  two non-terminal states must STAY non-terminal — collapsing a held share into "Not Due" is how VFO
  lost shares that were owed, never paid, never alerted and never retried. `Via ERT` is terminal for
  the transfer pipeline but NOT for the payment: its outstanding item is the `ert_share` tick, which
  is why nothing may treat the state alone as money having reached the COI (the COI Overview's
  earnings total counts a Path A share only once the tick is on).
- **The transfer's CLAIM and its Idempotency-Key are both required; neither replaces the other.**
  The claim stops two concurrent deliveries from both reaching Stripe. The key stops a transfer that
  committed but whose response was lost from being created twice on the retry — the claim cannot help
  there, because from this side that call never finished. The key must stay deterministic **for one
  ATTEMPT** and must be the STORED one on a mid-flight resume: a key generated fresh inside the
  transfer call, after the claim, guarantees nothing at all, and a key held fixed per PAYMENT makes a
  refusal permanent for 24 hours (GOTCHA #22). The scope is the whole rule — one attempt, written by
  the claim, read back only from `"processing"`.
- **NEVER un-receive a provider record's revenue.** The `revenue_received` stamp — written by
  `actions/receipts/create.ts` when the row is inserted, and by nothing else — is the amount the COI's
  share is computed from and transferred against. A hand-edit of it, or a "correction" screen, leaves a
  transfer sized by a figure that is no longer on the row, and re-opening the record cannot un-send the
  money. It is the exact shape of the `payment_status` trap above, for the same reason. There is no
  clearing step in the provider progress list for a tick handler to reach, and none should be added;
  the rest of this trap lives in `flows/provider-receipts.md`.
- **Both public handlers must keep answering 200 with a `state`**, exactly like `/set-password` and
  `/payout-setup`. A 404 or 400 on a bad token turns the endpoint into an oracle for guessing them.
  Only a *missing* token is a 400 — that is a malformed request, not a wrong guess.
- **`checkout_token` must never reach the browser.** Both readers spend it composing `pay_url` and
  drop the field — `load_client_payment` does it in the LOADER, before the payload is built, so a
  future caller cannot forget. Adding it to a response "for convenience" leaks the credential into
  every admin screen, log and screenshot.
- **The emailed link points at production**, so `/pay` must stay in `ROUTES` in
  `scripts/emit-route-pages.mjs` or GitHub Pages serves a real 404 to a client arriving from an
  email with money in hand.
- **`sandbox` is stamped once, at request time, and never revised.** It is the AUTHORITY for this
  payment's mode from then on — `pay_link_checkout`, the webhook booking, the revenue share and the
  hard-cost transfers all read it back off the row rather than asking the COI again. Flipping the
  COI's Sandbox toggle afterwards changes FUTURE payments only (GOTCHA #20) — and is refused once
  they have a Connect account; a live payment cannot be flipped onto a test key by an edit to a
  profile.
- **The `livemode` guard is per row, and it lives in `bookClientPayment`.** After the row is read and
  before any write: `event.livemode === !!row.sandbox` IS the mismatch (livemode true must pair with
  sandbox false). A mismatch logs both values and answers Stripe 200 with
  `skipped: "mode_mismatch"`, writing nothing — a 4xx would make Stripe retry an event this portal
  will never accept, forever. The `stripe_events` upsert still happens BEFORE the booking call:
  record first, act second.
- **"Start payment" is not a resend.** A second press raises a SECOND payment request with its
  own row, amount and token. Re-sending the same request is `resend_payment_email`, and its
  `already_sent_at` guard is the only thing standing between a double-click and a client holding two
  payment emails — never bypass it with `force` on the client's behalf.
- **A number is stamped on the row BEFORE the PDFs are rendered**, and that order is the design, not
  an accident of where the line ended up. Rendering first would mean a PDF failure — or a Gmail
  failure, or a retry of the same webhook — burning a second number and issuing two documents that
  describe one payment. Anything that reorders those steps, or that "tidies up" by allocating both
  numbers next to the render, breaks the one property this scheme has to have.
- **NEVER delete a `document_numbers` row.** The row IS the record that the number was issued; the
  count that produces the next number reads that table, so a deleted row is a number that will be
  handed out a second time, to a different client, for a different amount. Deleting a PAYMENT is
  fine — its numbers are already detached by ON DELETE SET NULL — and a cleanup script that follows
  the payment into this table is reissuing invoice numbers without knowing it.
- **A supabase-js `.select()` must be ONE string literal** (GOTCHA #16). Wrapping a long select with
  `+` collapses the row type to `GenericStringError` and turns every property read into a TS2339,
  dozens at a time, none of them pointing at the select. `load-client-payments.ts` gets away with a
  concatenated select only because its rows are consumed as `any`; copying that shape into a file
  that types its rows is what breaks the type gate.
- **`HTML2PDF_API_KEY` is read in exactly one file.** `utils/html2pdf.ts` owns the endpoint, the key
  and the base64 conversion, so there is one place to rotate, one place that could log the key, and
  one place to change if the PDF service is ever swapped. The key travels in the request BODY, which
  is why that file logs the response STATUS and never the response body.
- **`method` in the checkout body is honoured only on `client_fee_pool`.** On every other model
  `pay_link_checkout` does not consult the body at all: LEOS is ACH only — a product decision, not a
  limitation — and the page offers no card there because `load_pay_link` answers `accepts_card`
  false. Even on `client_fee_pool` only the literal `"card"` changes anything; any other value, on
  any model, is ACH. A card option must never be grown by way of a payload field. And there is
  deliberately no `payment_intent_data[setup_future_usage]` on either method — a client fee is a
  single payment, so storing the client's bank or card details past this charge would be keeping
  data nothing will ever use.
- **The fee discount is RECORD ONLY — never let it into arithmetic.** The fee typed is what the
  client is charged; the discount says how much was knocked off a standard price and why. It is read
  after the pool guard and by nothing that sizes money — not the waterfall, not the Stripe amount,
  not a receipt's sum check, not a document's total. Subtracting it anywhere would discount the fee
  twice.
- **A card's `card_processing_fee` is the client's cost, never revenue — it must never enter the
  waterfall.** The charge is grossed up so IAG nets the fee, and the pool is `total_fee`; the
  column exists so the invoice, the receipt and the detail screen can show what Stripe actually
  took. Adding it to the pool pays a COI a share of Stripe's fee; subtracting it from the pool
  charges the COI for the client's choice of method. It is NULL on an ACH, not 0 — a zero would
  claim a fee was computed and came to nothing.
- **Never draft a confirmation on a `"Not Needed"` row.** That value is the booking writing VFO's
  rule onto the row — the payment settled on the spot, the invoice and receipt are its confirmation —
  and `draftPaymentConfirmation`, `resend_payment_email`, sweep leg B and the detail screen's button
  all read it. `force` does not bypass it and must not start to: force is for an email that was owed
  and went astray, and a "please allow 2-4 business days" draft to a client who paid by card
  describes a transfer that never existed. `confirmation_status` has THREE values, and a reader that
  only knows two will treat this row as one with something missing.
