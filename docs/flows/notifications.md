# FLOW — In-portal bell notifications

How an event on a payment becomes a number on the header bell. Ported from the VFO portal and cut
down to what IAG has: **twelve payment events, one audience rule, one bell, one editor.**

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

**`notification_rules`** is the SETTINGS: `key` (PK), `label`, `description`, `enabled`,
`extra_recipients` (jsonb, default `[]`), `sort`, `updated_at`. Twelve rows, seeded by that migration
and never created at runtime — a rule the code does not fire would be a switch that does nothing.
`jsonb` rather than `text[]` to match `email_templates.to_list` and friends, so every editable list in
the system has one shape.

## Who hears it

For any payment event the audience is the union of three sets:

1. `client_payments.tax_planner_email` — the one admin who earns on the payment;
2. every row in `payment_notification_recipients` for that payment;
3. the rule's `extra_recipients` — admins who should hear that *class* of event on **every** payment.

(1) and (2) are already hard-linked to `admins` by foreign key. (3) is text an admin typed into the
editor, so it is resolved against the roster **in code** — lowercased, trimmed comparison, never
`.ilike()` (GOTCHA #8) — and an address that is not an admin is dropped with a warning rather than
inserted, because `admin_email` is an FK and one bad address would fail the whole insert.

Deduped by lowercased address, so one person named three ways gets one row.

## `utils/notify.ts`

One export: `notifyPaymentEvent(supabase, { paymentId, ruleKey, title, message })`.

`title` is the **event phrase alone** — "Funds cleared", "Revenue share held". The helper appends the
client and the amount from the payment it was handed, so the stored title reads
`Funds cleared - Test Client ($15,000.00 LEOS)`. That composition lives in the helper on purpose:
Jake's rule is that every notification about a client names the client, and putting it here makes it
structural rather than something twelve call sites each have to remember.

In order it reads the rule (a **disabled** rule returns at once; a **missing** rule fires anyway with
no extras — a deleted row must not silence news about money), the payment, the client, the strategy
name, the recipients table and, only when the rule has extras, the admin roster. Then it dedupes, then
it inserts one row per recipient.

**Dedupe is `unread` on `(payment_id, rule_key)`.** Several of these events sit behind helpers that
are safe to re-run — the resend button, the nightly sweep, a redelivered Stripe webhook — so an admin
who still holds an unread row for this pairing is skipped. Once they clear it, the same event can
raise a fresh one, which is what keeps a genuine second occurrence visible.

## The twelve events, and where each fires

Every call sits **after** the latch write that made the outcome true, so a bell never says something
the row does not already record.

| Rule key | Fires at | Note |
| --- | --- | --- |
| `payment_request_sent` | `payments/request-email.ts:193` | After the `payment_email_sent_at` stamp. All three callers reach it — the first request, the resend button, the sweep's leg D. |
| `payment_request_failed` | `request-email.ts:95, 153, 160, 174` | No email on file, no recipient resolved, Gmail unreachable, Gmail refused. The two "not found" returns above them are silent — there is no payment to announce anything about. |
| `client_paid` | `payments/book-client-payment.ts:203` (checkout) and `:292` (out-of-order PI) | Only the delivery that WON the conditional claim raises it, so a redelivered event announces nothing. |
| `funds_cleared` | `book-client-payment.ts:211, 298, 347` → `notifyFundsCleared` at `:364` | Three routes to the same news: a card that settled inside checkout, the out-of-order intent, the normal ACH clearing. One helper, one wording. |
| `confirmation_drafted` | `payments/confirmation-email.ts:169` | After the `confirmation_status = "Sent"` stamp. |
| `invoice_receipt_drafted` | `payments/invoice-receipt.ts:285` | After the `invoice_email_sent` stamp; names both document numbers. |
| `invoice_receipt_failed` | `invoice-receipt.ts:112, 175, 194, 242, 249, 269` | No email, invoice PDF, receipt PDF, no recipient, Gmail unreachable, Gmail refused. The "has not cleared" return is silent — a state refusal, not a failure. |
| `rev_share_paid` | `payments/revenue-share.ts:455` | After the `rev_paid = succeeded` write and before the COI's own email is drafted. |
| `rev_share_via_ert` | `revenue-share.ts:301` | Path A. No transfer, no email; the outstanding item is the manual `ert_share` tick, and the message says so. |
| `rev_share_held` | `revenue-share.ts:358` | Owed, no working payout account. Non-terminal — the retry button pays it. |
| `rev_share_failed` | `revenue-share.ts:337, 421, 465` | Account unreadable, Stripe unconfigured, transfer refused. |
| `payment_reminder_sent` | `payments/reminder-email.ts:166` | After the `payment_reminder_sent_at` stamp. No failure counterpart: an undrafted reminder leaves its latch unset and tomorrow's sweep tries the same row again. |

## The five actions

Dispatch entries **44 → 48** (`AUTH_HANDLERS` 37 → 42; 49 actions with `admin_login`).

| Action | Body | Answers |
| --- | --- | --- |
| `load_notifications` | — | `{ notifications, unread_count }` — unread, newest first, 20 max. The count comes from the SAME query (PostgREST's exact count is pre-limit), so the badge can say 47 while the list shows twenty. |
| `mark_notification_read` | `{ notification_id }` | `{ success }`, or 404. |
| `mark_all_notifications_read` | — | `{ updated }` — ALL of the caller's unread rows, not just the twenty on screen. |
| `load_notification_rules` | — | `{ rules, admins }` — rules by `sort` then `key`, plus the roster via `loadAdminDirectory` (email + name only). |
| `save_notification_rule` | `{ key, enabled?, extra_recipients? }` | `{ rule }`. Unknown key 404; a non-admin address 400. |

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
does not navigate.

## The editor

`src/components/NotificationEditorPanel.jsx`, at Automation & Config → Notification Editor.

One card per rule: the enabled checkbox, the plain-English description, an "Also notify" chip row with
an `Add admin…` picker (the same control the payment detail's recipients use), and **its own Save**.
Twelve unrelated switches behind one Save would make an admin who flipped one responsible for eleven
they never looked at. Save is disabled until the card is dirty, a **Reset** appears while it is, and
the card re-seeds itself from the row the server answers with — including the roster's spelling of
each address, without which a normalised address would leave the card reading as dirty forever.

## Traps

- **`title` is the phrase, not the headline.** Passing a finished sentence produces
  "Funds cleared - Test Client ($15,000.00 LEOS) - Test Client (…)".
- **Never move a `notifyPaymentEvent` call above its latch.** The dedupe only holds for an UNREAD row;
  a bell raised before the write it describes can be cleared, then raised again by the retry.
- **`extra_recipients` are ADDITIONS, never the whole audience.** Emptying the list does not silence a
  rule — the payment's own people still hear it. Unticking Enabled is the off switch.
- **A disabled rule is silence, a missing rule is not.** An unknown key fires with no extras on
  purpose.
- **The bell polls.** Any column added to `notifications` is read twice a minute per open tab; the
  loader selects columns by name for that reason and must never become `select("*")`.
