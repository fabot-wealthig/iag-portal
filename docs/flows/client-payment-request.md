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

## The path

1. **An admin opens a client and presses "Start New Payment."** The Payments tab (`ClientPayments`
   in `CoiClients.jsx`) loads that client's history plus the strategy rules, and the button opens
   `ClientPaymentForm` inline. The strategy select gates everything below it — no amounts are asked
   for until a strategy is chosen, because the strategy decides every number under it. The admin
   enters the **offset amount**, the **total client fee** and optional notes, ticks or unticks
   **"Legal opinion letter required"** (ticked by default), and watches a read-only **Revenue share
   preview** recompute on every keystroke. The letter checkbox sits with the amounts because it IS
   one: unticking it takes the flat legal fee out of the preview, and the fee the client is invoiced
   is quoted on the strength of the answer. It is decided ONCE, here — a repeat client running the
   exact same strategy as last year may not need a new letter, which is the tax advisor's call — and
   is never revisited afterwards.
2. **The preview is DISPLAY ONLY.** Nothing it computes is sent — only `strategy_key`,
   `offset_amount`, `total_fee`, `legal_fee_waived` and `notes` go to the server. It mirrors the
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
3. **`start_client_payment`** (authed; any admin session) refuses a client with no `email` and a
   strategy that is missing or `active !== true` — a deactivated strategy is one the portal has
   stopped offering, and its name is what the client is invoiced for. Money is parsed out of form
   text (`"25,000.00"`, `" $25000 "`) and must come back a finite positive number; notes are capped
   at 2000 characters.
