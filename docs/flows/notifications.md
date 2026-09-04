# FLOW — In-portal bell notifications

How an event on a payment becomes a number on the header bell. Ported from the VFO portal and cut
down to what IAG has: **six payment events, one audience rule, one bell, one editor.**

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
`recipients` (jsonb, **nullable**), `default_recipients` (jsonb, `["TAX_PLANNER","PAYMENT_RECIPIENTS"]`),
`sort`, `updated_at` — the last three columns added by `20260904161000_notification_rules_audiences.sql`,
which also **dropped `extra_recipients`**. Six rows — twelve seeded by the first migration, six deleted
by `20260904162000_notification_rules_trim.sql` (see *The six events* below) — and never created
at runtime — a rule the code does not fire would be a switch that does nothing. `jsonb` rather than
`text[]` to match `email_templates.to_list` and friends, so every editable list in the system has one
shape. This is the VFO portal's shape, column for column, so the two editors behave the same.

`area` groups the six into the four stages of a payment — **Payment request**, **Payment**,
**Paperwork**, **Revenue share** — and `sort` restarts inside each area in pipeline order. The grouping
survived the trim to six because it is what makes the shape of the pipeline legible: four headings say
where in a payment's life each switch bites, which a flat list never does.

`sort` is **gappy** after the trim (Payment request 20; Paperwork 30; Revenue share 30, 40) and that is
deliberately left alone. The numbers are an ordering, not a position, every area still reads in pipeline
order, and renumbering would have been churn inside a migration whose whole job was deletion. An area
the trim had emptied would simply stop rendering — the editor filters its area list against the rules it
actually received — but as it happens all four still hold at least one rule.

## Who hears it

The audience is named by **general title**, not by person. `recipients` holds those titles, and the
fan-out resolves them against today's roster and today's payment:

| Token | Resolves to |
| --- | --- |
| `TAX_PLANNER` | `client_payments.tax_planner_email` — the one admin who earns on that payment |
| `PAYMENT_RECIPIENTS` | every row in `payment_notification_recipients` for that payment |
| `ALL_ADMINS` | the whole roster |
| `SUPERADMINS` | `admins.is_superadmin`, plus the floor superadmin (`constants/superadmin.ts`) |

A literal admin address may sit in the list too, as the escape hatch for the one-off case. The four
tokens live in **one** backend constant, `constants/notification-tokens.ts`, which both `utils/notify.ts`
and `actions/notification-rules/save.ts` import — a token can never be storable but unresolvable.

**A role survives somebody joining or leaving; a list of individuals does not.** That is why the editor
offers titles: a new admin is inside `ALL_ADMINS` the moment their row exists, without anybody walking
six rules to add them.

**The default is `["TAX_PLANNER","PAYMENT_RECIPIENTS"]`** — the people the payment already names, which
is the routing the six rules shipped with. `recipients` is **NULL** until an admin overrides it,
and null means "use `default_recipients`".

**An override REPLACES the default, it does not add to it.** That is the only semantics under which
"only the superadmins hear about a failed transfer" is expressible; an additive list can never take
anybody away. **Reset to default writes NULL back**, so "unedited" stays a state the row can return to
rather than a list somebody has to retype. An empty array saves as NULL for the same reason.

**An override that resolves to NOBODY falls back to the default** — a rule pointed at a tax planner on
a payment that has none fires on the default audience instead of firing at nothing. An editing mistake
must not silently lose news about money. Only an explicitly **disabled** rule is silence.

