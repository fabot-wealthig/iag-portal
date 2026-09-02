# FLOW — Client payment request

How a client is asked for a strategy fee and pays it by ACH. Spans the client **Payments** tab
(frontend), one authed action that raises the request and drafts the email, the public `/pay` page,
and two PUBLIC actions behind the emailed link — one that quotes the amount and one that charges it.

**Nothing is sent and nothing is booked.** The payment email is a Gmail DRAFT — there is still no
send path. And this phase stops at Stripe: the `client_payments` row is created, the customer and
the checkout session exist, but every column from `payment_status` onward is still empty. Phase D
books them from the webhook.

## The path

1. **An admin opens a client and presses "Start New Payment."** The Payments tab (`ClientPayments`
   in `CoiClients.jsx`) loads that client's history plus the strategy rules, and the button opens
   `ClientPaymentForm` inline. The strategy select gates everything below it — no amounts are asked
   for until a strategy is chosen, because the strategy decides every number under it. The admin
   enters the **offset amount**, the **total client fee** and optional notes, and watches a
   read-only **Revenue share preview** recompute on every keystroke.
2. **The preview is DISPLAY ONLY.** Nothing it computes is sent — only `strategy_key`,
   `offset_amount`, `total_fee` and `notes` go to the server. It mirrors the strategy rules rather
   than replacing them, in the order Jake's "Understanding Revenue Share for the LEOS Strategy"
   sets out: the two **hard costs** come off the client fee first — admin fee = offset ×
   `admin_fee_pct`, plus `legal_fee_flat` as a flat line — and **ERT's percentage is then taken off
   what remains, not off the whole fee** (`processing_pct_affiliated` when the COI's
   `mothership_number` is 1, else `processing_pct_unaffiliated`). Available Revenue Pool =
   after-hard-costs − ERT; COI share = pool × the level's entry in `level_percentages`; net profit
   pool = pool − share. A **negative pool blocks submit** with "The client fee must cover the hard
   costs and the processing fee."
3. **`start_client_payment`** (authed; any admin session) refuses a client with no `email` and a
   strategy that is missing or `active !== true` — a deactivated strategy is one the portal has
   stopped offering, and its name is what the client is invoiced for. Money is parsed out of form
   text (`"25,000.00"`, `" $25000 "`) and must come back a finite positive number; notes are capped
   at 2000 characters.
4. **The row goes in FIRST**, before any external side effect: `client_id`, `strategy_key`,
   `offset_amount`, `total_fee`, `notes`, `sandbox` (stamped from `getStripeMode()`) and
   `created_by` (the admin's email, from the session). Then a **fresh Stripe customer per payment** —
   metadata `payment_id`, `client_id`, `client_number`, `pipeline=CLIENT_PAYMENT` — and the row is
   updated with `stripe_customer_id` and a freshly generated `checkout_token`. A Stripe failure
   **deletes the row**: a payment with no customer can never be paid and would only sit on the
   screen looking live.
5. **The draft.** Subject and body come from the `email_templates` row `CLIENT_PAYMENT` /
   `client_payment_request` (fallback constants in the handler mirror the seed, so a deactivated row
   still produces a sane email). Four global regex replacements, not a renderer: `[First Name]`,
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
   `$0.00` processing).
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
10. **Stripe hosts the checkout** and returns the client to `/pay?done=1`, which renders the
    "Payment submitted" card. We never see a bank detail.

## What the admin sees afterwards

- The Payments tab lists history **newest first**: date, strategy name, offset, fee, a status pill
  and a **Copy pay link** button. The pill reads `payment_status` (capitalised) once Stripe has
  produced one; before that it is **Awaiting payment** if the email went, or a red **Email not sent**
  if the Gmail draft failed.
- `load_client_payments` returns `pay_url` composed from the token and **never the
  `checkout_token` itself** — the admin screen needs the link, not the secret inside it.

## What the later phases pick up from here

- **Phase D** books the payment from the Stripe webhook, routing on either event by the metadata
  above, and is the first writer of `payment_status`, `payment_intent_id`, `payment_date`,
  `payment_method_type` and `acct_last4`.
