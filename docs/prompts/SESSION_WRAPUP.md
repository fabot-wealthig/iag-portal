<!-- CANONICAL COPY of the IAG Portal wrap-up prompt. Lives at iag-react/docs/prompts/SESSION_WRAPUP.md.
     Chat 1 fills the <PLACEHOLDER>s. Edit here, then re-copy. Last updated: 2026-08-21 (chat 1 wrap-up). -->

# SESSION WRAP-UP — HUB UPDATE + STALENESS AUDIT + COMMIT (run when the work is SHIPPING)

Does the hub update, doc audit, verification gate, commit, push, and save-point tag in ONE pass, ordered so the tag is stamped LAST and never goes stale.

**RUN THIS ONLY WHEN THE WORK IS SHIPPING.** This is the ship ritual, not the end-of-chat ritual — it belongs to the CHANGE, not the conversation, and one shipping unit may span several chats. If the work is unfinished and I am simply closing a long chat, this is the wrong prompt — ship nothing, state where things stand, and the next chat resumes the same branch.

## PART 1 — HUB UPDATE + STALENESS AUDIT (docs first, BEFORE committing)

### 1A. Update the hub — `docs/SESSION_REFERENCE.md` FIRST (next session's starter depends on it)

The hub is a LEAN always-loaded file with hard rules. Follow all of them:

