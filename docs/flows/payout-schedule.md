# FLOW — The payout schedule

WHEN a cleared payment's money goes out: the COI's revenue share and the legal and administration fees
paid to payees. Until 2026-09-24 every one of them was transferred the moment the payment cleared. IAG
asked for a cadence and for control over it, so they now go out on a **pay date** (v: 2026-09-24).

In plain words: when a payment clears, the portal works out everyone's share straight away and gives
the payment a pay date. On that date, in the morning run, the money goes out. Any admin can pay a
payment early or put it on hold, and every date and every change to it is recorded and shown.

## The rule

**ONE schedule** (Jake, 2026-09-24: no date windows — "set a schedule and use it"), set to **weekly on
Friday** from 2026-09-24 (migration 54). IAG switch it to monthly on the 15th themselves when Q4 ends.

| Schedule | Pays on |
| --- | --- |
| **Weekly** on a weekday (Mon–Fri) | that weekday of the week AFTER the Monday–Sunday week it cleared in |
| **Monthly** on a day (1–28) | that day of the month AFTER the one it cleared in |

- **The pay date is exactly the day the schedule names — no shifting for weekends or bank holidays**
  (Jake, 2026-09-24: "easier and less confusion"). A monthly 15th that is a Sunday pays that Sunday; a
  weekly Friday that is Christmas pays on Christmas. The Stripe transfer happens that day; when it lands
  in the COI's bank is their Connect payout timing, as always.
- **The schedule in force on the day the payment CLEARS decides**; a later edit re-dates only payments
  still waiting (see `save_payout_schedule`).
- **All dates are Eastern calendar days** (`YYYY-MM-DD`), because IAG, its COIs and the 06:00 Eastern run
  all live on that clock. "Cleared" is the day of `payment_date` for a client payment (the booking
  re-stamps it at clearing, so a row the sweep dates late keeps its real day), and the receipt's
  `revenue_received_at` for a provider row (so a receipt recorded late can be due at once).
- The arithmetic is `utils/payout-schedule.ts` (`payDateFor`, `nextPayDateAfter`). It still understands
  dated `window` rows (the table allows them); the screen no longer offers one and saves `windows: []`.

## The data

- **`payout_schedule`** (migration 50, deny-all RLS): ONE `default` row (no dates) plus dated `window`
  rows. `cadence` `monthly` (`pay_day_of_month` 1–28) or `weekly` (`pay_weekday` ISO 1–5). Windows may not
  overlap — refused by `save_payout_schedule`, not by the table.
- **`client_payments`** (migration 50): `payout_cleared_on`, `payout_due_on` (NULL until stamped),
  `payout_hold` + `_reason` / `_by` / `_at` (the CURRENT hold only), `payout_early_by` / `_at`.
- **`payout_events`** (migration 51, deny-all RLS): append-only history. `scheduled` (at clearing,
  `from` = cleared, `to` = pay date), `held` (reason), `released` (`to` = the new date), `paid_now`,
  `redated` (a schedule edit moved it), `schedule_changed` (payment_id NULL, `detail` = before/after and
  how many moved), `check_recorded` (migration 57) and `refunded` (migration 62: the refund's reason,
  the admin as actor). Written best-effort by `utils/payout-events.ts`: the history explains money, it never
  blocks it. The actor is the admin's email, or **"Stripe"** on a hold a dispute, a dashboard refund
  or a failed refund placed (v: 2026-09-29, *The controls*).

## Where the schedule bites

1. **Clearing** — `runRevenueShare` step (c) stamps the waterfall AND `payout_cleared_on` /
   `payout_due_on` in the SAME conditional update, so no row ever has figures without a date. A failed
   schedule read returns not-ok and stamps nothing (the sweep retries). The run that stamps writes the
   `scheduled` event when anything is left to transfer.
2. **Not Due and Via ERT are still settled at clearing** — neither moves money.
3. **The gate** — `payoutGate(row)` answers `on_hold` (hold set, OR a refund active — v: 2026-09-29,
   below) or `scheduled` (date ahead). It is asked
   ONLY of an UNCLAIMED transfer (`rev_paid` / `{cost}_paid` null, `Awaiting Payout Account` or
   `Failed`): `runRevenueShare` step (e3) returns `{ ok: true, deferred, payout_due_on }` with nothing
   written; `runHardCostTransfers` returns state `scheduled` / `on_hold`. A resume of a claim in flight
   (`processing`) and the email of a transfer that already succeeded are past its reach.
