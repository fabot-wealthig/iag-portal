# IAG PORTAL — SESSION REFERENCE (HUB)

The single always-loaded file: current state, binding invariants, and the map to every other doc.
Read in full at session start. Hard cap: 250 lines. Command output always beats prose.

## DERIVE-AT-START

Run these BEFORE any other work and state the results back. A doc sentence that disagrees with
command output is stale — the command wins.

| # | Command | Expected |
| --- | --- | --- |
| 1 | MCP `supabase-iag` → `list_edge_functions` | `iag-admin-api`, `ACTIVE`, `verify_jwt: false`, version **16** (v: 2026-09-02) |
| 2 | `git tag -l 'live-*' --sort=v:refname` (in `C:\iag-react`) | `live-3-revshare-foundation` (v: 2026-08-28) |
| 3 | `git tag -l 'backend-good-*' --sort=v:refname` (in `C:\iag-edge-functions`) | `backend-good-2026-08-28-v15` (v: 2026-08-28) |
| 4 | action count — see command below | `28` table entries + 1 direct = **29** actions (v: 2026-09-02) |
| 5 | `deno check --no-lock index.ts` from `supabase\functions\iag-admin-api` | 0 errors (v: 2026-09-02) |
| 6 | `npm run build` in the frontend worktree | exit code 0 (v: 2026-09-02) |
| 7 | MCP `supabase-iag` → `get_advisors` type `security` | **zero findings** — green baseline is `"lints": []` (v: 2026-09-02) |
| 8 | anon-key probe (below) | `Content-Range: */0` on all 12 tables (v: 2026-09-02) |

