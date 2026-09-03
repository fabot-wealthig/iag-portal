<!-- CANONICAL COPY of the IAG Portal session starter. Lives at iag-react/docs/prompts/SESSION_STARTER.md.
     Chat 1 (bootstrap) fills every <PLACEHOLDER> with real values and commits this file.
     Edit here, then re-copy — Jake pastes it by hand at the start of every chat. Last updated: 2026-09-03 (chat 8 wrap-up). -->

# IAG PORTAL SESSION STARTER

## STEP 0 — READ FIRST

Before anything else: **read `C:/iag-react/docs/SESSION_REFERENCE.md` IN FULL.** It is capped at 250 lines and is genuinely readable end to end — do not skim it, do not grep it for the one line you think you need.

Then **RUN the `DERIVE-AT-START` command block at the top of that file and state the results back to me** — live function version, latest tags, action count, check baselines — **before any other work.** Volatile facts come from those commands, never from prose: if a sentence in a doc disagrees with the command output, the command wins and the doc is stale.

**Pay special attention to the `SECURITY INVARIANTS` box — non-negotiable; re-check them on any table / policy / handler / function change.**

## THE DOC MAP IS BINDING

The hub carries a `DOC MAP`. Before editing ANY area, read the doc(s) it names for that area. Docs are maps, not gospel — verify against the code, and **if the work reveals a doc is wrong, fixing that doc is part of the task, not a follow-up.**

## NON-NEGOTIABLE SAFETY RULES

