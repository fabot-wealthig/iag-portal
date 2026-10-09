# IAG PORTAL — SESSION REFERENCE (HUB)

The single always-loaded file: current state, binding invariants, and the map to every other doc. Read in full at session start; before
editing an area, read the doc DOC MAP names for it. **Hard cap: 250 lines.** Command output always beats prose; a fact carries `(v: date)` when it was last verified.

## DERIVE-AT-START

Run these BEFORE any other work and state the results back. A doc sentence that disagrees with command output is stale — the command wins.

| # | Command | Expected |
| --- | --- | --- |
| 1 | MCP `supabase-iag` → `list_edge_functions` | `iag-admin-api`, `ACTIVE`, `verify_jwt: false`, version **93** (v: 2026-10-09) |
| 2 | `git tag -l 'live-*' --sort=v:refname` (in `C:\iag-react`) | `live-22-send-reset-cc` (v: 2026-10-08) |
| 3 | `git tag -l 'backend-good-*' --sort=v:refname` (in `C:\iag-edge-functions`) | `backend-good-2026-10-08-v93` (v: 2026-10-08) |
| 4 | action count — see command below | `79` table entries + 1 direct = **80** actions (v: 2026-10-09) |
| 5 | `deno check --no-lock index.ts` from `supabase\functions\iag-admin-api` | 0 errors (v: 2026-10-09) |
| 6 | `npm ci` (once per fresh worktree, #27) then `npm run build` in the frontend worktree | exit code 0 (v: 2026-10-07) |
| 7 | MCP `supabase-iag` → `get_advisors` type `security` | **zero findings** — green baseline is `"lints": []` (v: 2026-10-09) |
| 8 | anon-key probe — the anon key must see NOTHING. **Jake** runs `.\scripts\anon-probe.ps1` in the backend with `$env:IAG_ANON_KEY` set (Claude's shells are refused, #29): a GET per table, key as `apikey` AND `Bearer`, `Prefer: count=exact`, never `curl -I` (#7) | `ALL 28 = */0 (PASS)` — the script lists 28 (v: 2026-10-07 — chat 20 added `profile_notes` and `reminder_timing`; SQL `set local role anon` counted 0 on both; the HTTP run itself is owed, OWED) |

**The version is NOT a code-deploy counter** — Supabase bumps it on every SECRET change too; it means "what is live right now" (GOTCHA #3). **Tags (#2, #3)** are stamped post-merge, at chat-21 values.

**Action count (#4)** — with `$p` = the backend's `router\dispatch.ts`, `(Select-String -Path $p -Pattern '^\s+"[a-z_]+":' | Measure-Object).Count`.
Expected `79` = `PUBLIC_HANDLERS` (7) + `AUTH_HANDLERS` (72), plus `admin_login` (direct in `index.ts`, in neither table) = **80 total**.

## SECURITY INVARIANTS

These four are FINAL. Re-check them on any table, policy, handler, or function change. An invariant change is a headline,
never a quiet edit. **(Confirmed UNCHANGED by migrations 58–63: `sweep_runs` (58) ships deny-all RLS in its own migration, 61–62 add columns, rules and a template only, 63 two columns and the PRIVATE `client-vault` bucket with NO `storage.objects` policy (service role only — never public, never an anon policy); advisor green after 63; the SQL anon check 21/21 at 0, v: 2026-09-29; 64 `team_members`, 69 `team_share_rates` and 70 `payment_team_shares` ship deny-all RLS in their own migrations, 65–68 and 71 add columns, constraints, rules, templates and data only, advisor green, anon 0, v: 2026-10-06; 73 ships deny-all RLS on BOTH new tables, `team_payroll_settings` and `team_payroll_reports`, in that same migration, 72, 74 and 75 columns, constraints, rules and templates only, SQL anon 0 on both, v: 2026-10-07; 76 only dropped three unread columns, advisor green after it; 77 `profile_notes` and 80 `reminder_timing` ship deny-all RLS in their own migrations, 78, 79 and 81 add columns, a template, text and a CHECK only, advisor green, SQL anon 0 on both, v: 2026-10-07; 82–85 data only (a rule row, a template, seven Cc lists, four templates' wording), no table or policy, advisor green, v: 2026-10-09.)**

1. **RLS in the same migration.** Every public table ships with RLS enabled AND a deny-all policy created in the SAME migration that creates the table, verified by an anon probe of `*/0`.
2. **Ownership is re-checked from the session.** The edge function runs as service-role and so bypasses RLS. Every member-facing handler re-checks ownership from the SESSION, never from an id supplied in the request body.
3. **SECURITY DEFINER is pinned and locked down.** Every SECURITY DEFINER function pins `search_path` and revokes EXECUTE from `public`.
4. **Advisor after every DB change.** Run MCP `get_advisors` type `security` and reconcile against the documented green baseline. Any new anon-reachable-table finding is a STOP.

## CURATED GOTCHAS (always applies)

Full numbered list in `docs/GOTCHAS.md` — these five apply to essentially every session:

- **#1** PowerShell 5.1: no `&&`, no `tail`/`head`, `Out-File`/`Set-Content` write BOMs. Chain with `;`, use `Get-Content -Tail N`, and write files with the editor tools.
- **#4** CORS `Access-Control-Allow-Headers` is `Content-Type, Authorization` ONLY — the frontend must never send an `apikey` header; changing it means editing `utils/cors.ts` in the same breath.
- **#5/#13/#15/#24/#26** Backend deploys run `scripts/deploy-function.sh` (multipart upload to the Management API), and HOW
  to invoke it depends on the CALLER. **From ANY PowerShell — a real console OR the app's terminal tab — one command,
  `.\scripts\deploy.ps1`**: it puts Git's `usr\bin` and `mingw64\bin` on PATH and hands the script to the scoop bash, which
  is where a bare `bash` (the WSL relay stub, #15) and `dirname: command not found` (#24/#26) both come from. **From a
  Claude session the Bash tool**, `bash scripts/deploy-function.sh`, never Claude's PowerShell tool (#24). NEVER the
  `supabase` CLI (its login belongs to VFO); MCP `deploy_edge_function` no longer fits; an upload replaces the WHOLE function.
- **#12** NEVER answer 401 for a server-side failure. `lib/api.js` treats any 401 as a dead session and signs the admin out — a DB/network error must be a 500, and only a bad credential a 401.
- **#22** A Stripe `Idempotency-Key` is scoped to the ATTEMPT, never the entity. Stripe replays the FIRST response it saw under a key for 24h — a REFUSAL included — so a key held any wider makes a transient failure permanent.

## DOC MAP

| Doc | Covers |
| --- | --- |
| `docs/SESSION_REFERENCE.md` | This hub: current state, invariants, doc map. Read in full at session start. |
| `docs/CHANGELOG.md` | Narrative history, newest-first. One change = one entry = one squashed commit. |
| `docs/GOTCHAS.md` | Append-only numbered list of hard-won environment and code traps. Never renumbered. |
| `docs/flows/admin-invite.md` | A team member's portal login: Team → Portal Access → `team_login_email` (Gmail draft) → `/set-password` → login; tabs by RANK (no grants, v80) and the `superadminOnly` actions; status, resend, Rank, remove. The Admin Editor is gone. |
| `docs/flows/coi-connect-setup.md` | End-to-end COI (and payee) payouts: Connect account → emailed link → `/payout-setup` → Stripe → status; the Sandbox toggle and its lock. |
| `docs/flows/hard-cost-payees.md` | Payees (legal firms, GFX) and the LEOS / NBDT legal and admin fees paid to them by transfer after the share: the request-time choice, the claim and key, retry, leg H, the fee steps, the two bells. |
| `docs/flows/client-payment-request.md` | End-to-end client fee (LEOS and the Implementation Fee): request form → `/pay` (ACH, or card on `client_fee_pool`) → Stripe Checkout → webhook booking → confirmation (ACH only) → invoice and receipt (then filed into the client's vault) → COI revenue share → the detail screen; failures, disputes and the **Refund** button (both pipelines). |
| `docs/flows/client-vault.md` | The client's **Invoices/Receipts** tab (internally the vault): Jake's rules (the CLIENT's vault only, view-only), the private policy-less bucket and fixed path, filing after the draft, refiling by leg V, `load_client_vault` / `load_vault_file_url`, the screen, the traps. |
| `docs/flows/provider-receipts.md` | One lump sum from Boxhouse / SRA / DCD / Closehaul / ERT (Cost Segregation, Film Deduction, R&D Credits, Oil & Gas): the Tax Strategies form, the sum rule, rows born received, the per-row people and shares, the receipts list and detail, the ERT tick, Record refund on a row. |
| `docs/flows/nightly-sweep.md` | The `run_payment_sweep`: the bearer gate, the eighteen legs (R, A, T, H, P, Y, Z, B–E, E2, K, I, J, F, G, V) and their latches, the reminders (leg F weekly while owed), **Timing** (every wait a setting), expired transfer claims, the `sweep_runs` heartbeat + `row_errors` / `stuck`, housekeeping, the pg_cron job and dry runs. |
| `docs/flows/needs-attention.md` | Errors never go unseen: self-clearing bells, the stuck audit (`stuck-items.ts`) as superadmin alarms and **Accounting → Needs Attention**, the silent-leg row errors, Timing, the Payout card's single status, what Jake chose NOT to build. |
| `docs/flows/payout-schedule.md` | WHEN shares and payee fees go out: ONE schedule (weekly on a weekday or monthly on a day, no holiday shifting), the gate (a refund reads as a hold nobody can release), Pay now / Hold / Release, schedule edits and re-dating, `payout_events` history incl. every transfer's outcome, the three screens. |
| `docs/flows/internal-team-share.md` | The IAG internal team's cut of the Net Profit Pool: IAG's rules, the `team_members` roster and Team screen, Phases A (assignments), B1 (rates), B2 (the calculation), C (Stripe payouts), D1 (staff COIs "Via Team"), D2 (the payroll report, leg Y), D3 (the curator review reminder, leg Z); the pending cleanup migration 76. |
| `docs/flows/notifications.md` | The bell: the two tables, the fan-out audience and its SUPERADMINS fallback, the 30 rules and where each fires (the curator bell and `email_send_failed` the two not about a payment), dedupe (unread / ever / none), self-clearing bells, the superadmins' system alerts, the five actions, the 30s poll, the editor and its **Timing** group, the deep link. |
| `docs/integrations/sentry.md` | Frontend error monitoring: what is wired, why PROD-only, no replay, and the empty DSN. |
| `docs/prompts/` | `SESSION_STARTER.md` (pasted at the start of every chat) and `SESSION_WRAPUP.md` (pasted when the work is SHIPPING). |
| Both `README.md`s | Repo orientation — frontend: live URL, docs pointer, deploy warning; backend: deploy mechanism, type gate, migration convention. Its `supabase/.env.local.template` carries secret NAMES only; values live in Supabase function secrets. |

## LIVE STATE

- **Frontend:** https://portal.wealthig.com — GitHub Pages from the `gh-pages` branch of `fabot-wealthig/iag-portal`,
  custom domain via a Squarespace CNAME `portal` → `fabot-wealthig.github.io`, HTTPS enforced; `npm run deploy` IS
  production. **IAG Revenue Share Portal** (renamed from "IAG Portal" 2026-10-02 on every screen and email) / **Innovation Advisory Group**; palette = the `--wig-*` tokens in `src/styles.css`, orange
  carrying every alert. "Wealth IG" / "WIG" survive ONLY as infrastructure names (the domain, the email addresses, the
  CSS tokens, the storage keys).
- **Frontend shape (v: 2026-10-08):** 7 routes — `/` Landing, `/login` (with **Forgot passcode?**), `/forgot-password`, `/portal` (the whole signed-in app, one route),
  `/set-password`, plus two public session-less token pages, `/payout-setup` (COI and payee Connect) and `/pay` (client fee);
  `/members` → `/portal`. Any emailed path must ALSO be in `ROUTES` in `scripts/emit-route-pages.mjs` — 6 entries — or it
  404s on a client holding an emailed link. Inline style objects over `--wig-*`; dark mode signed-in only (`wig_theme`).
- **Portal UI (v: 2026-10-08):** a sticky navy header (the full logo lockup at 30px, bell, name, Settings, Sign
  Out) over a tab bar: **COI ▾** with hover flyouts, then five muted tabs — COI Overview, Client Overview, Tax
  Strategies for EVERY admin, plus for superadmins only **Automation & Config ▾** (Email Templates, Notification Editor, Payees, **Team**, **Team Share Rates**, **Payout Schedule**, **Payroll Report**) and **Accounting ▾** (Payments, **Payouts**, **Needs Attention**, **Team Payroll**; the Notification Editor carries **Timing**, `flows/needs-attention.md`). The RANK decides (Jake, 2026-10-07, v80: no per-person grants, `canSeeTab` in `Portal.jsx`;
  the server's `superadminOnly()` 403s the actions only those tabs call — `flows/admin-invite.md` step 5); under 1180px the secondary group collapses to **More ▾**. Each
  drill-in REPLACES the header above it — COI → its clients → a client (tabs **Profile ▾ · Payments · Invoices/Receipts**, the last the view-only client vault, `ClientVault.jsx`, `flows/client-vault.md`) → its payments → `PaymentDetail`, whose **Notifications** card (Advisor + IS
  notified automatically, picked TEAM-member chips, "No login" = never notified; EVERY admin) sits between Progress and Details, and every raising form asks it up front, pre-selecting NOBODY. An orange
  **Sandbox** chip marks a sandbox payment and a COI whose toggle is on; the bell polls every 30s — a bell reaching nobody falls back to the SUPERADMINS, who also get computed `system_alerts` from `load_notifications` (a "!" badge; stuck ones re-read LIVE and CLICKABLE — a team member's profile or Needs Attention, chat 21). **Overview rows are a work queue**: the whole row
  opens its payment, both NAMES staying links because each is a shortcut PAST it (rule 2); Client Overview carries ONE **Client** column, the name
  link over the number as the COI column does, eight columns keeping rule 4; **Next action** is the first outstanding step's `action`, NEVER its
  `label`, orange with an **Admin** chip when an admin owes it, "Nothing outstanding" when nothing does; a **Needs admin action** toggle narrows to
  those rows. A visit deep-linking PAST the COI — from `coi_overview`, `client_overview`, `accounting` or `tax_strategies`, never `mothership_search`
  — gets its ORIGIN's back link FIRST. **Tax Strategies renders each strategy BY ITS `model`**, each with an **ERT callout** naming who pays an
  ERT-affiliated COI, and **EVERY payment STARTS there**, "Start payment" beside each active strategy (the client's Payments tab is tracking only): a
  provider strategy opens the **receipt form** (the lump-sum total FIRST, then one line per client, over a green/red Allocated / Remaining line, a 90s
  submit), a client-funded one the request form with a client picker as question 1 (ONE fee field on `client_fee_pool` and `fee_pct_waterfall`; a
  **Legal firm** select on LEOS with the letter, and on NBDT); "+ Add a fee discount" sits under every fee and every receipt line. Each provider card
  lists its **Receipts**, each client-funded card its **Payments** (one shared grid); a receipt opens the split as it settled, the ONE action control
  in a row being a `Via ERT` line's "Paid by ERT" tick — that row's Payout cell until ticked, then a green chip, unticking stays on the payment
  detail. A provider record's detail hides the client fee, the documents and every email action, shows FOUR progress steps (a ticked "Revenue received" first; team steps when they apply) and a **View receipt**
  link; the grids read **Basis / Amount** (expected until received, a dash where nothing was measured). `/pay` offers ACH, a card ONLY when
  `accepts_card`. sessionStorage holds the screen — **eighteen** `wig*` keys, `wigTeamPayrollReport` the newest, listed TWICE (#21). Every payment detail carries a **Payout** card (pay date, holds, Pay now, history — `flows/payout-schedule.md`) and under it a **Refund** card (`RefundCard.jsx`: greyed with the server's reason unless nothing has gone out, reason required, "Refund"/"Confirm refund", on a provider row "Record refund"/"Confirm refund recorded"); money back shows in the Payment pill (Refunded / Refund pending / Refund recorded / Refunded in Stripe / Disputed / Dispute lost, plus an alert box for a dispute or a dashboard refund) and the Payout pill "Refunded — nothing paid"; every grid shows a **Payment** and a **Payout** pill in ONE vocabulary (`shared/PayoutPill.jsx`), Sandbox a small tag under the client, and step owners are System / Admin / Client / Provider / a name — never "IAG".
- **Profiles (Jake, 2026-10-02 — VFO parity):** COI, client, payee and team member open on a read-only **Profile** of category cards (`shared/ProfileKit.jsx`: bold underlined title, grey label over a bold value, side by side), **Profile ▾ → Edit Profile** the same cards as a form; the body never repeats the hero; **Notes** are a LOG on the Profile, never on Edit (Jake, 2026-10-07): "+ Add Note", each note dated and signed from the session, newest first, deleted by its author or a superadmin (`NotesCard` → `load_profile_notes` / `add_profile_note` / `delete_profile_note`, table `profile_notes`, migration 77; the old `notes` columns and `save_notes` are unread, awaiting cleanup).
- **Standing UI rules (permanent — Jake):** (1) the hero is flush at the top and the "← Back to …" link sits UNDER it, above
  any tab strip (`BackLink` and `Field` live in `TrackKit`); (2) a name is a link ONLY where it is a shortcut — plain where
  the row's own click goes to the same place, a link where it goes PAST it (`NameLink`, which stops the click propagating);
  (3) interaction mechanics copy the VFO portal exactly, hover timing included; (4) grid screens are auto-layout tables that
  fit the 1180px panel without horizontal scroll, every column left-aligned, no action controls in list rows — **ONE exception
  (2026-09-10): the "Paid by ERT" tick on a receipt's `Via ERT` row** — every data wait a skeleton; (5) a browser refresh on
  ANY signed-in screen lands on exactly that screen, all nav state being in sessionStorage; (6) a step whose amount is NOT YET
  CALCULATED is greyed and unclickable ("Pending calculation"), except the entry step that supplies the figure; (7) a step a
  payment NEVER HAS is ABSENT — the COI email when nothing was due / Via ERT / Via Team, a $0 COI share (Jake, 2026-10-06: Progress shows what DOES happen); greyed-with-a-reason only for a waived letter and a refunded payment's unfinished steps ("retained" included), the refund itself a final line only when it happened.
- **Backend (v: 2026-10-08):** `iag-admin-api` **v93** — chat 21: v89 the Draft / Send switch really sends (`utils/send-email.ts`, `email_send_failed`), v90 `delete_coi` + `save_strategy` superadmin-only, v91 bells that open their fix (curator bell, clickable system alerts), v92 **Forgot passcode** (`request_password_reset`) + payee fee email rows in Progress, v93 `ADVISOR` / `IS` recipient tokens + live stuck alerts
  (earlier: CHANGELOG) — ACTIVE, `verify_jwt: false` (custom auth). Deno 2. Project ref
  `gqznnyccridnpipjipeq`. 131 `.ts` files, ~1,050 KB, 80 actions. Smoke gate `scripts/smoke.ps1`: NINETEEN read-only loaders, one per area (`load_attention_items`, `load_reminder_timing` the newest), asserting 200 and no top-level `error` against the version SHIPPED.
- **Actions (80, v: 2026-10-08):** `admin_login` (direct in `index.ts`); public pre-auth `load_login_setup`, `submit_login_setup` (since chat 21 also deletes that email's `admin_sessions`), `request_password_reset` ("Forgot passcode?": `reset:`-throttled 5 / 15 min, ALWAYS `{ success: true }` floored to 1.2 s, a 1-hour link via `issueSetupToken`, template `password_reset` on Send — `flows/admin-invite.md`),
  `connect_setup_link`, `load_pay_link`, `pay_link_checkout`, `run_payment_sweep` (bearer-gated: its 401 is a bad credential, not a #12 breach);
  authed `ping`, `update_passcode`, `load_admin_directory`, `delete_admin`, `admin_set_superadmin` (superadmin; refuses the floor and the caller; revokes the target's sessions), `load_team_share_rates` / `save_team_share_rates` (save superadmin), `load_payment_team_shares` (superadmin; the Team shares card), `team_connect_request` / `team_connect_status` (superadmin; a Stripe-paid member's Connect account), `load_team_payroll` / `save_team_payroll_settings` / `draft_team_payroll` (superadmin; the payroll report), `draft_curator_reminder` (superadmin; D3, ignores the monthly latch),
  `load_members`, `add_coi`, `update_coi`, `delete_coi`, `coi_stripe_connect_request`, `coi_connect_status`, `load_payees`, `save_payee`, `load_team_members` (a superadmin also gets each `login` block), `save_team_member` (superadmin; no delete), `team_login_email` (superadmin; the ONE way a login is created — `flows/admin-invite.md`), `load_profile_notes` / `add_profile_note` / `delete_profile_note` (the notes log on a COI / client / payee / team member; any admin reads, team notes written by a superadmin, a note deleted by its author or a superadmin; `save_notes` is UNREAD since chat 20, awaiting cleanup),
  `payee_connect_request`, `payee_connect_status`, `load_motherships`, `add_mothership`, `load_clients`, `add_client`, `update_client`,
  `delete_client`, `start_client_payment`, `load_client_payments`, `load_client_payment`, `update_payment_step`, `create_provider_receipt`,
  `load_provider_receipts`, `load_provider_receipt`, `update_payment_recipient` (`team_member_id`), `resend_payment_email`,
  `retry_revenue_share`, `retry_hard_cost`, `load_all_payments`, `load_client_overview`, `load_coi_overview`, `load_strategies`, `save_strategy`,
  `load_email_templates`, `save_email_template`, `load_notifications`, `mark_notification_read`, `mark_all_notifications_read`,
  `load_notification_rules`, `save_notification_rule`, `load_payouts`, `load_payout_schedule`, `save_payout_schedule`, `set_payout_hold`, `pay_payout_now`, `record_check_payment`, `refund_payment` (ANY admin, reason required; only while nothing has gone out — `utils/refund.ts` `refundCheck`, the ONE rule; `flows/client-payment-request.md` *Refunds*), `load_client_vault`, `load_vault_file_url` (any admin, view-only — no upload or delete action exists, Jake; a 300s signed URL after uuid + path-prefix checks; `flows/client-vault.md`). **`superadminOnly()`** in `router/dispatch.ts` 403s "Superadmin only." on the thirteen actions only the superadmin tabs call (v80, v84, v86) plus `delete_coi` and `save_strategy` (v90, Jake chat 21: screens open to all, but only a superadmin sees the Delete COI card and the Edit Strategy button): `save_payee`, `payee_connect_request` / `_status`, `load_payouts`, `load_attention_items` (Needs Attention), `load_payout_schedule` / `save_payout_schedule`, `load_email_templates` / `save_email_template`, `load_notification_rules` / `save_notification_rule`, `load_reminder_timing` / `save_reminder_timing`. `*_admin*` actions are **superadmin-only** (an `auth.isSuperadmin` 403 first: the gate proves a
  session, not a rank), EXCEPT `load_admin_directory` — email+name, every admin; no screen calls it since v79 (smoke only), the recipient pickers reading `load_team_members` (`has_login` on every row).
  **`create_provider_receipt` is the WHOLE provider-funded pipeline**: one lump sum plus 1–50 client rows whose amounts must SUM to it (half a cent
  tolerance, else 400), each row BORN RECEIVED — so there is no clearing action — then per row the bell and `runRevenueShare` in process. A refused
  transfer is a 200 carrying that row's `error`; a timeout self-heals via sweep leg A. `update_payment_step` ticks FOUR whitelisted steps (three hard
  costs plus `ert_share`), moving no money — but a tick BLOCKS a refund (`refundCheck` reads them) — and refuses `legal_fee` / `admin_fee` on a row naming a payee (a transfer) and any refunded row (409).
  `pay_link_checkout` reads `method` ONLY on a `client_fee_pool` strategy, and asks Stripe FIRST whether an earlier attempt completed (`reconcilePayment`; 502 when it cannot ask). **Every step carries BOTH a `label`** (the STATE, for the progress list)
  **and an `action`** (the WORK OUTSTANDING, the overviews' `next_action` via `summarizePayment`) — neither derived from the other, so edit both.
- **Database (v: 2026-10-07):** 28 public tables — **`profile_notes`** (the notes log, migration 77), **`reminder_timing`** (the eleven sweep waits, migration 80), **`team_members`** (the internal team roster, `flows/internal-team-share.md`), **`team_share_rates`** (one row, the share percents, migration 69), **`payment_team_shares`** (each payment's team shares, snapshotted at clearing, migration 70; `staff_coi` role 72, `reported` 73), **`team_payroll_settings`** (ONE row: monthly/weekly + day) and **`team_payroll_reports`** (one per period, UNIQUE with sandbox; both migration 73), `admins`, `admin_sessions`, `login_attempts`, `login_setup_tokens`, `members`, `stripe_events`,
  `motherships`, `clients`, `client_payments`, `provider_receipts`, `strategies`, `email_templates`, `connect_setup_tokens`, `document_numbers`,
  `payment_notification_recipients`, `notifications` (one row per admin per event), `notification_rules` (30 rows, v: 2026-10-07), `payout_schedule`, `payout_events` (+ `transfer` outcomes, migration 81), **`sweep_runs`** (the sweep's heartbeat + `row_errors` / `stuck`, migration 79, deny-all, 90 days) and **`payees`**
  (`legal_firm`|`admin_fee`, own `sandbox` + Connect stamps; `GFX` / `GFX (Sandbox)` seeded, no email yet). **`provider_receipts`** is ONE lump sum a
  provider paid (`strategy_key` FK, `amount_received > 0`, `reference`, `notes`, `received_at`, `recorded_by`); `client_payments.receipt_id` is the
  split hanging off it — nullable (LEOS has no receipt) and **ON DELETE RESTRICT**, a blanked provenance reading as money from nowhere. On `members`, **`company` is the PRIMARY name** (firm over person on every screen, `shared/CoiName.jsx`) and `coi_manager_id` the Team roster person who manages it, `curator_tax_year` when they hold it as a curator (migration 68; the old text `coi_manager` dropped, migration 76); ADDING a COI requires company, first, last and work email (editing stays lenient for the imported rows); `payout_method` `stripe`|`check`|`team` (a check COI's share turns "Check Due" on its pay date and is Paid by **Record check**, `flows/payout-schedule.md`; `team` REQUIRES `team_member_id` — a staff COI, its share a `staff_coi` team share and `rev_paid` "Via Team", migration 72). On `members`
  (and `payees`), `stripe_account_id` and both `*_sent_at` stamps are never payload-writable, nor `member_number` (PK); `sandbox` is, until a Connect
  account exists. `client_payments` carries the assignment and waiver columns, the revenue-share tail, and the provider-funded half — `funded_by`
  (CHECK `client|provider`, a SNAPSHOT), `strategy_inputs` (jsonb), `contribution_amount`, `revenue_expected`, `implementation_fee_amount`,
  `revenue_received`/`_at`/`_by`, `revenue_reference`, `strategy_model` (a SNAPSHOT like `funded_by`, NULL = LEOS), `card_processing_fee` (the
  CLIENT's, NULL unless a card was booked), `discount_amount`/`_reason` (RECORD ONLY), `legal_fee_payee_id`/`admin_fee_payee_id` (FK SET NULL) and per
  cost `_paid`/`_transfer_id`/`_idempotency_key`/`_paid_at`, the payout columns (`payout_cleared_on`, `payout_due_on`, `payout_hold*`, `payout_early_*`), the failure columns (`payment_failed_at`/`_reason`/`_email_sent_at`, `bank_verification_pending_at`, `payment_reminder2_sent_at`), money back (`dispute_*` and `stripe_refunded_amount`/`_at` written by the webhook, migration 61; the portal's own `refund_status`/`_kind`/`_amount`/`_id`/`_reason`/`_by`/`_idempotency_key`/`_email_sent_at`…, migration 62, `refund_status` written ONLY by `refund.ts` and the refund webhook branch), the sweep's own bookkeeping (`stripe_checked_at`, `sweep_a_at`, `sweep_h_at`, `payout_followup_at`; `payment_intent_id` UNIQUE where set), and `invoice_vault_path`/`receipt_vault_path` (migration 63, NULL until filed — leg V's candidates) — with `offset_amount`/`total_fee` NULLABLE; `tax_planner_email` is DROPPED (migration 76)
  (no Tax Planner; awaiting the cleanup drop). `payment_notification_recipients` is `(payment_id, team_member_id)` UNIQUE, CASCADE
  both ways, holding whom the raising form named (nobody by default; migration 74); `email_templates` holds TWENTY rows (`password_reset`, migration 83, the one on Send), `document_numbers` the number registry (the vault is NEVER the source of a number); `payout_events` also records `check_recorded` and `refunded`. **Storage:** ONE bucket, `client-vault` — PRIVATE, NO `storage.objects` policy, PDF only, 50 MB, path `<client_id>/<doc number>.pdf` (upsert, so a resend replaces); nothing ever deletes from it.
- **Numbering:** COI `member_number` is **M.T.NNNN with DOTS** — mothership, type digit (1 CPA, 2 Advisor, 3 Other), then
  a GLOBAL zero-padded 4-digit sequence; `9999` is skipped by the allocator (IAG's "N/A" COI is 99.3.9999); next new COI 0184 (v: 2026-10-09). Dashes normalise to dots
  (`utils/coi-number.ts`), the dash separating a CLIENT number `{coi}-NNN`. Mothership and type are IMMUTABLE.
- **Revenue share (v: 2026-09-22):** `motherships` (number PK, ERT = 1) is the firm a COI sits under; `strategies` holds ELEVEN active rows whose rule
  sets are portal-editable, so tuning a split needs no deploy (seeded figures: the CHANGELOG). `model` (NINE) says HOW the pool is arrived at, the ONE
  thing code branches on; `funded_by` WHO PAYS. **LEOS** (`fee_waterfall`, client-funded): the admin fee (1.5% of the OFFSET) and the $7,500 legal
  letter — **WAIVABLE PER PAYMENT** (`legal_fee_waived`) — come off the fee first, then **ERT takes 10% or 5% of WHAT REMAINS, not the whole fee**;
  the rest is the pool. **The letter and the admin fee are TRANSFERRED to their payees after the COI's share** (the legal firm chosen on the request,
  GFX resolved by mode — none → a manual tick; `hard-cost-payees.md`); ERT's processing fee stays a tick. **Implementation Fee** (`client_fee_pool`,
  client-funded): the fee IS the pool, no hard costs, ACH or CARD (grossed up VFO-style `(fee + 0.30) / (1 - 0.029)`: the CLIENT pays the card fee,
  IAG nets it). **Nevada Bank Dynasty Trust** (`fee_pct_waterfall`, client-funded, ACH only): the attorney fee (`rules.attorney_fee_pct`, 60% OF THE
  FEE) is the ONE hard cost, stamped on `legal_fee_amount` and transferred to the chosen legal firm on the `legal_fee` step, the admin-fee and
  processing steps ABSENT, no waiver; the rest is the pool, Path A at 60%. **PROVIDER-FUNDED** (the client pays the provider, who pays IAG one lump
  sum for several clients — **the pool IS the money**): Boxhouse, 831(b), DCD; `pass_through` (the row amount IS the pool, no inputs) **Cost
  Segregation**, **Film Deduction**, **R&D Credits**; **Oil & Gas** (`hourly_rate`: chargeable hours × `rules.hourly_rate`, $450); **Closehaul**
  (`event_pct`: off `rules.events`, Loan 2% of the loan amount, Capital gains event 20% of the interest fee; the event's labels snapshotted onto the
  row, the base on `contribution_amount`). Only the older three bill an implementation fee, **INFORMATIONAL**, shared by nobody, except DCD's waiver
  moves ERT's cut 55% → 60%. **Path A needs BOTH** `mothership_number === 1` AND `affiliated_via_ert`: a flat `affiliated_share_pct`, no ladder, paid
  to ERT outside the portal — no transfer, no email, `rev_paid` = `Via ERT`, the manual `ert_share` tick its completion (Closehaul at 60%). **831(b)
  and Cost Segregation are the exceptions** (`affiliated_via_ert` false): this portal pays an ERT-affiliated COI on the ladder (0/20/30/40/50%) by
  transfer. **`rules.excluded_motherships` is read FIRST, provider rows included**: a listed mothership's COI earns 0% → `Not Due`, never Path A — ERT
  on the Implementation Fee (paid NOTHING), and on Film, R&D and Oil & Gas because ERT pays those COIs itself; Cost Segregation's empty rules exclude
  nobody. **CLEARING has two spellings** — `payment_status = "succeeded"`, or `revenue_received_at`, stamped by the RECEIPT that creates a provider
  row — writes the tail: the TEN waterfall columns in ONE conditional update BEFORE any money moves, NEVER recomputed (`coi_level_at_payment`,
  `coi_share_pct`, `coi_paid_via_ert` snapshots for that reason; on a provider record and on `client_fee_pool` the hard costs stamp ZERO, the pool
  being what ARRIVED), then `rev_paid` — `succeeded`/`processing`/`Not Due`/`Awaiting Payout Account`/`Failed`/`Via ERT`/`Check Due`/`Via Team`, owned by `revenue-share.ts`
  — and the transfer's stamps; **since 2026-09-24 the money waits for `payout_due_on`** (`flows/payout-schedule.md`). The key is **per ATTEMPT** (#22); a provider transfer draws on the platform BALANCE (#23). A **fee discount** (amount +
  reason, on every strategy, `pass_through` included) is **RECORD ONLY**: printed and emailed, never in any sum.
- **Migrations:** 85 (85 `20261009130000_spam_wording` — four client templates reworded off SpamAssassin's advance-fee rule, data only, #50; 84 `20261009120000_cc_advisor_is` — `ADVISOR` + `IS` on the seven client templates' Cc, data only; 83 `20261009110000_password_reset` — the `password_reset` template, on Send, data only; 82 `20261009100000_email_send_mode` — rule `email_send_failed`, data only; 81 `20261008110000_payout_transfer_history` — `payout_events` kind `transfer`; 80 `reminder_timing`; 79 `stuck_alarms` — `sweep_runs.row_errors` / `stuck`; 78 `connect_chase` — `team_members.connect_reminder_sent_at`, `team_connect_reminder`, the SSN/DOB line in six Connect templates; 77 `20261007200000_profile_notes`; 76 `20261007180000_drop_unread_columns` — DROPPED `members.coi_manager`, `client_payments.tax_planner_email`, `admins.allowed_tabs`, applied after v81 went live, #40; 75 `curator_review_reminder` — rule `curator_review_due` + template `curator_review_reminder`; 74 `20261007140000_recipients_team_members` — recipients re-keyed to `team_member_id`, `TAX_PLANNER` stripped from every rule; 73 `team_payroll_report` — the two payroll tables (deny-all), share status `reported`, the `team_payroll_report` template; 72 `staff_coi_team_pay` — `members.team_member_id`, payout method `team`, role `staff_coi`, `[SHARE_BASIS]`; 71 `20261006160000_team_share_payouts` — team Connect columns + `sandbox`, the `team` token kind, share payout statuses, 2 rules, 2 TEAM templates; 70 `payment_team_shares` + `team_shares_at`; 69 `team_share_rates`; 68 team assignments — COI manager link + curator year, client and payment Advisor/IS; 67 the template rename; 64 `20261002120000_team_members`; 65 first/last names, `login_email_sent_at`, the `team_login_setup` template; 66 `clients.notes`; 58 payment failure paths + `sweep_runs` + 14 rules; 59 the verify-bank and failed emails + `[BANK_SIGNIN_TIP]`; 60 email font sizes; 61 dispute / dashboard-refund state on the payment; 62 refunds — `refund_*`, `payout_events` `refunded`, 2 rules, 1 template; 63 `20260929150000_client_vault` — the bucket + two path columns), via MCP `apply_migration` AND committed under `supabase/migrations/`; reconcile on the migration NAME (the remote
  version is the applied-at timestamp). **GitHub:** both repos are squash-only.
- **Auth:** custom sessions, 8h, `login_type` `"admin"`. Passcodes PBKDF2 210k, salted, min length 8. Throttle 5 per
  identifier + 20 per IP per 15 min. Superadmin floor `fabot@wealthig.com` (`constants/superadmin.ts`) outranks
  `is_superadmin` and is undeletable; rank is granted on Team → Portal Access → **Rank** (`admin_set_superadmin`, since 2026-10-06 — no longer DB-only). `update_passcode` targets the SESSION's admin only and revokes their OTHER sessions;
  new admins get a NULL passcode plus a 14-day single-use `/set-password` link. `middleware/auth.ts` splits **401 from
  500**: a bad credential 401, a FAILED DB read 500, the frontend signing out on any 401 (#12).
- **Stripe (v: 2026-09-29):** the portal's own account, entirely separate from VFO. Both webhook endpoints, test and live, hit the same function URL
  and BOTH signing secrets are tried, so an event is verified by whichever signed it. **TWELVE event types, ticked on BOTH endpoints (#35, Jake 2026-09-29)**:
  six to `bookClientPayment` (`checkout.session.completed` / `.async_payment_failed`, `payment_intent.succeeded` / `.processing` / `.payment_failed` /
  `.canceled`), six to `stripe-exceptions.ts` (`charge.dispute.created` / `.closed`, `charge.refunded`, `transfer.reversed`: record it on the payment, hold
  the payouts, bell; `refund.updated` / `refund.failed`: the portal's OWN refunds, `metadata[pipeline]` `CLIENT_REFUND`; `charge.refunded` for one is skipped).
  **Refunds** (`refund_payment`, #37/#38): an ACH still in flight → PaymentIntent CANCEL; settled ACH or card → `/v1/refunds` for `total_fee` only, never the card fee.
  **Manual bank entry is ALLOWED, VFO's way**: no `verification_method` pin (never re-pin, #33), a bold `custom_text[submit][message]` warning, a
  verify-bank email for a `requires_action` PaymentIntent. **The mode is the COI's `sandbox` TOGGLE** (`members.sandbox`,
  `modeForCoi`, Jake's rule; both test COIs ON) — their Connect account and every client's payment and receipt; names no longer matter; a payee
  follows its own `payees.sandbox`; **locked (400) once a Connect account exists**. A payment's mode is stamped on `client_payments.sandbox` at
  request time and read back OFF THE ROW after; `stripeFetch` REQUIRES a mode; the `livemode` guard is PER ROW inside `bookClientPayment`, a mismatch
  answering 200 `skipped: "mode_mismatch"` with nothing written (#20) and a `stripe_mode_mismatch` bell. API calls pin `2024-06-20`. `bookClientPayment` is the ONLY writer of
  `payment_status` (`processing` / `succeeded` / **`failed`**, which re-opens the pay link; `reconcilePayment` books through it; a refund NEVER touches it), `coi_stripe_connect_request` of `members.stripe_account_id`, `payee_connect_request` of the payee's, `hard-costs.ts` of
  `*_fee_paid`. Client-fee Checkout is ACH only EXCEPT on `client_fee_pool`, where a card is offered and grossed up; a card books `succeeded` on the
  spot, `confirmation_status` **`Not Needed`** (no confirmation email — the instant invoice and receipt are it, VFO's rule). Provider strategies touch
  Stripe ONLY to transfer.
- **Gmail:** Google Cloud project "IAG Portal" in the wealthig.com org, consent screen INTERNAL (which is why the refresh token does not expire);
  OAuth client "IAG Portal Gmail", scope `gmail.compose`. **The Draft / Send switch WORKS (Jake, chat 21, 2026-10-07 — reversing chat 20's drafts-only):** every email goes through `utils/send-email.ts` `deliverEmail` → `draftGmail` drafts it, then `drafts.send` when the template's `send_mode` is true (never retried); a refused send stays in Drafts and rings `email_send_failed` (superadmins); responses carry `emailed` so the screens say "sent" or "drafted". All on Draft until flipped EXCEPT `password_reset`, which ships on Send (migration 83). TWENTY templates, each latched once created; all six Connect emails carry VFO's "complete every field… SSN and date of birth" line (payees the firm version): the team login email (`team_login_setup`, pipeline `TEAM`, chat 18), the team Connect setup, the team share paid, the payroll report and the curator review reminder (`team_connect_setup`, `team_share_paid`, `team_payroll_report` To Brittany + Beth with one PDF per employee, `curator_review_reminder` To the same two, monthly, chat 19), the team Connect reminder (`team_connect_reminder`, chat 20), the COI setup email,
  the payment request (`[PAYMENT_METHODS_NOTE]` per strategy, `[BANK_SIGNIN_TIP]` under the button), the confirmation (ACH ONLY) or its **verify-bank** twin
  on a manual entry, the **payment failed** email (the same link), the invoice + receipt (two PDFs, filed into the client vault AFTER the draft, never fatal; a card fee row + Total Charged on a grossed-up
  card), the COI revenue share (ONE neutral template), the payment reminder (sent TWICE, two latches) and the Connect reminder, the payee setup email
  and its reminder, the payee's fee confirmation (`payee_fee_paid`), and the **refund** email (`client_payment_refund`, `[REFUND_DETAIL]` in four variants; no credit note). `[DISCOUNT_NOTE]` sits in the five that state a fee. Plain emails are ONE
  text size (migration 60); the two card layouts keep theirs. `draftGmail` is `multipart/mixed`, HTML only. **Deliverability (v: 2026-10-09):** mail-tester 10/10 on the payment request; wealthig.com SPF + Google DKIM + DMARC `p=none` (Squarespace DNS); Gmail's Send-as name is "Innovation Advisory Group"; template wording is scored — #50.
- **Secrets (NAMES only; values set by Jake in Supabase function secrets):** `STRIPE_SECRET_KEY`,
  `STRIPE_SECRET_KEY_SANDBOX`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET_SANDBOX`, `GMAIL_CLIENT_ID`,
  `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `HTML2PDF_API_KEY` (read at call time, never logged). Plus the Vault
  secret `iag_service_role_key`, read only by the cron job at run time, so it is in no file nor in `cron.job`; **its value
  is the new-format `sb_secret_…` key, NOT the legacy JWT** — missing means a no-op sweep (#17).

## OWED

- **VFO carries the same auth bug we fixed** — `vfo-admin-api/middleware/auth.ts` ignores the error on all SIX identity
  queries; a ticket there, not ours. **ADMIN write paths lack click-through confirmation** — `update_passcode` only: type gate and code review (`team_login_email`,
  `delete_admin` PASSED chat 18's login run, 2026-10-02; `admin_update_tabs` is gone, v80). **UNTESTED branches:** everything as a NON-superadmin (no such login exists yet): the Team
  screen read-only with no `login` block, the Team shares card hidden + `load_payment_team_shares` / `save_team_share_rates` 403s, Automation & Config and Accounting hidden (Payroll Report and Team Payroll included) + the `superadminOnly` fifteen (Delete COI and Edit Strategy hidden), the payroll and curator actions' 403s (chat 19), Needs Attention and Timing hidden (chat 20); `team_login_email` LINKING an existing `admins` row; its inactive / no-email 400s.
- **REAL DATA** (v: 2026-10-05): **80 COIs, 777 clients, motherships 1–46 + 99** (2 = Innovative Group, 3–44 and 45 Wealth Innovation Group one per
  independent firm, 46 VFO Services — a Level-0 COI, 46.3.0182, so its 16 clients earn the TEAM only; 99 = IAG Internal & Referrals); all LIVE (sandbox off);
  58 COIs got work emails on 2026-10-05 (blank ones still need one before Stripe setup; Gluten Free Tax shares Diversify's and waits on IAG). **OWED from IAG:**
  Matt Croad's two COIs, Norm's last name, 3 Retire Smart clients. Payees `GFX`, `GFX (Sandbox)`, `Law Firm (Sandbox)` remain, plus the LIVE legal firm **Law Office of Gerald R. Nowotny** (added 2026-10-08, no Connect account yet). **Test assets (v: 2026-10-09):** the sandbox COIs "TEST Company" 1.2.0180 (ERT; Stripe ACH; its curator year cleared 2026-10-08) with Test Client 1.2.0180-001 (email `jlatham+test_email@elitert.com`, #36) and "TEST Company (Non-ERT)" 99.2.0183 with Test Client Two 99.2.0183-001 (Jake's testers' pairs) are kept; the training-video demo data (Demo Advisory Co. 99.2.0183, its client and payments, the test team members and login) was DELETED 2026-10-08, its 6 vault PDFs (folders `f9a26c0b…` and `24b4b3c7…`) awaiting Jake in the Dashboard; "Check Test Co" 1.2.0179 and its client, every test payment, receipt, team share, payroll report and bell, and the temporary members Test Stripe / Test Payroll and the `jlatham+teamc@` login are DELETED; the 24 `document_numbers` rows and the 83-row `stripe_events` log kept; Test Client's 10 vault PDFs await Jake in the Dashboard (SQL cannot delete storage objects, `storage.protect_delete`).
- **Chat 21 UNTESTED live** (v: 2026-10-08): a send Gmail refuses (`email_send_failed` bell), the curator bell's one-COI and several-COI clicks and the Payroll Report overdue table, `ADVISOR` / `IS` resolving on a real client email, a paid fee's email row in its Admin state; Jake DID test send mode, Forgot passcode end to end, the new Progress rows, and a stuck alarm raised and cleared live (Carson). **Chat 20 UNTESTED live** (v: 2026-10-07, all logic type-checked, the claim lookup and pill states checked offline): a self-clearing bell observed UNREAD-then-read, the weekly Connect repeat and the team Connect reminder drafting, a Timing change moving a real reminder, an expired claim (found / not found / released), a team-share reversal bell, a failed payee-fee or team-share pill; the HTTP anon probe over 28 tables. **OWED cleanup:** drop the unread `notes` columns on `members` / `clients` / `payees` / `team_members` and `save_notes`. **OWED: `load_client_vault` should skip dot-files** (the Dashboard leaves `.emptyFolderPlaceholder`). **Wealthbox** (v: 2026-09-29): Jake chose THE PORTAL AS THE SOURCE OF TRUTH — the portal PUSHES the client to Wealthbox (create, or match by email); asked of IAG: review-before-send by Olivia, and what JotForm sends today. Not built.
- **IAG's Stripe payout schedule** (v: 2026-09-24) — with shares now paid on a pay date, automatic bank payouts sweep the settled client money first and the transfer fails `Failed` (Stripe docs: `source_transaction` holds nothing once settled). Jake is asking IAG to go MANUAL, or keep a buffer. **Who tops up the Stripe balance** (v: 2026-09-10) — a provider transfer draws on IAG's own balance; short, the share sits `Failed` for retry and
  sweep leg A (#23); Jake tops up from the bank. **Never yet run LIVE**: the toggle's live branch, a card gross-up, a hard-cost transfer.
- **Before the first LIVE LEOS clears** (v: 2026-09-22): onboard `GFX`'s Connect account (its email is on file, v: 2026-10-08) and the live legal firm (Nowotny, added 2026-10-08)
  (else every live LEOS / NBDT request is refused, and a held fee waits). The HTTP anon probe over all 28 tables (Jake, `anon-probe.ps1`, #29) — the SQL-role check passed on every table as it shipped (latest `profile_notes` and `reminder_timing`, 2026-10-07).

- **Email deliverability (v: 2026-10-09):** DMARC to `p=quarantine` about 2026-10-23 once its reports are clean (Amazon SES also signs for the domain); delete the stray Squarespace TXT named `wealthig.com` (really `wealthig.com.wealthig.com`, a misplaced DKIM copy);
  the code `FALLBACK_BODY` copies still say "your payment" (next backend deploy); a `send_mode` email (API `drafts.send`, no text/plain part) is never mail-tested — test before flipping a client template to Send; no `robots.txt` / `privacy.html` in `public/` (#50).

## PARKED

- **Offered and NOT chosen (Jake, 2026-10-07):** re-checking disputes / failed refunds with Stripe when their webhook never arrives; a Connect webhook (`account.updated`, `payout.failed` on the COIs' own accounts); holding an inactive COI's payouts. `flows/needs-attention.md`.
- **Self-service password reset** was parked 2026-09-04 and BUILT 2026-10-08 (Jake, chat 21): "Forgot passcode?" → `/forgot-password` →
  `request_password_reset`. **Sentry is WIRED, DSN empty**: nothing reports until Jake pastes it into `SENTRY_DSN` (`integrations/sentry.md`), and **`stripe_events` indexes** stay parked (PK only).

## ENVIRONMENT

- **OS / toolchain:** Windows 11, PowerShell 5.1 (its constraints are #1) · Node v24.14.0 · Deno 2.7.14 · Supabase CLI
  2.78.1 · git 2.53.0 · gh CLI NOT installed. **Repos:** `fabot-wealthig/iag-portal` (public, frontend) and
  `iag-edge-functions` (private, backend); checkouts `C:\iag-react` and `C:\iag-edge-functions`.
- **MCP:** project-scoped `supabase-iag` in `C:\iag-edge-functions\.mcp.json` (gitignored — carries the PAT, which EXPIRES; #10). Restart the app after a
  change (#6); WRITE tools need `mcp__supabase-iag` in `.claude\settings.local.json` (#11). Timing out, the Management API answers every DERIVE read, reads only (#18).
- **Jobs:** one pg_cron job, `payment-sweep-daily`, `0 10,12,14 * * *` (06:00, 08:00, 10:00 Eastern; migration 53), POSTing `{"action":
  "run_payment_sweep"}` through pg_net with a Vault-read bearer (`nightly-sweep.md`). **Deploys:** backend via
  `scripts/deploy-function.sh` — from PowerShell the one-liner `.\scripts\deploy.ps1` wraps it (#5/#13/#15/#24/#26); frontend via `npm run deploy`, which IS production, from a checkout whose `node_modules` has `@sentry/react` (#27).
- **Git auth:** HTTPS + Git Credential Manager, per-repo `credential.useHttpPath true` PLUS a global scoped
  `credential.https://github.com/fabot-wealthig.useHttpPath true` — gh-pages publishes from a cache clone that ignores it (#2).