**The version is NOT a code-deploy counter** — Supabase bumps it on every SECRET change too; it means
"what is live right now" (GOTCHA #3). **Tags (#2, #3)** are stamped post-merge, at chat-3 values.

**Action count (#4)** — PowerShell-safe, run from anywhere:

```powershell
$p='C:\iag-edge-functions\supabase\functions\iag-admin-api\router\dispatch.ts'
(Select-String -Path $p -Pattern '^\s+"[a-z_]+":' | Measure-Object).Count
```

Expected `28` — that is `PUBLIC_HANDLERS` (3) + `AUTH_HANDLERS` (25). Add `admin_login`, which is
dispatched directly in `index.ts` and is in neither table, for **29 actions total**.

**Anon probe (#8)** — the anon key must see nothing. For each of the 12 tables (LIVE STATE → Database):

```
curl -s -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Prefer: count=exact" -o /dev/null -D - \
  "https://gqznnyccridnpipjipeq.supabase.co/rest/v1/<table>?select=*" | grep -i content-range
```

Expected `Content-Range: */0` on every one (v: 2026-09-02). It MUST be a GET with
`Prefer: count=exact` — `curl -I` answers `*/*` on locked and open tables alike. GOTCHA #7.

## SECURITY INVARIANTS

These four are FINAL. Re-check them on any table, policy, handler, or function change. An
invariant change is a headline, never a quiet edit. **(Confirmed UNCHANGED at chat-3 wrap-up.)**

1. **RLS in the same migration.** Every public table ships with RLS enabled AND a deny-all policy
   created in the SAME migration that creates the table. Verified by an anon-key probe that must
   come back `Content-Range: */0`.
2. **Ownership is re-checked from the session.** The edge function runs as service-role and
   therefore bypasses RLS. Every member-facing handler re-checks ownership from the SESSION,
   never from an id supplied in the request body.
3. **SECURITY DEFINER is pinned and locked down.** Every SECURITY DEFINER function pins
   `search_path` and revokes EXECUTE from `public`.
4. **Advisor after every DB change.** After ANY database change, run the security advisor
   (MCP `get_advisors`, type `security`) and reconcile the result against the documented green
   baseline. Any new anon-reachable-table finding is a STOP.

## CURATED GOTCHAS (always applies)

Full numbered list in `docs/GOTCHAS.md` — these four apply to essentially every session:

- **#1** PowerShell 5.1: no `&&`, no `tail`/`head`, `Out-File`/`Set-Content` write BOMs. Chain with
  `;`, use `Get-Content -Tail N`, and write files with the editor tools.
- **#4** CORS `Access-Control-Allow-Headers` is `Content-Type, Authorization` ONLY. The frontend
  must never send an `apikey` header — preflight rejects it. Changing this means editing
  `utils/cors.ts` in the same breath.
- **#5/#13** Backend deploys run `bash scripts/deploy-function.sh` (multipart upload to the Supabase
  Management API). NEVER the `supabase` CLI — its machine-wide login belongs to VFO. MCP
  `deploy_edge_function` no longer fits: it needs every file inline in one call, impossible at 47
  files. Never split an upload either — it replaces the WHOLE function.
- **#12** NEVER answer 401 for a server-side failure. `lib/api.js` treats any 401 as a dead session
  and signs the admin out — a DB/network error must be a 500, and only a bad credential a 401.

## DOC MAP

Binding: before editing an area, read the doc named for it.

| Doc | Covers |
| --- | --- |
| `docs/SESSION_REFERENCE.md` | This hub: current state, invariants, doc map. Read in full at session start. |
| `docs/CHANGELOG.md` | Narrative history, newest-first. One change = one entry = one squashed commit. |
| `docs/GOTCHAS.md` | Append-only numbered list of hard-won environment and code traps. Never renumbered. |
| `docs/flows/admin-invite.md` | End-to-end admin invite: Admin Editor → setup link → `/set-password` → login. |
| `docs/flows/coi-connect-setup.md` | End-to-end COI payouts: Connect account → emailed link → `/payout-setup` → Stripe → status. |
| `docs/prompts/SESSION_STARTER.md` | Pasted by hand by Jake at the start of every chat. |
| `docs/prompts/SESSION_WRAPUP.md` | Pasted by hand when the work is SHIPPING. |
| `iag-portal/README.md` | Frontend repo orientation: live URL, docs pointer, deploy warning. |
| `iag-edge-functions/README.md` | Backend repo orientation: deploy mechanism, type gate, migration convention. |
| `iag-edge-functions/supabase/.env.local.template` | Secret NAMES only. Values live in Supabase function secrets. |

## LIVE STATE

(v: 2026-09-02 where touched this session; everything else v: 2026-08-28 or earlier)

- **Frontend:** https://portal.wealthig.com — GitHub Pages from the `gh-pages` branch of
  `fabot-wealthig/iag-portal`, custom domain via a Squarespace CNAME `portal` →
  `fabot-wealthig.github.io`. HTTPS enforced. `npm run deploy` IS a production deploy.
- **Branding:** the portal is **Wealth IG Portal**, the company **Wealth Innovation Group**. Navy
  `#0F355A`, primary `#1D64A8`, primary-2 `#2E86C7`, sky `#3D9BE0`, orange `#EE6A33` (eyebrows,
  divider pills, superadmin chip). "IAG Portal" survives ONLY as infrastructure names — repos, the
  `iag-admin-api` slug, `iag_session` / `iag_redirect` — plus two chat-1 test actions (see OWED).
- **Frontend shape:** 5 routes — `/` Landing, `/login`, `/portal` (the whole signed-in app, one
  route), `/set-password`, `/payout-setup` (public, no session — the COI Connect link); `/members`
  redirects to `/portal`. Any emailed path must ALSO go in `ROUTES` in `scripts/emit-route-pages.mjs`
  — 4 entries: `login`, `portal`, `set-password`, `payout-setup` — or it serves a real 404.
  `/payout-setup` goes live at the NEXT `npm run deploy`; until then an emailed link 404s. Styling is
  inline style objects over `--wig-*` in `src/styles.css`; dark mode signed-in only (`wig_theme`).
- **Portal UI:** sticky navy header (mark-only logo, bell, name, Admin Editor pill for superadmins,
  Settings, Sign Out) over a tab bar. **COI ▾** holds two hover flyouts — **COI ▸** and
  **Mothership ▸**, each Search / KPIs / Add. Right of a divider, five muted secondary tabs gated
  per admin by `admins.allowed_tabs`: COI Overview, Client Overview, Tax Strategies, **Automation &
  Config ▾** (Email Templates / Notification Editor), **Accounting ▾** (Payments). Superadmins see
  all five; a grant takes effect only at the grantee's NEXT LOGIN, because `allowed_tabs` is baked
  into the session at `admin_login`. Under 1180px the secondary group collapses to **More ▾** and the
  COI flyouts render flat. COI Search rows open a hero + **Profile ▾** (Profile / Edit Profile /
  Settings) + a **Clients** pill; opening a client REPLACES the COI hero and strip with the client's
  own. Profile and Settings both carry the **Stripe Connect card** — account id, status pill,
  Refresh, Send/Resend; status is read live from Stripe on open / COI switch / Refresh / after a
  send, NO polling. Live: Tax Strategies (editable rules) and Email Templates (one seeded row). COI
  Overview, Client Overview, Notification Editor, Accounting → Payments are placeholders.
  sessionStorage: `wigActiveTab`, `wigCoiSection`, `wigSelectedCoi`, `wigCoiFeatureTab`,
  `wigAutomationSection`, `wigAccountingSection`, `wigSelectedMothership`, `wigCoiReturnTo` — all
  cleared on sign-in, sign-out-to-welcome and nav; the last two survive only the mothership→COI
  round trip, re-written after the nav clear.
- **Standing UI rules (permanent — Jake):** (1) the hero is flush at the top and the "← Back to …"
  link sits UNDER it, above any tab strip (`BackLink` in `TrackKit`); (2) a name is a link ONLY where
  it is a shortcut — rows that already navigate on click keep plain names (`NameLink`); (3)
  interaction mechanics copy the VFO portal exactly where one exists, hover timing included.
- **Backend:** edge function `iag-admin-api` v16, ACTIVE, `verify_jwt: false` (auth is custom, in
  the function). Deno 2. Supabase project ref `gqznnyccridnpipjipeq`. 47 `.ts` files, ~155 KB.
- **Actions (29):** `admin_login` (direct in `index.ts`); public pre-auth `load_login_setup`,
  `submit_login_setup`, `connect_setup_link`; authed `ping`, `update_passcode`, `load_admins`,
  `add_admin`, `issue_setup_link`, `delete_admin`, `admin_update_tabs`, `load_members`, `add_coi`,
  `update_coi`, `delete_coi`, `coi_stripe_connect_request`, `coi_connect_status`, `load_motherships`,
  `add_mothership`, `load_clients`, `add_client`, `update_client`, `delete_client`, `load_strategies`,
  `save_strategy`, `load_email_templates`, `save_email_template`, `create_test_checkout`,
  `admin_test_draft`. `*_admin*` / `load_admins` are **superadmin-only** — an `auth.isSuperadmin` 403
  as the handler's first line, because the auth gate proves a session, never a rank.
- **Database:** 12 public tables — `admins`, `admin_sessions`, `login_attempts`,
  `login_setup_tokens`, `members`, `stripe_events`, `motherships`, `clients`, `client_payments`,
  `strategies`, `email_templates`, `connect_setup_tokens`. All RLS-enabled deny-all; anon probe
  clean; advisor green. `members` carries `member_number` (PK), `mothership_number`, `coi_level`
  (0-4), names, `email`, `coi_type` (`Advisor|Accountant|Other`), `status` (`Active|Lost`),
  `personal_email`, `join_date`, `notes`, `stripe_account_id`, `connect_setup_email_sent_at`,
  `created_at`; `admins` has `allowed_tabs text[]` default `'{}'`. `coi_type`, `status`, `coi_level`
  are CHECK-constrained; `member_number`, `stripe_account_id` and `connect_setup_email_sent_at` are
  never payload-writable — `update_coi` must never touch the last two. `email_templates` holds ONE
  row: `COI_PAYOUT` / `coi_connect_setup` (draft mode, active).
- **Numbering:** COI `member_number` is **M.T.NNNN with DOTS** — mothership, type digit
  (1 Accountant/CPA, 2 Advisor, 3 Other), then a GLOBAL zero-padded 4-digit sequence; `9999` is the
  reserved test slot the allocator skips. Dashes on input normalise to dots (`utils/coi-number.ts`),
  because the dash separates a CLIENT number: `{coi}-NNN` (`1.1.0007-001`). Mothership and type are
  IMMUTABLE — baked into the number, and `update_coi` refuses either; `coi_level` is editable.
- **Revenue share:** `motherships` (number PK, ERT = 1) is the firm a COI sits under. `strategies`
  holds editable rule sets, so tuning the waterfall never needs a deploy; **LEOS** is seeded — admin
  fee 1.5% of the client's offset, $7,500 flat legal letter, ERT processing 10% if the COI's
  mothership is ERT else 5%, then the COI's level share of the rest (0/20/30/40/50% for levels 0-4),
  balance retained by WIG. `client_payments` holds the whole pipeline shape; nothing writes it yet.
- **Migrations:** 13, all applied via MCP `apply_migration` AND committed as files under
  `supabase/migrations/`. The remote version is the APPLIED-AT timestamp, so remote names never
  match filenames exactly — reconcile on the migration NAME, not the number.
- **Auth:** custom sessions, 8h, `login_type` `"admin"`. Passcodes PBKDF2 210k, salted, min length 8
  (VFO's is 6). Throttle 5 per identifier + 20 per IP per 15 min. Superadmin floor
  `fabot@wealthig.com` (`constants/superadmin.ts`) outranks the `admins.is_superadmin` column and
  can never be deleted. `update_passcode` targets the SESSION's admin only and revokes that admin's
  OTHER sessions. New admins get a NULL passcode plus a 14-day single-use `/set-password` link —
  `docs/flows/admin-invite.md`; no self-service reset (PARKED). `middleware/auth.ts` distinguishes
  **401 from 500**: a bad/expired/missing credential is 401, a FAILED DB read is 500, because the
  frontend signs the admin out on any 401 (GOTCHA #12). Every 401 logs its reason; tokens never are.
- **Stripe:** the IAG Portal's own account, entirely separate from VFO. Test-mode AND live-mode
  webhook endpoints both registered against
  `https://gqznnyccridnpipjipeq.supabase.co/functions/v1/iag-admin-api`. `STRIPE_MODE` in
  `utils/stripe.ts` is hardcoded `"sandbox"`; live-mode events are skipped with a logged mode
  mismatch. API calls pin `2024-06-20`; the endpoints were created at account version `2024-04-10`.
  Checkout + both webhooks (manual HMAC, constant-time compare → `stripe_events`) are proven end to
  end, and so is **Connect in sandbox**: `coi_stripe_connect_request` creates EXPRESS accounts (US,
  transfers requested) and is the ONLY writer of `members.stripe_account_id`; `coi_connect_status`
  reads status live and never stores it. `docs/flows/coi-connect-setup.md`.
- **Gmail:** Google Cloud project "IAG Portal" in the wealthig.com org. Consent screen INTERNAL,
  which is why the refresh token does not expire. OAuth client "IAG Portal Gmail" (Web app, redirect
  URI = OAuth Playground), scope `gmail.compose`. **Drafts only — no send path exists.** The COI
  Connect setup email is the first production draft flow; `/set-password` links are copied by hand.
- **Secrets (NAMES only; values set by Jake in Supabase function secrets):** `STRIPE_SECRET_KEY`,
  `STRIPE_SECRET_KEY_SANDBOX`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET_SANDBOX`,
  `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`.
- **GitHub:** both repos are squash-only — "Squash and merge" is the ONLY enabled merge button
  (merge commits and rebase were disabled after two Phase-1 PRs went in as merge commits).

## OWED

- **`email_templates` has ONE row.** `coi_connect_setup` is seeded and live; every other pipeline's
  subjects and bodies still need Jake's approval in chat before seeding.
- **Four placeholder panels** — COI Overview, Client Overview, Notification Editor, Accounting →
  Payments — render a hero and a "coming soon" card only; they fill in with the payment phases. So
  does **`client_payments`**: table and waterfall shape live, but nothing writes it until Phase C.
- **VFO carries the same auth bug we just fixed** — `vfo-admin-api/middleware/auth.ts` ignores the
  error on all SIX identity queries. Worth a ticket on that repo; not ours to fix from an IAG chat.
- **The notification bell is visual-only** — always "No new notifications". No table, action or poll.
- **Two chat-1 test actions still say "IAG Portal" in outbound content:** the `admin_test_draft`
  Gmail subject/body and the `create_test_checkout` Stripe product name — test-only and
  admin-triggered, but user-visible. Decide: rename (needs a deploy) or delete them.
- **Click-through confirmation of the ADMIN write paths.** `add_admin`, `issue_setup_link`,
  `delete_admin`, `update_passcode` — verified by type gate, deploy smoke and code review, not by
  Jake in the live UI. (COI writes exercised live 2026-08-28 and 2026-09-02 — discharged.)

## WATCH

- **Stripe Connect platform review is still PENDING.** Sandbox is fully proven — accounts created,
  hosted onboarding completed, status `complete` — so the build is NOT blocked. Only LIVE mode is:
  real COI onboarding needs both the review to clear AND the deliberate `STRIPE_MODE` flip below.
- **The `STRIPE_MODE` flip to live is a deliberate later decision**, not a chore. It is a constant
  in `utils/stripe.ts` and the live webhook endpoint is registered and waiting, so flipping the
  constant is the whole switch — and it goes live the moment it deploys.
- **`admin_sessions` has no cleanup sweep.** Expired rows are deleted only when that session is
  presented, or per-admin by `update_passcode` / `delete_admin`; unused rows accumulate forever.
- **The Supabase MCP PAT EXPIRES.** It lives in `C:\iag-edge-functions\.mcp.json` (gitignored); the
  first was a 7-day default and died mid-project, taking every MCP tool down at once. Regenerate at
  supabase.com/dashboard/account/tokens, then restart the app. (GOTCHA #10)

## PARKED

- **Self-service password reset** — deliberately absent, matching VFO, where admins are excluded by
  design. A locked-out admin gets a fresh `/set-password` link from a superadmin.
- Gmail **attachments** — VFO has this; deliberately dropped from IAG for now.
- **Sentry** or any error-reporting service.
- **Scripted smoke gate** — the `<SMOKE_GATE>` placeholder in `SESSION_WRAPUP.md` Part 2.
- **`stripe_events` secondary indexes** — not needed at current volume.
- **DB-driven sandbox toggle** — would replace the hardcoded `STRIPE_MODE` constant.

## ENVIRONMENT

- **OS / shell:** Windows 11, PowerShell 5.1 — no `&&` chaining, no `tail`, and `Out-File` writes
  BOMs. Prefer editor tools for file writes and separate commands for chaining. (GOTCHA #1)
- **Toolchain:** Node v24.14.0 · Deno 2.7.14 · Supabase CLI 2.78.1 · git 2.53.0 · gh CLI NOT installed.
- **Repos:** `fabot-wealthig/iag-portal` (public, frontend) and `iag-edge-functions` (private,
  backend); local checkouts `C:\iag-react` and `C:\iag-edge-functions`.
- **MCP:** project-scoped server `supabase-iag` in `C:\iag-edge-functions\.mcp.json` (gitignored —
  carries the PAT, which EXPIRES; GOTCHA #10), running `@supabase/mcp-server-supabase` with
  `--project-ref=gqznnyccridnpipjipeq`. Changes need an app restart, sometimes two (GOTCHA #6). MCP
  WRITE tools also need `mcp__supabase-iag` allowlisted in `.claude\settings.local.json` (#11).
- **Deploys:** backend via `bash scripts/deploy-function.sh` (Management API multipart upload, token
  read from `.mcp.json`). The MCP tool no longer fits; the CLI is still forbidden. (GOTCHAS #5, #13)
- **Git auth:** HTTPS + Git Credential Manager, per-repo `credential.useHttpPath true` PLUS a global
  scoped `credential.https://github.com/fabot-wealthig.useHttpPath true` — the global one is needed
  because gh-pages publishes from a cache clone that ignores repo-local config. (GOTCHA #2)
