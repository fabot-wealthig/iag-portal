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

**Superseded 2026-09-22 (chat 15):** names no longer matter — the COI's `members.sandbox` toggle
(migration 44) decides their Connect mode and every client's, and `update_coi` refuses to flip it once a
Connect account exists, so Trap 3's orphaning now needs an edit outside the portal; Trap 1 holds for the
toggle exactly as it did for names.

## #21 — Two lists hold the sessionStorage keys, and only one of them is named `SUB_STATE_KEYS`

**Symptom.** An admin signs out, a second admin signs in on the same browser, and the portal opens on the
first admin's payment, client or mothership. Or a new drill-in key is added, refresh-persistence works
perfectly, and the leak only shows up when two people share a machine.

**Cause.** The signed-in screen is twelve `wig*` keys: `wigActiveTab` plus the eleven in `SUB_STATE_KEYS`
(`src/pages/Portal.jsx`), which `goToTab` and the back links clear on navigation. But `AdminLogin.jsx`
cannot import that array without pulling `Portal.jsx` into the login bundle, so it clears the same keys
by **re-listing every string literal by hand** (`src/pages/AdminLogin.jsx`, in the `admin_login` success
path). The two lists agree today. Nothing enforces that they keep agreeing, and the failure is silent in
the only direction that matters: a key added to `SUB_STATE_KEYS` and forgotten in `AdminLogin` survives
a sign-in, because the keys deliberately outlive a reload (that is the whole point of standing UI rule
5 — a refresh lands on the screen it was fired from).

**Fix.** Adding a `wig*` key is TWO edits, always: `SUB_STATE_KEYS` in `Portal.jsx` AND the removal list
in `AdminLogin.jsx`. The same shape as the routes trap — a route needs `App.jsx` and `ROUTES` in
`scripts/emit-route-pages.mjs` — and it fails the same quiet way. To check the two are still in step,
count them: `AdminLogin`'s list must be exactly `SUB_STATE_KEYS` plus `wigActiveTab`.

## #22 — Stripe caches a REFUSED transfer under its idempotency key for 24 hours

