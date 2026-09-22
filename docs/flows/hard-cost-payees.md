# FLOW — Hard costs paid to payees

How the LEOS legal letter and administration fee, and the Nevada Bank Dynasty Trust attorney fee,
leave the portal as Stripe transfers to the firms they are owed to. Spans **Automation & Config →
Payees** (frontend), four authed payee actions, the request form's **Legal firm** question, one
transfer module that runs after the COI's revenue share, one retry action, sweep leg **H**, and the
fee steps on the payment detail screen (v: 2026-09-22).

**A payee is a firm, not a COI.** It earns no share, sits under no mothership and has no clients. It
is owed a FIXED line of the waterfall — the figure `runRevenueShare` already stamps on
`legal_fee_amount` / `admin_fee_amount` — and all it needs from this portal is a Connect account and
a transfer. Until chat 15 both fees were manual ticks; they still are wherever a row names no payee.

**Only two costs move.** `legal_fee` and `admin_fee`. The ERT `processing_fee` and the Path A
`ert_share` stay manual ticks, the Implementation Fee has no hard costs, and a provider-funded
record has none either (`runHardCostTransfers` refuses anything but a cleared `funded_by = 'client'`
row).

## Payees

`20260922160000_payees_and_hard_costs.sql` (migration 47), deny-all RLS in the same migration.

- **`payees`**: `id` (uuid), `kind` (CHECK `legal_firm | admin_fee`), `name` (unique on
  `lower(name)`), `contact_name`, `email` (NOT NULL, `''` default, like `members.email`), `sandbox`,
  `active`, `notes`, `stripe_account_id`, `connect_setup_email_sent_at`, `connect_reminder_sent_at`,
  `created_by`, `created_at`, `updated_at`. **Seeded: `GFX` (live) and `GFX (Sandbox)`**, both
  `admin_fee`, both with NO email — an admin adds it before the setup email can go.
- **`kind` is fixed at creation**, like a COI's type: every payment that names a payee reads it by
  id, and a firm does not stop being the legal firm and start being the admin-fee recipient.
- **`sandbox` is the payee's own Stripe mode** (`modeForPayee`, `utils/stripe-mode.ts` — only a
  literal `true` is test mode), the same rule as `members.sandbox`, and **locked once a Connect
  account exists**: `save_payee` answers 400 "This payee already has a Stripe payout account in
  <mode> mode; the sandbox setting cannot change." An account lives in one Stripe mode only.
- **The actions.** `load_payees` (every row, explicit columns, by kind then name); `save_payee` (no
  `id` adds, an `id` edits; name required, 120 max, duplicate name 400 compared in code with
  `23505` as the race backstop; never writes `kind` after creation, `stripe_account_id` or the two
  Connect stamps; `sandbox` and `active` absent mean leave alone); `payee_connect_request` and
  `payee_connect_status`, the payee twins of the COI pair (`flows/coi-connect-setup.md`). Any admin
  session may run all four.
- **Onboarding is the COI path, keyed by id.** `payee_connect_request` creates a Stripe **Express**
  account in the payee's mode (product description "Innovation Advisory Group fee payouts",
  `metadata[payee_id]`), mints the durable token with `entity_type = 'payee'` and `entity_key` = the
  payee's uuid (the `connect_setup_tokens` CHECK widened by migration 47), and drafts
  `COI_PAYOUT` / `payee_connect_setup` (migration 48, Jake's wording: fee payments, EIN and a
  representative's details — not the COI's SSN wording), `[First Name]` being the contact name or,
  failing that, the firm's name, To the `RECIPIENT` token only. Same resend guard, same `force`.
  `connect_setup_link` serves the token and `/payout-setup` is the same page. Sweep leg F sends one
  `payee_connect_reminder` two business days later to an ACTIVE payee Stripe still cannot pay.

## The path

