# FLOW — Client payment request

How a client is asked for a strategy fee, pays it by ACH, and gets booked. Spans the client
**Payments** tab and the payment detail screen (frontend), the authed actions that raise the request
and read it back, the public `/pay` page, the two PUBLIC actions behind the emailed link — one quotes
the amount, one charges it — and the Stripe webhook that books the money onto the row and then
issues the paperwork for it.

**Nothing is SENT; the money IS booked — and now paid out.** All four emails are Gmail DRAFTS —
there is still no send path anywhere in this system. But the pipeline no longer stops at Stripe:
since Phase D the webhook writes `payment_status` and the rest of the checkout block onto the row and
drafts the confirmation, since Phase E a payment that CLEARS is also issued a numbered invoice and
receipt, rendered to PDF and attached to a third draft, and since Phase F that same clearing stamps
the whole revenue waterfall onto the row and TRANSFERS the COI's share to their Stripe Connect
account. The row is now written end to end.

**And a second kind of record shares the pipeline.** On Boxhouse, 831(b) and DCD the client pays the
PROVIDER, never this portal — nothing is charged here, nothing is emailed to the client, and the
clearing event is an admin recording that the provider paid Wealth IG. Everything below the Available
Revenue Pool is then the same code on the same columns. That half is *Provider-funded records*, below;
everything between here and it is the client-funded (LEOS) path.

## The path

1. **An admin opens a client and presses "Start New Payment."** The Payments tab (`ClientPayments`
   in `CoiClients.jsx`) loads that client's history plus the strategy rules, and the button opens
   `ClientPaymentForm` inline. The strategy select gates everything below it — no amounts are asked
   for until a strategy is chosen, because the strategy decides every number under it, **including
   WHICH FORM this is**: a strategy whose `funded_by` is `provider` swaps the whole fee block for the
   strategy's own inputs and raises a revenue record instead of a payment request (*Provider-funded
   records*, below). On LEOS, the client-funded path described here, the admin
   enters the **offset amount**, the **total client fee** and optional notes, ticks or unticks
   **"Legal opinion letter required"** (ticked by default), and watches a read-only **Revenue share
   preview** recompute on every keystroke. The letter checkbox sits with the amounts because it IS
   one: unticking it takes the flat legal fee out of the preview, and the fee the client is invoiced
   is quoted on the strength of the answer. It is decided ONCE, here — a repeat client running the
   exact same strategy as last year may not need a new letter, which is the tax advisor's call — and
   is never revisited afterwards. Below the notes the form also asks WHO: a **Tax planner** select
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
   `offset_amount`, `total_fee`, `legal_fee_waived`, `notes`, `tax_planner_email` and
   `recipient_emails` go to the server. It mirrors the
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
   at 2000 characters.
