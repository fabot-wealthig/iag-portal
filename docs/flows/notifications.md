# FLOW — In-portal bell notifications

How an event on a payment becomes a number on the header bell. Ported from the VFO portal and cut
down to what IAG has: **29 rules, one audience rule, one bell, one editor** — plus, for superadmins,
computed **system alerts** about the portal itself (v: 2026-09-29).

**Nothing here sends email.** These are in-portal notifications only. The Gmail drafts are a separate
system with its own latches (`client-payment-request.md`), and several of these bells are raised
*about* those drafts, never instead of them.

**Nothing here may ever fail a payment.** Every fan-out call goes through one helper that catches
everything, logs it with `console.warn` and returns. A notification is an annotation on money that has
already moved.

## The two tables

`20260904160000_notifications.sql`, both with deny-all RLS in the same migration.

**`notifications`** is the LOG: `id`, `admin_email` (FK `admins.email`, CASCADE), `rule_key`,
`payment_id` / `client_id` (both SET NULL), `member_number`, `title`, `message`, `read`, `created_at`.
One row **per admin per event**, which is what makes `read` a per-person fact — two admins watching the
same payment each clear their own copy. Index `(admin_email, read)`: that pair is the bell's only
query, run twice a minute per signed-in tab.

**The row carries its own destination.** `member_number`, `client_id` and `payment_id` are stamped at
insert time, never looked up on click. The portal is a single route whose navigation is three
sessionStorage keys, so the click writes those keys and needs no fetch of its own.

`rule_key` is loose text, deliberately NOT an FK to `notification_rules`: the log records what was
announced, which is a fact about the past, and the dedupe check on `(payment_id, rule_key)` must keep
working for a rule row somebody has since renamed.