4. **Sweep legs A and H** select only rows that are due (`payout_due_on <= today`, or NULL) and not held,
   plus claims in flight and paid rows still owed an email, **least recently offered first, then oldest
   pay date** (`sweep_a_at` / `sweep_h_at`, v: 2026-09-29 — so unfinishable rows cannot crowd out a row
   due today). A NULL date is an unstamped row, which the helper stamps and dates.
5. **Retry buttons** refuse a held or not-yet-due transfer with the control that moves it: Pay now, or
   Release.
6. **The webhook and `create_provider_receipt`** call the same helpers and so get the same gate; the
   receipt's per-row answer carries `deferred` and `payout_due_on`.
7. **Team shares paid by Stripe transfer** (Phase C, v: 2026-10-06; `flows/internal-team-share.md`) go out
   on the SAME pay date under the SAME gate: `runTeamShareTransfers` asks `payoutGate` of the payment
   before claiming a share, sweep leg P offers them, Pay now sends them. They live in
   `payment_team_shares`, so **`pendingTransfers` counts `team_share` only on a row carrying
   `team_stripe_pending`** — every caller that must see them reads it first through `attachTeamPending`
   (`utils/team-shares.ts`): Put on hold, Pay now, a schedule edit's re-dating, the Stripe dispute and
   dashboard-refund hold, Accounting → Payouts, the Payout card, the grids and the clearing run's
   `scheduled` event (written after the shares, so a payment whose only payout is a team share still gets
   its date line). A caller that forgets it silently treats the team share as paid.

## The controls (any admin, Jake 2026-09-24)

- **`pay_payout_now`** — sets `payout_due_on` to today, lifts a hold the screen SHOWED (`override_hold:
  true`; the write is conditional on the hold flag it read, so a hold placed since the load is a 409,
  never wiped), stamps `payout_early_by/_at` only when the date was still AHEAD (an already-due payment is
  "sent now", not "paid early"), logs `paid_now`, then runs the share and the fees WITHOUT force. A double click cannot pay twice: the
  second press finds nothing unclaimed (400) or loses the claim inside the helper. Answers the detail
  body plus `pay_now` (per-transfer outcome).
- **`set_payout_hold`** — `hold: true` needs a reason (≤500) and a dated row with something left to pay;
  `hold: false` keeps a pay date still AHEAD, and moves a passed one to the next pay date strictly
  after today (a release "joins the next scheduled run"; Pay now is for today). Both writes are
  conditional on the flag they expect — a double click is a 409.
- **Holds Stripe places by itself** (v: 2026-09-29, `actions/payments/stripe-exceptions.ts`). A
  `charge.dispute.created` (a card chargeback, or an ACH return filed as a dispute) and a
  `charge.refunded` (money refunded from the Stripe DASHBOARD, outside the portal) put the payment's
  payouts ON HOLD automatically when anything is still unpaid (`pendingTransfers`) — the same columns
  an admin's hold writes, with `payout_hold_by = "Stripe"`, the reason "Stripe dispute opened
  (<reason>)" or "Refunded in the Stripe dashboard (in full | in part)", and a `held` event in
  `payout_events` with actor **"Stripe"**. Conditional on the hold being off, so a second event is a
  no-op; a row already held, with nothing left to pay, or not yet cleared (no pay date) is left
  alone and the bell (`payment_disputed` / `stripe_refund_detected`) says which. **Release is the
  same button** — nothing distinguishes a Stripe hold once placed; a `charge.dispute.closed` bells
  who won and deliberately leaves the hold for a person to lift. None of it writes `payment_status`
  or moves money, and a `transfer.reversed` (a share or fee pulled back in the dashboard) only bells
  (`transfer_reversed`) — the portal still shows it paid. Until chat 17 all four events were
  acknowledged and dropped, so a disputed or refunded payment still paid out on its date.