4. **The row goes in FIRST**, before any external side effect: `client_id`, `strategy_key`,
   `offset_amount`, `total_fee`, `legal_fee_waived` (anything but a literal `true` is false — a body
   that omits the field charges the letter, which is the safe direction: charging one that was not
   needed is a conversation, skipping one that was is a missing legal document), `notes`, `sandbox`
   and `created_by` (the admin's email, from the session).

   **The Stripe mode is decided here and only here.** `modeForNames(client.first_name,
   client.last_name, coi.first_name, coi.last_name)` — "Test" anywhere in EITHER name means sandbox,
   everyone else live (`utils/stripe-mode.ts`, GOTCHA #20). The answer is stamped as
   `sandbox: mode === "sandbox"` and echoed in the response, and everything downstream reads it back
   off the row instead of asking the names again. The COI's name counts because the client's
   test-ness is inherited from whoever referred them, and because the Connect account their share is
   transferred to is the COI's.

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
   a deactivated row still produces a sane email). Four global regex replacements: `[First Name]`,
   `[Client Name]`, `[STRATEGY]`, `[TOTAL_FEE]` (en-US grouping, two decimals), plus
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
   The page calls `load_pay_link`, which quotes the client name, the strategy, a
   `"<Strategy> Client Fee"` label and the amount, and renders one ACH card ("No Fee",
   `$0.00` processing). The token states sit in `AuthShell`, whose left panel carries a per-page
   `tagline` — here the client-facing "Secure payment of your strategy fee" line, not the team-portal
   default.
8. **`pay_link_checkout`** (PUBLIC) mints a Stripe Checkout session on the mode read back off the
   payment row (`modeForPaymentRow`) — the Stripe customer it bills against was created under that
   same key: `mode=payment`,
   `payment_method_types[]=us_bank_account`, one `price_data` line item at
   `round(total_fee × 100)` cents named `"<Strategy> - (<client_number>) <Name> - Client Fee"`, and
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
    successful", and a "What happens next" panel promising three things: the transfer clears in 2 to
    4 business days, a confirmation email when it arrives, and the invoice and receipt once
    it has settled. We never see a bank detail.

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
    `payment_method_type` (`"ach"`), `acct_last4`, `payment_date`, and `confirmation_status`
    `"Confirmation Needed"`. An unknown method is treated as ACH — claiming money has cleared when it
    has not is the more expensive mistake. Then it drafts the confirmation.
13. **`payment_intent.succeeded`** is the ACH clearing, days later: `"processing"` → `"succeeded"`,
    `payment_date` re-stamped with the clearing moment, and any of `payment_intent_id` /
    `payment_method_type` / `acct_last4` still null backfilled — only those, so a later, thinner read
    cannot erase what the checkout branch already saw. It drafts NO second confirmation. If the row
    has no status at all (Stripe orders nothing, so this event can arrive first) it books the payment
    in full right there, straight to `"succeeded"`, and chains the confirmation itself.
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
    row `CLIENT_PAYMENT` / `client_payment_confirmation`, fallback constants mirroring the seed, a
    Gmail DRAFT, recipients through the same role tokens. Its tokens are `[First Name]`,
    `[Client Name]`, `[STRATEGY]`, `[TOTAL_FEE]` and `[ACCT_LAST4]`, which falls back to `"----"`
    when Stripe gave us no digits — obviously unknown, rather than a plausible account number. The
    latch is `confirmation_status === "Sent"` (+ `confirmation_sent_at`), checked inside the helper
    so the webhook cannot draft twice; it NEVER throws, and on a Gmail failure it deliberately leaves
    the row on "Confirmation Needed" for an admin to resend. A *stamp* failure after a successful
    draft is logged only — surfacing it would get the email drafted twice.
17. **`resend_payment_email`** (authed) re-drafts either email: `kind` `request` or `confirmation`,
    guarded exactly like `coi_stripe_connect_request` — an already-sent email answers 200 with
    `already_sent_at` and `to_email` so the screen can ask "resend anyway?", and only `force: true`
    gets past it. The refusals are about the PAYMENT's state: a `request` is refused once
    `payment_status` exists, because the link is spent and mailing a dead button is worse than
    mailing nothing; a `confirmation` is refused while `payment_status` is null, because there is
    nothing to confirm. Both delegate to the same helpers the original callers use.
18. **The payment detail screen.** `load_client_payment` returns the row (with `checkout_token`
    spent composing `pay_url` and stripped in the LOADER, so no caller can forget), the client and
    strategy names, and an ordered `steps` list built SERVER-SIDE by `utils/payment-steps.ts`. On a
    client-funded payment that is ten
    steps in the real order of events — request emailed, client submitted, confirmation (drafted at
    submission, so it precedes clearing), "Invoice and receipt — funds cleared" (one step: the
    documents are drafted at the moment the money clears), the three hard costs, the COI's share, revenue-share email,
    and last the internal team share Wealth IG retains (`net_profit`, no checkbox, `net_profit_pool`
    as its amount, done once the COI's share is settled; the five money amounts sum to `total_fee`,
    which the screen shows as a Total line once all are stamped) —
    each with `done`, `at`, `owner`, `manual` and `applicable` — plus, on the INAPPLICABLE steps
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
    instead of patching its own copy. **The tick is COSMETIC**: the portal moves no money for those
    three costs, and nothing downstream reads `*_done`.

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
    row, details panel, schedule table, total band, footer — rebranded to Wealth Innovation Group and
    simplified to what a client fee actually is. Navy `#0F355A` invoice with `#1D64A8` eyebrows;
    green `#1b9254` receipt. From is "Wealth Innovation Group / portal.wealthig.com"; the client
    appears by name with `Ref: <client_number>` and their email (Bill To on the invoice, Received
    From on the receipt). The schedule table has exactly ONE row and it always reads `✓ Paid`,
    because a client fee is one payment; the receipt adds "Via ACH Bank Transfer · Account ending
    ****<last4>" and a **Date Received** of `payment_date`, while the document's own date is TODAY —
    conflating the two would date a receipt to the day it was re-issued. Every client-supplied string
    goes through `esc()`. Then `utils/html2pdf.ts` POSTs each document to `api.html2pdf.app` and
    returns it base64-encoded, ready to drop into a MIME part. Its key is `HTML2PDF_API_KEY`, read at
    call time so a rotation needs no code change, never logged — and the service's error BODY is
    never logged either, because it can echo the request, and the request carries the key.
26. **The email carries them as attachments.** `draftGmail` grew an `attachments` option: given any,
    the message becomes `multipart/mixed` — the HTML body as the first part, then one
    `application/pdf` / `Content-Transfer-Encoding: base64` part per document, named
    `<INV-…>.pdf` and `<REC-…>.pdf` so the client can match the sentence in the email to the files
    without opening them. Given none, the MIME is byte-identical to what it was before, which is what
    makes this safe to add under the two existing emails. Still a DRAFT. Subject and body come from
    `CLIENT_PAYMENT` / `client_payment_invoice_receipt` with fallback constants mirroring the seed,
    tokens `[First Name]`, `[Client Name]`, `[STRATEGY]`, `[TOTAL_FEE]`, `[INVOICE_NUMBER]` and
    `[RECEIPT_NUMBER]`, recipients through the same `RECIPIENT` / `CLIENT` / `COI` role tokens.
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
    answer Stripe 200.
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
    order and the rounding are written down. It mirrors `computePreview` in `ClientPaymentForm.jsx`
    step for step (`round2` at every stage, admin fee off the OFFSET, ERT's percentage off WHAT
    REMAINS, affiliated = `mothership_number === 1`), because the admin was shown a figure before the
    client was ever asked for money and the server has to arrive at the same one. Values from
    PostgREST are coerced with `Number()` and a NaN reads as 0, so one unset rule cannot poison every
    figure below it. Two rules bend the middle of it. **`legalFeeWaived` is a REQUIRED input**, not
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
    `[STRATEGY]`, `[TOTAL_FEE]`, `[SHARE_AMOUNT]`, `[COI_LEVEL]` and `[SHARE_PCT]` — the last two read
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
    that is wrong — a missing digit, or an offset and a fee the wrong way round. The provider branch
    carries the same guard against its own arithmetic: 400 "These inputs leave no revenue to share."
    when `expectedRevenue` comes back zero or less.

## Phase G — the sweep

Every stage above can stall: a Gmail outage swallows a draft, a COI has no payout account yet, a
client simply does not pay. Phase G adds one PUBLIC action, `run_payment_sweep`, fired nightly by
pg_cron at 10:00 UTC, that re-offers the stalled rows to the SAME latched helpers this flow already
uses — the revenue share, the confirmation, the invoice and receipt, and the request email — and adds
one new email of its own: a **payment reminder** two business days after the request went out, latched
on `client_payments.payment_reminder_sent_at`. It changes nothing in this flow; it just finishes it.
Legs B to E filter `funded_by = 'client'` explicitly — none of what they chase exists on a
provider-funded record — while **leg A chases both pipelines**, because once a record has cleared,
however it cleared, the COI is owed the same share by the same helper.
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

- The Payments tab is an auto-layout table, **newest first**, under a column header: Date |
  Strategy | **Basis** | **Amount** | Method | Status. The two money columns are named for what they
  MEAN rather than for what LEOS calls them, because a provider-funded record has neither an offset
  nor a client fee: Basis is the offset here and the box label or the contribution there, Amount is
  the client fee here and the received (or, in muted "expected", the forecast) revenue there. The pay
  link is not on the list — it is on the
  payment's own detail screen, which the row opens. The date is `payment_date` once the
  money has moved and `created_at` before that — always the row's most recent fact. Method reads
  `ACH ····1234`, or nothing at all while there is no payment (a dash would read as "paid, method
  unknown"). The status pill reads `payment_status` capitalised — **Processing**, **Succeeded** in
  green — and before Stripe has produced one, **Awaiting payment** if the email went or a red
  **Email not sent** if the draft failed. An orange "Confirmation not sent" sits under the pill while
  `confirmation_status` is "Confirmation Needed", and an orange "Invoice not sent" under a green
  Succeeded pill while `invoice_email_sent` is false — joined by "Revenue share held" on
  `rev_paid === "Awaiting Payout Account"` and "Revenue share failed" on `"Failed"`. A cleared
  payment can owe several of those, and the lines stack.
- **The whole row is clickable** and opens `PaymentDetail`, which REPLACES the client hero and its
  pills exactly as an open client replaces the COI's — the standing "nested detail takes over the
  parent header" rule, one level down. Inside: its own hero, a "← Back to payments" `BackLink`
  under it (never above the hero), a **Progress** card
  rendering the server's `steps` (done mark or a real checkbox, label, owner chip, date), an
  **Notifications** card (the tax planner select and the "Other notification recipients" chips — see above) and a
  **Details** card of fields — the invoice and receipt numbers, the available pool, the COI's level
  and share, the net profit pool, the revenue-share status and the transfer id among them — plus the
  actions: **Send payment email** while the request has never gone, **Resend payment email** once it
  has, **Resend confirmation** once there is a payment, and, on a SUCCEEDED payment only, **Send
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
- `load_client_payments` and `load_client_payment` both return `pay_url` composed from the token and
  **never the `checkout_token` itself** — the admin screen needs the link, not the secret inside it.

## Provider-funded records — Boxhouse, 831(b), DCD

**On three of the four strategies the client never pays through this portal.** They pay the provider —
Boxhouse, SRA, the DCD strategy — and the provider later pays Wealth IG its revenue, often as one
lump sum covering several clients (Jake, 2026-09-09). No money for those three passes through Stripe
here, so a "payment" on them is a **revenue record**: raised with the strategy's own inputs, carrying
what those inputs say the provider will owe, and waiting until an admin says the money arrived. It is
the same `client_payments` row and the same screens, because it is the same question — what is owed
to whom on this client's strategy, and has it been settled. `strategies.funded_by` decides which
pipeline a strategy runs, and `client_payments.funded_by` snapshots that answer onto the row for the
same reason `coi_paid_via_ert` is snapshotted: the step machine is handed the row and nothing else.

**The form asks the strategy's own questions.** `ClientPaymentForm` reads `funded_by` off the chosen
strategy and swaps the whole fee block out. Boxhouse asks for a **box size** (the `rules.tiers` list,
by label); 831(b) asks for a **premium** and **first-year / returning**; DCD asks for an **investment
amount** and an **"Implementation fee charged"** checkbox — held as CHARGED, exactly like the LEOS
legal letter, so the box reads as the thing being turned off. There is no offset, no total fee and no
legal-letter tick, because none of them exists on these strategies. The notes, the tax planner and the
recipient chips are the same controls in the same place. The button reads **Create revenue record**,
and the block reason under it names the missing input ("Choose a box size before submitting.").

**The preview is DISPLAY ONLY and mirrors three server functions.** `computeProviderPreview` in
`ClientPaymentForm.jsx` is to `expectedRevenue`, `implementationFee` and `computeProviderWaterfall`
(`utils/revenue-waterfall.ts`) what `computePreview` is to `computeWaterfall` — the admin is shown
what the provider will owe before the record is raised, so the server has to arrive at the same
figure. Three functions rather than one because they answer three separate questions, and only the
first two are knowable at request time:

- **Expected revenue** — the pool. `fixed_commission`: the commission for the box size, straight off
  the rules ($9,750 / $15,000 / $19,500 today). `retention_share`: the premium × SRA's retention
  percentage for a premium of that size — a FLOOR list read from the bottom up, so a premium landing
  exactly on a threshold takes that threshold's tier — then Wealth IG's cut of that fee, 30% first
  year or 20% returning. **Two roundings, not one**: the retention fee is real money SRA keeps before
  it is a base for anything. `contribution_pct`: a straight percentage of the investment (15%).
- **The implementation fee** — $2,500 Boxhouse, $1,800 831(b), 5% of the investment capped at $10,000
  on DCD, waivable there. **Informational only**: it is billed by its own automation, nobody shares in
  it, and it never comes off the pool. It shows as a note under the figure rather than a line in the
  split. Its ONE consequence is DCD's Path A share, below.
- **The split** — the same shape as the LEOS waterfall, and the same rules below the pool.
  `computeProviderWaterfall` returns the identical `Waterfall` object, with the three hard-cost
  figures and the processing percentage ZERO rather than absent so the screen can still total them,
  and **the pool IS the money**: there is no fee to subtract. **Path A needs BOTH flags** —
  `mothership_number === 1` AND `strategies.affiliated_via_ert` — because on 831(b) an ERT-affiliated
  COI is paid by this portal on the level ladder like anyone else, and the mothership alone would send
  them down the wrong path. On DCD the Path A percentage itself moves with the fee: 55% charged, 60%
  waived (`rules.affiliated_share_pct_fee_waived`), which is why the waiver is snapshotted onto the
  record as an input rather than recomputed later.

**What `start_client_payment` stores, and what it skips.** The provider branch validates the model's
own inputs — a `tier_key` that exists in the rules (400 "Choose a box size."), a LITERAL boolean for
`first_year` (there is no safe direction to default it in), a positive premium or investment — builds
`strategy_inputs` **from the RULES rather than from the body** (a body free to name its own label
could call a MiniBox a Duplex), computes `revenue_expected`, refuses a zero pool with 400 "These
inputs leave no revenue to share.", stores the informational `implementation_fee_amount`, and
snapshots `coi_paid_via_ert` off the EXPECTED pool so the progress list shows the ERT path from the
day the record is raised. `offset_amount` and `total_fee` go in as **NULL, not zero** — there is no
client fee here, not a zero one, none, and zero is a figure the waterfall would act on. Then it stops:
**no Stripe customer, no `checkout_token`, no email**, and the client's address is not even required,
because nobody is being written to. It answers `{ success, payment_id, funded_by: "provider", sandbox }`.
The Stripe mode is still decided from both names and stamped, because the COI's share will be
transferred on it. Everything that is not money — the planner, the recipients, the notes, the insert
itself — is the SAME code as LEOS.

**The progress list is five steps, not ten.** `buildPaymentSteps` branches on the row's `funded_by`
snapshot: **Revenue record created** (always done — a row exists, so it was created), **Revenue
received from provider**, then the same three functions that end every payment — the COI's share
(`coiShareStep`, in whichever of its two forms), the revenue-share email and the internal team share.
The eight client-facing and hard-cost steps are ABSENT rather than inapplicable: "greyed out with a
reason" is for a step this pipeline HAS and this row does not, not for a stage that was never part of
the journey.

**`mark_revenue_received` is the clearing event.** There is no webhook to say a provider's money is
here, so an admin says it — and the action therefore does exactly what booking a cleared client
payment does. On the screen it is the progress list's `revenue_received` row wearing the same checkbox
as the LEOS manual ticks, but ticking it OPENS an inline confirm under the row: **amount received**
(pre-filled from `revenue_expected`, so the common case is a Confirm away and a different figure is a
correction rather than a fresh entry), an optional **reference**, and an orange line saying the share
is paid out the moment Confirm lands and cannot be undone. The step is deliberately sent with
`manual: false` so `update_payment_step` can never reach it — a tick with no amount would clear a
record and pay nobody. In order the handler:

1. **Refuses what it is not for.** 400 on a `funded_by = 'client'` row ("This payment is billed to the
   client; it clears when they pay."), 400 once `revenue_received_at` is set, 400 on an amount that is
   not a positive number — parsed with the same `"25,000.00"` / `" $25000 "` rule
   `start_client_payment` applies, deliberately spelled the same way, because an amount one would take
   and the other would refuse is a control that lies. The reference is trimmed, capped at 200
   characters, and absent is a real answer.
2. **Claims the row conditionally.** One update writes `revenue_received`, `revenue_received_at`,
   `revenue_received_by` (the SESSION's email) and `revenue_reference` with `.is("revenue_received_at",
   null)`, and a claim that changes no rows answers 400. Two admins can press this at the same moment
   and exactly one may clear the record; the read above it only makes the refusal fast.
3. **Raises the bell**, `revenue_received` — the seventh rule, Payment area sort 15
   (`flows/notifications.md`) — with the reference in the message when one was given.
4. **Runs `runRevenueShare` IN PROCESS**, never throwing, exactly as the webhook chains it on a
   clearing. That is what stamps the waterfall and pays or holds the COI's share.
5. **Answers the whole detail again** — the same `paymentDetailBody` shape `load_client_payment`
   returns, so the screen re-renders from server truth rather than reloading — plus a `rev_share`
   block (`rev_paid`, `share_amount`, `transfer_id`, `to_email`, `error`) so it can say what happened
   to the COI's money in the same breath. A transfer Stripe refused comes back `ok: true` WITH an
   error, and passing that string straight through is what puts Stripe's own reason in front of the
   admin instead of "try again shortly".

**It is NOT undoable, and that is the point rather than an omission.** The stamp is what the COI's
share is computed from and transferred against, so a received amount that could be edited afterwards
would be a payout sized by a figure that no longer exists. A wrong amount is a conversation with
whoever moved the money, not a button.

**`revenue-share.ts` branches in exactly two places.** First, **"cleared" has two spellings**:
`payment_status === "succeeded"` on a client row, `revenue_received_at != null` on a provider one —
a provider record has no `payment_status` and never will. Second, the STAMP reads
`computeProviderWaterfall` with `pool: revenue_received` — **what actually arrived, not what the
record expected**, because a lump sum rarely matches a per-client expectation to the cent. Everything
below the pool is the LEOS code on the LEOS columns: `Not Due`, `Via ERT`, the live account check, the
transfer, the hold, the failure, the email, the ten stamped columns and the rule that they are never
recomputed. `retry_revenue_share` applies the same clearing test, with its own wording for a record
whose revenue has not arrived ("This record's revenue has not been received yet; there is no revenue
share to pay."). In the nightly sweep, **leg A takes both pipelines** — one `.or()` per question, so
the pair reads "cleared, either way, AND unfinished" — while legs B to E filter `funded_by = 'client'`
explicitly, because nobody was emailed and nothing was charged on these records. Several of those legs
would exclude them today anyway, but only by ACCIDENT of a null column (`flows/nightly-sweep.md`).

**One COI email covers both kinds of record.** Rather than a template per strategy,
`20260909160000_coi_revenue_share_email_neutral.sql` rewrote the `COI_PAYOUT` / `coi_revenue_share`
row — and the fallback constants that mirror it — until every line is true of both: **"Payment
received"** rather than "Client fee received", a **Reference** row rather than "Receipt number", and
the "Paid in full" line gone. `[RECEIPT_NUMBER]` resolves to the client's receipt number on LEOS and
to `revenue_reference` on a provider record (an em dash when neither exists), and `[TOTAL_FEE]` to
whichever amount actually arrived, because `total_fee` is NULL on a provider row. `email_templates`
still holds SEVEN rows: this was a rewrite, not an eighth.

**What the admin sees.** The payments grid's money columns read **Basis** and **Amount** — Basis is
the box label on Boxhouse and the contribution on the other two, Amount is the received revenue or the
expected one with a muted "expected" beside it — and the status pill is one of two stages of its own,
**Awaiting provider payment** or **Revenue received**, because there is no Stripe state to report and
no request was ever emailed. The detail screen shows the inputs the record was raised on, the expected
and received revenue, the received date and the reference, and hides the client fee, the method, the
documents and every email action; the revenue-share buttons appear once the revenue is in. A money
step whose amount has not been calculated yet is greyed and unclickable (standing UI rule), with
"Pending calculation" beside it — except the entry step, which reads "Pending", because nothing is
being calculated there.

## Where the pieces live

| Piece | File |
| --- | --- |
| Payments tab + grid rows | `iag-portal/src/components/CoiClients.jsx` (`ClientPayments`), `PaymentsGrid.jsx` (`PaymentRow`) |
| Payment detail + status pill | `iag-portal/src/components/PaymentDetail.jsx` (also exports `StatusPill`, `methodText`) |
| Shared `Field` / `BackLink` / `TrackHero` | `iag-portal/src/components/shared/TrackKit.jsx` |
| Request form + both previews (`computePreview`, `computeProviderPreview`) | `iag-portal/src/components/ClientPaymentForm.jsx` |
| Public pay page | `iag-portal/src/pages/PayPage.jsx` |
| Route + emitted static page | `iag-portal/src/App.jsx`, `iag-portal/scripts/emit-route-pages.mjs` |
| Row + customer + token + draft | `iag-admin-api/actions/payments/start-client-payment.ts` |
| Request-email helper (shared) | `iag-admin-api/actions/payments/request-email.ts` (also exports `paymentLinkButton`) |
| Payment-reminder helper (latched, sweep only) | `iag-admin-api/actions/payments/reminder-email.ts` |
| Payment history (composes `pay_url`) | `iag-admin-api/actions/payments/load-client-payments.ts` |
| One payment + its `steps` | `iag-admin-api/actions/payments/load-client-payment.ts` |
| Step builder (the ONE step machine) | `iag-admin-api/utils/payment-steps.ts` |
| Manual step toggle | `iag-admin-api/actions/payments/update-payment-step.ts` |
| Tax planner (the ONE earner) | `iag-admin-api/actions/payments/set-payment-tax-planner.ts` |
| Notification recipients (a set) | `iag-admin-api/actions/payments/update-payment-recipient.ts` |
| Admin roster (the ONE picker read) | `iag-admin-api/actions/admins/directory.ts` (`loadAdminDirectory` + `load_admin_directory`) |
| Webhook envelope → booking call | `iag-admin-api/router/webhooks.ts` |
| Booking (the ONLY `payment_status` writer) | `iag-admin-api/actions/payments/book-client-payment.ts` |
| Confirmation-email helper (latched) | `iag-admin-api/actions/payments/confirmation-email.ts` |
| Resend any of the three emails | `iag-admin-api/actions/payments/resend-payment-email.ts` |
| Invoice + receipt chain (latched) | `iag-admin-api/actions/payments/invoice-receipt.ts` |
| Revenue share: stamp, transfer, email | `iag-admin-api/actions/payments/revenue-share.ts` (owns `rev_paid` and `rev_idempotency_key`) |
| The waterfall arithmetic (pure) | `iag-admin-api/utils/revenue-waterfall.ts` — `computeWaterfall` plus `expectedRevenue`, `implementationFee`, `computeProviderWaterfall` |
| The four models and the two funding sources | `iag-admin-api/utils/strategy-models.ts` |
| Strategy rules: read, and validate per model | `iag-admin-api/actions/strategies/load.ts`, `save.ts` (the ONLY writer of `model` and `rules`) |
| Strategy rules editor, one form per model | `iag-portal/src/components/TaxStrategiesPanel.jsx` |
| Overview grids (Basis / Amount, provider rows) | `iag-admin-api/actions/overview/shared.ts`, `clients.ts`, `all-payments.ts`; `iag-portal/src/components/ClientOverviewPanel.jsx` |
| Provider clearing event (the ONLY `revenue_received*` writer) | `iag-admin-api/actions/payments/mark-revenue-received.ts` |
| Finish an unfinished revenue share | `iag-admin-api/actions/payments/retry-revenue-share.ts` |
| Number allocation (insert = claim) | `iag-admin-api/utils/doc-numbers.ts` |
| The two documents, as HTML | `iag-admin-api/utils/payment-documents-html.ts` |
| HTML → PDF (only reader of the key) | `iag-admin-api/utils/html2pdf.ts` |
| Gmail draft + MIME attachments | `iag-admin-api/utils/gmail-draft.ts` |
| Public quote handler | `iag-admin-api/actions/payments/load-pay-link.ts` |
| Public checkout handler | `iag-admin-api/actions/payments/pay-link-checkout.ts` |
| Recipient role tokens | `iag-admin-api/utils/email-recipients.ts` |
| Stripe key + `stripeFetch` (mode REQUIRED) | `iag-admin-api/utils/stripe.ts` |
| The mode rule (by name, by row) | `iag-admin-api/utils/stripe-mode.ts` |
| Pipeline table (all columns) | `supabase/migrations/20260828123000_client_payments.sql` |
| Issued-number registry | `supabase/migrations/20260902150000_document_numbers.sql` |
| Assignments: column + join table + backfill | `supabase/migrations/20260904120000_payment_notification_assignments.sql` |
| Strategy models: `model`, `rules`, `affiliated_via_ert`, the three seeded rows | `supabase/migrations/20260909120000_strategy_models.sql` (activated by `20260910100000_activate_provider_strategies.sql`) |
| Provider-funded columns (`funded_by`, `strategy_inputs`, `revenue_*`) | `supabase/migrations/20260909130000_provider_funded_records.sql` |
| The per-attempt transfer key | `supabase/migrations/20260909150000_rev_idempotency_key.sql` |
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
- **The four `*_done` flags are acknowledgements, never gates.** They record that a cost was settled
  OUTSIDE the portal — the three hard costs, and on Path A the COI's share handed to ERT
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
- **NEVER un-mark a provider record's revenue, and never widen `update_payment_step` to reach it.**
  `mark_revenue_received` is the clearing event: it stamps the amount the COI's share is computed from
  and transferred against, then pays it. A hand-edit of `revenue_received` — or a "correction" screen
  — leaves a transfer sized by a figure that is no longer on the row, and re-opening the record cannot
  un-send the money. It is the exact shape of the `payment_status` trap above, for the same reason.
  The step is sent with `manual: false` precisely so the generic tick handler cannot claim it; a tick
  with no amount would clear a record and pay nobody.
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
  payment's mode from then on — `pay_link_checkout`, the webhook booking and the revenue share all
  read it back off the row rather than recomputing from the names. Renaming the client or the COI
  afterwards changes FUTURE payments only (GOTCHA #20); a live payment cannot be flipped onto a test
  key by an edit to a profile.
- **The `livemode` guard is per row, and it lives in `bookClientPayment`.** After the row is read and
  before any write: `event.livemode === !!row.sandbox` IS the mismatch (livemode true must pair with
  sandbox false). A mismatch logs both values and answers Stripe 200 with
  `skipped: "mode_mismatch"`, writing nothing — a 4xx would make Stripe retry an event this portal
  will never accept, forever. The `stripe_events` upsert still happens BEFORE the booking call:
  record first, act second.
- **"Start New Payment" is not a resend.** A second press raises a SECOND payment request with its
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
- **ACH only.** Any `method` field in the request body is ignored, the page offers no card option,
  and there is deliberately no `payment_intent_data[setup_future_usage]` — a client fee is a single
  payment, so storing the client's bank details past this charge would be keeping data nothing will
  ever use.