Literal addresses are resolved against the roster **in code** — lowercased, trimmed comparison, never
`.ilike()` (GOTCHA #8) — and an address that is not an admin is dropped with a warning rather than
inserted, because `admin_email` is an FK and one bad address would fail the whole insert. What is
stored is the roster's own spelling.

Deduped by lowercased address, so one person named three ways gets one row.

## `utils/notify.ts`

One export: `notifyPaymentEvent(supabase, { paymentId, ruleKey, title, message })`.

`title` is the **event phrase alone** — "Funds cleared", "Revenue share held". The helper appends the
client and the amount from the payment it was handed, so the stored title reads
`Funds cleared - Test Client ($15,000.00 LEOS)`. That composition lives in the helper on purpose:
Jake's rule is that every notification about a client names the client, and putting it here makes it
structural rather than something every call site has to remember.

In order it reads the rule (a **disabled** rule returns at once; a **missing** rule fires on the
default audience — a deleted row must not silence news about money), the payment, the client and the
strategy name, then resolves the audience through `resolveRecipients(list)` over
`rule.recipients ?? rule.default_recipients`. Then it dedupes, then it inserts one row per recipient.

`resolveRecipients` is **lazy and memoised**: a rule addressed to nothing but `TAX_PLANNER` reads
neither the roster nor `payment_notification_recipients`, and a list naming two addresses reads the
roster once. An override that comes back empty is re-resolved against the defaults (see *Who hears it*).

**Dedupe is `unread` on `(payment_id, rule_key)`.** Several of these events sit behind helpers that
are safe to re-run — the resend button, the nightly sweep, a redelivered Stripe webhook — so an admin
who still holds an unread row for this pairing is skipped. Once they clear it, the same event can
raise a fresh one, which is what keeps a genuine second occurrence visible.

## The six events, and where each fires

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

`20260904162000_notification_rules_trim.sql` deletes those six rules **and the `notifications` log rows
that carried their keys**. `rule_key` is loose text on purpose, so an orphaned row would sit on
somebody's bell forever with no switch anywhere that could turn it off — the one case where deleting
history is kinder than keeping it.

| Rule key | Fires at | Note |
| --- | --- | --- |
| `payment_request_failed` | `request-email.ts:95, 153, 160, 174` | No email on file, no recipient resolved, Gmail unreachable, Gmail refused. One helper (`notifyFailed`, `:73`) behind all four, with the reason in the message. The two "not found" returns above them are silent — there is no payment to announce anything about. |
| `client_paid` | `payments/book-client-payment.ts:204` (checkout) and `:293` (out-of-order PI) | Only the delivery that WON the conditional claim raises it, so a redelivered event announces nothing. |
| `funds_cleared` | `book-client-payment.ts:212, 299, 348` → `notifyFundsCleared` at `:366` | Three routes to the same news: a card that settled inside checkout, the out-of-order intent, the normal ACH clearing. One helper, one wording. |
| `invoice_receipt_failed` | `invoice-receipt.ts:112, 175, 194, 242, 249, 269` | No email, invoice PDF, receipt PDF, no recipient, Gmail unreachable, Gmail refused. One helper (`notifyFailed`, `:78`). The "has not cleared" return is silent — a state refusal, not a failure. |
| `rev_share_held` | `revenue-share.ts:352` | Owed, no working payout account. Non-terminal — the retry button pays it. |
| `rev_share_failed` | `revenue-share.ts:331, 415, 453` | Account unreadable, Stripe unconfigured, transfer refused. |

**The successful paths are now deliberately silent**, and each carries a comment saying so, so the next
reader does not "fix" the omission: `request-email.ts` (drafted), `confirmation-email.ts` (drafted — no
`notifyPaymentEvent` import at all any more), `invoice-receipt.ts` (drafted), `revenue-share.ts` (paid,
and settled via ERT), `reminder-email.ts` (drafted — import dropped too). The reminder is the one step
with **no bell in either direction**: a reminder that could not be drafted leaves
`payment_reminder_sent_at` unset, so tomorrow night's sweep simply tries the same row again and nobody
has to act on it.

## The five actions

Dispatch entries **44 → 48** (`AUTH_HANDLERS` 37 → 42; 49 actions with `admin_login`).

| Action | Body | Answers |
| --- | --- | --- |
| `load_notifications` | — | `{ notifications, unread_count }` — unread, newest first, 20 max. The count comes from the SAME query (PostgREST's exact count is pre-limit), so the badge can say 47 while the list shows twenty. |
| `mark_notification_read` | `{ notification_id }` | `{ success }`, or 404. |
| `mark_all_notifications_read` | — | `{ updated }` — ALL of the caller's unread rows, not just the twenty on screen. |
| `load_notification_rules` | — | `{ rules, admins }` — rules by `area`, `sort` then `key`, plus the roster via `loadAdminDirectory` (email + name only). |
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

A port of VFO's `NotificationEditorPanel`, on WIG tokens. The six rules sit in four **collapsible
area sections** — Payment request, Payment, Paperwork, Revenue share, in that order, each with a count
badge and an orange "N edited" when any rule inside carries an override or is switched off.

Each rule is a card. **Collapsed** it is one line: a chevron, the label, an `OFF` flag when disabled,
and on the right the effective audience as labels (`Tax planner`, `Payment recipients`, `All admins`,
`Superadmins`, or `Name (email)`) followed by an orange **· edited** when `recipients` is non-null.
**Expanded** it adds the plain-English description, a `RECIPIENTS (custom)` / `(system default)`
heading, the audience chips (tokens filled with `--wig-tint`, addresses outlined, each with a ×), an
`Add recipient…` `<select>` with an **Audiences** optgroup for the four tokens and an **Admins**
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
- **`recipients` REPLACES the default, it does not add to it.** Saving `["SUPERADMINS"]` means the tax
  planner stops hearing that event. Emptying the list is not "nobody" — it stores NULL and restores the
  default. Unticking Enabled is the off switch.
- **NULL is a value here.** Never write `[]` or a copy of the defaults where a reset is meant: the card
  reads null to decide between "custom" and "system default", and a retyped copy of the defaults would
  freeze today's routing into a rule that should follow tomorrow's.
- **A disabled rule is silence, a missing rule is not.** An unknown key fires on the default audience
  on purpose, and so does an override that resolves to nobody.
- **The bell polls.** Any column added to `notifications` is read twice a minute per open tab; the
  loader selects columns by name for that reason and must never become `select("*")`.
