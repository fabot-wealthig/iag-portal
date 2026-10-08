# Needs Attention, stuck alarms and timing (v: 2026-10-07)

How the portal makes sure a failure never sits unseen (Jake, 2026-10-07: "look across the whole system so errors
don't go hidden", compared against the VFO portal's safeguards). Built in chat 20, backend v82–v88, migrations
77–81. The per-leg mechanics live in `flows/nightly-sweep.md`; the bells in `flows/notifications.md`; the payout
history in `flows/payout-schedule.md`.

## The layers

1. **The item's own bell** fires once when something goes wrong (held, failed, refused, overdue). Since v84 a bell
   about a problem is marked read by the code that FIXES it (`clearPaymentBells`, `utils/notify.ts`), and the
   "waiting for a payout account" bells (`rev_share_held`, `hard_cost_held`) fire once on the way into held instead
   of up to three times a day.
2. **The stuck audit** (`utils/stuck-items.ts` `findStuckItems`) catches whatever that bell did not get acted on.
   - `"alarm"` mode runs at the end of every morning sweep; the summary (count + three examples + the threshold
     used, per kind) is stored on that run's `sweep_runs.stuck`; since 2026-10-08 the superadmins' system alerts
     re-run this audit LIVE in `"alarm"` mode on every bell poll (so an alert goes the moment its cause is fixed,
     not at the next morning run), reading the stored summary only when the live read fails
     (`stuck_<kind>`, pinned at the top of the bell, not dismissible, gone when the cause is). Since 2026-10-08
     each is CLICKABLE (`SystemAlert.link`): a group of ONE team member (the group's `team_member_id`, written
     by `summarizeStuck`) opens that person's Team profile, any other stuck group opens Needs Attention.
   - `"all"` mode feeds **Accounting → Needs Attention** live (`load_attention_items`, superadmin): every current
     problem, oldest first, with no age threshold on transfers, plus failed payments, unpaid-after-two-reminders
     and checks due.
3. **Silent legs** — a reminder, the refund or failed-payment email, a Connect reminder, the payroll or curator
   job, a reconcile, housekeeping — have no bell per row; their per-row errors go on `sweep_runs.row_errors` and
   raise `sweep_row_errors` (first three quoted).
4. **The heartbeat alerts** that predate this (`sweep_stale`, `gmail_unavailable`, `sweep_errors`) are unchanged.

## The stuck kinds

| Kind | Raised when (alarm mode) | Who / what to do |
| --- | --- | --- |
| `claim_unconfirmed` | a share / fee / Stripe team share "processing" with a key older than 23 h, or none (both modes) | Stripe is asked each run and a transfer it has is recorded; still here = Stripe has none → Retry (Pay now for a team share). `flows/nightly-sweep.md` *An expired transfer claim* |
| `transfer_failed` | still Failed `alarm_transfer_failed` (3) business days after the pay date | the COI / payee / team member; open the payment for Stripe's reason, Retry |
| `awaiting_account` | still `Awaiting Payout Account` / `held` `alarm_no_account` (10) business days after | the person owed; make sure their setup and weekly reminder drafts were SENT from Gmail |
| `processing_stuck` | a client bank payment processing `alarm_processing` (8) business days, no bank verification pending (both modes) | the client; check Stripe |
| `refund_stuck` | a portal refund "processing" for over an hour | press Refund again to resume it |
| `payroll_failed` | a payroll report `draft_failed`, or `building` for a day | Accounting → Team Payroll, draft again |
| `team_no_email` | an active Stripe-paid team member with no email | their Team profile → Edit Profile |
| `payment_failed`, `unpaid_overdue`, `check_due` | Needs Attention only (each has its own bell ladder) | the client / the COI's check |

A payment on hold or refunded is never "stuck" (except an unconfirmed claim). **Who** is whoever is owed the money
or must act; **Payment** is the client it hangs off (Jake, 2026-10-07). A row opens where the fix is: the payment,
Team Payroll, or the team member's profile. Team share lines name the member (the screen is superadmin-only).

## Timing

Every wait above and in the sweep's reminder ladder is a superadmin setting: Automation & Config → Notification
Editor → **Timing** (`load_reminder_timing` / `save_reminder_timing`, table `reminder_timing`, migration 80), eleven
keys, 1–60 days, read once per sweep run with `TIMING_DEFAULTS` as the per-key fallback. Keys and defaults:
`flows/nightly-sweep.md` *Timing*.

## The Payout card

Says a stuck state ONCE (the header pill); the headline is the date with one line on why it waits; after Pay now
the card reads each transfer's STATE, not just its error, so a press that sent nothing never reads "Paid". The
history records every attempt's outcome (`payout_events` `transfer`, migration 81).

## What is deliberately NOT here (Jake, 2026-10-07)

- **Auto-sending emails** — declined here, then BUILT on 2026-10-07 (chat 21): each template's Draft / Send
  switch decides; a reminder counts as "sent" once drafted either way, and a refused send rings `email_send_failed`.
- **Re-checking disputes / refund failures with Stripe** when their webhook never arrives, a **Connect webhook**
  (`account.updated`, `payout.failed`), and **holding an inactive COI's payouts** — offered, not chosen.

## Code

| What | Where |
| --- | --- |
| The audit, both modes | `iag-admin-api/utils/stuck-items.ts` |
| Needs Attention action | `iag-admin-api/actions/attention/load.ts` |
| System alert wording | `iag-admin-api/actions/notifications/system-alerts.ts` |
| Self-clearing bells | `iag-admin-api/utils/notify.ts` (`clearPaymentBells`) |
| Expired claims | `iag-admin-api/utils/expired-claims.ts` |
| Transfer outcomes in the history | `iag-admin-api/utils/transfer-history.ts` |
| Timing | `iag-admin-api/utils/reminder-timing.ts`, `actions/timing/timing.ts`, migration `20261008100000_reminder_timing.sql` |
| Screens | `iag-portal/src/components/NeedsAttentionPanel.jsx`, `TimingSettings.jsx`, `PayoutCard.jsx` |