1. **The request form asks for the legal firm.** On LEOS with "Legal opinion letter required" ticked,
   and always on NBDT (the attorney fee is never waived), `ClientPaymentForm` shows a **Legal firm**
   select listing ACTIVE `legal_firm` payees in the COI's mode (`isSandboxCoi(member)`). None there
   reads "No legal firm is set up in <mode> mode. Add one under Automation & Config → Payees.", and
   submit blocks on "Choose the legal firm before submitting." The body carries `legal_fee_payee_id`.
2. **`start_client_payment` fixes both payees on the row.** `needsLegalPayee` = NBDT, or LEOS with the
   letter not waived; then the id is REQUIRED (400 "Choose the legal firm before submitting."), must
   be a uuid of a `legal_firm` payee (else "Legal firm not found."), `active` ("That legal firm is
   inactive; choose an active one.") and **in this payment's mode** ("Choose a legal firm set to
   <mode> mode — this COI's payments run in <mode> mode."). The admin fee is RESOLVED, never asked,
   on LEOS only: the one active `admin_fee` payee whose `sandbox` matches the mode. **None → NULL**,
   and the step stays a manual tick; **two → 400** "More than one active admin-fee payee is set to
   <mode> mode; deactivate all but one under Automation & Config → Payees." Both land on
   `legal_fee_payee_id` / `admin_fee_payee_id` (FK `payees`, ON DELETE SET NULL).
3. **Clearing pays the COI, then the payees.** `chainRevenueShare` in `book-client-payment.ts` runs
   `runRevenueShare` and THEN `runHardCostTransfers(supabase, paymentId)` — after, because the fees
   are read off the waterfall the share stamps. It is wrapped in its own `try`; it never fails the
   booking.
4. **Per cost, in order `legal_fee`, `admin_fee`** (`actions/payments/hard-costs.ts`):
   - due only when the row names a payee for it (and, for the letter, `legal_fee_waived` is false);
     an unstamped waterfall (`available_pool` NULL) is `skipped: "waterfall_not_stamped"`;
   - **amount ≤ 0 → `not_due`, nothing written**; `succeeded` → `existing`; `processing` without
     `force` → `claimed` (another run holds it);
   - **not resuming**, three pre-checks, each before any claim: the payee's mode must equal the
     payment's (`Failed` + bell otherwise — re-checked because either row can change after the
     request), the account read must succeed (`Failed` + bell), and it must be payable —
     `capabilities.transfers === "active"` AND `payouts_enabled` (`connectAccountPayable`,
     `utils/connect-status.ts`) — else **`Awaiting Payout Account`** + the `hard_cost_held` bell;
   - **the claim** writes `{cost}_paid = processing` and `{cost}_idempotency_key` in ONE update
     matching the **EXACT** state this run read (`.eq(prev)`, or `.is(null)`) — plus the stored key
     on a resume (GOTCHA #28). Zero rows changed → `claimed`, stop;
   - **the key is per attempt**: `hardcost-<cost>-<payment_id>-<ms>`, fresh from null, Held or
     Failed; the STORED key only on a forced resume from `processing`, which also **skips the three
     pre-checks** so Stripe answers under that key (#22);
   - **the transfer**: `POST /v1/transfers`, cents, `destination` = the payee's account,
     description `<Legal Opinion Letter | Attorney Fee | Administration Fee> - Client: (<client_number>)
     <Name> - <Strategy>`, `source_transaction` = the client's charge (`readLatestCharge`, shared with
     `revenue-share.ts`, read at most once per run; unreadable → platform balance, logged), metadata
     `payment_id`, `payee_id`, `cost`, `pipeline=HARD_COST`;
   - **success** writes `succeeded`, `{cost}_transfer_id`, `{cost}_paid_at` AND `{cost}_done` /
     `_done_at`, conditioned on `processing` + the key, so done-ness reads one column for a tick or a
     transfer; **a refusal** (or an unset Stripe key) → `Failed` + `hard_cost_failed`; **Stripe
     `idempotency_error`** keeps `processing` and the key and bells "<Name> transfer needs
     checking" — it is not proof no transfer exists.
   - It NEVER THROWS, and a held or failed cost is `ok: true`: an outcome on the row, not an error.
   - **The payee's confirmation** (migration 49, v: 2026-09-22): on success, and on a run that finds
     the cost already `succeeded`, `draftFeeEmail` drafts `COI_PAYOUT` / `payee_fee_paid` to the
     payee's own address (`RECIPIENT`), once — latched on `{cost}_email_sent_at`, stamped only after
     Gmail accepts. Tokens `[First Name]` (contact name, else the firm), `[Payee Name]`, `[Client
     Name]`, `[CLIENT_NUMBER]`, `[RECEIPT_NUMBER]`, `[STRATEGY]`, `[FEE_TYPE]`, `[FEE_AMOUNT]`; no client
     fee, no discount. No address → `email: "no_email"`, Gmail down → `gmail_unavailable`; the
     transfer stands either way and nothing about the email is a failure of the fee.
5. **`retry_hard_cost`** `{ payment_id, cost }` (authed) is the step's **Retry**: 400 unless the
   payment cleared, the row names a payee for that cost ("…tick it off by hand instead."), the letter
   was not waived, it is not already `succeeded` WITH its confirmation drafted, and the waterfall is
   stamped (a paid fee with no confirmation drafts only the email); then
   `runHardCostTransfers(…, { force: true, only: cost })` and the payment detail body plus
   `hard_cost`. `ok: false` is a 500.
6. **Sweep leg H**, straight after leg A and before the Gmail probe: cleared client rows with a
   stamped waterfall where either cost has a payee (the letter not waived) and a `{cost}_paid` that is
   NULL or not `succeeded`, or `succeeded` with `{cost}_email_sent_at` NULL; `force` when either is `processing` (`nightly-sweep.md`).

## The steps and the screen

- **`buildPaymentSteps(row, payees?)`** (`utils/payment-steps.ts`): a fee whose row names a payee is
  built by `transferFeeFields` — `manual: false`, `done` from `{cost}_done`, plus `transfer_state`
  (the raw `{cost}_paid`, null until tried) and `payee_name`. The `action` follows the state:
  pending "Transfer to <payee> pending" (IAG), `processing` "Transfer in progress" (IAG), Held
  "<Payee> must finish Stripe payout setup" (owner = the payee), Failed "Retry the transfer to
  <payee>" (Admin), `succeeded` the plain action. The detail loader passes the names; the overview
  summaries do not and read "the legal firm" / "the admin-fee payee". A WAIVED letter keeps its
  greyed manual form whatever the row says.
- **`update_payment_step` refuses** `legal_fee` / `admin_fee` on a row that names a payee for it: 400
  "This fee is paid by Stripe transfer — retry it from the step instead of ticking it." A hand tick
  would claim money that never moved.
- **`PaymentDetail`**: a step carrying `transfer_state` draws a pill (Paid / Transfer in progress /
  Awaiting payout account / Failed / Pending) instead of a checkbox, and **Retry** only on Failed or
  Awaiting payout account — there is deliberately NO button for an undrafted confirmation (Jake:
  out of place; leg H finishes it). Details gains **Legal firm**, **Admin fee payee** (hidden on
  `client_fee_pool` and NBDT) and the two transfer ids once they exist.
- **The bells**, both default audience, area **Payment**, sort 50 and 60 (migration 47):
  `hard_cost_held` and `hard_cost_failed`, raised only from `hard-costs.ts` (`notifications.md`).

## Where the pieces live

| Piece | File |
| --- | --- |
| Payees list, detail (replaces the header), Add form; `wigPayeeSelected` | `iag-portal/src/components/PayeesPanel.jsx` |
| Connect card shared with COIs | `iag-portal/src/components/shared/StripeConnectCard.jsx` |
| Sandbox toggle shared with COIs (locked once an account exists) | `iag-portal/src/components/shared/SandboxToggle.jsx` |
| Legal firm select | `iag-portal/src/components/ClientPaymentForm.jsx` |
| Fee-step pill, Retry, payee Details | `iag-portal/src/components/PaymentDetail.jsx` (`StepRow`, `TRANSFER_PILLS`) |
| Load / save a payee | `iag-admin-api/actions/payees/load.ts`, `save.ts` |
| Payee Connect account + setup email (fallback copy) | `iag-admin-api/actions/payees/connect-request.ts` (also exports `UUID_RE`) |
| Payee live status | `iag-admin-api/actions/payees/connect-status.ts` → `utils/connect-status.ts` |
| Payee reminder (fallback copy) | `iag-admin-api/actions/members/connect-reminder-email.ts` (`draftPayeeConnectReminder`) |
| The payee choice at request time | `iag-admin-api/actions/payments/start-client-payment.ts` |
| The transfers (owns `{cost}_paid` and `{cost}_idempotency_key`) | `iag-admin-api/actions/payments/hard-costs.ts` |
| Run after the share | `iag-admin-api/actions/payments/book-client-payment.ts` (`chainRevenueShare`) |
| Retry one cost | `iag-admin-api/actions/payments/retry-hard-cost.ts` |
| Leg H, leg F's payee half | `iag-admin-api/actions/payments/sweep.ts` |
| The tick refusal | `iag-admin-api/actions/payments/update-payment-step.ts` |
| Transfer-aware steps | `iag-admin-api/utils/payment-steps.ts` (`transferFeeFields`) |
| Table, GFX seed, token CHECK, the ten `client_payments` columns, the two rules | `supabase/migrations/20260922160000_payees_and_hard_costs.sql` |
| The payee email pair | `supabase/migrations/20260922170000_payee_connect_emails.sql` |
| The fee confirmation (`payee_fee_paid`) and the two `{cost}_email_sent_at` latches | `supabase/migrations/20260922180000_payee_fee_email.sql`; drafted by `draftFeeEmail` in `hard-costs.ts` |

## Traps

- **A deactivated payee is still paid.** `active` gates the request form and `start_client_payment`
  only; the transfer reads the payee by the id on the row and never checks it. Deactivating a firm
  stops it being CHOSEN, not being owed.
- **A zero amount comes back every night.** `not_due` writes nothing, so a row naming a payee for a
  $0.00 cost still matches leg H's predicate (`{cost}_paid` NULL) and is re-offered nightly, doing
  nothing each time — one of the 50 leg-H slots, forever. It takes a strategy rule set to zero
  (`admin_fee_pct`, `legal_fee_flat`, `attorney_fee_pct`, all portal-editable); give `not_due` a
  terminal write before letting one be.
- **The admin-fee payee is resolved ONCE, at request time.** Adding GFX's live row after a LEOS
  request was raised does not reach that payment: its `admin_fee_payee_id` stays NULL and the step
  stays a manual tick. Two active admin-fee payees in one mode block every LEOS request in that mode.
- **The payee's mode must match the payment's.** Checked at request time AND before every non-resume
  transfer, because a transfer can only reach an account in its balance's own mode. A mismatch is
  `Failed`, not Held — fixing it means onboarding a payee in the right mode, since the toggle is
  locked once an account exists.
- **Never widen the claim to a list of claimable states** (GOTCHA #28), and never let a resume run
  the pre-checks: writing Held or Failed over a `processing` claim drops the stored key, and the next
  attempt would mint a fresh one and pay twice.
- **`retry_revenue_share` does not run the hard costs.** A share finished by hand leaves the fees to
  the step's Retry (Failed or Held only) or tonight's leg H — a never-attempted fee (`Pending`) has
  no button and waits for the sweep.
- **The ERT processing fee and `ert_share` are still ticks**, and `update_payment_step` still allows
  them. Do not route them through this module: ERT is paid outside the portal.
