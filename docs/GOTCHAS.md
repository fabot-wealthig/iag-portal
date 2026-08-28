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