**`notification_rules`** is the SETTINGS: `key` (PK), `area`, `label`, `description`, `enabled`,
`recipients` (jsonb, **nullable**), `default_recipients` (jsonb, `["PAYMENT_RECIPIENTS"]` on 25 rules and
`["SUPERADMINS"]` on 4 — 3 since migration 74, `20261007140000_recipients_team_members.sql`, which stripped
`TAX_PLANNER` from every rule's default and override, and `curator_review_due` from migration 75),
`sort`, `updated_at` — the last three columns added by `20260904161000_notification_rules_audiences.sql`,
which also **dropped `extra_recipients`**. **29 rows** (v: 2026-10-07; TWO, `team_share_failed` and `team_share_held`, by `20261006160000_team_share_payouts.sql`, area Revenue share, sort 61–62, default `SUPERADMINS`; ONE, `curator_review_due`, by `20261007160000_curator_review_reminder.sql`, sort 63, default `SUPERADMINS`) — twelve seeded by the first migration, six deleted
by `20260904162000_notification_rules_trim.sql` (see *The events* below), one added back by
`20260909140000_revenue_received_rule.sql` when provider-funded records gained a clearing event of
their own, two added by `20260922160000_payees_and_hard_costs.sql` for the hard-cost transfers, one,
`coi_check_due`, by `20260924160000_coi_check_payouts.sql`, and FOURTEEN by
`20260929100000_payment_failure_paths.sql` (chat 17, *The fourteen of chat 17* below), and TWO,
`payment_refunded` and `refund_failed`, by `20260929140000_refunds.sql` (chat 17 Phase 2, *The refund
pair* below)
— and never created
at runtime — a rule the code does not fire would be a switch that does nothing. `jsonb` rather than
`text[]` to match `email_templates.to_list` and friends, so every editable list in the system has one
shape. This is the VFO portal's shape, column for column, so the two editors behave the same.

`area` groups the rules into the four stages of a payment — **Payment request**, **Payment**,
**Paperwork**, **Revenue share** — and `sort` restarts inside each area in pipeline order. The grouping
survived the trim because it is what makes the shape of the pipeline legible: four headings say
where in a payment's life each switch bites, which a flat list never does.

`sort` is **gappy** after the trim (Payment request 20; Paperwork 30; Revenue share 30, 40) and that is
deliberately left alone. The gaps then earned their keep: `revenue_received` slotted into the Payment
area at **15**, between `client_paid` (10) and `funds_cleared` (20), in pipeline order and without
renumbering a single existing row; `hard_cost_held` (50) and `hard_cost_failed` (60) followed it into
the same area in chat 15. Chat 17's fourteen used the gaps the same way — `bank_verification_pending`
(12) and `bank_verification_stalled` (13) between `client_paid` and `revenue_received`,
`payment_failed` (25) after `funds_cleared`, the dispute, refund and mode rules at 70–80 (the refund
pair at 76 and 77, between `stripe_refund_detected` and `stripe_mode_mismatch`); Payment
request 30/40, Paperwork 20/40/45, Revenue share 50/60. The numbers are an ordering, not a position, every area still reads in pipeline
order, and renumbering would have been churn inside a migration whose whole job was deletion. An area
the trim had emptied would simply stop rendering — the editor filters its area list against the rules it
actually received — but as it happens all four still hold at least one rule.

## Who hears it

The audience is named by **general title**, not by person. `recipients` holds those titles, and the
fan-out resolves them against today's roster and today's payment:

| Token | Resolves to |
| --- | --- |
| `PAYMENT_RECIPIENTS` | the payment's Advisor (`advisor_id`) + Implementation Specialist (`is_id`) + every team member in `payment_notification_recipients` — each ONLY if they have a portal login (`team_members.admin_email`); `paymentRecipientEmails` in `utils/payment-recipients.ts` (v: 2026-10-07, backend v79) |
| `ALL_ADMINS` | the whole roster |
| `SUPERADMINS` | `admins.is_superadmin`, plus the floor superadmin (`constants/superadmin.ts`) |

**There is no `TAX_PLANNER` token any more** (Jake, 2026-10-06, migration 74): no Tax Planner anywhere,
and `client_payments.tax_planner_email` was dropped by migration 76. A team
member with no login can be picked on a payment (shown "No login") but is never notified.

A literal admin address may sit in the list too, as the escape hatch for the one-off case. The three
tokens live in **one** backend constant, `constants/notification-tokens.ts`, which both `utils/notify.ts`
and `actions/notification-rules/save.ts` import — a token can never be storable but unresolvable.

**A role survives somebody joining or leaving; a list of individuals does not.** That is why the editor
offers titles: a new admin is inside `ALL_ADMINS` the moment their row exists, without anybody walking
29 rules to add them.

**The default is `["PAYMENT_RECIPIENTS"]`** (`DEFAULT_AUDIENCE`) — the people the payment already names,
which is the routing 25 of the 29 rules ship with. The four exceptions default to **`["SUPERADMINS"]`**:
`stripe_mode_mismatch` (about the Stripe setup, not the payment), `team_share_failed` /
`team_share_held` (what staff earn is superadmin-only) and `curator_review_due` (about COIs, not a payment).
`recipients` is **NULL** until an admin overrides it, and null means "use `default_recipients`".

**An override REPLACES the default, it does not add to it.** That is the only semantics under which
"only the superadmins hear about a failed transfer" is expressible; an additive list can never take
anybody away. **Reset to default writes NULL back**, so "unedited" stays a state the row can return to
rather than a list somebody has to retype. An empty array saves as NULL for the same reason.

**An override that resolves to NOBODY falls back to the default** — a rule pointed at a literal address
no longer on the roster fires on the default audience instead of firing at nothing. An editing mistake
must not silently lose news about money. **And a default that resolves to nobody falls back to the
SUPERADMINS** (v: 2026-09-29): the request and receipt forms pre-select NOBODY, so an unassigned
payment resolved the default to nobody too, and every bell about it went nowhere (since v79 the
Advisor and IS usually answer it — when they have a login). The chain is
therefore **override → default → `SUPERADMINS`**, each tried only when the one before resolved to no
one (logged with `console.warn`). Chat 17's first test proved it: the manual-bank-entry bells reached
the superadmins on a payment nobody was assigned to. Only an explicitly **disabled** rule is silence.

Literal addresses are resolved against the roster **in code** — lowercased, trimmed comparison, never
`.ilike()` (GOTCHA #8) — and an address that is not an admin is dropped with a warning rather than
inserted, because `admin_email` is an FK and one bad address would fail the whole insert. What is
stored is the roster's own spelling.

Deduped by lowercased address, so one person named three ways gets one row.

## `utils/notify.ts`

One export: `notifyPaymentEvent(supabase, { paymentId, ruleKey, title, message, dedupe? })`.

`title` is the **event phrase alone** — "Funds cleared", "Revenue share held". The helper appends the
client and the amount from the payment it was handed, so the stored title reads
`Funds cleared - Test Client ($15,000.00 LEOS)`. That composition lives in the helper on purpose:
Jake's rule is that every notification about a client names the client, and putting it here makes it
structural rather than something every call site has to remember.

In order it reads the rule (a **disabled** rule returns at once; a **missing** rule fires on the
default audience — a deleted row must not silence news about money), the payment, the client and the
strategy name, then resolves the audience through `resolveRecipients(list)` over
`rule.recipients ?? rule.default_recipients`. Then it dedupes, then it inserts one row per recipient.

`resolveRecipients` is **lazy and memoised**: a rule addressed to nothing but `SUPERADMINS` never reads
the payment's people (`paymentRecipientEmails` runs at most once, on the first `PAYMENT_RECIPIENTS`),
and a list naming two addresses reads the roster once. An override that comes back empty is re-resolved against the defaults (see *Who hears it*).

**Dedupe is `unread` on `(payment_id, rule_key)`.** Several of these events sit behind helpers that
are safe to re-run — the resend button, the nightly sweep, a redelivered Stripe webhook — so an admin
who still holds an unread row for this pairing is skipped. Once they clear it, the same event can
raise a fresh one, which is what keeps a genuine second occurrence visible. **The key is the RULE,
not the cost:** a LEOS payment whose legal fee AND admin fee are both held raises ONE
`hard_cost_held` per admin — the second cost's bell is skipped until the first is read, and the
detail screen's two pills are what show both (v: 2026-09-22).

**Two more dedupe modes** (`dedupe`, v: 2026-09-29), chosen per call, never per rule:

| `dedupe` | Skips an admin who… | Used for |
| --- | --- | --- |
| `"unread"` (default) | holds an UNREAD row for `(payment_id, rule_key)` | everything not listed below |
| `"ever"` | was EVER told for `(payment_id, rule_key)`, read or not | a condition a sweep leg re-meets every run and only a person ends: `coi_email_missing` (revenue-share.ts, leg A), `payee_email_missing` (hard-costs.ts, leg H), `payment_overdue` and `bank_verification_stalled` (sweep leg J) — a cleared bell must not come straight back three times a morning |
| `"none"` | nobody — everyone is told again | `client_paid` on a re-booking of a FAILED row (book-client-payment.ts): a retry after a failure is news even while the first bell is unread |

**"ever" is per payment, forever**: a payment told `payment_overdue` once is not told again for a
later episode on the same row (a known limit, accepted). **And the key is the dedupe's whole
scope** — which is why two different events must never share a rule key (*Traps*).

## The events, and where each fires

Every call sits **after** the latch write that made the outcome true, so a bell never says something
the row does not already record.

**Why six and not twelve.** The first cut announced every step, and Jake cut it back on sight: *"we
don't need THAT many notifications — see how VFO portal does it, only the important stuff; the rest
they can see in the email they are CC'd in. Just: they have paid, the money has arrived, and if
anything went wrong."* That is the VFO portal's practice, and the reason it works is that **a bell is
an interruption**, which spends attention whether or not it earns it — twelve per payment is a bell
nobody reads, which is the same as no bell at all. The six that went were all announcements of routine
*success*: a request drafted, a confirmation drafted, an invoice drafted, a share paid, a share settled
by ERT, a reminder drafted. Every one of them already put an email in front of the same admins, who are
**CC'd on it** — the bell was repeating what their inbox had already told them. What survives is only
what somebody must **act on**, plus the two facts they want without asking: they have paid, the money
has arrived.

**The tenth is work, not news** (v: 2026-09-24). `coi_check_due` fires from `runRevenueShare` step (e4)
when a COI paid by paper check reaches the pay date — the share turns "Check Due" and an admin must mail
and record the check (`flows/payout-schedule.md`). Default audience: the payment's people
(`PAYMENT_RECIPIENTS`). Jake's call: only the people selected are told; point it at All admins in the
editor if a check must never go unseen.

**The seventh is not a thirteenth.** `revenue_received` was added in chat 10, and it passes the same
test the surviving six pass: it is THE MONEY ARRIVING, on a pipeline where no Stripe event can
announce it. On every provider-funded strategy (Boxhouse, 831(b), DCD, Cost Segregation, Film Deduction, R&D Credits, Oil & Gas, Closehaul) the client never pays through this
portal, so a colleague
recording the provider's lump sum is the clearing event — every client row that receipt creates is
born received, and each one stamps the waterfall and runs the COI's share exactly as a cleared client
payment does (`flows/provider-receipts.md`). It is deliberately NOT folded into
`funds_cleared`: one is Stripe telling us a client's money settled, the other is a person telling us
a provider paid up, and an admin has to be able to switch off one without silencing the other.

**The eighth and ninth are the fee twins of the share's two.** `hard_cost_held` and
`hard_cost_failed` (chat 15, `flows/hard-cost-payees.md`) pass the same test `rev_share_held` and
`rev_share_failed` do: money is owed to the legal firm or GFX and somebody must act — chase their
Stripe setup, or fix the cause and press Retry. A transferred fee raises nothing, like a paid share.

**Since v84 (2026-10-07) a fixed problem clears its own bell, and a hold bells once.** `clearPaymentBells`
(`utils/notify.ts`, VFO's `clearJakeFailure`) marks a payment's UNREAD bells read when their cause is
gone: `rev_share_held` / `rev_share_failed` when the COI's share transfers; `hard_cost_held` /
`hard_cost_failed` once NEITHER fee is still Failed or held; `team_share_held` / `team_share_failed` once no
Stripe team share on the payment is (a "Team share reversed" bell is spared); `payment_failed`,
`payment_overdue`, `bank_verification_pending` / `_stalled`, `checkout_failed` and `payment_request_failed`
when the client's money clears (`notifyFundsCleared`); `coi_check_due` / `payout_followup` on Record check.
`rev_share_held` and `hard_cost_held` now fire only on the way INTO held (they used to re-raise up to three
times a day once read, `team_share_held` already behaved this way); a hold nobody resolves is caught by the
`stuck_awaiting_account` system alert after ten business days.

**The fourteen of chat 17 pass the same test** (v: 2026-09-29, migration 58). Jake's rule for the
pass was that nothing may fail silently, and every one is work or something gone wrong — a payment
that failed, came back, stalled or was never told — never a routine success.

**The refund pair passes it too** (v: 2026-09-29, migration 62, `flows/client-payment-request.md`
*Refunds*). `payment_refunded` is money going BACK: it changes what everyone on the payment is owed —
no share, no fee — and the payment's people earn on it, so it is told even though an admin pressed it.
`refund_failed` is something gone wrong with the payouts put ON HOLD. Both default to the payment's
people, Area Payment. `refund_failed` passes **`dedupe: "none"`**: a second failure (a retry that
fails again, or Stripe failing a refund the portal thought succeeded) is a new fact, never swallowed
behind the first unread bell.

`20260904162000_notification_rules_trim.sql` deletes those six rules **and the `notifications` log rows
that carried their keys**. `rule_key` is loose text on purpose, so an orphaned row would sit on
somebody's bell forever with no switch anywhere that could turn it off — the one case where deleting
history is kinder than keeping it.

**Where each fires is cited by FILE and function, not line number** (v: 2026-09-29): chat 17 moved
every line in the booking and the sweep, and a line number drifts on every edit — `grep -n` the rule
key.

| Rule key | Fires at | Note |
| --- | --- | --- |
| `payment_request_failed` | `request-email.ts` (`notifyFailed`, four calls) | No email on file, no recipient resolved, Gmail unreachable, Gmail refused, with the reason in the message. The two "not found" returns above them are silent — there is no payment to announce anything about. |
| `checkout_failed` | `pay-link-checkout.ts` (`bellCheckoutFailed`, two calls) | NEW. The client pressed Pay and Stripe's page could not be created — Stripe unconfigured for the mode (500) or Stripe refused the session (502). They cannot pay and have no way to tell anyone. Area Payment request, sort 30. |
| `payment_overdue` | `sweep.ts` leg J, two queries, `dedupe: "ever"` | NEW. "Payment still unpaid" two business days after the SECOND reminder (no more emails go automatically), or "Failed payment not retried" five business days after the failed-payment email. Area Payment request, sort 40. |
| `client_paid` | `book-client-payment.ts` — `bookFromCheckout`, and the out-of-order branch of `bookFromPaymentIntent` | Only the delivery that WON the conditional claim raises it, so a redelivered event announces nothing. The message says which method: "Paid by bank transfer — the funds take 2-4 business days to clear." on an ACH, "Paid by card — the money has already settled." on a card, and on a manual bank entry the title reads "Client submitted bank details (verification pending)". A re-booking of a FAILED row passes `dedupe: "none"`. **A card raises this AND `funds_cleared` at checkout, back to back** — for a card that one moment IS the money arriving — and NO confirmation email follows it: the row is booked `succeeded` with `confirmation_status` "Not Needed", and the invoice and receipt that chain on the spot are the confirmation (`client-payment-request.md`, *The Implementation Fee*). |
| `bank_verification_pending` | `book-client-payment.ts` `bookFromCheckout`, right after `client_paid` | NEW. The PaymentIntent was `requires_action` at checkout: the client typed account and routing numbers, Stripe is verifying by micro-deposit and NO money has moved; the Gmail draft is the verify-bank one. Area Payment, sort 12. |
| `bank_verification_stalled` | `sweep.ts` leg J, `dedupe: "ever"` | NEW. Still unverified five business days after the manual entry (VFO's SpecRev backstop); Stripe cancels at about ten days. Area Payment, sort 13. |
| `funds_cleared` | `book-client-payment.ts` → `notifyFundsCleared`, three routes | Three routes to the same news: a card that settled inside checkout (raised immediately after `client_paid`, no confirmation email between them), the out-of-order intent, the normal ACH clearing. One helper, one wording. |
| `payment_failed` | `book-client-payment.ts` `failPayment` — from `payment_intent.payment_failed`, `payment_intent.canceled`, `checkout.session.async_payment_failed`, or `reconcilePayment` | NEW. Only the delivery that won the `processing` → `failed` claim. The message carries the reason and says the pay link is open again and a failed-payment draft follows. Area Payment, sort 25. |
| `payment_disputed` | `stripe-exceptions.ts` (`charge.dispute.created`) | NEW. The amount, Stripe's reason and the dispute id, plus what the automatic payout hold did — held, already held, nothing left to hold, not cleared, or could not hold (`flows/payout-schedule.md`). Area Payment, sort 70. |
| `dispute_closed` | `stripe-exceptions.ts` (`charge.dispute.closed`) | NEW. "Dispute won" (release the hold) or "Dispute closed" with Stripe's status; the hold is left for a person either way. Its OWN key, never `payment_disputed`'s — see *Traps*. Area Payment, sort 72. |
| `stripe_refund_detected` | `stripe-exceptions.ts` (`charge.refunded`) | NEW. Money refunded from the Stripe DASHBOARD, outside the portal, in full or in part; payouts still owed are held, and since v62 `stripe_refunded_amount` is recorded on the payment. NOT raised for the portal's own refund (`refund_status` set and not `failed`): its `charge.refunded` is skipped. Area Payment, sort 75. |
| `payment_refunded` | `refund.ts` (`refundPayment`), after the outcome write | Phase 2. Three titles by path — "Refund recorded" (a provider row), "Payment cancelled and refunded" (an in-flight ACH cancelled: no money moved), "Payment refunded" (a Stripe refund on its way) — each with the amount, who, the reason and "No share or fee will be paid on this payment." Default dedupe. Area Payment, sort 76. |
| `refund_failed` | `refund.ts` (`fail`: Stripe refused, or answered `failed` / `canceled`) and `stripe-exceptions.ts` (`refund.failed`, or `refund.updated` with status `failed` / `canceled`) | Phase 2. Nothing reached the client, the payouts are ON HOLD, press Refund again once the cause is fixed; the webhook's wording adds that the client was already emailed a refund was issued. `dedupe: "none"`. Area Payment, sort 77. |
| `team_share_failed` | `team-transfers.ts` (`bellFailed`: member not found, a live payment for a sandbox member, the account unreadable, Stripe refused, an idempotency conflict, or a transfer that went through but could not be recorded); and `stripe-exceptions.ts` for a `TEAM_SHARE` `transfer.reversed` (v82, "Team share reversed in Stripe", `dedupe: "none"` so an unread failure bell cannot swallow it — before v82 a reversed team transfer was silently skipped) | Phase C (v: 2026-10-06). A team member paid by Stripe was not sent their share; the morning run (leg P) tries again. **No amount in the message** — a rule can be pointed at any admin, and what staff earn is superadmin-only (Jake). Default audience `SUPERADMINS`. Area Revenue share, sort 61. |
| `team_share_held` | `team-transfers.ts`, when the share moves INTO `held` (not on every re-run) | Phase C. The share is due but the member has not finished Stripe onboarding; paid on the first run after they do. No amount. Default `SUPERADMINS`. Area Revenue share, sort 62. |
| `curator_review_due` | `utils/curator-reminder.ts` (`bellCurators`, from `runCuratorReminder`: sweep leg Z once a month, or `draft_curator_reminder`) | Phase D3 (v: 2026-10-07, migration 75). ONE summary bell per reminder (Jake: not one per COI), "Curator review overdue - N COIs", raised after the email to Brittany and Beth is drafted. **The one bell NOT about a payment**: it bypasses `notifyPaymentEvent`, the row carries no `payment_id` / `client_id` / `member_number`, and the rule's list is resolved locally from the tokens that mean something without a payment — `ALL_ADMINS`, `SUPERADMINS`, a literal admin address (`PAYMENT_RECIPIENTS` resolves to nobody) — nobody → the superadmins; a disabled rule is silence. No dedupe: the monthly latch is the guard. Its click opens **COI Overview** (`onOpenCoiOverview`). Default `SUPERADMINS`. Area Revenue share, sort 63. |
| `stripe_mode_mismatch` | `book-client-payment.ts` `mismatchResult` (every booking branch) and `stripe-exceptions.ts` | NEW. A live event for a Sandbox payment or the reverse, not recorded — an endpoint pointed at the wrong place. **Default audience `SUPERADMINS`** (with the two team-share rules and `curator_review_due`, the only ones that do not default to the payment's people). Area Payment, sort 80. |
| `confirmation_failed` | `confirmation-email.ts` (`failed`, five calls) | NEW. No client, no email, no recipient, Gmail unreachable, Gmail refused: the client has paid and has not been told. The state refusals (not found, already sent, Not Needed, a failed payment) are silent. Area Paperwork, sort 20. |
| `invoice_receipt_failed` | `invoice-receipt.ts` (`notifyFailed`) | No email; since chat 17 a number that could not be allocated or could not be stamped (`allocateDocNumber` never guesses); invoice PDF, receipt PDF, no recipient, Gmail unreachable, Gmail refused. The "has not cleared" return is silent — a state refusal, not a failure. |
| `coi_email_missing` | `revenue-share.ts`, `dedupe: "ever"` | NEW. A COI was paid but has no email on file, so the share email was skipped; told once per payment, because leg A re-meets the row every run. Split from the payee's twin in review — see *Traps*. Area Paperwork, sort 40. |
| `payee_email_missing` | `hard-costs.ts`, `dedupe: "ever"` | NEW. The payee's twin: a fee was transferred, and there is no address for its confirmation. Area Paperwork, sort 45. |
| `rev_share_held` | `revenue-share.ts` | Owed, no working payout account. Non-terminal — leg A pays it on the first run after onboarding (or Retry). Since v82 the message says what blocks it (`connectSetupHint`: no email / setup email never sent / unfinished); `hard_cost_held` and `team_share_held` say the same. |
| `rev_share_failed` | `revenue-share.ts` (five calls) | Account unreadable, Stripe unconfigured, transfer refused — and since chat 17 a transfer that WENT THROUGH whose success write failed ("Revenue share needs checking": within 24h a retry replays that transfer, after it a retry would pay twice). |
| `coi_check_due` | `revenue-share.ts` step (e4) | A check-paid COI's pay date arrived (`flows/payout-schedule.md`). Area Revenue share, sort 35. |
| `transfer_reversed` | `stripe-exceptions.ts` (`transfer.reversed`, found by the transfer's `payment_id` metadata, pipeline `COI_PAYOUT` or `HARD_COST`; a `TEAM_SHARE` reversal goes by `team_share_failed` instead, below) | NEW. A share or fee transfer reversed from the Stripe dashboard — how much, of whose payment; the portal still shows it paid. Area Revenue share, sort 50. |
| `payout_followup` | `sweep.ts` leg J, weekly (timed by `payout_followup_at`) | NEW. A COI check still unrecorded a week past its pay date, or a `Via ERT` share still unticked a week after clearing — weekly until done. Area Revenue share, sort 60. |
| `revenue_received` | `receipts/create.ts`, **once per client row** on the receipt | THE CLEARING EVENT for a provider-funded record (Boxhouse, 831(b), DCD, Cost Segregation, Film Deduction, R&D Credits, Oil & Gas, Closehaul): a provider's lump sum was recorded and split, every row was born with its `revenue_received` stamp, and the COI's revenue share runs from it. One receipt covering four clients raises FOUR of these — a bell is about one client's record, not about the transfer. Raised BEFORE that row's in-process share, so a held or failed transfer raises its own bell on top of this one rather than instead of it. The message carries the provider's reference when one was given. |
| `hard_cost_held` | `hard-costs.ts` | A legal or admin fee is owed and the payee's Connect account is not payable yet (`Awaiting Payout Account`). Non-terminal — the step's Retry, or leg H, pays it. Area Payment, sort 50. |
| `hard_cost_failed` | `hard-costs.ts` (`bellFailed`, plus the success-write call) | Payee not found; before the claim, a payee/payment mode mismatch or an unreadable account (`failBeforeClaim`); after it, Stripe unconfigured or the transfer refused (`failAfterClaim`); a Stripe `idempotency_error`, titled "… transfer needs checking" with the claim KEPT; and since chat 17 a transfer that WENT THROUGH whose success write failed ("Legal or admin fee needs checking" — check Stripe before Retry). Area Payment, sort 60. |

**The successful paths are still deliberately silent**, and each carries a comment saying so, so the
next reader does not "fix" the omission: `request-email.ts` (drafted), `confirmation-email.ts`
(drafted — it imports `notifyPaymentEvent` again since chat 17, but ONLY for `confirmation_failed`),
`invoice-receipt.ts` (drafted), `revenue-share.ts` (paid, and settled via ERT), `reminder-email.ts`
(drafted — no import), `payment-failed-email.ts` (drafted — no bell of its own; `payment_failed`
already told the payment's people). The reminders are the one step with **no bell in either
direction**: a reminder that could not be drafted leaves its latch unset, so the next run simply
tries the same row again and nobody has to act on it — until leg J's `payment_overdue` says the
ladder has run out.

## The five actions

They added five `AUTH_HANDLERS` entries when they landed (37 → 42). The table is **72** today — six public plus
sixty-six authed, **73** actions with `admin_login` (v: 2026-10-07; `SESSION_REFERENCE.md` DERIVE row 4
is the live count) — `set_payment_tax_planner` among those deleted since (backend v79).

| Action | Body | Answers |
| --- | --- | --- |
| `load_notifications` | — | `{ success, notifications, unread_count, system_alerts }` — unread, newest first, 20 max. The count comes from the SAME query (PostgREST's exact count is pre-limit), so the badge can say 47 while the list shows twenty. `system_alerts` is `[{ key, title, message }]`, computed for a superadmin (`auth.isSuperadmin`, the floor included) and `[]` for everyone else (*System alerts*, below). |
| `mark_notification_read` | `{ notification_id }` | `{ success }`, or 404. |
| `mark_all_notifications_read` | — | `{ updated }` — ALL of the caller's unread rows, not just the twenty on screen. |
| `load_notification_rules` | — | SUPERADMIN (v80; `save_notification_rule` too). `{ rules, admins }` — rules by `area`, `sort` then `key`, plus the roster via `loadAdminDirectory` (email + name only). |
| `save_notification_rule` | `{ key, enabled?, recipients? }` | `{ rule }`. `recipients` is an array of tokens/addresses, or `null` to reset; `[]` stores NULL. Unknown key 404; an entry that is neither a token nor an email is 400 `Invalid recipient: …`, an address that is not an admin 400 `Unknown admin: …`. |

**The recipient is ALWAYS the session.** All three notification handlers scope on `auth.email` and
never on a payload field — that is the whole authorization rule. `mark_notification_read` puts the
ownership check in the SAME statement as the id (`.eq("id").eq("admin_email")`), so there is no window
between the check and the write, and another admin's id answers 404 exactly as a non-existent one
does. There is no shared `admin` / `all` pseudo-recipient the way VFO has: IAG resolves the audience
at insert time, so every row is addressed to a real person.

Both loaders match `lib/api.js`'s read-retry pattern (`^load_`); neither write does.

## The bell

`src/components/NotificationBell.jsx`, rendered in `Portal.jsx`'s header.

- Loads on mount, then every **30 s** (`POLL_MS`) — VFO's interval, kept.
- Badge shows `unread_count`, capped at `99+`, in WIG orange `#EE6A33`.
- Also listens for the window event `wig:notifications-changed` (exported as `NOTIFICATIONS_CHANGED`),
  so a screen that resolves something a notification was about can refresh the bell at once instead of
  leaving it up to thirty seconds stale.
- Dropdown: title, message, relative time ("just now" → "5m ago" → "3h ago" → "2d ago" → the date),
  a per-row **Done**, and **Mark all read**. Closes on click-outside.
- **First load only** draws skeletons (`Skeleton` from `shared/Skeleton.jsx`, standing rule — never
  "Loading..."). A poll that lands while the list is open replaces it in place; redrawing skeletons
  twice a minute would be flicker, not feedback.
- A row click marks read and **awaits that write before navigating** — the destination re-renders the
  bell, and its poll would otherwise race the write and resurrect the row.
- **System alerts** (superadmins only) are pinned ABOVE the list, orange-ruled, title and message,
  with no Done and no click; the badge shows **"!"** when there are alerts but no unread rows (the
  count wins when there are both), and "No new notifications" shows only when both are empty.

### Timing (v86, 2026-10-07)

The editor's first group, **Timing** (`TimingSettings.jsx`), sets how long each timed step of the morning
sweep waits — the two payment reminders, the overdue / not-retried / verification-stalled bells, the weekly
check/ERT follow-up, the first and repeat Stripe setup reminders, and the three stuck alarms — one whole-number
box each (1–60), "edited · default N" on a changed row, **Save timing** and **Reset all to default**. Superadmin
only. Mechanics and keys: `flows/nightly-sweep.md` *Timing*.

### System alerts (v: 2026-09-29)

What is wrong with the PORTAL rather than with one payment. `actions/notifications/system-alerts.ts`
`loadSystemAlerts` reads the newest `sweep_runs` row on every poll and answers these (since v84 also
`sweep_row_errors` and one `stuck_<kind>` per stuck kind — failed payouts, payouts waiting on an
account, stuck processing, stuck refunds, undrafted payroll reports, Stripe-paid team members with no
email; thresholds and wording in `flows/nightly-sweep.md` *The heartbeat*):
`sweep_stale` ("Daily payment check has stopped" — the newest run is more than 26 hours old, or
there is none), `gmail_unavailable` ("Gmail is not connected" — that run could not reach Gmail) and
`sweep_errors` ("Payment check hit N errors" — its candidate queries failed; the first three
quoted), plus `sweep_unreadable` when the table itself cannot be read. **Computed per poll, NEVER
stored**, because the worst of them — the check has stopped — is exactly the case where nothing is
running to store one; **not dismissible**, because each clears by itself the moment its cause does
(the next good run replaces the row read). Superadmin only: it is the Stripe, cron and Gmail setup,
which only a superadmin can fix. The heartbeat that feeds it is `flows/nightly-sweep.md`.

### The deep link

The portal is one route, so `Portal.jsx` hands the bell a handler rather than a URL:

```js
onOpenPayment={n => openClientProfile(n.member_number, n.client_id, {
  clientTab: 'client_payments', paymentId: n.payment_id || undefined,
})}
```

That is the same drill-in the overview panels perform — COI, then the client's Payments pane, then
that payment. **No `returnTo`**: the bell is reachable from every screen, so there is no origin to go
back to, and the payment's back link behaves like any other in-panel open (`returnToOrigin` needed no
new case). A row missing `member_number` or `client_id` — a payment deleted since — marks read and
does not navigate, EXCEPT a `curator_review_due` row, which `NotificationBell` sends to
`onOpenCoiOverview` (`goToTab('coi_overview')` in `Portal.jsx`, v: 2026-10-07).

## The editor

`src/components/NotificationEditorPanel.jsx`, at Automation & Config → Notification Editor.

A port of VFO's `NotificationEditorPanel`, on WIG tokens (superadmins only since v80: the tab is theirs and
`load_notification_rules` / `save_notification_rule` sit behind `superadminOnly()`). The 29 rules sit in four **collapsible
area sections** — Payment request, Payment, Paperwork, Revenue share, in that order, each with a count
badge and an orange "N edited" when any rule inside carries an override or is switched off.

Each rule is a card. **Collapsed** it is one line: a chevron, the label, an `OFF` flag when disabled,
and on the right the effective audience as labels (`Payment recipients`, `All admins`, `Superadmins`,
or `Name (email)`) followed by an orange **· edited** when `recipients` is non-null.
**Expanded** it adds the plain-English description, a `RECIPIENTS (custom)` / `(system default)`
heading, the audience chips (tokens filled with `--wig-tint`, addresses outlined, each with a ×), an
`Add recipient…` `<select>` with an **Audiences** optgroup for the three tokens (the Payment recipients
hint: "the payment's Advisor, Implementation Specialist and picked team members (with a login)") and an **Admins**
optgroup for the roster, an "or any email…" box with **Add** (same `EMAIL_RE` as the backend), a
`Default: …` footnote, the **Enabled** checkbox, and **Save** / **Reset to default** with an inline
`Saved` / `Reset to default` for 2.5 s and errors in red.

Each card owns **its own Save**: unrelated switches behind one Save would make an admin who
flipped one responsible for the five they never looked at. The card re-seeds itself from the row the
server answers with — including the roster's spelling of each address and the NULL a reset writes —
rather than from what was typed.

## Traps

- **`title` is the phrase, not the headline.** Passing a finished sentence produces
  "Funds cleared - Test Client ($15,000.00 LEOS) - Test Client (…)".
- **Never move a `notifyPaymentEvent` call above its latch.** The dedupe only holds for an UNREAD row;
  a bell raised before the write it describes can be cleared, then raised again by the retry.
- **`recipients` REPLACES the default, it does not add to it.** Saving `["SUPERADMINS"]` means the
  payment's Advisor, IS and picked recipients stop hearing that event. Emptying the list is not "nobody" — it stores NULL and restores the
  default. Unticking Enabled is the off switch.
- **NULL is a value here.** Never write `[]` or a copy of the defaults where a reset is meant: the card
  reads null to decide between "custom" and "system default", and a retyped copy of the defaults would
  freeze today's routing into a rule that should follow tomorrow's.
- **A disabled rule is silence, a missing rule is not.** An unknown key fires on the default audience
  on purpose, and so does an override that resolves to nobody — and a default that resolves to
  nobody reaches the SUPERADMINS. Never remove that last step to "respect" an unassigned payment:
  the forms pre-select nobody, so without it most bells about new payments reach no one.
- **Two different events must never share a rule key** (GOTCHA #34). The unread dedupe is on
  `(payment_id, rule_key)`, so while the first bell is unread the second is SWALLOWED for that
  admin. Chat 17's review caught two: a closed dispute raised under `payment_disputed` would vanish
  behind the unread opening bell (hence `dispute_closed`), and one "email missing" key for the COI
  AND the payee under `dedupe: "ever"` would let the COI's bell silence the payee's forever (hence
  `coi_email_missing` / `payee_email_missing`). The sharings left are deliberate, one fact in two
  forms: `payment_overdue` (never paid, or failed and not retried — "call the client", told once)
  and `hard_cost_held` / `hard_cost_failed` for either fee (the detail screen's pills show both).
- **`dedupe: "ever"` is for conditions a person ends**, re-met by a sweep every run (a missing
  address, an overdue payment). On anything that genuinely recurs it silences the second occurrence
  forever; `"none"` is for a genuine repeat that must be told even while the first is unread
(`refund_failed`, and a re-booking of a failed row's `client_paid`).
- **System alerts are never stored.** Writing one to `notifications` would need something running
  to write it — the failure it reports — and a stored row would outlive the fault it described.
- **The bell polls.** Any column added to `notifications` is read twice a minute per open tab; the
  loader selects columns by name for that reason and must never become `select("*")`.