- **Phase E** owns confirmation, invoice and receipt (`confirmation_*`, `invoice_*`, `receipt_*`).
- **Phase F** computes the waterfall SERVER-SIDE (`admin_fee_amount`, `legal_fee_amount`,
  `processing_pct` / `processing_fee_amount`, `available_pool`, `coi_level_at_payment`,
  `coi_share_pct`, `coi_share_amount`, `net_profit_pool`) and pays the COI (`rev_*`), with ERT's
  percentage taken AFTER the hard costs as above. The form's preview is not that calculation and
  must not become its source. Note that the seeded LEOS `explainer` and the Tax Strategies panel's
  step-3 card still give the 10%/5% without naming the base — words to fix, not maths.

## Where the pieces live

| Piece | File |
| --- | --- |
| Payments tab + history rows | `iag-portal/src/components/CoiClients.jsx` (`ClientPayments`, `PaymentRow`) |
| Request form + revenue-share preview | `iag-portal/src/components/ClientPaymentForm.jsx` |
| Public pay page | `iag-portal/src/pages/PayPage.jsx` |
| Route + emitted static page | `iag-portal/src/App.jsx`, `iag-portal/scripts/emit-route-pages.mjs` |
| Row + customer + token + draft | `iag-admin-api/actions/payments/start-client-payment.ts` |
| Payment history (composes `pay_url`) | `iag-admin-api/actions/payments/load-client-payments.ts` |
| Public quote handler | `iag-admin-api/actions/payments/load-pay-link.ts` |
| Public checkout handler | `iag-admin-api/actions/payments/pay-link-checkout.ts` |
| Recipient role tokens | `iag-admin-api/utils/email-recipients.ts` |
| Stripe key/mode + `stripeFetch` | `iag-admin-api/utils/stripe.ts` |
| Pipeline table (all columns) | `supabase/migrations/20260828123000_client_payments.sql` |
| Seeded template row | `supabase/migrations/20260902130000_client_payment_request.sql` |

## Traps

- **The two public handlers MUST agree on what a token means.** `load_pay_link` quotes the amount
  and `pay_link_checkout` charges it, from the same row by the same lookup, with identical `invalid`
  and `paid` answers. Letting them drift shows the client one figure and bills another.
- **Any `payment_status` at all kills the link.** Both public handlers refuse a row whose
  `payment_status` is non-null with `state: "paid"`. So a hand-written status — a manual fix, a
  reconciliation script, a Phase D bug — permanently retires that pay link. There is no way to
  re-open one; the admin raises a new payment.
- **Both public handlers must keep answering 200 with a `state`**, exactly like `/set-password` and
  `/payout-setup`. A 404 or 400 on a bad token turns the endpoint into an oracle for guessing them.
  Only a *missing* token is a 400 — that is a malformed request, not a wrong guess.
- **`checkout_token` must never reach the browser.** `load_client_payments` strips it and hands back
  `pay_url` instead. Adding it to a response "for convenience" leaks the credential into every admin
  screen, log and screenshot.
- **The emailed link points at production**, so `/pay` must stay in `ROUTES` in
  `scripts/emit-route-pages.mjs` or GitHub Pages serves a real 404 to a client arriving from an
  email with money in hand.
- **`sandbox` is stamped from the mode the customer was created on**, not from a default, so a row
  can never claim to be real money taken in test mode. It is written once and never revised —
  flipping `STRIPE_MODE` does not migrate an existing payment.
- **There is no resend, and no resend guard.** Unlike the COI setup email there is nothing to guard:
  a second press of "Start New Payment" is a SECOND payment request with its own row, amount and
  token, not a duplicate of the first. A payment whose draft failed currently cannot be re-emailed
  from the UI at all — the admin copies the pay link, or raises a new request.
- **ACH only.** Any `method` field in the request body is ignored, the page offers no card option,
  and there is deliberately no `payment_intent_data[setup_future_usage]` — a client fee is a single
  payment, so storing the client's bank details past this charge would be keeping data nothing will
  ever use.
