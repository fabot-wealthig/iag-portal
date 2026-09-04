# IAG PORTAL — SESSION REFERENCE (HUB)

The single always-loaded file: current state, binding invariants, and the map to every other doc.
Read in full at session start; before editing an area, read the doc DOC MAP names for it. Hard cap:
250 lines. Command output always beats prose; a fact carries `(v: date)` when it was last verified.

## DERIVE-AT-START

Run these BEFORE any other work and state the results back. A doc sentence that disagrees with
command output is stale — the command wins.

| # | Command | Expected |
| --- | --- | --- |
| 1 | MCP `supabase-iag` → `list_edge_functions` | `iag-admin-api`, `ACTIVE`, `verify_jwt: false`, version **24** (v: 2026-09-03) |
| 2 | `git tag -l 'live-*' --sort=v:refname` (in `C:\iag-react`) | `live-8-overview-panels` (v: 2026-09-03) |
| 3 | `git tag -l 'backend-good-*' --sort=v:refname` (in `C:\iag-edge-functions`) | `backend-good-2026-09-03-v24` (v: 2026-09-03) |
| 4 | action count — see command below | `48` table entries + 1 direct = **49** actions (v: 2026-09-04) |
| 5 | `deno check --no-lock index.ts` from `supabase\functions\iag-admin-api` | 0 errors (v: 2026-09-03) |
| 6 | `npm run build` in the frontend worktree | exit code 0 (v: 2026-09-03) |
| 7 | MCP `supabase-iag` → `get_advisors` type `security` | **zero findings** — green baseline is `"lints": []` (v: 2026-09-03) |
| 8 | anon-key probe (below) | `Content-Range: */0` on all 16 tables (v: 2026-09-04) |

