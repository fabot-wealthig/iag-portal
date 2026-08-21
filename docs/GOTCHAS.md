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
