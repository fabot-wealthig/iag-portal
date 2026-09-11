# IAG PORTAL — SESSION REFERENCE (HUB)

The single always-loaded file: current state, binding invariants, and the map to every other doc. Read in full at session
start; before editing an area, read the doc DOC MAP names for it. **Hard cap: 250 lines.** Command output always beats
prose; a fact carries `(v: date)` when it was last verified.

## DERIVE-AT-START

Run these BEFORE any other work and state the results back. A doc sentence that disagrees with command output is stale —
the command wins.

| # | Command | Expected |
| --- | --- | --- |
| 1 | MCP `supabase-iag` → `list_edge_functions` | `iag-admin-api`, `ACTIVE`, `verify_jwt: false`, version **43** (v: 2026-09-11) |
| 2 | `git tag -l 'live-*' --sort=v:refname` (in `C:\iag-react`) | `live-11-provider-receipts` (v: 2026-09-11) |
| 3 | `git tag -l 'backend-good-*' --sort=v:refname` (in `C:\iag-edge-functions`) | `backend-good-2026-09-11-v43` (v: 2026-09-11) |
| 4 | action count — see command below | `49` table entries + 1 direct = **50** actions (v: 2026-09-11) |
| 5 | `deno check --no-lock index.ts` from `supabase\functions\iag-admin-api` | 0 errors (v: 2026-09-11) |
| 6 | `npm run build` in the frontend worktree | exit code 0 (v: 2026-09-11) |
| 7 | MCP `supabase-iag` → `get_advisors` type `security` | **zero findings** — green baseline is `"lints": []` (v: 2026-09-11) |
| 8 | anon-key probe (below) | `Content-Range: */0` on all 17 tables (v: 2026-09-11, all 17 re-run) |

**The version is NOT a code-deploy counter** — Supabase bumps it on every SECRET change too; it means "what is live right
now" (GOTCHA #3). **Tags (#2, #3)** are stamped post-merge, at chat-11 values.

