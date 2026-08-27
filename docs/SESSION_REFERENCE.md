# IAG PORTAL — SESSION REFERENCE (HUB)

The single always-loaded file: current state, binding invariants, and the map to every other doc.
Read in full at session start. Hard cap: 250 lines. Command output always beats prose.

## DERIVE-AT-START

Run these BEFORE any other work and state the results back. A doc sentence that disagrees with
command output is stale — the command wins.

| # | Command | Expected |
| --- | --- | --- |
| 1 | MCP `supabase-iag` → `list_edge_functions` | `iag-admin-api`, `ACTIVE`, `verify_jwt: false`, version **13** (v: 2026-08-27) |
| 2 | `git tag -l 'live-*' --sort=v:refname` (in `C:\iag-react`) | `live-2-wig-portal` (v: 2026-08-27) |
| 3 | `git tag -l 'backend-good-*' --sort=v:refname` (in `C:\iag-edge-functions`) | `backend-good-2026-08-27-v13` (v: 2026-08-27) |
| 4 | action count — see command below | `14` table entries + 1 direct = **15** actions (v: 2026-08-27) |
| 5 | `deno check --no-lock index.ts` from `supabase\functions\iag-admin-api` | 0 errors |
| 6 | `npm run build` in the frontend worktree | exit code 0 |
| 7 | MCP `supabase-iag` → `get_advisors` type `security` | **zero findings** — green baseline is `"lints": []` |
| 8 | anon-key probe (below) | `Content-Range: */0` on all 6 tables |

**The version is NOT a code-deploy counter.** Supabase bumps the edge function version on every
SECRET add or update too. This function went 1 → 2 → 5 → 11 across only three code deploys in chat
1, then 12 → 13 across two code deploys in chat 2. Treat the version as "what is live right now",
never as "how many times we deployed". See GOTCHA #3.

