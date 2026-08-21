# IAG PORTAL — SESSION REFERENCE (HUB)

The single always-loaded file: current state, binding invariants, and the map to every other doc.

> **SKELETON — completed at end of chat 1 (Phase 6).** Created 2026-08-21. Everything marked
> "(to be filled Phase 6)" is a placeholder, not a fact. Do not treat this file as authoritative
> until the Phase 6 pass lands. Hard cap once complete: 250 lines.

## DERIVE-AT-START

TODO (to be filled Phase 6) — this block will hold the exact commands a session runs before any
other work, plus the expected result of each. Planned contents:

- Live `iag-admin-api` version — Supabase MCP `list_edge_functions` (to be filled Phase 6)
- Latest frontend save-point tag — `git tag -l 'live-*' --sort=v:refname` (to be filled Phase 6)
- Latest backend save-point tag — `git tag -l 'backend-good-*' --sort=v:refname` (to be filled Phase 6)
- Action count — grep over the router/dispatch table in `supabase/functions/iag-admin-api/router/dispatch.ts` (to be filled Phase 6)
- Backend type gate baseline — `deno check --no-lock` (to be filled Phase 6)
- Frontend build baseline — `npm run build` (to be filled Phase 6)
- Security advisor green baseline — MCP `get_advisors`, type `security` (to be filled Phase 6)

Each line gets its expected output recorded in Phase 6. Command output always wins over prose.

## SECURITY INVARIANTS

These four are FINAL — not placeholders. Re-check them on any table, policy, handler, or function
change. An invariant change is a headline, never a quiet edit.

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

## DOC MAP

Binding: before editing an area, read the doc named for it. This table grows in Phase 6 and with
every branch that adds a doc surface.

| Doc | Covers |
| --- | --- |
| `docs/SESSION_REFERENCE.md` | This hub: current state, invariants, doc map. Read in full at session start. |
| `docs/CHANGELOG.md` | Narrative history, newest-first. One change = one entry = one squashed commit. |
| `docs/GOTCHAS.md` | Append-only numbered list of hard-won environment and code traps. |
| `docs/prompts/*` | `SESSION_STARTER.md` and `SESSION_WRAPUP.md` — pasted by hand by Jake. |

## LIVE STATE

(to be filled Phase 6)

## OWED

(to be filled Phase 6)

## WATCH

(to be filled Phase 6)

## PARKED

(to be filled Phase 6)

## ENVIRONMENT

- **OS / shell:** Windows 11, PowerShell 5.1 — no `&&` chaining, no `tail`, and `Out-File` writes
  BOMs. Prefer editor tools for file writes and separate commands for chaining.
- **Toolchain:** Node v24.14.0 · Deno 2.7.14 · Supabase CLI 2.78.1 · git 2.53.0 · gh CLI NOT installed.
- **Repos:** `fabot-wealthig/iag-portal` (public, frontend) and `fabot-wealthig/iag-edge-functions`
  (private, backend). Local checkouts `C:\iag-react` and `C:\iag-edge-functions`.
- **Live URL:** https://portal.wealthig.com (GitHub Pages; DNS at Squarespace).
- **Supabase project ref:** (Phase 2)
- **Edge function:** `iag-admin-api` (single function, Deno 2).
