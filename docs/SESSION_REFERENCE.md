# IAG PORTAL — SESSION REFERENCE (HUB)

The single always-loaded file: current state, binding invariants, and the map to every other doc. Read in full at session
start; before editing an area, read the doc DOC MAP names for it. **Hard cap: 250 lines.** Command output always beats
prose; a fact carries `(v: date)` when it was last verified.

## DERIVE-AT-START

Run these BEFORE any other work and state the results back. A doc sentence that disagrees with command output is stale —
the command wins.

| # | Command | Expected |
| --- | --- | --- |
| 1 | MCP `supabase-iag` → `list_edge_functions` | `iag-admin-api`, `ACTIVE`, `verify_jwt: false`, version **51** (v: 2026-09-22) |
| 2 | `git tag -l 'live-*' --sort=v:refname` (in `C:\iag-react`) | `live-15-iag-rebrand-payees` (v: 2026-09-22) |
| 3 | `git tag -l 'backend-good-*' --sort=v:refname` (in `C:\iag-edge-functions`) | `backend-good-2026-09-22-v51` (v: 2026-09-22) |
| 4 | action count — see command below | `60` table entries + 1 direct = **61** actions (v: 2026-09-24) |
| 5 | `deno check --no-lock index.ts` from `supabase\functions\iag-admin-api` | 0 errors (v: 2026-09-22) |
| 6 | `npm ci` (once per fresh worktree, #27) then `npm run build` in the frontend worktree | exit code 0 (v: 2026-09-22) |
| 7 | MCP `supabase-iag` → `get_advisors` type `security` | **zero findings** — green baseline is `"lints": []` (v: 2026-09-22) |
| 8 | anon-key probe — the anon key must see NOTHING. **Jake** runs `.\scripts\anon-probe.ps1` in the backend with `$env:IAG_ANON_KEY` set (Claude's shells are refused, #29): a GET per table, key as `apikey` AND `Bearer`, `Prefer: count=exact`, never `curl -I` (#7) | `ALL 20 = */0 (PASS)` (v: 2026-09-24 — run in SQL as `set local role anon` over all 20, every count 0; the HTTP script is still the standard) |

**The version is NOT a code-deploy counter** — Supabase bumps it on every SECRET change too; it means "what is live right
now" (GOTCHA #3). **Tags (#2, #3)** are stamped post-merge, at chat-15 values.

**Action count (#4)** — with `$p` = the backend's `router\dispatch.ts`, `(Select-String -Path $p -Pattern
'^\s+"[a-z_]+":' | Measure-Object).Count`. Expected `60` = `PUBLIC_HANDLERS` (6) + `AUTH_HANDLERS` (54), plus
`admin_login` (direct in `index.ts`, in neither table) = **61 total**.

## SECURITY INVARIANTS

These four are FINAL. Re-check them on any table, policy, handler, or function change. An invariant change is a headline,
never a quiet edit. **(Confirmed UNCHANGED by migrations 44–51: `payees` (47), `payout_schedule` (50) and `payout_events` (51) ship deny-all RLS; advisor green after each; anon re-run OWED.)**

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
- **#5/#13/#15/#24/#26** Backend deploys run `scripts/deploy-function.sh` (multipart upload to the Management API), and HOW
  to invoke it depends on the CALLER. **From ANY PowerShell — a real console OR the app's terminal tab — one command,
  `.\scripts\deploy.ps1`**: it puts Git's `usr\bin` and `mingw64\bin` on PATH and hands the script to the scoop bash, which
  is where a bare `bash` (the WSL relay stub, #15) and `dirname: command not found` (#24/#26) both come from. **From a
  Claude session the Bash tool**, `bash scripts/deploy-function.sh`, never Claude's PowerShell tool (#24). NEVER the
  `supabase` CLI (its login belongs to VFO); MCP `deploy_edge_function` no longer fits; an upload replaces the WHOLE function.
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
| `docs/flows/coi-connect-setup.md` | End-to-end COI (and payee) payouts: Connect account → emailed link → `/payout-setup` → Stripe → status; the Sandbox toggle and its lock. |
| `docs/flows/hard-cost-payees.md` | Payees (legal firms, GFX) and the LEOS / NBDT legal and admin fees paid to them by transfer after the share: the request-time choice, the claim and key, retry, leg H, the fee steps, the two bells. |
| `docs/flows/client-payment-request.md` | End-to-end client fee (LEOS and the Implementation Fee): request form → `/pay` (ACH, or card on `client_fee_pool`) → Stripe Checkout → webhook booking → confirmation (ACH only) → invoice and receipt → COI revenue share → the detail screen. |
| `docs/flows/provider-receipts.md` | One lump sum from Boxhouse / SRA / DCD / Closehaul / ERT (Cost Segregation, Film Deduction, R&D Credits, Oil & Gas): the Tax Strategies form, the sum rule, rows born received, the per-row people and shares, the receipts list and detail, the ERT tick. |
| `docs/flows/nightly-sweep.md` | The nightly `run_payment_sweep`: the bearer gate, the eight legs (A, H, B–G) and their latches, the two 2-business-day reminders, housekeeping retention, the pg_cron job and dry runs. |
| `docs/flows/payout-schedule.md` | WHEN shares and payee fees go out: ONE schedule (weekly on a weekday or monthly on a day, no holiday shifting), the gate, Pay now / Hold / Release, schedule edits and re-dating, `payout_events` history, the three screens. |
| `docs/flows/notifications.md` | The bell: the two tables, the fan-out audience, the nine events and where each fires, dedupe, the five actions, the 30s poll, the editor, the deep link. |
| `docs/integrations/sentry.md` | Frontend error monitoring: what is wired, why PROD-only, no replay, and the empty DSN. |
| `docs/prompts/` | `SESSION_STARTER.md` (pasted at the start of every chat) and `SESSION_WRAPUP.md` (pasted when the work is SHIPPING). |
| Both `README.md`s | Repo orientation — frontend: live URL, docs pointer, deploy warning; backend: deploy mechanism, type gate, migration convention. Its `supabase/.env.local.template` carries secret NAMES only; values live in Supabase function secrets. |

## LIVE STATE

- **Frontend:** https://portal.wealthig.com — GitHub Pages from the `gh-pages` branch of `fabot-wealthig/iag-portal`,
  custom domain via a Squarespace CNAME `portal` → `fabot-wealthig.github.io`, HTTPS enforced; `npm run deploy` IS
  production. **IAG Portal** / **Innovation Advisory Group**; palette = the `--wig-*` tokens in `src/styles.css`, orange
  carrying every alert. "Wealth IG" / "WIG" survive ONLY as infrastructure names (the domain, the email addresses, the
  CSS tokens, the storage keys).
- **Frontend shape (v: 2026-09-02):** 6 routes — `/` Landing, `/login`, `/portal` (the whole signed-in app, one route),
  `/set-password`, plus two public session-less token pages, `/payout-setup` (COI and payee Connect) and `/pay` (client fee);
  `/members` → `/portal`. Any emailed path must ALSO be in `ROUTES` in `scripts/emit-route-pages.mjs` — 5 entries — or it
  404s on a client holding an emailed link. Inline style objects over `--wig-*`; dark mode signed-in only (`wig_theme`).
- **Portal UI (v: 2026-09-22):** a sticky navy header (the full logo lockup at 30px, bell, name, Admin Editor pill for superadmins, Settings, Sign
  Out) over a tab bar: **COI ▾** with hover flyouts, then five muted tabs gated by `admins.allowed_tabs` — COI Overview, Client Overview, Tax
  Strategies, **Automation & Config ▾** (Email Templates, Notification Editor, Payees, **Payout Schedule**), **Accounting ▾** (Payments, **Payouts**). Superadmins see all five; a grant lands
  at the grantee's NEXT LOGIN, `allowed_tabs` being session-baked at `admin_login`; under 1180px the secondary group collapses to **More ▾**. Each
  drill-in REPLACES the header above it — COI → its clients → a client → its payments → `PaymentDetail`, whose **Notifications** card (tax planner +
  recipient chips, EVERY admin) sits between Progress and Details, and every raising form asks it up front, pre-selecting NOBODY. An orange
  **Sandbox** chip marks a sandbox payment and a COI whose toggle is on; the bell polls every 30s. **Overview rows are a work queue**: the whole row
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
  in a row being a `Via ERT` line's "Paid by ERT" tick — that row's Share status until ticked, then a green chip, unticking stays on the payment
  detail. A provider record's detail hides the client fee, the documents and every email action, shows THREE progress steps and a **View receipt**
  link; the grids read **Basis / Amount** (expected until received, a dash where nothing was measured). `/pay` offers ACH, a card ONLY when
  `accepts_card`. sessionStorage holds the screen — **fourteen** `wig*` keys, `wigPayoutsView` the newest, listed TWICE (#21). Every payment detail carries a **Payout** card (pay date, holds, Pay now, history — `flows/payout-schedule.md`); every grid shows a **Payment** and a **Payout** pill in ONE vocabulary (`shared/PayoutPill.jsx`), Sandbox a small tag under the client, and step owners are System / Admin / Client / Provider / a name — never "IAG".
- **Standing UI rules (permanent — Jake):** (1) the hero is flush at the top and the "← Back to …" link sits UNDER it, above
  any tab strip (`BackLink` and `Field` live in `TrackKit`); (2) a name is a link ONLY where it is a shortcut — plain where
  the row's own click goes to the same place, a link where it goes PAST it (`NameLink`, which stops the click propagating);
  (3) interaction mechanics copy the VFO portal exactly, hover timing included; (4) grid screens are auto-layout tables that
  fit the 1180px panel without horizontal scroll, every column left-aligned, no action controls in list rows — **ONE exception
  (2026-09-10): the "Paid by ERT" tick on a receipt's `Via ERT` row** — every data wait a skeleton; (5) a browser refresh on
  ANY signed-in screen lands on exactly that screen, all nav state being in sessionStorage; (6) a step whose amount is NOT YET
  CALCULATED is greyed and unclickable ("Pending calculation"), except the entry step that supplies the figure; (7) a step a
  payment NEVER HAD is ABSENT — greyed-with-a-reason is only for a step the pipeline has and this row lost (a waived letter).
- **Backend (v: 2026-09-24):** `iag-admin-api` **v56** (payout schedule, firm-first COIs, check payouts), ACTIVE, `verify_jwt: false` (custom auth). Deno 2. Project ref
  `gqznnyccridnpipjipeq`. 102 `.ts` files, ~700 KB, 60 actions. Smoke gate `scripts/smoke.ps1`: FIFTEEN read-only loaders, one per area (`load_payouts`,
  `load_payout_schedule` the newest), asserting 200 and no top-level `error` against the version SHIPPED.
- **Actions (61, v: 2026-09-24):** `admin_login` (direct in `index.ts`); public pre-auth `load_login_setup`, `submit_login_setup`,
  `connect_setup_link`, `load_pay_link`, `pay_link_checkout`, `run_payment_sweep` (bearer-gated: its 401 is a bad credential, not a #12 breach);
  authed `ping`, `update_passcode`, `load_admins`, `load_admin_directory`, `add_admin`, `issue_setup_link`, `delete_admin`, `admin_update_tabs`,
  `load_members`, `add_coi`, `update_coi`, `delete_coi`, `coi_stripe_connect_request`, `coi_connect_status`, `load_payees`, `save_payee`,
  `payee_connect_request`, `payee_connect_status`, `load_motherships`, `add_mothership`, `load_clients`, `add_client`, `update_client`,
  `delete_client`, `start_client_payment`, `load_client_payments`, `load_client_payment`, `update_payment_step`, `create_provider_receipt`,
  `load_provider_receipts`, `load_provider_receipt`, `set_payment_tax_planner`, `update_payment_recipient`, `resend_payment_email`,
  `retry_revenue_share`, `retry_hard_cost`, `load_all_payments`, `load_client_overview`, `load_coi_overview`, `load_strategies`, `save_strategy`,
  `load_email_templates`, `save_email_template`, `load_notifications`, `mark_notification_read`, `mark_all_notifications_read`,
  `load_notification_rules`, `save_notification_rule`, `load_payouts`, `load_payout_schedule`, `save_payout_schedule`, `set_payout_hold`, `pay_payout_now`, `record_check_payment`. `*_admin*` actions are **superadmin-only** (an `auth.isSuperadmin` 403 first: the gate proves a
  session, not a rank), EXCEPT `load_admin_directory` — email+name, every admin, since any admin assigns planners and recipients.
  **`create_provider_receipt` is the WHOLE provider-funded pipeline**: one lump sum plus 1–50 client rows whose amounts must SUM to it (half a cent
  tolerance, else 400), each row BORN RECEIVED — so there is no clearing action — then per row the bell and `runRevenueShare` in process. A refused
  transfer is a 200 carrying that row's `error`; a timeout self-heals via sweep leg A. `update_payment_step` ticks FOUR whitelisted steps (three hard
  costs plus `ert_share`), COSMETIC: nothing reads them — and refuses `legal_fee` / `admin_fee` on a row naming a payee (a transfer).
  `pay_link_checkout` reads `method` ONLY on a `client_fee_pool` strategy. **Every step carries BOTH a `label`** (the STATE, for the progress list)
  **and an `action`** (the WORK OUTSTANDING, the overviews' `next_action` via `summarizePayment`) — neither derived from the other, so edit both.
- **Database (v: 2026-09-24):** 20 public tables — `admins`, `admin_sessions`, `login_attempts`, `login_setup_tokens`, `members`, `stripe_events`,
  `motherships`, `clients`, `client_payments`, `provider_receipts`, `strategies`, `email_templates`, `connect_setup_tokens`, `document_numbers`,
  `payment_notification_recipients`, `notifications` (one row per admin per event), `notification_rules` (NINE rows), `payout_schedule`, `payout_events` and **`payees`**
  (`legal_firm`|`admin_fee`, own `sandbox` + Connect stamps; `GFX` / `GFX (Sandbox)` seeded, no email yet). **`provider_receipts`** is ONE lump sum a
  provider paid (`strategy_key` FK, `amount_received > 0`, `reference`, `notes`, `received_at`, `recorded_by`); `client_payments.receipt_id` is the
  split hanging off it — nullable (LEOS has no receipt) and **ON DELETE RESTRICT**, a blanked provenance reading as money from nowhere. On `members`, **`company` is the PRIMARY name** (firm over person on every screen, `shared/CoiName.jsx`) and `coi_manager` the IAG staff owner (a pick-list of managers in use); ADDING a COI requires company, first, last and work email (editing stays lenient for the imported rows); `payout_method` `stripe`|`check` (a check COI's share turns "Check Due" on its pay date and is Paid by **Record check**, `flows/payout-schedule.md`). On `members`
  (and `payees`), `stripe_account_id` and both `*_sent_at` stamps are never payload-writable, nor `member_number` (PK); `sandbox` is, until a Connect
  account exists. `client_payments` carries the assignment and waiver columns, the revenue-share tail, and the provider-funded half — `funded_by`
  (CHECK `client|provider`, a SNAPSHOT), `strategy_inputs` (jsonb), `contribution_amount`, `revenue_expected`, `implementation_fee_amount`,
  `revenue_received`/`_at`/`_by`, `revenue_reference`, `strategy_model` (a SNAPSHOT like `funded_by`, NULL = LEOS), `card_processing_fee` (the
  CLIENT's, NULL unless a card was booked), `discount_amount`/`_reason` (RECORD ONLY), `legal_fee_payee_id`/`admin_fee_payee_id` (FK SET NULL) and per
  cost `_paid`/`_transfer_id`/`_idempotency_key`/`_paid_at`, the payout columns (`payout_cleared_on`, `payout_due_on`, `payout_hold*`, `payout_early_*`) — with `offset_amount`/`total_fee` NULLABLE; `tax_planner_email` is an FK to
  `admins.email` (SET NULL), the ONE admin who earns on a payment. `payment_notification_recipients` is `(payment_id, admin_email)` UNIQUE, CASCADE
  both ways, holding whom the raising form named (nobody by default); `email_templates` holds TEN draft rows, `document_numbers` the number registry.
- **Numbering:** COI `member_number` is **M.T.NNNN with DOTS** — mothership, type digit (1 CPA, 2 Advisor, 3 Other), then
  a GLOBAL zero-padded 4-digit sequence; `9999` is skipped by the allocator (IAG's "N/A" COI is 99.3.9999); next new COI 0179. Dashes normalise to dots
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
  being what ARRIVED), then `rev_paid` — `succeeded`/`processing`/`Not Due`/`Awaiting Payout Account`/`Failed`/`Via ERT`, owned by `revenue-share.ts`
  — and the transfer's stamps; **since 2026-09-24 the money waits for `payout_due_on`** (`flows/payout-schedule.md`). The key is **per ATTEMPT** (#22); a provider transfer draws on the platform BALANCE (#23). A **fee discount** (amount +
  reason, on every strategy, `pass_through` included) is **RECORD ONLY**: printed and emailed, never in any sum.
- **Migrations:** 56 (55 members.company + coi_manager; 56 COI check payouts), via MCP `apply_migration` AND committed under `supabase/migrations/`; reconcile on the migration NAME (the remote
  version is the applied-at timestamp). **GitHub:** both repos are squash-only.
- **Auth:** custom sessions, 8h, `login_type` `"admin"`. Passcodes PBKDF2 210k, salted, min length 8. Throttle 5 per
  identifier + 20 per IP per 15 min. Superadmin floor `fabot@wealthig.com` (`constants/superadmin.ts`) outranks
  `is_superadmin` and is undeletable. `update_passcode` targets the SESSION's admin only and revokes their OTHER sessions;
  new admins get a NULL passcode plus a 14-day single-use `/set-password` link. `middleware/auth.ts` splits **401 from
  500**: a bad credential 401, a FAILED DB read 500, the frontend signing out on any 401 (#12).
- **Stripe (v: 2026-09-22):** the portal's own account, entirely separate from VFO. Both webhook endpoints, test and live, hit the same function URL
  and BOTH signing secrets are tried, so an event is verified by whichever signed it. **The mode is the COI's `sandbox` TOGGLE** (`members.sandbox`,
  `modeForCoi`, Jake's rule; both test COIs ON) — their Connect account and every client's payment and receipt; names no longer matter; a payee
  follows its own `payees.sandbox`; **locked (400) once a Connect account exists**. A payment's mode is stamped on `client_payments.sandbox` at
  request time and read back OFF THE ROW after; `stripeFetch` REQUIRES a mode; the `livemode` guard is PER ROW inside `bookClientPayment`, a mismatch
  answering 200 `skipped: "mode_mismatch"` with nothing written (#20). API calls pin `2024-06-20`. `bookClientPayment` is the ONLY writer of
  `payment_status`, `coi_stripe_connect_request` of `members.stripe_account_id`, `payee_connect_request` of the payee's, `hard-costs.ts` of
  `*_fee_paid`. Client-fee Checkout is ACH only EXCEPT on `client_fee_pool`, where a card is offered and grossed up; a card books `succeeded` on the
  spot, `confirmation_status` **`Not Needed`** (no confirmation email — the instant invoice and receipt are it, VFO's rule). Provider strategies touch
  Stripe ONLY to transfer.
- **Gmail:** Google Cloud project "IAG Portal" in the wealthig.com org, consent screen INTERNAL (which is why the refresh token does not expire);
  OAuth client "IAG Portal Gmail", scope `gmail.compose`. **Drafts only — no send path exists.** TEN drafts, each latched: the COI setup email, the
  payment request (`[PAYMENT_METHODS_NOTE]` per strategy), the confirmation (ACH ONLY), the invoice + receipt (two PDFs; a card fee row + Total
  Charged on a grossed-up card), the COI revenue share (ONE neutral template for both record kinds), the two Phase-G reminders, and the payee setup
  email and its reminder (their own wording, migration 48), and the payee's fee confirmation (`payee_fee_paid`, migration 49, one per paid fee). `[DISCOUNT_NOTE]` sits in the five that state a fee. `draftGmail` is `multipart/mixed`.
- **Secrets (NAMES only; values set by Jake in Supabase function secrets):** `STRIPE_SECRET_KEY`,
  `STRIPE_SECRET_KEY_SANDBOX`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET_SANDBOX`, `GMAIL_CLIENT_ID`,
  `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `HTML2PDF_API_KEY` (read at call time, never logged). Plus the Vault
  secret `iag_service_role_key`, read only by the cron job at run time, so it is in no file nor in `cron.job`; **its value
  is the new-format `sb_secret_…` key, NOT the legacy JWT** — missing means a no-op sweep (#17).

## OWED

- **VFO carries the same auth bug we fixed** — `vfo-admin-api/middleware/auth.ts` ignores the error on all SIX identity
  queries; a ticket there, not ours. **ADMIN write paths lack click-through confirmation** — `add_admin`, `issue_setup_link`,
  `delete_admin`, `update_passcode`: type gate and code review only.
- **REAL DATA, no test roster** (v: 2026-09-24): IAG's COI list imported — **78 COIs, 762 clients, motherships 1–44 + 99** (2 = Innovative Group, 3–44 one
  per independent firm, 99 = IAG Internal & Referrals); all LIVE (sandbox off), NO emails (each needs one before Stripe setup). The test COIs, clients and
  payments are deleted, `document_numbers` with them (numbers carried the 9999 client prefix, so none can recur). **OWED: 16 "VFO Services" clients**
  await where they go. Payees `GFX`, `GFX (Sandbox)`, `Law Firm (Sandbox)` remain; sandbox testing now needs a sandbox COI created first.
- **IAG's Stripe payout schedule** (v: 2026-09-24) — with shares now paid on a pay date, automatic bank payouts sweep the settled client money first and the transfer fails `Failed` (Stripe docs: `source_transaction` holds nothing once settled). Jake is asking IAG to go MANUAL, or keep a buffer. **Who tops up the Stripe balance** (v: 2026-09-10) — a provider transfer draws on IAG's own balance; short, the share sits `Failed` for retry and
  sweep leg A (#23); Jake tops up from the bank. **Never yet run LIVE**: the toggle's live branch, a card gross-up, a hard-cost transfer.
- **Before the first LIVE LEOS clears** (v: 2026-09-22): fill in `GFX`'s email and onboard its Connect account, and add and onboard a live legal firm
  (else every live LEOS / NBDT request is refused, and a held fee waits). **The anon probe over 18 tables** (Jake, `anon-probe.ps1`, #29).

## WATCH

- **Stripe Connect platform review is still PENDING.** Nothing is blocked in the repo, but **live COI AND payee onboarding will FAIL at Stripe until
  it clears**: a COI or payee whose Sandbox toggle is off gets a LIVE Connect account on the first Send Setup Email.

## PARKED

- **Self-service password reset** stays absent, Jake's decision (v: 2026-09-04) — VFO excludes admins by design too, and a
  locked-out admin gets a fresh `/set-password` link from a superadmin. **Sentry is WIRED, DSN empty**: nothing reports
  until Jake pastes it into `SENTRY_DSN` (`integrations/sentry.md`), and **`stripe_events` indexes** stay parked (PK only).

## ENVIRONMENT

- **OS / toolchain:** Windows 11, PowerShell 5.1 (its constraints are #1) · Node v24.14.0 · Deno 2.7.14 · Supabase CLI
  2.78.1 · git 2.53.0 · gh CLI NOT installed. **Repos:** `fabot-wealthig/iag-portal` (public, frontend) and
  `iag-edge-functions` (private, backend); checkouts `C:\iag-react` and `C:\iag-edge-functions`.
- **MCP:** project-scoped `supabase-iag` in `C:\iag-edge-functions\.mcp.json` (gitignored — carries the PAT, which EXPIRES;
  #10). Restart the app after a change (#6); WRITE tools need `mcp__supabase-iag` in `.claude\settings.local.json` (#11).
  Timing out, the Management API answers every DERIVE read, reads only (#18).
- **Jobs:** one pg_cron job, `payment-sweep-daily`, `0 10,12,14 * * *` (06:00, 08:00, 10:00 Eastern; migration 53), POSTing `{"action":
  "run_payment_sweep"}` through pg_net with a Vault-read bearer (`nightly-sweep.md`). **Deploys:** backend via
  `scripts/deploy-function.sh` — from PowerShell the one-liner `.\scripts\deploy.ps1` wraps it (#5/#13/#15/#24/#26); frontend via `npm run deploy`, which IS production, from a checkout whose `node_modules` has `@sentry/react` (#27).
- **Git auth:** HTTPS + Git Credential Manager, per-repo `credential.useHttpPath true` PLUS a global scoped
  `credential.https://github.com/fabot-wealthig.useHttpPath true` — gh-pages publishes from a cache clone that ignores it (#2).