4. **The row goes in FIRST**, before any external side effect: `client_id`, `strategy_key`,
   `offset_amount`, `total_fee`, `legal_fee_waived` (anything but a literal `true` is false — a body
   that omits the field charges the letter, which is the safe direction: charging one that was not
   needed is a conversation, skipping one that was is a missing legal document), `notes`, `sandbox`
   (stamped from `getStripeMode()`) and `created_by` (the admin's email, from the session).
   Then a **fresh Stripe customer per payment** —
   metadata `payment_id`, `client_id`, `client_number`, `pipeline=CLIENT_PAYMENT` — and the row is
   updated with `stripe_customer_id` and a freshly generated `checkout_token`. A Stripe failure
   **deletes the row**: a payment with no customer can never be paid and would only sit on the
   screen looking live. `tax_planner_email` is NOT set here — nobody has decided yet — but the
   raising admin is inserted straight away as the payment's first notification recipient, non-fatally
   (see **Notifications** below).
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
8. **`pay_link_checkout`** (PUBLIC) mints a Stripe Checkout session: `mode=payment`,
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
    strategy names, and an ordered `steps` list built SERVER-SIDE by `utils/payment-steps.ts`: eleven
    steps in the real order of events — request emailed, client submitted, funds cleared,
    confirmation, invoice and receipt, the three hard costs, the COI's share, revenue-share email,
    and last the internal team share Wealth IG retains (`net_profit`, no checkbox, `net_profit_pool`
    as its amount, done once the COI's share is settled; the five money amounts sum to `total_fee`,
    which the screen shows as a Total line once all are stamped) —
    each with `done`, `at`, `owner`, `manual` and `applicable`, an `amount` on the money steps (null
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
19. **`update_payment_step`** ticks the three `manual` steps — `admin_fee`, `legal_fee`,
    `processing_fee` — and nothing else. The whitelist is load-bearing twice: the value is
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
    **Idempotency-Key** `revshare-client-<payment_id>` — deterministic per payment, never a fresh
    uuid — is what `stripeFetch` grew an option for. A claim without the key double-pays when a
    committed transfer's response is lost, because from this side that call never finished; the key
    without a claim double-pays on two concurrent deliveries.
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
    succeeds. Template `COI_PAYOUT` / `coi_revenue_share` with fallback constants mirroring the seed;
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
    payment cleared, 400 on `"Not Due"` (there is nothing to retry into), 400 on `"Via ERT"` ("This
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
    that is wrong — a missing digit, or an offset and a fee the wrong way round.

## Phase G — the sweep

Every stage above can stall: a Gmail outage swallows a draft, a COI has no payout account yet, a
client simply does not pay. Phase G adds one PUBLIC action, `run_payment_sweep`, fired nightly by
pg_cron at 10:00 UTC, that re-offers the stalled rows to the SAME latched helpers this flow already
uses — the revenue share, the confirmation, the invoice and receipt, and the request email — and adds
one new email of its own: a **payment reminder** two business days after the request went out, latched
on `client_payments.payment_reminder_sent_at`. It changes nothing in this flow; it just finishes it.
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

The list starts populated. `start_client_payment` inserts the raising admin as the payment's first
recipient right after the row lands, and that insert is deliberately NON-FATAL: the payment request
and the Stripe wiring are what that action exists for, and a convenience row anybody can re-add from
this card must never cost a client their payment link. Migration
`20260904120000_payment_notification_assignments.sql` does the same for payments that already
existed, joining `admins` so a `created_by` that no longer matches a live admin is skipped rather
than breaking the foreign key.

Both actions re-read through `loadPaymentDetail` and answer the SAME body as `load_client_payment`
(one shared `paymentDetailBody` helper), which also ships the admin roster — **email and name only**
— with every payment, because any admin may open one while `load_admins` is superadmin-only.

**NOTHING IS SENT FROM ANY OF THIS.** There is no notifications table, no bell backend and no
fan-out. Phase 3 is what will read these two facts together and notify the tax planner ∪ the
recipients; until then the card only records who should hear about the payment when there is
something to hear.

## What the admin sees afterwards

- The Payments tab is an auto-layout table, **newest first**, under a column header: Date |
  Strategy | Offset | Fee | Method | Status. The pay link is not on the list — it is on the
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
  as not applicable.
  Coming back re-reads the list, because a step ticked in the detail changes the row it came from.
- **Accounting → Payments lists the same rows across every client.** The `AccountingPaymentsPanel` renders
  every payment in the portal, newest first, through the SAME `PaymentsGrid` the client's Payments tab uses
  (with a leading Client / COI column switched on) and opens the SAME `PaymentDetail` behind every row.
- `load_client_payments` and `load_client_payment` both return `pay_url` composed from the token and
  **never the `checkout_token` itself** — the admin screen needs the link, not the secret inside it.

## Where the pieces live

| Piece | File |
| --- | --- |
| Payments tab + grid rows | `iag-portal/src/components/CoiClients.jsx` (`ClientPayments`), `PaymentsGrid.jsx` (`PaymentRow`) |
| Payment detail + status pill | `iag-portal/src/components/PaymentDetail.jsx` (also exports `StatusPill`, `methodText`) |
| Shared `Field` / `BackLink` / `TrackHero` | `iag-portal/src/components/shared/TrackKit.jsx` |
| Request form + revenue-share preview | `iag-portal/src/components/ClientPaymentForm.jsx` |
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
| Webhook envelope → booking call | `iag-admin-api/router/webhooks.ts` |
| Booking (the ONLY `payment_status` writer) | `iag-admin-api/actions/payments/book-client-payment.ts` |
| Confirmation-email helper (latched) | `iag-admin-api/actions/payments/confirmation-email.ts` |
| Resend any of the three emails | `iag-admin-api/actions/payments/resend-payment-email.ts` |
| Invoice + receipt chain (latched) | `iag-admin-api/actions/payments/invoice-receipt.ts` |
| Revenue share: stamp, transfer, email | `iag-admin-api/actions/payments/revenue-share.ts` (owns `rev_paid`) |
| The waterfall arithmetic (pure) | `iag-admin-api/utils/revenue-waterfall.ts` |
| Finish an unfinished revenue share | `iag-admin-api/actions/payments/retry-revenue-share.ts` |
| Number allocation (insert = claim) | `iag-admin-api/utils/doc-numbers.ts` |
| The two documents, as HTML | `iag-admin-api/utils/payment-documents-html.ts` |
| HTML → PDF (only reader of the key) | `iag-admin-api/utils/html2pdf.ts` |
| Gmail draft + MIME attachments | `iag-admin-api/utils/gmail-draft.ts` |
| Public quote handler | `iag-admin-api/actions/payments/load-pay-link.ts` |
| Public checkout handler | `iag-admin-api/actions/payments/pay-link-checkout.ts` |
| Recipient role tokens | `iag-admin-api/utils/email-recipients.ts` |
| Stripe key/mode + `stripeFetch` | `iag-admin-api/utils/stripe.ts` |
| Pipeline table (all columns) | `supabase/migrations/20260828123000_client_payments.sql` |
| Issued-number registry | `supabase/migrations/20260902150000_document_numbers.sql` |
| Assignments: column + join table + backfill | `supabase/migrations/20260904120000_payment_notification_assignments.sql` |
| Seeded template rows | `supabase/migrations/20260902130000_client_payment_request.sql`, `20260902140000_client_payment_confirmation.sql`, `20260902151000_client_payment_invoice_receipt.sql`, `20260903120000_coi_revenue_share_email.sql`, `20260903130000_coi_revenue_share_email_layout.sql` |

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
  there, because from this side that call never finished. The key must stay DETERMINISTIC
  (`revshare-client-<payment_id>`): a fresh uuid per attempt guarantees nothing at all.
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
- **`sandbox` is stamped from the mode the customer was created on**, not from a default, so a row
  can never claim to be real money taken in test mode. It is written once and never revised —
  flipping `STRIPE_MODE` does not migrate an existing payment.
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