**Symptom.** A COI's revenue share is refused by Stripe — on 2026-09-09 an `insufficient available
funds` on the platform balance, on a provider-funded record — and the row parks at
`rev_paid = "Failed"`, which is the design: Failed is non-terminal, and the retry button exists to
finish it. The balance is then funded, **Retry revenue share** is pressed, and the SAME refusal comes
back, instantly, with the same wording. So does the next press, and so does that night's sweep. The
share only becomes payable the following day, by accident.

**Cause.** The transfer's `Idempotency-Key` was `revshare-client-<payment_id>` — deterministic per
PAYMENT, which is exactly what GOTCHA-free double-pay protection asked for and exactly what makes a
refusal permanent. Stripe replays the FIRST response it saw for a key for 24 hours, and **an error is
a response**. Every retry after the first refusal was answered out of Stripe's cache without a
transfer ever being attempted, so nothing anybody did on this side — funding the balance, fixing the
COI's account — could change the answer until the cache expired. It is not specific to
provider-funded records; LEOS behaves identically, and it had simply never been refused before.

**The rule now: the key is deterministic PER ATTEMPT, and the row stores it.**
`revenue-share.ts` mints `revshare-client-<payment_id>-<Date.now()>` and writes it in the SAME
conditional update that claims the transfer (`rev_paid` → `"processing"`), so the key and the
in-flight state land together or not at all, in `client_payments.rev_idempotency_key`. It is REUSED
in exactly one case — a **mid-flight resume**, previous state `"processing"`, reachable only under
`force` — where a transfer may already exist at Stripe under that key and must not be made twice.
From null, `"Awaiting Payout Account"` or `"Failed"` a FRESH key is minted: in the first two nothing
was ever attempted, and in the third Stripe itself confirmed no transfer exists.

**Both guards are still required, and neither has been weakened.** The conditional CLAIM is what
stops two concurrent deliveries reaching Stripe; the key is what stops a committed transfer whose
response was lost from being created twice. What changed is only the SCOPE of the key — one attempt
instead of one payment. A fresh uuid per CALL would still be wrong: the key has to survive the
process that sent it, which is why it is a column and not a local variable.

**How to recognise it.** A retry that answers with a byte-identical Stripe message with no network
delay, and no new transfer in the Stripe dashboard for that account. `rev_idempotency_key` on the row
tells you which key the last attempt used; if a retry is answering out of the cache, that key is
older than the fix. The same trap applies to ANY Stripe call this portal ever sends a fixed key with:
a key scoped wider than the attempt turns a transient refusal into a day-long one.

## #23 — A provider-funded record's COI transfer draws on the platform balance

**What is different.** On Boxhouse, 831(b) and DCD **no client money enters Stripe at all**. The
client pays the provider, the provider pays Wealth IG (usually by bank transfer, often one lump sum
covering several clients), and an admin marks the revenue received. There is no Checkout session, no
PaymentIntent and therefore no `source_transaction` to attach the COI's transfer to — a LEOS transfer
names the charge the client's money arrived on and draws on those funds, and a provider-funded one
has nothing to name. It draws on **Wealth IG's Stripe balance at large**.

**So the balance has to be funded, and the designed behaviour is Failed-then-retry.** A transfer
Stripe cannot cover comes back refused, `rev_paid` goes to `"Failed"`, the `rev_share_failed` bell
fires, the payments list shows "Revenue share failed" and the row waits. That is not a bug and must
not be "fixed" by pre-checking the balance: the share is owed either way, Failed is non-terminal on
purpose, and the retry button and the nightly sweep's leg A both come back for it. What clears it is
money in the platform balance — after which a retry succeeds, and a retry now CAN succeed (#22).

**The operational consequence — Jake's call, 2026-09-10 (option A).** When a provider pays Wealth IG
the money lands in a bank account, not in Stripe. Wealth IG tops up the Stripe balance ("Add funds"
from the bank) when a provider pays; until it covers the shares those records owe, they sit Failed
and the retry button and sweep leg A pay them the moment it does. No code; it is the one manual step
this pipeline has.

**In the sandbox, the dashboard's Add funds was NOT enough.** On 2026-09-09 a $50,000 top-up showed
as Available on the Balances page and the transfer was still refused with `insufficient available
funds`. What worked was Stripe's own advice: a charge through the Charges API with
`source=tok_bypassPending` (the token form of test card 4000 0000 0000 0077), run from Jake's own
terminal with the sandbox secret key — that lands in AVAILABLE at once. Even then the retry replayed
the cached refusal until #22 was fixed; only then did it pay.
Do not read a refused retry after a dashboard top-up as the fix not working.

## #24 — The deploy script runs from Claude's Bash tool, not from Claude's PowerShell tool

**Symptom.** On 2026-09-10, invoking the backend deploy the way GOTCHA #15 documents it — through
Claude's **PowerShell** tool — failed twice, and neither failure named the real problem:

```
& "$HOME\scoop\apps\git\current\usr\bin\bash.exe" scripts/deploy-function.sh
dirname: command not found
...
fatal: not a git repository (or any of the parent directories)
```

It reads like a broken script or a worktree problem. It is neither: the script is fine and the
worktree is a worktree.

**Cause.** That `bash.exe` was launched with a PATH that had no coreutils on it, so `dirname` — and
`git`, at the second failure — simply were not there to be found. #15's command is correct **from a
real PowerShell console**, where the environment carries them; started from inside Claude's
PowerShell tool it inherits an environment that does not.

**Fix.** From Claude's tools, run the deploy with the **Bash tool**, which IS Git Bash and carries its
own coreutils:

```
bash scripts/deploy-function.sh
```

That is what worked the same day, first try. So the rule is by CALLER, not by shell name:

- **A real PowerShell console (Jake typing):** `& "$HOME\scoop\apps\git\current\usr\bin\bash.exe" scripts/deploy-function.sh` (#15 — a bare `bash` there is the WSL relay stub).
- **A Git Bash window, or Claude's Bash tool:** `bash scripts/deploy-function.sh`.
- **Claude's PowerShell tool:** don't. Switch to the Bash tool.

**How to recognise it.** If `bash.exe` answers `dirname: command not found`, `git: command not
found`, or any other missing-coreutils error, the binary is right and its PATH is wrong — use Git
Bash rather than hunting for a fault in the script.


## #25 — A dev-server test of an emailed link needs the HOST swapped; the token is the same

**Symptom.** Testing a new `/pay` page on the Vite dev server, Jake copied the pay link off the payment
detail and saw the OLD page (ACH only), then swapped the host by hand and got "This payment link is
not valid."

**Cause.** Two separate things. The copied link is built by the BACKEND from `PORTAL_BASE`, so it
always points at `portal.wealthig.com` — the deployed frontend, which until `npm run deploy` is the
previous build. And a 64-character hex token retyped or partially selected loses a character, and
`load_pay_link` answers the deliberately generic `invalid` state for ANY unknown token (it is an
anti-oracle by design), so the page cannot tell you the token was mangled.

**Fix.** Keep the token, replace only the host:

```
http://localhost:<vite port>/pay?token=<the 64-hex token from the copied link>
```

Read the token straight off `client_payments.checkout_token` via the MCP when in doubt (a SANDBOX
row only — a live token is a live credential), and confirm the backend sees it before blaming the
page:

```
curl -s -X POST <function url> -H "Content-Type: application/json" -d '{"action":"load_pay_link","token":"<token>"}'
```

`{"state":"ready", ...}` means the page is wrong; `{"state":"invalid"}` means the token is.


## #26 — The app's terminal tab reaches the scoop `bash.exe` but not the coreutils beside it

**Symptom.** On 2026-09-17, Jake ran the documented PowerShell deploy — GOTCHA #15's command — from
the **terminal tab inside the Claude desktop app** rather than from a standalone PowerShell console,
and got #24's failure even though the caller was a real PowerShell:

```
& "$HOME\scoop\apps\git\current\usr\bin\bash.exe" scripts/deploy-function.sh
dirname: command not found
...
fatal: not a git repository (or any of the parent directories)
```

**Cause.** Exactly #24's cause, from a caller #24 did not name. `bash.exe` resolves because the path
is absolute; `dirname`, `find` and `git` live in `usr\bin` and `mingw64\bin` **beside** it and are
found only via PATH, and the environment the app hands its terminal tab does not carry them. So the
rule "PowerShell console good, Claude's PowerShell tool bad" was never about PowerShell at all — it
is about whether the PATH that launched the shell has Git's own bin directories on it.

**Fix.** `scripts/deploy.ps1` in the backend repo, which prepends both directories and then runs the
same script through the same binary:

```
.\scripts\deploy.ps1
```

One command, from a PowerShell console OR the app's terminal tab, from the repo root or any worktree.
Nothing else changes: it is still `scripts/deploy-function.sh` doing the multipart upload (#13), the
token is still read from the gitignored `.mcp.json` and never printed, and the `supabase` CLI is
still never touched. From a Claude session the Bash tool remains the way (`bash
scripts/deploy-function.sh`, #24) — the Bash tool IS Git Bash and carries its own coreutils.

**How to recognise it.** Any missing-coreutils error out of `bash.exe` — `dirname: command not
found`, `git: command not found` — means the binary is right and its PATH is wrong, whatever shell
you are sitting in. Reach for `deploy.ps1` rather than hunting for a fault in the script (#15, #24).

## #27 — A worktree with no `node_modules` borrows the main checkout's, which has no `@sentry/react`

**Symptom.** On 2026-09-22, `npm run build` in a fresh frontend worktree
(`C:\iag-react\.claude\worktrees\<branch>`) failed before bundling anything:

```
Rollup failed to resolve import "@sentry/react"
```

`package.json` lists `@sentry/react` and `package-lock.json` pins it, and `src/main.jsx` and
`ErrorBoundary.jsx` import it, so the manifest looked right and the code looked right.

**Cause.** A git worktree is a checkout of the TRACKED files, and `node_modules` is gitignored, so a
new worktree has none. Node's module resolution then walks UP the directory tree —
`<branch>\node_modules`, `worktrees\node_modules`, `.claude\node_modules`, `C:\iag-react\node_modules`
— and finds the main checkout's install. That install predates the Sentry wiring
(`integrations/sentry.md`) and has no `@sentry` directory at all. Vite itself resolves from the same
borrowed tree, which is why the build got as far as Rollup rather than failing on a missing `vite`.

**Fix.** Install INSIDE the worktree, from the lockfile:

```
npm ci --no-audit --no-fund
```

`npm ci` installs exactly what `package-lock.json` says and never rewrites it, so the tracked files are
untouched and `node_modules` stays out of git. The build then passes. The same cure applies to the
main checkout: until its `node_modules` is reinstalled, `npm run dev` and `npm run deploy` from
`C:\iag-react` fail the same way (the deploy builds first, so nothing is published).

**How to recognise it.** Any `failed to resolve import "<package>"` for a package that IS in
`package.json` means the `node_modules` being read is older than the manifest — usually a borrowed
one. Check for a `node_modules` directory in the folder you are building from before suspecting the
code or the lockfile.

## #28 — The hard-cost claim matches the EXACT prior state, never a list of claimable ones

**The shape that looks right and is not.** `revenue-share.ts` claims `rev_paid` with an `.or()` of
every state it may start from — null, `Awaiting Payout Account`, `Failed`, plus `processing` under
`force`. Copying that into `actions/payments/hard-costs.ts` (chat 15, the legal and admin fee transfers)
would open a double payment. Sweep leg H and an admin's Retry (which always passes `force`) both
read a cost at `Failed`. The sweep claims first and writes `processing` with a FRESH key K1. The
retry's claim then runs with `processing` on its forced list, so it matches the sweep's claim and
overwrites it with a SECOND fresh key K2 — its own read saw `Failed`, not a stored key to resume.
Two claims, two keys, two transfers, and Stripe dedupes neither.

**The rule.** The claim is `.eq("{cost}_paid", prev)` — or `.is(null)` — where `prev` is the value
THIS run read, and on a forced resume from `processing` it ALSO matches `.eq("{cost}_idempotency_key",
storedKey)` and reuses that key. Whoever moved the row after our read makes our claim change zero
rows, and a zero-row claim stops.

**The second half: a resume skips the pre-checks.** Before claiming, a normal run checks the payee's
mode, reads their account and may write `Awaiting Payout Account` or `Failed`. A resume from
`processing` must NOT: the dead run's transfer may already exist at Stripe, and writing Held or Failed
over the claim throws away the stored key, so the next attempt mints a fresh one and pays twice. A
resume goes straight to Stripe under the stored key and lets Stripe's replay answer (#22). The same
reasoning keeps the claim on a Stripe `idempotency_error`: that is not proof no transfer exists.

**How to recognise it.** Any claim written as "the states I am allowed to start from" rather than
"the state I just read" is this bug waiting for a second caller. `revenue-share.ts` had exactly that
list until late in chat 15, and was brought to this entry's shape in the same chat, with one more
guard found in review: a run WITHOUT `force` that reads `processing` must stop without writing, or
its Held/Failed lands on a live claim and that claim's success write misses.

## #29 — Claude's shells cannot run the anon-key probe; Jake runs `scripts/anon-probe.ps1`

**Symptom.** In chat 15 (2026-09-22), DERIVE #8 — GET every table with the anon key and expect
`Content-Range: */0` — was refused by the auto-mode permission classifier from BOTH of Claude's shells
(the Bash tool and the PowerShell tool); Jake ran it by hand. The probe is a live read of the
production project with a real (publishable) key, and the classifier treats it as such.

**Fix.** Do not work around it. `scripts/anon-probe.ps1` in the backend repo is the probe as one
PowerShell 5.1 script: it reads the key from `$env:IAG_ANON_KEY` (never from a file or the chat),
GETs all 18 tables with the key as both `apikey` and `Authorization: Bearer` plus `Prefer:
count=exact` (never `curl -I`, #7), prints each table's `Content-Range`, and ends `ALL 18 = */0
(PASS)` or `<n> table(s) NOT */0 (STOP)`. Claude hands Jake the line; Jake runs it and pastes the
result:

```
cd C:\iag-edge-functions; $env:IAG_ANON_KEY = "<anon key>"; .\scripts\anon-probe.ps1
```

**Keep the list current.** A new table goes into the script's `$tables` in the same change that
creates it, or the probe passes on a table it never asked about.