1. **Declare every edit** against the existing line: **ADD** / **UPDATE** / **DELETE** / **NOOP**. No blind appends — if you cannot name which of the four an edit is, you do not understand the change yet.
2. **Superseded facts move out immediately** to `docs/CHANGELOG.md` in the same pass — never a `Prior: ...` tail or struck line. The hub holds CURRENT state only.
3. **Stamp freshness:** every fact touched or re-verified gets `(v: YYYY-MM-DD)`. Only stamp what you actually checked this session.
4. **Narrative goes straight to CHANGELOG** — the story of the WHOLE change (every chat that worked this branch, reconstructed from the branch's commits if needed), newest-first, ONE entry per change (it becomes one squashed commit). The hub never holds narrative.
5. **Reconcile OWED / WATCH / PARKED.** Discharge every item this session settled (note the discharge in CHANGELOG); add every item it created. Two easy-to-miss feeders: **every `UNTESTED` line from prior chats on this branch** (an untested thing is either tested now or becomes a hub OWED line — it may NOT quietly vanish), and **any gate run against an EARLIER deploy than the one shipping** (re-run it, or record it as owed by name and version).
6. **Re-run the DERIVE block and reconcile expectations** — action count, advisor baseline, check baselines, live versions. If the session legitimately changed one, UPDATE it. If it changed one you did not intend, STOP and investigate before committing.
7. **Count the hub's lines — over 250 is a FAILURE.** Cut before committing; justify any net growth in ONE sentence in the doc commit body.
8. **Confirm the SECURITY INVARIANTS box is unchanged** — an invariant change is a headline, never a quiet edit.

Also confirm: live `iag-admin-api` VERSION NUMBER (authoritative — MCP `list_edge_functions`; record the VERSION, never a guessed tag); new live state (crons, buckets, columns, routes). Do NOT hard-code "current tag" — the real tag is created post-merge in Part 4.

### 1B. Gotchas — append, then PRUNE the curated list
- New session-learned gotchas → append to the END of `docs/GOTCHAS.md` (increment from the current max #N — NEVER renumber).
- Always-applies invariants ALSO get a one-line entry in the hub's curated list; then prune that list — demote anything that no longer earns always-loaded status (kept in GOTCHAS.md; only the curated surface is pruned). Declare each demotion.

### 1C. Ripple — update every OTHER doc surface THE BRANCH touched

**Scope is the BRANCH, not this chat.** Start by running in BOTH repos:

git fetch origin && git diff --stat origin/main...HEAD && git log --oneline origin/main..HEAD

That file list — every file the whole branch changed, across every chat — is the input to this audit, not your memory of this conversation. Read the diff of anything you did not personally change before deciding it needs no doc update. Fold in doc debt from prior chats on this branch (OWED and GOTCHA lines).

Surfaces: `docs/CHANGELOG.md` · `docs/GOTCHAS.md` · `docs/README.md` · `architecture/*` · `flows/*` · `integrations/*` · `tables/*` · `glossary.md` · repo READMEs · inline comments in touched files.

Drift = file paths/line refs moved · actions added/removed · action count · response shapes · DB tables/columns/status fields · env vars · webhook semantics · auth/role-gate behavior · frontend↔backend contract · version numbers · resolved deferred items · new gotchas.

Rules: surgical edits for moved refs; section rewrites for structural changes; **a new end-to-end flow gets a new `docs/flows/<x>.md` AND a new DOC MAP row in the hub.** Describe CURRENT state only. There is NO "follow-up session" option for doc updates.

### 1D. Prompt maintenance
If this session changed how sessions START or END, update `docs/prompts/SESSION_STARTER.md` / `SESSION_WRAPUP.md` (bump the header date) and **tell me explicitly to re-copy the changed prompt** — I paste them by hand.

## PART 2 — VERIFICATION GATE
- git rev-parse --abbrev-ref HEAD — NOT main
- git status — only intended files; NO stray edits to main-checkout files
- Backend changed? `deno check --no-lock` (baseline must match the hub) + action-count parity against the hub's DERIVE expectation
- DB / policy / function changed? MCP `get_advisors` (type security) → must match the hub's documented GREEN baseline exactly. Any new anon-reachable-table finding = STOP and fix. (SECURITY INVARIANTS)
- Frontend changed? `npm run build` exit 0 + visual smoke on affected pages; DevTools Network targets the right backend
- <SMOKE_GATE — placeholder: when the portal grows a scripted smoke check, name it here and require it green against the version being SHIPPED>
- Hub line count ≤ 250 — a failing count blocks the commit

## PART 3 — SUMMARIES + COMMIT

### 3A. Three concise summaries — covering the BRANCH, not just this chat: Code changes · Doc updates · Remaining risks/open questions

### 3B. Inspection (read-only), in each changed worktree: git rev-parse --abbrev-ref HEAD; git status --short; git diff --stat; git log --oneline -5

### 3C. Pre-commit report — tell me:
- Branch (confirm NOT main)
- Uncommitted/untracked — flag anything unintended (.env.local, tmp files, node_modules, .claude/, supabase/.temp/*)
- Files to exclude · push-to-current-or-fresh (current is fine for feature/claude/docs branches; STOP if main) · merge-safe green light (clean tree after staging, doc audit passed, gates passed, no debug logs or commented-out code)

### 3D. Stage by PATH (never git add -A) + commit — TWO commits, code first then docs (never mixed):
Template per commit (BOM-free — use a bash heredoc or the Edit tool):
  <scope>: <one-line, imperative, <70 chars>
  - <what changed and why>  - <non-obvious risk/scope note>
  Verification: deno check <N>; action count <N>; build <...>; visual <...>
  Co-Authored-By: Claude <noreply@anthropic.com>   (or the session's model name — do not hard-code an old one)
The DOC commit body must carry the hub's line count and, if it grew, the one-sentence justification.
DO NOT create/push any tag here — the tag is stamped LAST in Part 4.

## PART 4 — PUSH → DEPLOY → TAG (tag is LAST so it can't be stale)

### 4A. Push: git push -u origin <branch>  (push does NOT deploy)

### 4B. Post-push report: commit SHA(s) · PR-creation URL(s) · production untouched · "merge with Squash and merge (one chat = one commit on main)" · then the MANDATORY deploy question:
  > DEPLOY NEEDED — merged/pushed ≠ live. To ship:
  > - Frontend changed? → npm run deploy in iag-react
  > - Backend changed?  → Supabase MCP deploy_edge_function on project gqznnyccridnpipjipeq
  >   (NEVER the supabase CLI — its machine-wide login belongs to VFO)
  > Want me to run [the relevant one(s)] now? (yes / no)
  (If a repo needs no deploy, say so explicitly.)

### 4C. [I merge the PR(s); you deploy ONLY if I explicitly say "deploy".]

### 4D. STAMP THE SAVE POINT — LAST, only after merge + deploy confirmed good:
- Backend deployed? tag the merged main commit: backend-good-YYYY-MM-DD-v<Supabase version>; push it.
- Frontend deployed? tag the merged main commit: live-N-<short> (N = current max +1 via git tag -l); push it.
- Confirm rollback: "If anything's wrong later, say: restore to <previous tag>."
- **Then go BACK to the hub and re-stamp the lines you could not know in Part 1A** — the live function version and the two deploy-tag lines in the DERIVE block; commit as a one-line docs follow-up. Every other derive expectation was knowable in Part 1 and needs no revisit.
- No deploy this session? Skip 4D entirely, including the re-stamp.

## SAFETY GUARDRAILS
- Never git add -A/. (stage by path) - Never --amend a pushed commit (new commit instead)
- Never push --force to main (feature branches only, with approval) - Never --no-verify w/o approval
- Never commit .env.local/secrets/large binaries/node_modules/supabase/.temp/*
- Don't push tags except the Part-4D save-point tag - Don't deploy after push unless I say "deploy"
- Never end the flow without explicitly asking about deploy
If a pre-commit hook fails: fix the root cause, re-stage, NEW commit (don't --amend).