- NEVER deploy to production without explicit approval: backend = `scripts/deploy-function.sh` from the backend worktree (Management API upload, GOTCHA #13) — from PowerShell run it as `& "$HOME\scoop\apps\git\current\usr\bin\bash.exe" scripts/deploy-function.sh`, because a bare `bash` there is the WSL relay stub (GOTCHA #15), frontend = `npm run deploy` (**`npm run deploy` IS a production deploy** — vite build + gh-pages to the live URL).
- **NEVER use the `supabase` CLI to deploy, and never log it into this account.** The CLI has a single machine-wide login and it belongs to VFO. Backend deploys go through `scripts/deploy-function.sh`, always (invoked via the scoop Git Bash binary when you are in PowerShell — GOTCHA #15) — the MCP `deploy_edge_function` tool no longer fits either, because it requires every file passed inline and the function is long past that size.
- NEVER expose secrets in chat (API keys, tokens, passcodes). `supabase/.env.local` is gitignored; keep it that way. Jake sets all secret values himself — Claude only ever names the key.
- NEVER skip the `deno check --no-lock` gate after non-trivial backend changes.
- NEVER add retries on timeout to non-idempotent write actions in `src/lib/api.js` — reads retry once, writes never (this rule exists because retrying writes created a double-write bug on VFO).
- The Stripe account is the IAG Portal's own. Never reference VFO's Stripe account, keys, customers, or webhooks from this codebase — and vice versa.
- Every new public table ships with RLS deny-all in the SAME migration, and every DB change ends with a green security advisor run.

## PATH GUARDRAIL — READ BEFORE ANY FILE OPERATION

You work in worktrees, not main checkouts. The ONLY valid paths for Edit/Write/NotebookEdit:
- `C:\iag-react\.claude\worktrees\<branch>\...`
- `C:\iag-edge-functions\.claude\worktrees\<branch>\...`

FORBIDDEN edit paths (main checkouts): anything else directly under `C:\iag-react\` or `C:\iag-edge-functions\` — **including `docs\`, which exists in BOTH main and worktree; only the worktree copy is safe to edit.** Also forbidden always: any path under `C:\vfo-react\` or `C:\vfo-edge-functions\` (the VFO portal — read-only reference at most, never edit from an IAG chat).

Before EVERY Edit/Write call: confirm the `file_path` begins with one of the two worktree prefixes. If not, STOP and say so. Reading main-checkout files for inspection is fine — re-resolve to the worktree path before editing. If you violate this: revert the main-checkout edit with `git checkout --`, re-apply in the worktree, verify `git status` in both (main clean, worktree shows the change).

At the start of every chat, run `git worktree list` in each repo and state which worktree path corresponds to your branch.

## GIT / BRANCH SAFETY

- **NEVER work directly on `main`** in either repo. Check with `git rev-parse --abbrev-ref HEAD`; if on main, STOP and propose a worktree.
- Worktrees: `<repo>\.claude\worktrees\<branch>`; branch naming `feature/<name>`, `fix/<bug>`, `claude/<descriptor>`, `docs/<descriptor>`; same branch name in both repos.
- **Don't push, don't merge, don't deploy without explicit approval.** Read-only inspection is always fine.

## SAVE-POINT SYSTEM

- Production is bookmarked with git tags: `live-N-<short>` on iag-react, `backend-good-YYYY-MM-DD-vNNN` on iag-edge-functions. "Restore to <tag>" from me overrides everything.
- PRs merge via GitHub "Squash and merge" — one chat = one commit on main.
- Frontend rollback = redeploy a live-N tag; backend rollback = Supabase Dashboard version revert.
- The current tag is NEVER hard-coded — derive it: `git tag -l 'live-*' --sort=v:refname` / `git tag -l 'backend-good-*' --sort=v:refname`.

## WORK RULES

- Preserve existing behavior unless explicitly approved; flag suspected dead code and ask, never silently remove.
- Small phases > giant rewrites; explain risks BEFORE changes; flag uncertainty explicitly.
- Default to no code comments; add one only when WHY is non-obvious.
- Tests don't exist — verify via curl smoke checks + my click-through. **After every phase touching user-facing behavior, stop and hand me a numbered test script** (what to click, what URL, what to look for) and wait for my confirmation. I do the testing, not Claude.
- **No half checks:** exercise every branch of a multi-branch handler before declaring complete.
- **Execute SQL for me via the Supabase MCP** (`execute_sql` / `apply_migration` on project `gqznnyccridnpipjipeq`) — don't paste SQL at me. Every migration applied via MCP is ALSO committed as a file.
- Show any email subject+body in chat for approval before seeding/editing email templates.
- **Every approved change ends at DEPLOYED, not merged.** Backend → `scripts/deploy-function.sh` (GOTCHA #15 for how to invoke it); frontend → `npm run deploy`; DB → migration applied via MCP. If work spans both repos, both deploy or the un-deployed half is flagged EXPLICITLY in the final summary. `npm run deploy` requires fresh explicit approval every time.
- Fix small adjacent bugs on the spot; batch all deploys to the end of the session. Don't nag about frontend deploys mid-chat — raise at session end.

## RESPONSE PROTOCOL

**Non-trivial tasks:** summarize understanding → list affected files (verified by Read/Grep, not guessed) → risks → phased plan with checkpoints → test strategy → rollback strategy → WAIT for approval.
**Trivial tasks** (1–2 files, no auth/dispatch/money involvement): proceed, report what you did.
**Destructive ops** (`rm -rf`, force-push, any deploy, `git reset --hard`): always ask first, every time.
**Style:** short scannable answers; one terminal command at a time during ops; disclose scope changes; no secrets in chat; separate doc commits from code commits; no emojis.

## SESSION STARTUP — RUN BEFORE ANY OTHER WORK

1. **Sync both repos** (`C:\iag-react` and `C:\iag-edge-functions`): `git fetch origin && git checkout main && git merge --ff-only origin/main` — local main is not authoritative, origin/main is.
2. **Create matching worktrees in both repos** (branch specific to this chat): `git worktree add .claude/worktrees/<chat-branch> -b <chat-branch> main`. Never reuse a prior chat's worktree — if the chat opens inside one, STOP and propose fresh ones.
3. **Freshness check** in each worktree: `git fetch origin && git rev-list --count HEAD..origin/main` — if not 0, STOP and `git merge origin/main` before any edits. Never edit, test against, or deploy from a stale worktree.
4. **Confirm worktree paths** aloud; refer back to them for every edit.
5. **Start the dev server:** `cd C:\iag-react\.claude\worktrees\<chat-branch>; npm run dev` — NO `VITE_API_URL` override; this hits the real Supabase project `gqznnyccridnpipjipeq`, real database, real Gmail drafts, real Stripe (test mode until go-live). Never `supabase functions serve`, never `supabase start`. I log in with my real credentials; there is no test login. Note the port Vite prints; a stale server from a removed worktree may hold 5173 (GOTCHA #19).

## ENDING A CHAT

- **WRAP UP** (`docs/prompts/SESSION_WRAPUP.md`) — runs when the work is ready to ship: docs audit, gates, commits, push, merge, deploy, tag. Run once per shipping unit, which may span several chats. **I decide when the work ships — never propose a wrap-up as a way to end a chat.**

There is no handoff flow. If a chat ends with work unfinished, simply stop and state where things stand; the next chat resumes on the same branch.

When I paste the wrap-up prompt: complete it in full, stop the dev server, and after I confirm merge, sync main in both repos, remove the chat's worktrees, verify with `git worktree list`.

## STANDING PREFERENCES — never make me repeat these

- **Delegation:** Fable plans the work and delegates; Opus executes; Fable reviews what Opus did and sends it back until it is right; Opus walks me through planning questions and testing; Opus checks while I test; Opus runs the wrap-up when I paste it.
- **Never deploy, merge, push a tag, or wrap up on your own initiative.** Ask every time, even if I approved something similar an hour ago.
- **Ask before assuming scope** — one question for genuine forks; settle everything else by reading the code.

## YOUR TASK

*First, run `git worktree list` in both repos and tell me the EXACT worktree path you'll be editing. Then confirm STEP 0 is done — hub read in full, DERIVE block run, results stated.*

The task text below is a plain-English instruction from me — it is the INSTRUCTION for this chat.

[TASK TEXT GOES HERE]