**Action count (#4)** — with `$p` = the backend's `router\dispatch.ts`, `(Select-String -Path $p -Pattern
'^\s+"[a-z_]+":' | Measure-Object).Count`. Expected `49` = `PUBLIC_HANDLERS` (6) + `AUTH_HANDLERS` (43), plus
`admin_login` (direct in `index.ts`, in neither table) = **50 total**.

**Anon probe (#8)** — the anon key must see NOTHING. GET each of the 17 tables at `…supabase.co/rest/v1/<table>?select=*`,
the key as BOTH `apikey` and `Authorization: Bearer`, plus `Prefer: count=exact`; expect `*/0` on all 17. Never `curl -I` (#7).

## SECURITY INVARIANTS

These four are FINAL. Re-check them on any table, policy, handler, or function change. An invariant change is a headline,
never a quiet edit. **(Confirmed UNCHANGED by chat 11's `provider_receipts` migration: advisor green, anon probe `*/0`.)**

1. **RLS in the same migration.** Every public table ships with RLS enabled AND a deny-all policy created in the SAME
   migration that creates the table, verified by an anon probe of `*/0`.
2. **Ownership is re-checked from the session.** The edge function runs as service-role and so bypasses RLS. Every
   member-facing handler re-checks ownership from the SESSION, never from an id supplied in the request body.
3. **SECURITY DEFINER is pinned and locked down.** Every SECURITY DEFINER function pins `search_path` and revokes EXECUTE
   from `public`.
4. **Advisor after every DB change.** Run MCP `get_advisors` type `security` and reconcile against the documented green
   baseline. Any new anon-reachable-table finding is a STOP.

## CURATED GOTCHAS (always applies)

Full numbered list in `docs/GOTCHAS.md` — these five apply to essentially every session:

- **#1** PowerShell 5.1: no `&&`, no `tail`/`head`, `Out-File`/`Set-Content` write BOMs. Chain with `;`, use `Get-Content
  -Tail N`, and write files with the editor tools.
- **#4** CORS `Access-Control-Allow-Headers` is `Content-Type, Authorization` ONLY — the frontend must never send an
  `apikey` header; changing it means editing `utils/cors.ts` in the same breath.
- **#5/#13/#15/#24** Backend deploys run `scripts/deploy-function.sh` (multipart upload to the Management API), and HOW to
  invoke it depends on the CALLER: from a real PowerShell console `& "$HOME\scoop\apps\git\current\usr\bin\bash.exe"
  scripts/deploy-function.sh` (a bare `bash` there is the WSL relay stub, #15); **from a Claude session the Bash tool**,
  `bash scripts/deploy-function.sh` — Claude's PowerShell tool runs that binary with no coreutils on its PATH, which looks
  like `dirname: command not found` (#24). NEVER the `supabase` CLI (its login belongs to VFO); MCP `deploy_edge_function`
  no longer fits; never split an upload — it replaces the WHOLE function.
- **#12** NEVER answer 401 for a server-side failure. `lib/api.js` treats any 401 as a dead session and signs the admin
  out — a DB/network error must be a 500, and only a bad credential a 401.
- **#22** A Stripe `Idempotency-Key` is scoped to the ATTEMPT, never the entity. Stripe replays the FIRST response it saw
  under a key for 24h — a REFUSAL included — so a key held any wider makes a transient failure permanent.

## DOC MAP

| Doc | Covers |
| --- | --- |
| `docs/SESSION_REFERENCE.md` | This hub: current state, invariants, doc map. Read in full at session start. |
| `docs/CHANGELOG.md` | Narrative history, newest-first. One change = one entry = one squashed commit. |
| `docs/GOTCHAS.md` | Append-only numbered list of hard-won environment and code traps. Never renumbered. |
| `docs/flows/admin-invite.md` | End-to-end admin invite: Admin Editor → setup link → `/set-password` → login. |
| `docs/flows/coi-connect-setup.md` | End-to-end COI payouts: Connect account → emailed link → `/payout-setup` → Stripe → status. |
| `docs/flows/client-payment-request.md` | End-to-end client fee (LEOS): request form → `/pay` → Stripe Checkout → webhook booking → confirmation → invoice and receipt → COI revenue share → the detail screen. |
| `docs/flows/provider-receipts.md` | One lump sum from Boxhouse / SRA / DCD: the Tax Strategies form, the sum rule, rows born received, the per-row people and shares, the receipts list and detail, the ERT tick. |
| `docs/flows/nightly-sweep.md` | The nightly `run_payment_sweep`: the bearer gate, the seven legs and their latches, the two 2-business-day reminders, housekeeping retention, the pg_cron job and dry runs. |
| `docs/flows/notifications.md` | The bell: the two tables, the fan-out audience, the seven events and where each fires, dedupe, the five actions, the 30s poll, the editor, the deep link. |
| `docs/integrations/sentry.md` | Frontend error monitoring: what is wired, why PROD-only, no replay, and the empty DSN. |
| `docs/prompts/` | `SESSION_STARTER.md` (pasted at the start of every chat) and `SESSION_WRAPUP.md` (pasted when the work is SHIPPING). |
| Both `README.md`s | Repo orientation — frontend: live URL, docs pointer, deploy warning; backend: deploy mechanism, type gate, migration convention. Its `supabase/.env.local.template` carries secret NAMES only; values live in Supabase function secrets. |

## LIVE STATE

- **Frontend:** https://portal.wealthig.com — GitHub Pages from the `gh-pages` branch of `fabot-wealthig/iag-portal`,
  custom domain via a Squarespace CNAME `portal` → `fabot-wealthig.github.io`, HTTPS enforced; `npm run deploy` IS
  production. The portal is **Wealth IG Portal**, the company **Wealth Innovation Group**; the palette is the `--wig-*`
  tokens in `src/styles.css`, orange carrying every alert. "IAG Portal" survives ONLY as infrastructure names.
- **Frontend shape (v: 2026-09-02):** 6 routes — `/` Landing, `/login`, `/portal` (the whole signed-in app, one route),
  `/set-password`, plus two public session-less token pages, `/payout-setup` (COI Connect) and `/pay` (client fee);
  `/members` → `/portal`. Any emailed path must ALSO be in `ROUTES` in `scripts/emit-route-pages.mjs` — 5 entries — or it
  404s on a client holding an emailed link. Inline style objects over `--wig-*`; dark mode signed-in only (`wig_theme`).
- **Portal UI (v: 2026-09-11):** a sticky navy header (logo, bell, name, Admin Editor pill for superadmins, Settings, Sign
  Out) over a tab bar: **COI ▾** with hover flyouts, then five muted tabs gated by `admins.allowed_tabs` — COI Overview,
  Client Overview, Tax Strategies, **Automation & Config ▾**, **Accounting ▾**. Superadmins see all five; a grant lands at the
  grantee's NEXT LOGIN, `allowed_tabs` being session-baked at `admin_login`; under 1180px the secondary group collapses to
  **More ▾**. Each drill-in REPLACES the header above it — COI → its clients → a client → its payments → `PaymentDetail`,
  whose **Notifications** card (tax planner + recipient chips, EVERY admin) sits between Progress and Details and which every
  raising form asks up front, pre-selecting NOBODY. An orange **Sandbox** chip marks a test payment and a test COI; the bell
  polls every 30s. **Overview rows are a work queue**: the whole row opens its payment, both NAMES staying links because each
  is a shortcut PAST that destination (rule 2); **Next action** is the first outstanding step's `action`, NEVER its `label`,
  orange with an **Admin** chip when an admin owes it, "Nothing outstanding" when nothing does, and a **Needs admin action**
  toggle narrows to those rows. A visit that deep-links PAST the COI — from `coi_overview`, `client_overview`, `accounting` or
  `tax_strategies`, never `mothership_search` — gets its ORIGIN's back link as the FIRST one it sees. **Tax Strategies renders
  each strategy BY ITS `model`**, each with an **ERT callout** naming who pays an ERT-affiliated COI on it, and **EVERY
  payment now STARTS there**, "Start payment" beside each active strategy (the client's Payments tab is tracking only): a
  provider strategy opens the **receipt form** (the lump-sum total FIRST, then one line per client, over a green/red Allocated
  / Remaining line and a 90 s submit), LEOS the old request form with a client picker as question 1. Each provider card lists
  its **Receipts**; a receipt opens the split as it settled, the ONE action control in a row being a `Via ERT` line's "Paid by
  ERT" checkbox — it IS that row's Share status until ticked, then a green chip, unticking staying on the payment detail. A
  provider record's detail hides the client fee, the documents and every email action, shows THREE progress steps and carries
  a **View receipt** link; the grids read **Basis / Amount** (expected until received). sessionStorage holds the screen —
  **twelve** `wig*` keys, `wigStrategyScreen` the newest, listed TWICE (#21).
- **Standing UI rules (permanent — Jake):** (1) the hero is flush at the top and the "← Back to …" link sits UNDER it, above
  any tab strip (`BackLink` and `Field` live in `TrackKit`); (2) a name is a link ONLY where it is a shortcut — plain where
  the row's own click goes to the same place, a link where it goes PAST it (`NameLink`, which stops the click propagating);
  (3) interaction mechanics copy the VFO portal exactly, hover timing included; (4) grid screens are auto-layout tables that
  fit the 1180px panel without horizontal scroll, every column left-aligned, no action controls in list rows — **ONE exception
  (2026-09-10): the "Paid by ERT" tick on a receipt's `Via ERT` row** — every data wait a skeleton; (5) a browser refresh on
  ANY signed-in screen lands on exactly that screen, all nav state being in sessionStorage; (6) a step whose amount is NOT YET
  CALCULATED is greyed and unclickable ("Pending calculation"), except the entry step that supplies the figure.
- **Backend (v: 2026-09-11):** `iag-admin-api` **v43**, ACTIVE, `verify_jwt: false` (custom auth, in the function). Deno
  2. Project ref `gqznnyccridnpipjipeq`. 86 `.ts` files, ~677 KB, 50 actions. Smoke gate `scripts/smoke.ps1`: TWELVE
  read-only loaders, one per area, asserting 200 and no top-level `error` against the version SHIPPED (12/12 PASS on v43).
- **Actions (50, v: 2026-09-11):** `admin_login` (direct in `index.ts`); public pre-auth `load_login_setup`,
  `submit_login_setup`, `connect_setup_link`, `load_pay_link`, `pay_link_checkout`, `run_payment_sweep` (bearer-gated: its 401
  is a bad credential, not a #12 breach); authed `ping`, `update_passcode`, `load_admins`, `load_admin_directory`,
  `add_admin`, `issue_setup_link`, `delete_admin`, `admin_update_tabs`, `load_members`, `add_coi`, `update_coi`, `delete_coi`,
  `coi_stripe_connect_request`, `coi_connect_status`, `load_motherships`, `add_mothership`, `load_clients`, `add_client`,
  `update_client`, `delete_client`, `start_client_payment`, `load_client_payments`, `load_client_payment`,
  `update_payment_step`, `create_provider_receipt`, `load_provider_receipts`, `load_provider_receipt`,
  `set_payment_tax_planner`, `update_payment_recipient`, `resend_payment_email`, `retry_revenue_share`, `load_all_payments`,
  `load_client_overview`, `load_coi_overview`, `load_strategies`, `save_strategy`, `load_email_templates`,
  `save_email_template`, `load_notifications`, `mark_notification_read`, `mark_all_notifications_read`,
  `load_notification_rules`, `save_notification_rule`. `*_admin*` actions are **superadmin-only** (an `auth.isSuperadmin` 403
  first: the gate proves a session, not a rank), EXCEPT `load_admin_directory` — email+name, every admin, since any admin
  assigns planners and recipients. **`create_provider_receipt` is the WHOLE provider-funded pipeline**: one lump sum plus 1–50
  client rows whose amounts must SUM to it (half a cent of tolerance, else 400), each row BORN RECEIVED — so there is no
  clearing action any more — then per row the bell and `runRevenueShare` in process. A refused transfer is a 200 carrying that
  row's `error`; a timeout self-heals via sweep leg A. `update_payment_step` ticks FOUR whitelisted steps (three hard costs
  plus `ert_share`), COSMETIC: nothing reads them. **Every step carries BOTH a `label`** (the STATE, for the progress list)
  **and an `action`** (the WORK OUTSTANDING, which `summarizePayment` gives the overviews as `next_action`) — neither derived
  from the other, so both are edited together.
- **Database (v: 2026-09-11):** 17 public tables — `admins`, `admin_sessions`, `login_attempts`, `login_setup_tokens`,
  `members`, `stripe_events`, `motherships`, `clients`, `client_payments`, `provider_receipts`, `strategies`,
  `email_templates`, `connect_setup_tokens`, `document_numbers`, `payment_notification_recipients`, `notifications` (one row
  per admin per event) and `notification_rules` (SEVEN rows). **`provider_receipts`** is ONE lump sum a provider paid
  (`strategy_key` FK, `amount_received > 0`, `reference`, `notes`, `received_at`, `recorded_by`); `client_payments.receipt_id`
  is the split hanging off it — nullable (LEOS has no receipt) and **ON DELETE RESTRICT**, a blanked provenance reading as
  money from nowhere. On `members`, `member_number` (PK), `stripe_account_id` and both `*_sent_at` stamps are never
  payload-writable. `client_payments` carries the assignment and waiver columns, the revenue-share tail, and the
  provider-funded half — `funded_by` (CHECK `client|provider`, a SNAPSHOT), `strategy_inputs` (jsonb), `contribution_amount`,
  `revenue_expected`, `implementation_fee_amount`, `revenue_received`/`_at`/`_by`, `revenue_reference` — with
  `offset_amount`/`total_fee` NULLABLE; `tax_planner_email` is an FK to `admins.email` (SET NULL), the ONE admin who earns on
  a payment. `payment_notification_recipients` is `(payment_id, admin_email)` UNIQUE, CASCADE both ways, holding whom the
  raising form named (nobody by default); `email_templates` holds SEVEN draft rows, `document_numbers` the issued-number
  registry.
- **Numbering:** COI `member_number` is **M.T.NNNN with DOTS** — mothership, type digit (1 CPA, 2 Advisor, 3 Other), then
  a GLOBAL zero-padded 4-digit sequence; `9999` is the test slot the allocator skips. Dashes normalise to dots
  (`utils/coi-number.ts`), the dash separating a CLIENT number `{coi}-NNN`. Mothership and type are IMMUTABLE.
- **Revenue share (v: 2026-09-11):** `motherships` (number PK, ERT = 1) is the firm a COI sits under; `strategies` holds FOUR
  active rows whose rule sets are editable in the portal, so tuning a split never needs a deploy — the seeded figures live
  there, and in the CHANGELOG. `model` says HOW the pool is arrived at, the only thing the code branches on; `funded_by` says
  WHO PAYS. **LEOS** (`fee_waterfall`, client-funded): the admin fee (1.5% of the OFFSET) and the $7,500 legal letter —
  **WAIVABLE PER PAYMENT** (`legal_fee_waived`) — come off the client fee first, then **ERT takes 10% or 5% of WHAT REMAINS,
  not of the whole fee**, and the rest is the pool. The other three are **PROVIDER-FUNDED**: the client pays the provider, the
  provider pays WIG one lump sum for several clients, and **the pool IS the money**. Implementation fees are
  **INFORMATIONAL**, shared by nobody — except that DCD's waiver moves ERT's cut 55% → 60%. **Path A needs BOTH**
  `mothership_number === 1` AND `affiliated_via_ert`: a flat `affiliated_share_pct`, no level ladder, paid to ERT outside the
  portal — no transfer, no email, `rev_paid` = `Via ERT`, the manual `ert_share` tick the completion. **831(b) is the
  exception** (`affiliated_via_ert` false): the ONE strategy where this portal pays an ERT-affiliated COI, on the ladder, by
  transfer, like everyone else on their level's share (0/20/30/40/50%). **CLEARING has two spellings** — `payment_status =
  "succeeded"`, or `revenue_received_at`, stamped on a provider row by the RECEIPT that created it — and it writes the tail:
  the TEN waterfall columns in ONE conditional update BEFORE any money moves and NEVER recomputed (`coi_level_at_payment`,
  `coi_share_pct`, `coi_paid_via_ert` are snapshots for that reason; on a provider record the hard costs stamp ZERO and the
  pool is what ARRIVED), then `rev_paid` — `succeeded`/`processing`/`Not Due`/`Awaiting Payout Account`/`Failed`/`Via ERT`,
  owned by `revenue-share.ts` — and the transfer's stamps. The key is **per ATTEMPT** (#22); a provider transfer draws on the
  platform BALANCE (#23).
- **Migrations:** 37, applied via MCP `apply_migration` AND committed under `supabase/migrations/`; the remote version is
  the APPLIED-AT timestamp, so reconcile on the migration NAME, not the number. **GitHub:** both repos are squash-only.
- **Auth:** custom sessions, 8h, `login_type` `"admin"`. Passcodes PBKDF2 210k, salted, min length 8. Throttle 5 per
  identifier + 20 per IP per 15 min. Superadmin floor `fabot@wealthig.com` (`constants/superadmin.ts`) outranks
  `is_superadmin` and is undeletable. `update_passcode` targets the SESSION's admin only and revokes their OTHER sessions;
  new admins get a NULL passcode plus a 14-day single-use `/set-password` link. `middleware/auth.ts` splits **401 from
  500**: a bad credential 401, a FAILED DB read 500, the frontend signing out on any 401 (#12).
- **Stripe (v: 2026-09-10):** the portal's own account, entirely separate from VFO. Both webhook endpoints, test and live,
  hit the same function URL and BOTH signing secrets are tried, so an event is verified by whichever signed it. **The mode
  is PER ENTITY, BY NAME** (`utils/stripe-mode.ts`, Jake's rule): "Test" anywhere in the client's OR the COI's name →
  sandbox, EVERYONE ELSE LIVE — no constant, no toggle. A payment's mode is stamped on `client_payments.sandbox` at
  request time and read back OFF THE ROW after; a COI's own objects follow their name; `stripeFetch` REQUIRES a mode; the
  `livemode` guard is PER ROW inside `bookClientPayment`, a mismatch answering 200 `skipped: "mode_mismatch"` with nothing
  written (#20). API calls pin `2024-06-20`. `bookClientPayment` is the ONLY writer of `payment_status`,
  `coi_stripe_connect_request` of `members.stripe_account_id`. Client-fee Checkout is ACH only; the three provider-funded
  strategies touch Stripe ONLY for the COI's transfer.
- **Gmail:** Google Cloud project "IAG Portal" in the wealthig.com org, consent screen INTERNAL (which is why the refresh
  token does not expire); OAuth client "IAG Portal Gmail", scope `gmail.compose`. **Drafts only — no send path exists.**
  SEVEN drafts, each latched: the COI setup email, the payment request, the confirmation, the invoice + receipt (two
  PDFs), the COI revenue share (after the transfer succeeds — ONE neutral template for both kinds of record) and the two
  Phase-G reminders. `draftGmail` is `multipart/mixed` only with attachments.
- **Secrets (NAMES only; values set by Jake in Supabase function secrets):** `STRIPE_SECRET_KEY`,
  `STRIPE_SECRET_KEY_SANDBOX`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET_SANDBOX`, `GMAIL_CLIENT_ID`,
  `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `HTML2PDF_API_KEY` (read at call time, never logged). Plus the Vault
  secret `iag_service_role_key`, read only by the cron job at run time, so it is in no file nor in `cron.job`; **its value
  is the new-format `sb_secret_…` key, NOT the legacy JWT** — missing means a no-op sweep (#17).

## OWED

- **VFO carries the same auth bug we fixed** — `vfo-admin-api/middleware/auth.ts` ignores the error on all SIX identity
  queries. Worth a ticket there; not ours to fix from an IAG chat.
- **ADMIN write paths lack click-through confirmation** — `add_admin`, `issue_setup_link`, `delete_admin`, `update_passcode`:
  type gate and code review only. **`email_templates` holds SEVEN rows**; the rest need Jake's sign-off.
- **The test PAYMENTS are gone; the test ROSTER is not** (v: 2026-09-11, Jake). After chat 11's testing every
  `client_payments` row, every `provider_receipts` row and every payment notification was deleted from the live DB, so both
  pipelines are empty. What remains and still has to go before go-live: three clients (`1.2.9999-001` Test Client,
  `1.2.9999-002` Test Newbie, `2.2.9999-001` Unaffilliated Client), COIs `1.2.9999` "Test Advisor" and `2.2.9999` "Test
  Unaffiliated" (Level 3, holding a COPY of the other's sandbox Connect account), and motherships 1 and 2 — names checked
  first, `2.2.9999`'s client being sandbox only through its COI (#20). **Eight `document_numbers` rows survive with a NULL
  `payment_id`** and are meant to: the registry is never deleted, so those numbers stay issued. The sandbox Stripe transfers
  and the Gmail drafts testing produced are outside the DB and untouched.
- **Who tops up the Stripe balance, and when** (v: 2026-09-10) — a provider-funded record's COI transfer draws on Wealth IG's
  own Stripe balance, no client money having entered Stripe. Until it covers what those records owe their shares sit `Failed`,
  and the retry button and sweep leg A chase them (#23). Jake's call: top up from the bank, no code. **The LIVE branch of the
  name rule has never executed** — every name in the DB is a test name, so the first real client is the first live call. **The
  `docs/chat-7-restamp` PR is obsolete** — chat 8's re-stamp carries those tags; close it unmerged.

## WATCH

- **Stripe Connect platform review is still PENDING.** Nothing is blocked in the repo, but **live COI onboarding will FAIL
  at Stripe until it clears**: a COI without "Test" in their name gets a LIVE Connect account on the first Send Setup Email.

## PARKED

- **Self-service password reset** stays absent, Jake's decision (v: 2026-09-04) — VFO excludes admins by design too, and a
  locked-out admin gets a fresh `/set-password` link from a superadmin. **Sentry is WIRED, DSN empty**: nothing reports
  until Jake pastes it into `SENTRY_DSN` (`integrations/sentry.md`), and **`stripe_events` indexes** stay parked (PK only).

## ENVIRONMENT

- **OS / toolchain:** Windows 11, PowerShell 5.1 (its constraints are #1) · Node v24.14.0 · Deno 2.7.14 · Supabase CLI
  2.78.1 · git 2.53.0 · gh CLI NOT installed. **Repos:** `fabot-wealthig/iag-portal` (public, frontend) and
  `iag-edge-functions` (private, backend); checkouts `C:\iag-react` and `C:\iag-edge-functions`.
- **MCP:** project-scoped `supabase-iag` in `C:\iag-edge-functions\.mcp.json` (gitignored — carries the PAT, which
  EXPIRES; #10). Restart the app after a change (#6); WRITE tools need `mcp__supabase-iag` in
  `.claude\settings.local.json` (#11). Timing out, the Management API answers every DERIVE read, reads only (#18).
- **Jobs:** one pg_cron job, `payment-sweep-daily`, `0 10 * * *` (10:00 UTC = 06:00 Eastern), POSTing `{"action":
  "run_payment_sweep"}` through pg_net with a Vault-read bearer (`nightly-sweep.md`). **Deploys:** backend via
  `scripts/deploy-function.sh` (#5/#13/#15/#24); frontend via `npm run deploy`, which IS production.
- **Git auth:** HTTPS + Git Credential Manager, per-repo `credential.useHttpPath true` PLUS a global scoped
  `credential.https://github.com/fabot-wealthig.useHttpPath true` — gh-pages publishes from a cache clone ignoring the
  repo-local config (#2).