- **A refund is a hold nobody can release** (v: 2026-09-29, backend v63; the Refund button,
  `flows/client-payment-request.md` *Refunds*). While `refund_status` is `processing`, `pending`,
  `refunded` or `recorded` (`refundActive`, `utils/refund.ts`), `payoutGate` answers `on_hold` and
  `pendingTransfers` answers `[]` — every money path asks one or the other, so nothing is ever paid
  on the payment again, and it sits on no Payouts list. `payout_hold` itself is NOT written: there is
  no flag for Release to lift. So **Pay now** and **Put on hold** refuse a refunded row (400 "Nothing
  on this payment is left to pay out."), **Record check** refuses it (409 "This payment has been
  refunded, so no check is owed.", its write also conditioned on `refund_status` null or `failed`),
  and the transfer claims in `revenue-share.ts` and `hard-costs.ts` repeat the same condition for a
  refund that lands between the gate and the claim (GOTCHA #37). The refund itself is refused once
  anything has gone out — the schedule is what makes that window days long.
- **A FAILED refund holds the payouts automatically** (`holdForFailedRefund`, `utils/refund.ts`). A
  `failed` refund is not active — it may be pressed again — but the money is back in IAG's balance
  and still owed to the client, so the failure writes an ordinary hold (`payout_hold_reason` "Refund
  failed: <why>", by the pressing admin, or "Stripe" when `refund.failed` / a failed `refund.updated`
  arrives; conditional on the hold being off; a `held` event) and bells `refund_failed`. Release is
  the person's decision, on the Payout card.
- **`save_payout_schedule`** — the whole schedule, validated. `preview: true` writes nothing and answers
  the next 6 pay dates plus every waiting payment it would move (`from` → `to`). A real save updates the
  default, inserts the new windows, THEN deletes the old ones (never left with no schedule), and
  re-dates payments whose date is still AHEAD, not held, not paid early — each move conditional on the
  date it read. A new date that has already passed goes to the next pay date after today instead
  (`clamped` in the preview), so a schedule edit never makes a waiting payment pay the next morning. Logs `schedule_changed` and one `redated` per move.
- **`load_payout_schedule`** — rows, the next 6 pay dates, and the last 10 schedule changes.
- **`load_payouts`** — every owed transfer as a line (status `scheduled` / `on_hold` / `due`), a LIVE
  Stripe payability check per distinct account (`ready` / `not_ready` / `none` / `unknown`, capped at
  40), `original_pay_date` + `last_change` per line, `recent_changes` (25), and `paid` (last 45 days).

## The screens

- **Payment detail → Payout card** (under Progress): the pay date in words ("Pays Friday, October 2,
  2026 — in 8 days"), or On hold (who, when, why), Due now, or Paid (when, and "Paid early by" if so);
  what will be paid (a moved date is read from the history below, not flagged above it — Jake); **Pay now** and **Put on hold / Release hold**, each behind a confirmation; the full payout
  history. The transfer steps read "Scheduled · Fri Oct 2" / "On hold" instead of a Retry. On a
  refunded payment the card offers no control (nothing is pending); a row never dated reads "This
  payment was refunded, so nothing will be paid out on it.", its header pill **Refunded — nothing
  paid**, and the history carries the `refunded` event. The **Refund** card sits directly beneath.
- **Team shares on the screens** (Phase C): what staff earn is superadmin-only (Jake), so a team line —
  "Team share", the person, "Team · <role>" under the name (a link to their Team profile) — is on Payouts'
  Upcoming and Paid lists for SUPERADMINS only (`load_payouts` filters by rank). The Payout card says only
  "Team share to the team by Stripe transfer —" (no amount) to anyone; the amounts are on the Team shares
  card. When the COI's share is settled (Paid, Not Due, Via ERT) but a payee fee or a team share is still
  owed, the server sends **`payout_rest`** (`restPayoutState`: `scheduled` / `on_hold` / `due`) and the
  Payout pill speaks for THAT money — before it, a payment owing only a fee or a team share read "Not due".
- **Accounting → Payouts**: next payout and current schedule at the top; **Upcoming** (On hold, Due now,
  then one group per pay date with totals; a "Date notes" column says moved / held / released and by
  whom), **Paid** (last 45 days, on its date or paid early), **Changes** (every hold, release, early
  payment and schedule edit). `wigPayoutsView` remembers the view (#21: listed in BOTH key lists).
- **Automation & Config → Payout Schedule**: plain-English explanation, the **Payment schedule** (weekly
  on a weekday, or monthly on a day), **Review changes** → a confirmation listing every payment that will
  move → **Confirm and save**, and a change log with before/after.
- **One vocabulary everywhere** (Jake, 2026-09-24). Every grid that lists payments has a **Payment** pill
  (money in: Awaiting payment / Processing / Paid / Revenue received) and a **Payout** pill (money out:
  Scheduled · Fri, Oct 2 / On hold / Due now / In progress / Paid / Failed / No payout account / Payout
  account not ready / Not due / ERT to pay / Paid by ERT / **Refunded — nothing paid**, v: 2026-09-29,
  checked FIRST once the money has arrived), both from ONE function
  (`shared/PayoutPill.jsx`) — Accounting → Payments, a client's Payments tab, Tax Strategies' grids,
  Accounting → Payouts, the receipt detail ("Payout" column) and the Payout card header. **Sandbox** is a
  small tag under the client's name, never in a status column. The paperwork lines ("Confirmation not
  sent", "Invoice not sent") left the grid; they live on the Progress list and the overviews' Next action.
  Payouts' last column is **Last change** (a hold and its reason, a release, a schedule move, or —).
- **Step owners mean who has to act**: System (the portal, by itself), Admin, Client, Provider, or the COI's
  / payee's name; "IAG" is gone. **Provider records start with a ticked "Revenue received: $X" step**
  (no `amount`, so the Total does not double).

## COIs paid by check (IAG item 8, 2026-09-24)

IAG asked about BILL for COIs who don't want ACH; the answer built instead is a **payout method** per COI
(`members.payout_method` `stripe` | `check`, migration 56 — set on Add COI / Edit Profile; a check COI's
profile shows no Stripe card). Scheduling is unchanged. On the pay date `runRevenueShare` step **(e4)**
writes `rev_paid` **"Check Due"** instead of reading an account or transferring, and bells `coi_check_due`
(the tenth rule). "Check Due" is a latch: the sweep never re-offers it, retry refuses it, and it counts as
still owed (`pendingTransfers`). An admin mails the check any way they like and presses **Record check** on
the Payout card (`record_check_payment`: check number required, date defaults to today; allowed from Check
Due or, early, from any unclaimed state; conditional on the state read). That writes `rev_paid` succeeded
with `rev_check_number` / `rev_check_recorded_by`, logs `check_recorded`, and re-runs the revenue share,
which drafts the COI's usual email — with a `[PAYOUT_NOTE]` line under the share box, "Your payment was mailed as check #1001 on … Please allow 7–10 business days for it to arrive." (migration 57; empty for Stripe COIs). Pills read **Check due** / **Paid**; the Paid list says "By check
#1234". Payee fees still go by Stripe transfer — COIs only.

**A weekly nudge until it is done** (v: 2026-09-29, sweep leg J, `flows/nightly-sweep.md`): a share
still **Check Due** a week or more past its pay date, and a **Via ERT** share whose "COI share paid to
ERT" tick is still off a week or more after the payment cleared, raise the `payout_followup` bell to
the payment's people — "COI check still not recorded" / "ERT share still not ticked" — then again
each week (timed by the sweep's own `payout_followup_at` stamp) until the check is recorded or the
tick is on.

## Emails

The COI revenue share email is drafted when the share is TRANSFERRED, so its opening now reads "today we
sent your revenue share for the following payment" and a **Payment received on `[RECEIVED_DATE]`** row
names the day the money arrived (migration 52, applied WITH the backend deploy — the old code would
print the token raw). The payee fee email already said "today we sent", so it is unchanged.

## Operating notes

- **The sweep runs 10:00, 12:00 and 14:00 UTC** (06:00 / 08:00 / 10:00 Eastern, migration 53): a big pay
  date can exceed a leg's 50-row cap, and the follow-up runs finish it the same morning.
- **Stripe's automatic payouts to IAG's bank** would move held money out of Stripe before the pay date;
  a transfer then draws on an empty balance and fails (`Failed` + bell, retried by the sweep). IAG's
  Stripe payout schedule must be manual, or a buffer kept (#23).
- **"No payout account" is now found on pay day**, not at clearing — Accounting → Payouts flags it ahead.
- **Rolling back the backend alone pays every waiting payment, holds included, on the next run** — the
  old code ignores the columns. Pause the cron job (`cron.alter_job(..., active := false)`) FIRST.
