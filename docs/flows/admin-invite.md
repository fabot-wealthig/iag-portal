# FLOW — Admin invite

How a new person becomes an admin who can sign in. Spans the Admin Editor (frontend), four
superadmin-only actions (backend), and the `login_setup_tokens` credential table.

**No email is sent anywhere in this flow.** The superadmin copies the link out of the UI and sends
it themselves. That is deliberate for now — see the hub's OWED section.

## The path

1. **Superadmin opens the Admin Editor.** The amber pill in the portal header renders only when
   `session.is_superadmin` is true. That is a convenience, not the boundary: every action below
   re-checks `auth.isSuperadmin` server-side and 403s otherwise.
2. **Add Admin** (`add_admin`) validates name + email, rejects a duplicate address
   case-insensitively (compared in code, never `.ilike()` — GOTCHA #8), and inserts an `admins` row
   with **`passcode` NULL** and `is_superadmin` false. A NULL passcode fails closed in
   `verifyPasscode()`, so the row cannot sign in until step 4. Superadmin is granted in the database
   deliberately, never by a form field.
3. **A setup token is minted** by the shared `issueSetupToken()` helper: 32 random bytes as hex,
   `expires_at` now + 14 days, `completed_at` NULL. Before inserting, every earlier uncompleted
   token for that email is **expired, not deleted** (`expires_at = now`), so `load_login_setup`
   can still tell an old link apart from a link that never existed. `add_admin` returns the token
   once, in the response that mints it; the editor renders it as
   `<origin>/set-password?token=<token>` in a copyable chip. It is never re-read from
   `load_admins`, so that render is the only chance to copy it.
4. **The new admin opens the link.** `/set-password` calls the PUBLIC `load_login_setup` — the
   token IS the credential, so the page has no session. Every failure answers HTTP 200 with a
   `state` (`invalid` / `already_setup`) rather than a 4xx, which would be a louder oracle.
   `submit_login_setup` hashes the chosen passcode (PBKDF2-HMAC-SHA256, 210k, salted; minimum 8
   characters), writes it to the `admins` row, and only then stamps `completed_at`. That order
   matters: a failed write that reported success would burn the token and lock the person out with
   no trace.
5. **They sign in** at `/login` like any admin. They get no Admin Editor pill, because they are not
   superadmin — and no secondary tabs either: `admins.allowed_tabs` defaults to `'{}'`, so a new
   admin starts with the COI tabs only. A superadmin grants the rest with the tab checkboxes on
   their row in the Admin Editor (`admin_update_tabs`).

## Re-issuing and removing

- **New setup link** (`issue_setup_link`) mints a fresh token for an existing admin — a lost link,
  an expired one, or a passcode reset. It retires the previous uncompleted links first, so there is
  never more than one live path into an account. The existing passcode is left in place and stops
  working only when the new link is actually used, so issuing a link nobody opens locks nobody out.
- **Delete** (`delete_admin`) removes the `admins` row, then that email's `admin_sessions` rows,
  then its `login_setup_tokens`. Ordered so the identity disappears first: with the `admins` row
  gone, `authenticate()` already 401s every session for that email on its next request, so the
  session sweep is cleanup rather than the thing holding the door shut. Two targets are refused
  outright — the caller's own account, and the `SUPERADMIN_EMAIL` floor, which is what makes a
  lockout recoverable.

## Where the pieces live

| Piece | File |
| --- | --- |
| Editor UI | `iag-portal/src/components/AdminEditor.jsx` |
| Setup page | `iag-portal/src/pages/SetPassword.jsx` |
| Roster + pending flags | `iag-admin-api/actions/admins/load.ts` |
| Create admin | `iag-admin-api/actions/admins/add.ts` |
| Token minting (shared) | `iag-admin-api/actions/admins/setup-token.ts` |
| Re-issue link | `iag-admin-api/actions/admins/issue-setup-link.ts` |
| Delete admin | `iag-admin-api/actions/admins/delete.ts` |
| Token validate / spend | `iag-admin-api/actions/login-setup/load.ts`, `submit.ts` |
| Superadmin floor | `iag-admin-api/constants/superadmin.ts` |

## Traps

- `load_admins` reads the `passcode` column to compute the `setup_pending` boolean. It collapses it
  to a boolean and must never put a hash on the wire.
- **A tab grant does not take effect until the grantee's NEXT LOGIN.** `allowed_tabs` is read at
  `admin_login` and stored in the session, so ticking a box for someone already signed in changes
  nothing on their screen until they sign out and back in. The checkbox is optimistic and reverts
  on error, so it looks instant to the superadmin — say so when they ask why nothing happened.
- The editor hides Delete for the caller's own row and for any row whose **effective**
  `is_superadmin` is true — effective meaning the column OR the `SUPERADMIN_EMAIL` floor, computed
  the same way `middleware/auth.ts` computes it. If those two ever disagree, the UI offers a button
  the backend refuses.
- `/set-password` must stay in the `ROUTES` array in `scripts/emit-route-pages.mjs`. It is a path
  people reach from a pasted link, so it has to return a real 200 rather than relying on the
  `public/404.html` JS shim.
