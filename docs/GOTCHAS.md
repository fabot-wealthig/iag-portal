# GOTCHAS

Hard-won traps, **append-only and oldest-first**. Entries are numbered permanently from #1 and are
NEVER renumbered, even if an entry later becomes obsolete — other docs and commit messages cite
these numbers. New entries go at the END of the file with the next number after the current max.

Nothing is deleted here. If an entry stops applying, say so inside the entry; leave the number.

## #1 — PowerShell 5.1 has no `&&`, no `tail`, and `Out-File` writes BOMs

This machine runs Windows PowerShell 5.1, not PowerShell 7. Consequences that bite every session:

- The `&&` and `||` pipeline chain operators do not exist and produce a parser error. Chain with
  `;`, or use `A; if ($?) { B }` when the second command should only run on success.
- There is no `tail` (and no `head`). Use `Get-Content <file> -Tail N` / `-TotalCount N`, or
  `Select-Object -Last N` / `-First N` in a pipeline.
- `Out-File`, `>`, and `Set-Content` write byte-order marks or ANSI-encoded text depending on the
  cmdlet. Files written that way break tools that expect clean UTF-8 — git commit messages in
  particular. Use the editor tools (Write/Edit) for any file content, or `git commit -m` flags.

## #2 — `gh-pages` publishes from a cache clone that ignores repo-local git config

`npm run deploy` does not push from the working checkout. The `gh-pages` package makes its own
clone under `node_modules/.cache/gh-pages/` and pushes from there — so every `git config` set with
`--local` in `C:\iag-react` is invisible to the push that actually matters.

This surfaced as a credential failure: the repo-local `credential.useHttpPath true` (which lets Git
Credential Manager keep separate credentials per GitHub account) was simply not seen. The fix is a
GLOBAL scoped setting, which the cache clone does inherit:

```
git config --global credential.https://github.com/fabot-wealthig.useHttpPath true
```

Keep the per-repo setting too. And after ANY failed publish, delete `node_modules/.cache/gh-pages`
before retrying — the cache clone keeps the broken remote state and will fail again identically.

## #3 — The edge function version bumps on SECRET changes, not just code deploys

Supabase increments the edge function version number every time a function SECRET is added or
updated, exactly as it does for a code deploy. `iag-admin-api` went 1 → 2 → 5 → 11 during chat 1
with only THREE actual code deploys; the other eight bumps were secret writes.

Consequences: the version number is not a deploy counter, a version jump is not evidence that code
changed, and "v11" means only "this is what is live right now". Always read the live version from
MCP `list_edge_functions` rather than inferring it. The `backend-good-YYYY-MM-DD-vNNN` tag records
the version that was live at tag time, which is still the right thing to tag on.

## #4 — CORS `Allow-Headers` is `Content-Type, Authorization` only — never send `apikey`

`utils/cors.ts` sets `Access-Control-Allow-Headers: "Content-Type, Authorization"`. A frontend
request carrying the usual Supabase `apikey` header therefore fails at the CORS PREFLIGHT, before
any handler runs — and the browser reports it as an opaque network/CORS error rather than
anything that points at the header.

This bit chat 1: the API client sent `apikey` out of habit (it is required for PostgREST, but this
function is not PostgREST). The header was removed from `src/lib/api.js`. Do not re-add it without
adding it to `Access-Control-Allow-Headers` in `utils/cors.ts` in the same change.

## #5 — Backend deploys go through the Supabase MCP, never the `supabase` CLI

**Superseded in part by #13 (2026-09-02):** the MCP tool no longer fits this function, so deploys
now run `bash scripts/deploy-function.sh`. The CLI half of this entry is unchanged and still binding.

Deploy with the MCP `supabase-iag` tool `deploy_edge_function` on project `gqznnyccridnpipjipeq`.

Do NOT run `supabase functions deploy`. The supabase CLI holds a single machine-wide login, and on
this machine that login belongs to the **VFO** account. Logging the CLI into the IAG account to
deploy would silently break VFO's tooling — and logging back and forth is a foot-gun that will
eventually deploy the wrong code to the wrong project. The CLI stays on VFO; IAG uses MCP.

## #6 — Project MCP server changes need an app restart (sometimes two)

The `supabase-iag` server is defined in the project-scoped `C:\iag-edge-functions\.mcp.json`
(gitignored — it contains a PAT). Edits to that file do not hot-reload; the app must be restarted
before the server appears or picks up changes.

The FIRST load needed two restarts: `npx` had to download `@supabase/mcp-server-supabase`, and the
initial startup timed out while the download was still running. If the server is missing after one
restart, restart once more before assuming the config is wrong.

