# CHANGELOG

Narrative history of the IAG Portal, **newest entry first**.

Format: `## YYYY-MM-DD — headline`, followed by bullets describing what changed and why.

One change = one entry = one squashed commit on `main`. A change may span several chats; it still
gets exactly one entry. Superseded facts move here out of `docs/SESSION_REFERENCE.md` when the hub
is updated, so the hub only ever holds current state.

## 2026-08-21 — Bootstrap begun (chat 1)

- Created both repos under the `fabot-wealthig` account: `iag-portal` (frontend, Vite and React)
  and `iag-edge-functions` (backend, single Supabase edge function `iag-admin-api`). Each got a
  base commit on `main` carrying only a `.gitignore` and a `README.md`.
- Seeded the documentation system in `docs/`: this changelog, `GOTCHAS.md`, the hub skeleton
  `SESSION_REFERENCE.md`, and the two session prompts under `docs/prompts/`.
- Established the worktree workflow used by every later chat: work happens in
  `<repo>\.claude\worktrees\<branch>`, never in the main checkout, and `main` is written to only by
  a squashed merge. The bootstrap base commits are the one deliberate exception.