**Tags (#2, #3)** are stamped post-merge; both names above are the values shipped for chat 2.

**Action count (#4)** — PowerShell-safe, run from anywhere:

```powershell
$p='C:\iag-edge-functions\supabase\functions\iag-admin-api\router\dispatch.ts'
(Select-String -Path $p -Pattern '^\s+"[a-z_]+":' | Measure-Object).Count
```

Expected `14` — that is `PUBLIC_HANDLERS` (2) + `AUTH_HANDLERS` (12). Add `admin_login`, which is
dispatched directly in `index.ts` and is in neither table, for **15 actions total**.

**Anon probe (#8)** — the anon/publishable key must see nothing. For each table in
`admins`, `admin_sessions`, `login_attempts`, `login_setup_tokens`, `members`, `stripe_events`:

```
curl -s -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Prefer: count=exact" -o /dev/null -D - \
  "https://gqznnyccridnpipjipeq.supabase.co/rest/v1/<table>?select=*" | grep -i content-range
```

Expected `Content-Range: */0` on every one (v: 2026-08-27). It MUST be a GET with
`Prefer: count=exact` — a `curl -I` HEAD request answers `*/*` on a locked table and on an open one
alike, so the HEAD form proves nothing. See GOTCHA #7.

## SECURITY INVARIANTS

These four are FINAL. Re-check them on any table, policy, handler, or function change. An
invariant change is a headline, never a quiet edit. **(Confirmed UNCHANGED at chat-2 wrap-up.)**

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

Full numbered list in `docs/GOTCHAS.md` — these three apply to essentially every session:

- **#1** PowerShell 5.1: no `&&`, no `tail`/`head`, `Out-File`/`Set-Content` write BOMs. Chain with
  `;`, use `Get-Content -Tail N`, and write files with the editor tools.
- **#4** CORS `Access-Control-Allow-Headers` is `Content-Type, Authorization` ONLY. The frontend
  must never send an `apikey` header — preflight rejects it. Changing this means editing
  `utils/cors.ts` in the same breath.
- **#5** Backend deploys go through the Supabase **MCP** `deploy_edge_function`, NEVER the
  `supabase` CLI — the machine-wide CLI login belongs to the VFO account and must not be touched.

## DOC MAP

Binding: before editing an area, read the doc named for it.

| Doc | Covers |
| --- | --- |
| `docs/SESSION_REFERENCE.md` | This hub: current state, invariants, doc map. Read in full at session start. |
| `docs/CHANGELOG.md` | Narrative history, newest-first. One change = one entry = one squashed commit. |
| `docs/GOTCHAS.md` | Append-only numbered list of hard-won environment and code traps. Never renumbered. |
| `docs/flows/admin-invite.md` | End-to-end admin invite: Admin Editor → setup link → `/set-password` → login. |
| `docs/prompts/SESSION_STARTER.md` | Pasted by hand by Jake at the start of every chat. |
| `docs/prompts/SESSION_WRAPUP.md` | Pasted by hand when the work is SHIPPING. |
| `iag-portal/README.md` | Frontend repo orientation: live URL, docs pointer, deploy warning. |
| `iag-edge-functions/README.md` | Backend repo orientation: deploy mechanism, type gate, migration convention. |
| `iag-edge-functions/supabase/.env.local.template` | Secret NAMES only. Values live in Supabase function secrets. |

## LIVE STATE

(all v: 2026-08-27)

- **Frontend:** https://portal.wealthig.com — GitHub Pages from the `gh-pages` branch of
  `fabot-wealthig/iag-portal`, custom domain via a Squarespace CNAME `portal` →
  `fabot-wealthig.github.io`. HTTPS cert provisioned, Enforce HTTPS on. `npm run deploy` IS a
  production deploy (vite build + gh-pages).
- **Branding:** the portal is **Wealth IG Portal**, the company **Wealth Innovation Group**. Navy
  `#0F355A`, primary `#1D64A8`, primary-2 `#2E86C7`, sky `#3D9BE0`, orange `#EE6A33` (secondary
  accent: eyebrows, divider pills, superadmin chip). "IAG Portal" survives ONLY as infrastructure
  names — the two repo names, the `iag-admin-api` function slug, the `iag_session` / `iag_redirect`
  sessionStorage keys — plus the two chat-1 test actions (see OWED). Nothing user-facing says it.
- **Frontend shape:** 4 routes — `/` Landing (navy gradient, single Admin card), `/login`
  AdminLogin (split AuthShell), `/portal` Portal (the whole signed-in app, one route), and
  `/set-password`. `/members` redirects to `/portal`. Any emailed path must ALSO be added to
  `ROUTES` in `scripts/emit-route-pages.mjs` (currently `login`, `portal`, `set-password`) or it
  serves a real 404. Styling is VFO-style inline style objects over `--wig-*` CSS variables in
  `src/styles.css`; light + dark palettes, dark mode signed-in only, preference in `localStorage`
  key `wig_theme`. Logo assets live in `src/assets/` (source JPG plus generated transparent full
  lockup and mark-only variants, white and colour) with `public/favicon.png`.
- **Portal UI:** sticky navy header (mark-only logo, notification bell, name, Admin Editor pill for
  superadmins only, Settings, Sign Out) over a tab bar whose single **COI ▾** dropdown holds COI
  Search / COI KPIs / Add COI. Welcome screen shows "Welcome back" + name + three stat cards. COI
  Search is a card-row list with live search, multi-select filter and sort; opening a row gives a
  hero plus a **Profile ▾** pill dropdown (Profile / Edit Profile / Settings). Tab state lives in
  sessionStorage keys `wigActiveTab`, `wigCoiSection`, `wigSelectedCoi`, `wigCoiFeatureTab`, all
  cleared on sign-in, sign-out-to-welcome, and nav.
- **Backend:** edge function `iag-admin-api` v13, ACTIVE, `verify_jwt: false` (auth is custom, in
  the function). Deno 2. Supabase project ref `gqznnyccridnpipjipeq`.
- **Actions (15):** `admin_login` (direct in `index.ts`); public pre-auth `load_login_setup`,
  `submit_login_setup`; authed `ping`, `update_passcode`, `load_admins`, `add_admin`,
  `issue_setup_link`, `delete_admin`, `load_members`, `add_coi`, `update_coi`, `delete_coi`,
  `create_test_checkout`, `admin_test_draft`. The four `*_admin*` / `load_admins` actions are
  **superadmin-only**, enforced by `if (!auth.isSuperadmin) return 403` as the first line of each
  handler — the auth gate proves a session, never a rank.
- **Database:** 6 public tables — `admins`, `admin_sessions`, `login_attempts`,
  `login_setup_tokens`, `members`, `stripe_events`. All RLS-enabled deny-all; anon probe clean;
  security advisor green (zero findings). `members` carries `member_number` (text PK), `first_name`,
  `last_name`, `email` (work), `coi_type` (`Advisor|Accountant`), `status` (`Active|Lost`, default
  `Active`), `personal_email`, `join_date`, `notes`, `stripe_account_id`, `created_at`. `coi_type`
  and `status` are CHECK-constrained; `member_number` and `stripe_account_id` are never writable
  from a payload.
- **Migrations:** 6, all applied via MCP `apply_migration` AND committed as files under
  `supabase/migrations/`. Convention: the remote migration version is the APPLIED-AT timestamp, so
  remote names never match the filenames exactly — match on the migration NAME, not the number.
- **Auth:** custom sessions, 8h, `login_type` `"admin"`. Passcodes PBKDF2 210k, salted, minimum
  length 8 (raised from VFO's 6). Login throttle 5 per identifier + 20 per IP per 15 min.
  Superadmin floor `fabot@wealthig.com` (`constants/superadmin.ts`) — it outranks the
  `admins.is_superadmin` column and can never be deleted. `update_passcode` targets the SESSION's
  admin only and revokes that admin's OTHER sessions on success. New admins are created with a NULL
  passcode plus a 14-day single-use `/set-password` link — see `docs/flows/admin-invite.md`. There
  is deliberately no self-service password reset (see PARKED).
- **Stripe:** the IAG Portal's own new account, entirely separate from VFO. Test-mode AND live-mode
  webhook endpoints both registered against
  `https://gqznnyccridnpipjipeq.supabase.co/functions/v1/iag-admin-api`. `STRIPE_MODE` in
  `utils/stripe.ts` is hardcoded `"sandbox"`; live-mode events are skipped with a logged mode
  mismatch. API calls pin version `2024-06-20`; the webhook endpoints were created at account
  version `2024-04-10`. Proven end to end: a $5.00 test checkout paid with the 4242 card, and both
  `checkout.session.completed` and `payment_intent.succeeded` verified (manual HMAC, constant-time
  compare) and upserted into `stripe_events`. `members.stripe_account_id` exists and is READ by the
  COI Stripe Connect cards, but nothing writes it yet.
- **Gmail:** Google Cloud project "IAG Portal" in the wealthig.com org. Consent screen INTERNAL,
  which is why the refresh token does not expire. OAuth client "IAG Portal Gmail" (Web application,
  redirect URI = OAuth Playground), refresh token minted with scope `gmail.compose`. Proven:
  `admin_test_draft` created a real draft in `fabot@wealthig.com`'s Drafts. Drafts only, never send.
  No production flow sends or drafts mail yet — setup links are copied by hand from the UI.
- **Secrets (NAMES only; values set by Jake in Supabase function secrets):** `STRIPE_SECRET_KEY`,
  `STRIPE_SECRET_KEY_SANDBOX`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET_SANDBOX`,
  `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`.
- **GitHub:** both repos are squash-only — "Squash and merge" is the ONLY enabled merge button
  (merge commits and rebase were disabled after two Phase-1 PRs went in as merge commits).

## OWED

- **Stripe Connect onboarding is UNWIRED.** The COI Profile and Settings panes render a Stripe
  Connect card, but "Send Setup Email" / "Set Up Payment Details" call no API — they surface
  "Email sending isn't wired up yet." Wiring them needs Connect verification (see WATCH) plus a
  Gmail send path.
- **The notification bell is visual-only.** It renders, opens, and always says "No new
  notifications". There is no notifications table, no action, and no polling.
- **Two chat-1 test actions still say "IAG Portal" in outbound content:** the `admin_test_draft`
  Gmail subject/body and the `create_test_checkout` Stripe product name. Both are test-only and
  admin-triggered, but both are technically user-visible. Decide: rename (needs a deploy) or delete
  the test actions once they have served their purpose.
- **Click-through confirmation of the write paths.** `add_coi`, `update_coi`, `delete_coi`,
  `add_admin`, `issue_setup_link`, `delete_admin` and `update_passcode` were verified by type gate,
  deploy smoke (all fail closed with 401 unauthenticated) and code review — not yet by Jake
  exercising each one in the live UI.

## WATCH

- **Stripe Connect platform verification is PENDING** a Stripe admin review. Connect is enabled on
  the account, but nothing Connect-dependent can be built until that review clears — which is
  exactly what blocks the OWED Stripe Connect wiring.
- **The `STRIPE_MODE` flip to live is a deliberate later decision**, not a chore. It is a constant
  in `utils/stripe.ts`, and the live-mode webhook endpoint is already registered and waiting — so
  flipping the constant is the whole switch, and it goes live the moment it deploys.
- **`admin_sessions` has no cleanup sweep.** Expired rows are deleted only when that session is
  presented, or wholesale for one admin by `update_passcode` / `delete_admin`. Rows for sessions
  that are never used again accumulate indefinitely.

## PARKED

- **Self-service password reset** — deliberately absent, matching VFO, where admins are excluded
  from the forgot-password flow by design. An admin who loses their passcode gets a fresh
  `/set-password` link from a superadmin in the Admin Editor.
- Gmail **attachments** — VFO has this; deliberately dropped from IAG for now.
- **Sentry** or any error-reporting service.
- **Scripted smoke gate** — the `<SMOKE_GATE>` placeholder in `SESSION_WRAPUP.md` Part 2.
- **`stripe_events` secondary indexes** — not needed at current volume.
- **DB-driven sandbox toggle** — would replace the hardcoded `STRIPE_MODE` constant.
- **Per-admin permission tiers.** VFO has `allowed_tabs`; IAG has exactly two ranks, superadmin and
  admin, and no tab gating.

## ENVIRONMENT

- **OS / shell:** Windows 11, PowerShell 5.1 — no `&&` chaining, no `tail`, and `Out-File` writes
  BOMs. Prefer editor tools for file writes and separate commands for chaining. (GOTCHA #1)
- **Toolchain:** Node v24.14.0 · Deno 2.7.14 · Supabase CLI 2.78.1 · git 2.53.0 · gh CLI NOT installed.
- **Repos:** `fabot-wealthig/iag-portal` (public, frontend) and `fabot-wealthig/iag-edge-functions`
  (private, backend). Local checkouts `C:\iag-react` and `C:\iag-edge-functions`.
- **MCP:** project-scoped server `supabase-iag` configured in `C:\iag-edge-functions\.mcp.json`
  (gitignored — it carries the PAT), running `@supabase/mcp-server-supabase` with
  `--project-ref=gqznnyccridnpipjipeq`. Changes to `.mcp.json` need an app restart to load, and may
  need two if npx still has to download the package. (GOTCHA #6)
- **Deploys:** backend via MCP `deploy_edge_function` ONLY — never the supabase CLI. (GOTCHA #5)
- **Git auth:** HTTPS + Git Credential Manager, per-repo `credential.useHttpPath true` PLUS a global
  scoped `credential.https://github.com/fabot-wealthig.useHttpPath true`. The global one is required
  because gh-pages publishes from its own cache clone under `node_modules/.cache/gh-pages`, which
  ignores repo-local config. (GOTCHA #2)