## #7 — The anon RLS probe must be a GET with `Prefer: count=exact`, never `curl -I`

The chat-1 hub documented the anon-key probe as `curl -s -I -H "Range: 0-0" ...` and expected
`Content-Range: */0`. It does not produce that. A HEAD request answers `Content-Range: */*` —
PostgREST reports "range unknown" rather than a row count — and it answers `*/*` whether the table
is locked down or wide open. Run that way, the probe is a check that can never fail.

The form that actually proves deny-all is a GET that asks for an exact count:

```
curl -s -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Prefer: count=exact" -o /dev/null -D - \
  "https://gqznnyccridnpipjipeq.supabase.co/rest/v1/<table>?select=*" | grep -i content-range
```

`Content-Range: */0` from that command means the anon role genuinely sees zero rows. The general
lesson is worth more than the command: a verification step whose expected output does not match
what it actually emits is worse than no verification, because it reads as green forever.

## #8 — Never use `.ilike()` for a case-insensitive email match — `_` and `%` are wildcards

A duplicate-email guard written as `.ilike("email", submitted)` is wrong. In SQL `LIKE` patterns,
`_` matches any single character and `%` matches any run — and both are perfectly ordinary
characters in an email address. So `.ilike("email", "a_b@x.com")` also matches `axb@x.com`, and any
address containing `%` matches far more. The failure mode is a false "already exists" rejection of a
legitimate address, which looks like a bug in the form rather than in the query.

Fetch the column and compare in code instead — `String(r.email ?? "").toLowerCase().trim() === x` —
which is what `add_coi`, `update_coi` and `add_admin` all do. At these table sizes the scan is free,
and those handlers already read the roster for other reasons.

## #9 — Login inputs need `id` + `name` + `autoComplete` AND a ref fallback

A password manager can fill a React-controlled input without firing `onChange`, which leaves the
component's state empty while the box on screen visibly contains the credential. Submitting then
posts `""` and the server records a login failure — and after five of those the throttle locks the
account out, for a passcode the person never actually typed wrong.