**The version is NOT a code-deploy counter** — Supabase bumps it on every SECRET change too; it means
"what is live right now" (GOTCHA #3). **Tags (#2, #3)** are stamped post-merge, at chat-8 values.

**Action count (#4)** — with `$p` = the backend's `router\dispatch.ts`, `(Select-String -Path $p
-Pattern '^\s+"[a-z_]+":' | Measure-Object).Count`. Expected `48` = `PUBLIC_HANDLERS` (6) +
`AUTH_HANDLERS` (42), plus `admin_login` (direct in `index.ts`, in neither table) = **49 total**.

**Anon probe (#8)** — the anon key must see NOTHING. GET each of the 16 tables at
`https://gqznnyccridnpipjipeq.supabase.co/rest/v1/<table>?select=*`, the key as BOTH `apikey` and
`Authorization: Bearer`, plus `Prefer: count=exact`; expect `*/0` on all 16. Never `curl -I` (#7).

## SECURITY INVARIANTS

These four are FINAL. Re-check them on any table, policy, handler, or function change. An
invariant change is a headline, never a quiet edit. **(Confirmed UNCHANGED at chat-8 wrap-up.)**

1. **RLS in the same migration.** Every public table ships with RLS enabled AND a deny-all policy created
   in the SAME migration that creates the table, verified by an anon probe of `*/0`.
2. **Ownership is re-checked from the session.** The edge function runs as service-role and so bypasses
   RLS. Every member-facing handler re-checks ownership from the SESSION, never from an id supplied in
   the request body.
3. **SECURITY DEFINER is pinned and locked down.** Every SECURITY DEFINER function pins `search_path` and
   revokes EXECUTE from `public`.
4. **Advisor after every DB change.** Run MCP `get_advisors` type `security` and reconcile against the
   documented green baseline. Any new anon-reachable-table finding is a STOP.

## CURATED GOTCHAS (always applies)

Full numbered list in `docs/GOTCHAS.md` — these four apply to essentially every session:

- **#1** PowerShell 5.1: no `&&`, no `tail`/`head`, `Out-File`/`Set-Content` write BOMs. Chain with `;`, use
  `Get-Content -Tail N`, and write files with the editor tools.
- **#4** CORS `Access-Control-Allow-Headers` is `Content-Type, Authorization` ONLY — the frontend must never send an
  `apikey` header. Changing this means editing `utils/cors.ts` in the same breath.
- **#5/#13/#15** Backend deploys run `scripts/deploy-function.sh` (multipart upload to the Supabase Management API):
  from PowerShell `& "$HOME\scoop\apps\git\current\usr\bin\bash.exe" scripts/deploy-function.sh` (a bare `bash` there
  is the WSL relay stub, #15), from Git Bash a bare `bash`. NEVER the `supabase` CLI (its login belongs to VFO); MCP
  `deploy_edge_function` no longer fits; never split an upload — it replaces the WHOLE function.
- **#12** NEVER answer 401 for a server-side failure. `lib/api.js` treats any 401 as a dead session and signs the
  admin out — a DB/network error must be a 500, and only a bad credential a 401.

## DOC MAP

| Doc | Covers |
| --- | --- |
| `docs/SESSION_REFERENCE.md` | This hub: current state, invariants, doc map. Read in full at session start. |
| `docs/CHANGELOG.md` | Narrative history, newest-first. One change = one entry = one squashed commit. |
| `docs/GOTCHAS.md` | Append-only numbered list of hard-won environment and code traps. Never renumbered. |
| `docs/flows/admin-invite.md` | End-to-end admin invite: Admin Editor → setup link → `/set-password` → login. |
| `docs/flows/coi-connect-setup.md` | End-to-end COI payouts: Connect account → emailed link → `/payout-setup` → Stripe → status. |
| `docs/flows/client-payment-request.md` | End-to-end client fee: request form → `/pay` → Stripe Checkout → webhook booking → confirmation → invoice and receipt → COI revenue share → the detail screen. |
| `docs/flows/nightly-sweep.md` | The nightly `run_payment_sweep`: the bearer gate, the seven legs and their latches, the two 2-business-day reminders, housekeeping retention, the pg_cron job and dry runs. |
| `docs/flows/notifications.md` | The bell: the two tables, the fan-out audience, the twelve events and where each fires, dedupe, the five actions, the 30s poll, the editor, the deep link. |
| `docs/prompts/` | `SESSION_STARTER.md` (pasted at the start of every chat) and `SESSION_WRAPUP.md` (pasted when the work is SHIPPING). |
| Both `README.md`s | Repo orientation — frontend: live URL, docs pointer, deploy warning; backend: deploy mechanism, type gate, migration convention. Its `supabase/.env.local.template` carries secret NAMES only; values live in Supabase function secrets. |

## LIVE STATE

- **Frontend:** https://portal.wealthig.com — GitHub Pages from the `gh-pages` branch of `fabot-wealthig/iag-portal`,
  custom domain via a Squarespace CNAME `portal` → `fabot-wealthig.github.io`. HTTPS enforced. `npm run deploy` IS
  production.
- **Branding:** the portal is **Wealth IG Portal**, the company **Wealth Innovation Group**. Navy `#0F355A`, primary
  `#1D64A8`, primary-2 `#2E86C7`, sky `#3D9BE0`, orange `#EE6A33` (eyebrows, divider pills, superadmin chip, the
  "still owed" lines on a payment). "IAG Portal" survives ONLY as infrastructure names — repos, the `iag-admin-api`
  slug, `iag_session`/`iag_redirect` — plus two chat-1 test actions (see OWED).
- **Frontend shape (v: 2026-09-02):** 6 routes — `/` Landing, `/login`, `/portal` (the whole signed-in app, one
  route), `/set-password`, plus two public session-less token pages, `/payout-setup` (COI Connect) and `/pay` (client
  fee); `/members` → `/portal`. Any emailed path must ALSO be in `ROUTES` in `scripts/emit-route-pages.mjs` — 5
  entries: `login`, `portal`, `set-password`, `payout-setup`, `pay` — or it 404s on a client holding an emailed link.
  Styling is inline style objects over `--wig-*` in `src/styles.css`; dark mode signed-in only (`wig_theme`); the
  public token pages use `AuthShell` (split panel, per-page `tagline`) and `/pay?done=1` renders the WIG success
  landing in `TokenShell` (v: 2026-09-03).
- **Portal UI (v: 2026-09-04):** sticky navy header (mark-only logo, bell, name, Admin Editor pill for superadmins, Settings,
  Sign Out) over a tab bar. **COI ▾** holds hover flyouts **COI ▸** and **Mothership ▸**, each Search / KPIs / Add. Right of a
  divider, five muted tabs gated by `admins.allowed_tabs`: COI Overview, Client Overview, Tax Strategies, **Automation &
  Config ▾** (Email Templates / Notification Editor), **Accounting ▾** (Payments). Superadmins see all five; a grant lands at
  the grantee's NEXT LOGIN — `allowed_tabs` is session-baked at `admin_login`. Under 1180px the secondary group collapses to
  **More ▾**, the COI flyouts flat. COI Search rows open a hero + **Profile ▾** (Profile / Edit / Settings) + a **Clients**
  pill; opening a client REPLACES both — Profile ▾ plus a **Payments** pill (newest-first grid + **Start New Payment**) whose
  rows open `PaymentDetail`, the same takeover again, now carrying a **Notifications** card (one-select tax planner +
  recipient chips, EVERY admin) between Progress and Details; the request form asks for both up front. Profile and Settings
  carry the **Stripe Connect card** — account id, status pill, Refresh, Send/Resend, live from Stripe, NO polling. Live: Tax
  Strategies (editable rules), Email Templates (seven rows), COI Overview, **Client Overview** (ONE ROW PER PAYMENT) and
  Accounting → Payments (all payments, newest first); overview names deep-link into the COI, the client, or that very payment,
  and back. The **bell is live** (30s poll, orange badge, Done / Mark all read, a click deep-links to the payment) and
  **Notification Editor** is real — twelve rule cards, each a tick, a description, an "Also notify" chip row and its own Save;
  NO placeholders remain. Overview tables and the payments list are auto-layout `<table>`s; every data wait is a skeleton from
  `shared/Skeleton.jsx`. sessionStorage holds the whole signed-in screen — the eleven `wig*` keys in `SUB_STATE_KEYS`
  (`Portal.jsx`); each persists until nav clears it, and all are cleared on sign-in, sign-out-to-welcome and nav.
- **Standing UI rules (permanent — Jake):** (1) the hero is flush at the top and the "← Back to …" link sits UNDER it, above
  any tab strip (`BackLink` and `Field` live in `TrackKit`); (2) a name is a link ONLY where it is a shortcut — rows that
  navigate keep plain names (`NameLink`); (3) interaction mechanics copy the VFO portal exactly, hover timing included; (4)
  grid screens are auto-layout tables that fit the 1180px panel without horizontal scroll, every column left-aligned, no
  action controls in list rows (the pay link lives on the detail), and every data wait is a skeleton, never "Loading..."
  text; (5) a browser refresh on ANY signed-in screen lands on exactly that screen — all nav state is in sessionStorage.
- **Backend (v: 2026-09-03):** `iag-admin-api` **v24**, ACTIVE, `verify_jwt: false` (custom auth, in the function).
  Deno 2. Project ref `gqznnyccridnpipjipeq`. 73 `.ts` files, ~505 KB. Post-deploy smoke: the public pay handlers
  answer 200 `state: "invalid"` on junk; authed actions 401 without a session.
- **Actions (49, v: 2026-09-04):** `admin_login` (direct in `index.ts`); public pre-auth `load_login_setup`,
  `submit_login_setup`, `connect_setup_link`, `load_pay_link`, `pay_link_checkout`, `run_payment_sweep`; authed `ping`,
  `update_passcode`, `load_admins`, `load_admin_directory`, `add_admin`, `issue_setup_link`, `delete_admin`,
  `admin_update_tabs`, `load_members`, `add_coi`, `update_coi`, `delete_coi`, `coi_stripe_connect_request`,
  `coi_connect_status`, `load_motherships`, `add_mothership`, `load_clients`, `add_client`, `update_client`, `delete_client`,
  `start_client_payment`, `load_client_payments`, `load_client_payment`, `update_payment_step`, `set_payment_tax_planner`,
  `update_payment_recipient`, `resend_payment_email`, `retry_revenue_share`, `load_all_payments`, `load_client_overview`,
  `load_coi_overview`, `load_strategies`, `save_strategy`, `load_email_templates`, `save_email_template`,
  `load_notifications`, `mark_notification_read`, `mark_all_notifications_read`, `load_notification_rules`,
  `save_notification_rule`, `create_test_checkout`, `admin_test_draft`. `*_admin*` actions are **superadmin-only** (an
  `auth.isSuperadmin` 403 first — the gate proves a session, not a rank), EXCEPT `load_admin_directory`: email+name, every
  admin, since any admin assigns planners and recipients. `resend_payment_email` covers all three client emails (`kind`);
  `retry_revenue_share` refuses a `Via ERT` share. `run_payment_sweep` is bearer-gated, its 401 a bad credential, not a #12
  breach (`nightly-sweep.md`). `update_payment_step` ticks FOUR whitelisted steps — three hard costs plus `ert_share`;
  COSMETIC, nothing reads `*_done`. Both assignment writes echo `load_client_payment`'s body.
- **Database (v: 2026-09-04):** 16 public tables — `admins`, `admin_sessions`, `login_attempts`, `login_setup_tokens`,
  `members`, `stripe_events`, `motherships`, `clients`, `client_payments`, `strategies`, `email_templates`,
  `connect_setup_tokens`, `document_numbers`, `payment_notification_recipients`, `notifications` (one row per admin per event)
  and `notification_rules` (twelve seeded rows). `members` carries `member_number` (PK), `mothership_number`, `coi_level`
  (0-4), `coi_type` (`Advisor|Accountant|Other`), `status` (`Active|Lost`), `stripe_account_id` and
  `connect_setup_email_sent_at`. `coi_type`/`status`/`coi_level` are CHECK-constrained; `member_number`, `stripe_account_id`
  and both `*_sent_at` stamps are never payload-writable — `update_coi` touches none. `client_payments` gained
  `payment_reminder_sent_at` (sweep-only), `tax_planner_email` (FK `admins.email`, SET NULL — the ONE admin who earns on it)
  and, beside `strategies.affiliated_share_pct`, `legal_fee_waived`/`coi_paid_via_ert`/`ert_share_done`/`ert_share_done_at`
  (NOT NULL defaults); its twin `payment_notification_recipients` is `(payment_id, admin_email)` UNIQUE, CASCADE both ways,
  seeded with the creator and backfilled from `created_by`. `email_templates` holds SEVEN draft rows: three `COI_PAYOUT` and
  four `CLIENT_PAYMENT`. `document_numbers` is the issued-number registry (`client-payment-request.md`).
- **Numbering:** COI `member_number` is **M.T.NNNN with DOTS** — mothership, type digit (1 CPA, 2 Advisor, 3 Other),
  then a GLOBAL zero-padded 4-digit sequence; `9999` is the test slot the allocator skips. Dashes normalise to dots
  (`utils/coi-number.ts`) because the dash separates a CLIENT number, `{coi}-NNN` (`1.1.0007-001`). Mothership and
  type are IMMUTABLE — baked into the number, and `update_coi` refuses either; `coi_level` is editable.
- **Revenue share (v: 2026-09-04):** `motherships` (number PK, ERT = 1) is the firm a COI sits under; `strategies` holds
  editable rule sets, so tuning the waterfall never needs a deploy. **LEOS** is seeded: admin fee 1.5% of the OFFSET plus a
  $7,500 flat legal letter come off the client fee first, then **ERT takes 10% (mothership ERT, affiliated) or 5% of WHAT
  REMAINS, not of the whole fee**; the rest is the Available Revenue Pool, and WIG keeps what the COI does not. The letter is
  **WAIVABLE PER PAYMENT** (`legal_fee_waived`, ticked on the request form, default required — the tax advisor's call for a
  repeat client): that line is $0.00 for that payment. TWO PATHS: an **ERT-affiliated COI** (mothership 1) takes a flat
  `strategies.affiliated_share_pct` (50), levels do NOT apply, paid to ERT outside the portal — NO transfer, NO email,
  `rev_paid` = `Via ERT`, and the manual `ert_share` tick is the completion. Everyone else takes their level's share
  (0/20/30/40/50%, levels 0-4) by transfer. **Phase F writes the tail ON CLEARING**: the TEN waterfall columns stamped in ONE
  conditional update BEFORE any money moves and NEVER recomputed (`coi_level_at_payment`, `coi_share_pct`, `coi_paid_via_ert`
  are snapshots for that reason), then `rev_paid` (`succeeded`/`processing`/`Not Due`/`Awaiting Payout Account`/`Failed`/`Via
  ERT`, owned by `revenue-share.ts`), `rev_transfer_id`, `rev_completed_at`, `rev_email_sent_at`.
- **Migrations:** 28, applied via MCP `apply_migration` AND committed under `supabase/migrations/`. The remote version
  is the APPLIED-AT timestamp: reconcile on the migration NAME, not the number.
- **Auth:** custom sessions, 8h, `login_type` `"admin"`. Passcodes PBKDF2 210k, salted, min length 8 (VFO's is 6).
  Throttle 5 per identifier + 20 per IP per 15 min. Superadmin floor `fabot@wealthig.com` (`constants/superadmin.ts`)
  outranks `is_superadmin` and is undeletable. `update_passcode` targets the SESSION's admin only and revokes their
  OTHER sessions. New admins get a NULL passcode plus a 14-day single-use `/set-password` link; no self-service reset
  (PARKED). `middleware/auth.ts` splits **401 from 500**: a bad/expired/missing credential is 401, a FAILED DB read is
  500, because the frontend signs out on any 401 (#12); a 401 logs why, never its token.
- **Stripe:** the IAG Portal's own account, entirely separate from VFO. Test-mode AND live-mode webhook endpoints both
  hit `https://<ref>.supabase.co/functions/v1/iag-admin-api`. `STRIPE_MODE` in `utils/stripe.ts` is hardcoded
  `"sandbox"`; live-mode events are skipped with a logged mode mismatch. API calls pin `2024-06-20`; the endpoints
  were created at account version `2024-04-10`. Checkout + both webhooks (manual HMAC, constant-time compare →
  `stripe_events`) are proven end to end. After that upsert the webhook BOOKS: `bookClientPayment` routes on metadata
  `pipeline=CLIENT_PAYMENT` + `payment_id`, is the ONLY writer of `payment_status`, and claims every write
  conditionally so two deliveries can never both book or draft. Also proven, **Connect in sandbox**:
  `coi_stripe_connect_request` creates EXPRESS accounts (US, transfers requested), the ONLY writer of
  `members.stripe_account_id`; `coi_connect_status` reads status live, never stores it. Clearing also TRANSFERS the
  COI's share there, on the terms under Revenue share above. Client-fee Checkout is ACH only. Flows:
  `coi-connect-setup.md`, `client-payment-request.md`, `nightly-sweep.md`.
- **Gmail:** Google Cloud project "IAG Portal" in the wealthig.com org. Consent screen INTERNAL, which is why the
  refresh token does not expire. OAuth client "IAG Portal Gmail" (Web app, redirect URI = OAuth Playground), scope
  `gmail.compose`. **Drafts only — no send path exists.** SEVEN drafts, each latched: the COI setup email, the payment
  request, the confirmation (`confirmation_status` "Sent"), the invoice + receipt (`invoice_email_sent`, two PDFs),
  the COI revenue share (`rev_email_sent_at`, only after the transfer succeeds) and the two Phase-G reminders
  (`payment_reminder_sent_at`, `connect_reminder_sent_at`) — the middle three drafted in process by the webhook, the
  last two by the nightly sweep; `/set-password` by hand. `draftGmail` emits `multipart/mixed` only when given
  attachments, byte-identical without them.
- **Secrets (NAMES only; values set by Jake in Supabase function secrets):** `STRIPE_SECRET_KEY`,
  `STRIPE_SECRET_KEY_SANDBOX`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET_SANDBOX`, `GMAIL_CLIENT_ID`,
  `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `HTML2PDF_API_KEY` (read at call time in `utils/html2pdf.ts`, never
  logged). Plus the Vault secret `iag_service_role_key`, set by Jake, read only by the cron job at run time, so it is
  in no file nor in `cron.job`; **its value is the new-format `sb_secret_…` key, NOT the legacy `service_role` JWT**
  (GOTCHA #17). Missing means an empty bearer, a 401 and a no-op sweep.
- **GitHub:** both repos are squash-only — "Squash and merge" is the ONLY enabled merge button.

## OWED

- **`email_templates` holds only SEVEN rows** (v: 2026-09-03) — every other pipeline's subjects and bodies still need
  Jake's sign-off in chat before they can be seeded.
- **VFO carries the same auth bug we just fixed** — `vfo-admin-api/middleware/auth.ts` ignores the error on all SIX
  identity queries. Worth a ticket on that repo; not ours to fix from an IAG chat.
- **Two chat-1 test actions still say "IAG Portal" in outbound content** — the `admin_test_draft` Gmail subject/body
  and the `create_test_checkout` Stripe product name. Rename (a deploy) or delete.
- **ADMIN write paths lack click-through confirmation** — `add_admin`, `issue_setup_link`, `delete_admin`,
  `update_passcode`: type gate and code review only.
- **UNTESTED against real data** (v: 2026-09-03) — sweep legs B-F (confirmation, invoice/receipt, request-email, the two
  2-business-day reminders); only A (a drafted share email) and G (20 purged sessions) have run live. Also the WHOLE
  notification path — the twelve events, the bell and the editor are code review only; no payment has raised a bell. Also
  `rev_paid` `Awaiting Payout Account`, `Failed` and `Via ERT` — only `succeeded`/`Not Due` have run — and
  `start_client_payment`'s zero-pool guard, code review only. Agreed plan: a second test COI inserted by SQL as `1.1.9999`
  (the reserved test slot) with no payout account for the held path and a bogus account id for Failed; legs B-F by resetting
  each latch on a test row; the zero-pool guard via a DevTools fetch.
- **The `docs/chat-7-restamp` PR is obsolete** — chat 8's re-stamp carries those tag values; close it unmerged once
  this branch lands.

## WATCH

- **Stripe Connect platform review is still PENDING.** Sandbox is fully proven, so the build is NOT blocked; only LIVE
  mode is — real COI onboarding needs the review AND the **`STRIPE_MODE` flip**, a deliberate decision: one constant
  in `utils/stripe.ts`, live endpoint already registered.
- **The Supabase MCP PAT EXPIRES.** In `C:\iag-edge-functions\.mcp.json` (gitignored); the first was a 7-day default
  and died mid-project. Regenerate, then restart the app. (GOTCHA #10)

## PARKED

- **Self-service password reset** — deliberately absent, matching VFO, where admins are excluded by design. A
  locked-out admin gets a fresh `/set-password` link from a superadmin.
- Also parked: **Sentry** or any error-reporting service, the **scripted smoke gate** (`<SMOKE_GATE>`,
  `SESSION_WRAPUP.md` Part 2), **`stripe_events` secondary indexes**, a **DB-driven sandbox toggle**.

## ENVIRONMENT

- **OS / shell:** Windows 11, PowerShell 5.1 — the constraints are GOTCHA #1 above.
- **Toolchain:** Node v24.14.0 · Deno 2.7.14 · Supabase CLI 2.78.1 · git 2.53.0 · gh CLI NOT installed.
- **Repos:** `fabot-wealthig/iag-portal` (public, frontend) and `iag-edge-functions` (private, backend); local
  checkouts `C:\iag-react` and `C:\iag-edge-functions`.
- **MCP:** project-scoped `supabase-iag` in `C:\iag-edge-functions\.mcp.json` (gitignored — carries the PAT, which
  EXPIRES; #10), running `@supabase/mcp-server-supabase --project-ref=<ref>`. Restart the app after a change (#6);
  WRITE tools need `mcp__supabase-iag` in `.claude\settings.local.json` (#11). When it times out, the Management API
  answers every DERIVE read (GOTCHA #18) — reads only.
- **Jobs:** one pg_cron job, `payment-sweep-daily`, `0 10 * * *` (10:00 UTC = 06:00 Eastern), POSTing `{"action":
  "run_payment_sweep"}` through pg_net with a Vault-read bearer. `nightly-sweep.md`.
- **Deploys:** backend via `scripts/deploy-function.sh`, exactly as CURATED GOTCHAS #5/#13/#15 spells it out; frontend
  via `npm run deploy`, which IS production.
- **Git auth:** HTTPS + Git Credential Manager, per-repo `credential.useHttpPath true` PLUS a global scoped
  `credential.https://github.com/fabot-wealthig.useHttpPath true` — needed because gh-pages publishes from a cache
  clone that ignores repo-local config. (GOTCHA #2)
