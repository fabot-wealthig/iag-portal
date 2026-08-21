# CHANGELOG

Narrative history of the IAG Portal, **newest entry first**.

Format: `## YYYY-MM-DD — headline`, followed by bullets describing what changed and why.

One change = one entry = one squashed commit on `main`. A change may span several chats; it still
gets exactly one entry. Superseded facts move here out of `docs/SESSION_REFERENCE.md` when the hub
is updated, so the hub only ever holds current state.

## 2026-08-21 — Chat 1: bootstrap complete

The IAG Portal went from nothing to live in one chat: two repos, a Supabase project, a deployed
edge function, a public frontend on its own domain, and proven Stripe and Gmail integrations.

**A note on the one-entry rule.** This entry covers the whole bootstrap, but it did NOT ship as one
commit. Chat 1's Phase 1 produced two PRs that were merged before the repo was locked to squash-only
— and both went in as merge commits, which is what prompted that setting. The remaining work is the
`claude/chat1-build` branch in each repo, which squash-merges normally. So: three merges to `main`
per repo for this one entry, honestly recorded rather than pretended away.

- **Repos and auth.** `fabot-wealthig/iag-portal` (public, frontend) and
  `fabot-wealthig/iag-edge-functions` (private, backend). HTTPS remotes through Git Credential
  Manager, with per-repo `credential.useHttpPath true` and a global scoped
  `credential.https://github.com/fabot-wealthig.useHttpPath true`. The global one is not optional:
  `gh-pages` pushes from its own cache clone, which ignores repo-local config (GOTCHA #2). After the
  two Phase-1 merge commits, both repos were set to **squash-only** — merge commits and rebase
  merging are now disabled in GitHub repo settings.
- **Docs.** Seeded `docs/`: this changelog, `GOTCHAS.md`, the `SESSION_REFERENCE.md` hub, and the
  two hand-pasted prompts in `docs/prompts/`. The hub shipped as a skeleton and was rewritten into
  the real hub at wrap-up. Established the worktree workflow every later chat uses: work happens in
  `<repo>\.claude\worktrees\<branch>` and `main` is written only by a squashed merge — the bootstrap
  base commits being the one deliberate exception.
- **Supabase and MCP.** Project `gqznnyccridnpipjipeq`. Wired a project-scoped MCP server
  `supabase-iag` via a gitignored `.mcp.json`. All SQL and all function deploys go through MCP; the
  `supabase` CLI is deliberately never used here, because its single machine-wide login belongs to
  the VFO account (GOTCHA #5). First MCP load needed two app restarts (GOTCHA #6).
- **Schema, RLS, advisor.** Four migrations, each applied via MCP and committed as a file:
  `admin_auth`, `lock_down_rls_auto_enable`, `members`, `stripe_events`. Six public tables —
  `admins`, `admin_sessions`, `login_attempts`, `login_setup_tokens`, `members`, `stripe_events` —
  every one RLS-enabled with a deny-all policy in the same migration that creates it. An anon-key
  probe returns `Content-Range: */0` on all six, and the security advisor is green with zero
  findings. `lock_down_rls_auto_enable` exists because a Supabase-provisioned SECURITY DEFINER
  function arrived without a pinned `search_path`; it now pins it and revokes EXECUTE from `public`.
- **Edge function.** `iag-admin-api`, Deno 2, `verify_jwt: false` because authentication is custom
  and handled inside the function. Seven actions: `admin_login` (dispatched directly in `index.ts`,
  since it needs the client IP for throttling), the pre-auth pair `load_login_setup` and
  `submit_login_setup`, and the authed `ping`, `load_members`, `create_test_checkout`, and
  `admin_test_draft`. Auth is custom sessions (8h, `login_type` `"admin"`) over PBKDF2 210k salted
  passcodes, with a 5-per-identifier / 20-per-IP-per-15-min login throttle and a superadmin floor of
  `fabot@wealthig.com`. Jake's admin row was bootstrapped through the `/set-password` one-time-token
  flow. Live at version 11 — which is not a deploy count: Supabase bumps the version on secret
  writes too, and only three of those eleven bumps were code (GOTCHA #3).
- **Frontend live.** Vite + React portal (admin login, set-password, members) deployed to
  https://portal.wealthig.com via GitHub Pages from the `gh-pages` branch, custom domain through a
  Squarespace CNAME `portal` → `fabot-wealthig.github.io`, HTTPS cert provisioned and Enforce HTTPS
  on. `npm run deploy` IS the production deploy.
- **Stripe proven.** A brand-new account, wholly separate from VFO's. Test-mode and live-mode
  webhook endpoints both registered against the function URL. Signature verification is done by hand
  (HMAC with a constant-time compare) rather than via the SDK. End-to-end proof: a $5.00 test
  checkout paid with the 4242 card produced `checkout.session.completed` and
  `payment_intent.succeeded`, both verified and upserted into `stripe_events`. `STRIPE_MODE` in
  `utils/stripe.ts` is hardcoded `"sandbox"`, so live-mode events are skipped with a logged mode
  mismatch. Stripe Connect is enabled but its platform verification is still pending review.
- **Gmail proven.** Google Cloud project "IAG Portal" in the wealthig.com org with an INTERNAL
  consent screen, which is what makes the refresh token non-expiring. OAuth client minted a refresh
  token scoped to `gmail.compose`, and `admin_test_draft` created a real draft in
  `fabot@wealthig.com`'s Drafts. Drafts only — nothing is ever sent.
- **Fixed: the `apikey` CORS bug.** The frontend API client sent a Supabase `apikey` header out of
  habit, but this function is not PostgREST and its `Access-Control-Allow-Headers` allows only
  `Content-Type, Authorization` — so every call died at preflight with an opaque browser error. The
  header was removed from `src/lib/api.js` (GOTCHA #4).
- **Changed: passcode minimum raised to 8** characters, up from the 6 that VFO uses.