`src/pages/AdminLogin.jsx` therefore keeps refs on both inputs and reads
`state || ref.current?.value` at submit time, and both inputs carry `id`, `name` and
`autoComplete` (`username` / `current-password`) so the manager can match and UPDATE a saved entry
instead of re-filling a dead one. Do not "simplify" the refs away. Ported from VFO, which hit this
in production (their GOTCHA #354).

## #10 — The Supabase MCP personal access token EXPIRES, and every MCP tool dies at once

The PAT in `C:\iag-edge-functions\.mcp.json` is a Supabase **personal access token**, and the
dashboard's default expiry is **7 days**. The first one issued for this project hit that limit
mid-project. The failure mode is not a helpful message: every `mcp__supabase-iag__*` tool starts
returning `Unauthorized`, all at the same moment, which reads like the project or the network broke
rather than like a credential aged out.

Fix: mint a new token at supabase.com/dashboard/account/tokens, replace the value in `.mcp.json`,
and restart the app (GOTCHA #6 — sometimes twice). Choose a long expiry, or expect this again. The
tell is that reads AND writes fail together and instantly; a real outage usually degrades one
surface first.

## #11 — MCP write tools need an allowlist entry before auto-mode will run them

Claude Code's auto-approval mode refuses MCP tools that are not allowlisted, so `apply_migration`,
`deploy_edge_function` and `execute_sql` silently never ran — the session appeared to stall on
"permission" rather than reporting a blocked call.

The allowlist entry is `mcp__supabase-iag` in `C:\iag-edge-functions\.claude\settings.local.json`.
That file is **machine-local and gitignored**, so it does NOT travel with the repo: a fresh clone,
a new machine, or a teammate's checkout starts blocked again, and the fix has to be re-applied by
hand. Read-only MCP tools are unaffected, which is why the problem shows up only at the first write.

## #12 — Never answer 401 for a server-side failure — the frontend signs the admin out

`src/lib/api.js` treats ANY 401 as a dead session: it clears the stored session and hard-navigates
to the login page. So a 401 is not a generic "request failed" — it is a statement that the
credential is no good, and the browser acts on it destructively and immediately.

`middleware/auth.ts` originally destructured only `data` from its two Supabase reads
(`const { data: session } = await ...`). On a transient DB or network error `data` comes back null,
the code read that as "no such session", and answered 401 — so a database blip signed a working
admin out mid-session. Jake hit this twice, and the logs showed two 401s from his own browser with
perfectly normal request bodies.

The rule: capture `error` on EVERY query in the auth path and return **500** ("Something went wrong
— please try again.") when it is set; reserve 401 for a genuinely absent, expired or unmatched
credential. Check the error BEFORE the `!data` branch, because a failed query produces null data too
and would otherwise fall straight through into the 401. Every 401 path also logs
`auth 401: <reason> action: <action>` so a future "I got signed out" report names its own branch —
never log token values. Note the VFO portal still has this bug in all six of its identity queries.

## #13 — The MCP deploy tool cannot carry the function past ~45 files; deploy with `scripts/deploy-function.sh`

**Symptom.** A backend deploy through MCP `deploy_edge_function` never finishes. There is no error
and no rejection — the call simply does not complete. On 2026-09-02 an agent sat on one for
**16 minutes** with the live version never leaving v15, which reads like a hung network call rather
than a request that was too big to emit.

**Cause.** That tool takes every file of the function as inline text in a single call, so the whole
function has to be written out again to redeploy it. `iag-admin-api` was **47 files / ~155 KB** the
day it hung and is **51 files / ~178 KB** as of chat-5, which is past what one response can carry.
The limit is the response, so it will only get worse as the function grows; this is a permanent
change of deploy path, not a bad day.

**Fix.** `bash scripts/deploy-function.sh` from the backend repo or any worktree. It streams the
same files as a **multipart upload** to `POST https://api.supabase.com/v1/projects/<ref>/functions/
deploy?slug=iag-admin-api` — the exact Management API endpoint the MCP server itself calls, so the
result is identical. It reads the access token from the gitignored `.mcp.json` at the repo root
(located via `git rev-parse --git-common-dir`, so it works from a worktree) and never prints it. The
2026-09-02 v15 → v16 deploy took under 10 seconds and returned HTTP 201.

**What NOT to do.** Never the `supabase` CLI — GOTCHA #5 still stands, and its reason (the
machine-wide login belongs to VFO) is unchanged by any of this. And never try to split the upload
across two calls to fit the limit: this endpoint REPLACES the whole function with what it is given,
so a partial upload does not deploy half the change, it deploys a broken function.

## #14 — Windows Python cannot open a Git-Bash `/c/…` path

Bash scripts in this repo run under Git Bash, but `python` is the **Windows** interpreter. Git Bash
paths like `/c/iag-edge-functions/.mcp.json` are a Git-Bash fiction — Windows Python resolves them
against the drive root and fails with a bare `FileNotFoundError` naming a path that visibly exists,
which sends you looking for a permissions or gitignore problem that is not there.

`scripts/deploy-function.sh` sidesteps it by asking git for the path in Windows form:
`git rev-parse --path-format=absolute --git-common-dir` returns `C:/…`, which BOTH Git Bash and
Windows Python accept. Any new script that hands a path from bash to python, node or another Windows
binary must do the same — convert with `cygpath -m`, or get the path from git already converted.
Keep forward slashes; it is the `/c/` prefix that breaks, not the separator.

## #15 — In PowerShell, bare `bash` is the WSL relay stub, not Git Bash

**Symptom.** `bash scripts/deploy-function.sh` typed into PowerShell dies before the script runs:

```
WSL (9 - Relay) ERROR: CreateProcessCommon:800: execvpe(/bin/bash) failed: No such file or directory
```

It reads like a broken script or a missing file in the repo. It is neither — nothing in the repo has
been reached yet.

**Cause.** A bare `bash` in PowerShell resolves to `C:\Windows\system32\bash.exe`, the Windows→WSL
relay stub. `Get-Command bash -All` lists it first, then the WindowsApps alias. With no Linux distro
installed the stub has no `/bin/bash` to relay to, so it fails on its own. Git Bash on this machine
is installed by **scoop**, at `C:\Users\jakel_fjetgbx\scoop\apps\git\current\usr\bin\bash.exe`, and
is NOT on PATH under the name `bash`.

**Fix.** From PowerShell, call the Git Bash binary by path:

```powershell
& "$HOME\scoop\apps\git\current\usr\bin\bash.exe" scripts/deploy-function.sh
```

From a **Git Bash** window, `bash scripts/deploy-function.sh` works exactly as written — and so does
it from a Claude session, because Claude's Bash tool IS Git Bash. That is why the same command can
succeed for the agent and fail for Jake in the same repo, which is the confusing part.

## #16 — A supabase-js `.select()` string must be ONE string literal

**Symptom.** `deno check` answers with a wall of errors — 32 at once the day this was found — every
one of them this shape, and not one of them pointing at a query:

```
Property 'payment_status' does not exist on type 'GenericStringError'.
```

The properties it names are real columns, spelled correctly, on a table that exists. Renaming them,
typing the row into a local, or adding fields to the select changes nothing, so the search goes to
the generated types and the Supabase version — neither of which is the problem.

**Cause.** `@supabase/supabase-js` derives the row type from the LITERAL TEXT of the select. Wrapping
a long select to stay inside the line length is the natural thing to do:

```ts
.select(
  "id, client_id, strategy_key, total_fee, " +
    "payment_status, payment_date, invoice_number",
)
```

but a concatenation is not a literal. Its type widens to plain `string`, the library's parser has
nothing to parse, and the row type collapses to `GenericStringError`. Every property read on that
row is then a TS2339 — which is why ONE query produces dozens of errors, scattered across the file
that consumes it rather than the line that caused it.

**Fix.** A single string literal, however long the line. Line length is worth less than the type.

**Why it is not already broken everywhere.** `actions/payments/load-client-payments.ts` still
concatenates its select and passes the type gate, because its rows are consumed as `any` — nothing
ever reads a property off the collapsed type. That is the trap: the pattern is sitting in the
codebase looking correct, and it detonates in the next file that types its rows.

## #17 — The edge runtime's `SUPABASE_SERVICE_ROLE_KEY` is the new-format secret key, not the legacy JWT

**Symptom.** The `payment-sweep-daily` cron job fires on schedule and `net._http_response` shows a
clean `401 {"error":"Service-role authorization required"}`. Nothing runs, and nothing else looks
wrong: the job is registered and active, the Vault secret `iag_service_role_key` exists and is
non-empty, the function is ACTIVE with `verify_jwt: false`, and the same POST sent by hand with the
same header is refused identically. The function logs show only the 401, because `run_payment_sweep`
answers its bearer gate before it does anything worth logging.

**Cause.** The Vault secret had been filled with the LEGACY `service_role` JWT — the long `eyJ…` value
under Project Settings → API → **Legacy API keys**. On this project the edge runtime's
`SUPABASE_SERVICE_ROLE_KEY` env var is NOT that string: it is the NEW-FORMAT secret API key from the
**Publishable and secret API keys** tab, which starts `sb_secret_`. Both are genuine credentials for
the same project with the same privileges, so neither one looks wrong anywhere — they are simply not
the same string. The gate is a `constantTimeEqual` against the env var, so from the outside "a valid
key, but the wrong one" and "garbage" are the same 401.

**How it was diagnosed, without the value ever being printed.** Two steps, both arranged so the secret
stayed inside the database:

1. **Prove the header survives the trip.** `net.http_post` was aimed at an httpbin echo endpoint with
   exactly the headers the job builds. The echo lands back in `net._http_response` as JSON, so the
   comparison was done IN SQL — the echoed `Authorization` against `'Bearer ' || (select
   decrypted_secret from vault.decrypted_secrets where name = 'iag_service_role_key')`, selecting only
   the boolean. It came back true. pg_net was sending the header intact and the Vault read was working,
   which cleared the entire transport path and left the VALUE as the only suspect.
2. **Prove the value is a real key for the right project.** The stored JWT's payload was decoded in SQL
   (base64 of the middle segment) and only its `ref` and `role` claims were selected — correct project
   ref, `role: service_role`, unexpired. So it was not a typo, not another project's key and not an
   expired one. It was the wrong FORMAT of the right credential, which is the one failure mode that
   survives every sanity check you would think to run.

**Fix.** Set the Vault secret to the `sb_secret_…` value from Project Settings → API → **Publishable
and secret API keys**, not to anything under **Legacy API keys**. The sweep answered 200 on the next
firing with no code change.

**Why it is easy to get wrong.** Every older doc, tutorial and StackOverflow answer calls this key "the
service_role key", and the Dashboard still offers a legacy key by exactly that name. The env var kept
its legacy NAME across the key-format change, so the name promises the JWT and the runtime holds the
`sb_secret_` key. VFO hit this too: the header of its `supabase/cron/accountant-sweep.sql` records the
same instruction in the same words, and is worth reading before wiring any future cron job in either
project.

**Applies to anything comparing against that env var**, not just the sweep: any future service-role
bearer gate, and any external caller (a scheduled job, a webhook relay) told to authenticate as
service-role. The value belongs in Vault or in function secrets and is never typed into a chat.

## #18 — When `supabase-iag` times out, the Management API answers every DERIVE read

**Symptom.** The session opens with `MCP server supabase-iag connection timed out after 30000ms`
(CONNECT_TIMEOUT). It happened on 2026-09-02 after a reboot and again on 2026-09-03. Every DERIVE-AT-START
row that names an MCP tool — the live function version, the security advisor, any read-only SQL — has no
tool to run, and the temptation is to skip the block and trust the prose. Do not: the whole point of
DERIVE is that the command wins over the doc.

**Fix.** The Supabase Management API answers all of it, using the SAME access token
`scripts/deploy-function.sh` already reads from the gitignored `.mcp.json` at the backend repo root. Locate
that root with `git rev-parse --path-format=absolute --git-common-dir` so it resolves from inside a
worktree, read the token out of the JSON, and NEVER print it — pipe it straight into the request header.
The three endpoints that cover the block:

- `GET https://api.supabase.com/v1/projects/<ref>/functions/iag-admin-api` — `version`, `status` and
  `verify_jwt` (DERIVE row 1).
- `GET https://api.supabase.com/v1/projects/<ref>/advisors/security` — the green baseline is `"lints": []`
  (DERIVE row 7).
- `POST https://api.supabase.com/v1/projects/<ref>/database/query` with `{"query": "..."}` — read-only SQL,
  for anything else the block needs.

**Rule: reads only.** Database WRITES still go through the MCP tools `execute_sql` and `apply_migration`,
because that path is the one that keeps every migration applied AND committed as a file. A schema change
pushed through the Management API would land in the database with no file behind it, which is exactly the
drift the migration convention exists to prevent. If the MCP is down and a write is needed, restart the
desktop app — that has brought the server back every time — rather than reaching for this fallback.

## #19 — A Vite dev server from a REMOVED worktree keeps its port

**Symptom.** `npm run dev` in a fresh worktree prints `Local: http://localhost:5175/` instead of 5173.
Port 5173 is held by a `node .../worktrees/<old-branch>/node_modules/.bin/vite` process whose directory
git no longer lists — the worktree was removed at a previous wrap-up but the server it was running was
never stopped, and a removed directory does not kill a process that already has it open. 5174 is VFO's.
The damage is silent: testing against 5173 tests LAST chat's code, on a branch that no longer exists,
and every symptom then looks like the current change failing to take effect.

**Fix.** Read the port Vite actually prints and use that one — never assume 5173. Before trusting any
port, check what owns it:

```powershell
Get-NetTCPConnection -LocalPort 5173,5174,5175 -State Listen |
  ForEach-Object { Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)" } |
  Select-Object ProcessId, CommandLine
```

The command line names the worktree the server is serving. Kill any orphan whose path is not the current
worktree. `constants/allowed-origins.ts` on the backend allows 5173-5176, so a Stripe checkout return URL
works from whichever of those ports Vite lands on — the port number is not the problem, serving the wrong
code from it is.

## #20 — Stripe mode follows the NAME, and a stamped payment keeps the mode it was raised under

**The rule** (Jake, 2026-09-04). There is no Stripe mode constant, no env var and no toggle. Anyone with
"Test" anywhere in their name runs in Stripe sandbox; everyone else runs LIVE. The decision lives in
`supabase/functions/iag-admin-api/utils/stripe-mode.ts` and nowhere else, and `stripeFetch` requires a
mode argument so a caller cannot silently inherit one.

**Trap 1 — renaming changes FUTURE payments only.** `start_client_payment` stamps the answer onto
`client_payments.sandbox` and every later call for that payment (`pay_link_checkout`, the webhook
booking, the revenue share) reads it back OFF THE ROW. So renaming "Test Client" to "Real Client" does
NOT make an existing sandbox payment live, and adding "Test" to a live client's name does not retire
their live payments to the sandbox. That is deliberate — the row is the authority for the same reason
`coi_level_at_payment` is — but it means the chip on a payment can disagree with the name on the client
above it, and both are correct.

**Trap 2 — a COI named "Test…" makes EVERY client under them sandbox.** The mode reads both names, and
either one is enough. A client called "Jane Smith" referred by "Test COI" raises sandbox payments. The
reason is the money: the revenue share is transferred to the COI's Connect account, which was created
under the COI's own name-derived mode, so a live payment under a sandbox COI could not be paid out at
all.

**Trap 3 — renaming a COI orphans their Connect account.** The account lives under whichever mode
created it. Rename a COI into or out of "Test" and `coi_connect_status` starts looking in the other mode
and finds nothing; it reports `mode_mismatch` rather than a red failure, and `connect_setup_link` logs
the mode it used. The fix is to rename them back, or to onboard them again in the mode they now belong
to — never to assume the account is gone.

**Consequence at go-live.** A COI or client whose name does not contain "Test" is LIVE from the first
click. There is no staging step between deploying this and moving real money; the roster IS the switch.
