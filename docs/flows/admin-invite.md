# FLOW — Admin invite (a team member's portal login)

How a person becomes an admin who can sign in. **Since 2026-10-02 (chat 18) every login starts as a
team member** on Automation & Config → Team (`TeamPanel.jsx`), Portal Access tab: the Admin Editor,
`add_admin`, `issue_setup_link` and `load_admins` are GONE (Jake), leaving ONE action that creates a
login, `team_login_email`. The roster itself is `flows/internal-team-share.md`.

**The link travels by email, as a Gmail DRAFT** (the `team_login_setup` template, pipeline `TEAM`) —
the portal has no direct-send path, so a person opens Gmail and presses Send. Before chat 18 the
superadmin copied the link out of the UI.

## The path

1. **Superadmin opens the person** on Team → **Portal Access** (the tab renders only when
   `session.is_superadmin` is true — a convenience, not the boundary: every action below re-checks
   `auth.isSuperadmin` server-side and 403s otherwise). The tab copies the VFO portal's member login:
   a **Portal Login** card whose one sentence carries the state ("can sign in as …" / "No login yet. A
   setup email was sent …" / "… has expired" / "No login yet. Send a setup email …") over ONE **Send
   account-setup email** button, then **Rank** (step 6), then a red **Danger Zone**. There is no Tab
   Access card since 2026-10-07 (step 5). The button is disabled
   until the profile has an email, and for an inactive person (the server refuses both, 400).
2. **`team_login_email`** (first call) inserts an `admins` row for the team member's email with
   **`passcode` NULL** and `is_superadmin` false (an existing unlinked `admins` row with that email is
   linked instead), then sets `team_members.admin_email`. A NULL passcode fails closed in
   `verifyPasscode()`, so the row cannot sign in until step 4. Superadmin is granted in the database
   deliberately, never by a form field. From then on the team member's **email is LOCKED**
   (`save_team_member` 400s a change — it is the sign-in identity); a NAME change is copied onto the
   `admins` row.
3. **A setup token is minted** by the shared `issueSetupToken()` helper: 32 random bytes as hex,
   `expires_at` now + 14 days, `completed_at` NULL. Before inserting, every earlier uncompleted token
   for that email is **expired, not deleted** (`expires_at = now`), so `load_login_setup` can still
   tell an old link apart from a link that never existed. The token goes into the email as a
   "Set Up My Login" button to `PORTAL_BASE/set-password?token=…` and is never returned to the
   browser. `login_email_sent_at` is stamped only AFTER the draft exists; if the draft fails it is
   CLEARED, because the new token has already retired the link the last email carried.
4. **The person opens the link.** `/set-password` calls the PUBLIC `load_login_setup` — the token IS
   the credential, so the page has no session. Every failure answers HTTP 200 with a `state`
   (`invalid` / `already_setup`) rather than a 4xx, which would be a louder oracle.
   `submit_login_setup` hashes the chosen passcode (PBKDF2-HMAC-SHA256, 210k, salted; minimum 8
   characters), writes it to the `admins` row, and only then stamps `completed_at`. That order
   matters: a failed write that reported success would burn the token and lock the person out.
5. **They sign in** at `/login` like any admin. **The RANK decides the tabs** (Jake, 2026-10-07, backend
   v80 — no per-person grants): every admin sees **COI, COI Overview, Client Overview, Tax Strategies**;
   a superadmin ALSO **Automation & Config** and **Accounting** (`canSeeTab` in `Portal.jsx`). The
   server enforces it: `superadminOnly()` in `router/dispatch.ts` 403s "Superadmin only." on the ten
   actions only those screens call (`save_payee`, `payee_connect_request`, `payee_connect_status`,
   `load_payouts`, `load_payout_schedule`, `save_payout_schedule`, `load_email_templates`,
   `save_email_template`, `load_notification_rules`, `save_notification_rule`; later also Needs Attention and
   Timing, and in chat 21 `delete_coi` and `save_strategy`, whose screens stay open to every admin but whose
   Delete COI card and Edit Strategy button only a superadmin sees; `dispatch.ts` is the list). Still open to every admin:
   `load_payees` (the request form), `load_all_payments` (Tax Strategies), Pay now / Hold / Refund on the
   payment detail, `load_team_members`, `load_team_share_rates`. `admin_update_tabs` and
   `constants/tabs.ts` are deleted; `admin_login` and `load_team_members` no longer read
   `admins.allowed_tabs` and the session no longer carries it (the column was dropped by migration 76,
   2026-10-07, after v81 stopped reading it).
6. **Rank** (Jake, 2026-10-06 — before this, superadmin was granted in the database only): the Portal
   Access **Rank** card, Make / Remove Superadmin with a confirm step, `admin_set_superadmin`
   (superadmin-gated). It refuses the `SUPERADMIN_EMAIL` floor and the caller's own login (the card is
   hidden for both), so the portal always keeps a working superadmin, and it deletes the target's
   `admin_sessions`: rank is read per request (`middleware/auth.ts`), but the screen learned it at
   sign-in, so a demotion bites at once and a promotion shows at the next sign-in. The card spells out
   what each rank sees (an admin: COI, COI Overview, Client Overview and Tax Strategies).

## Status, resending and removing

- **Status** is computed in `load_team_members`, for superadmins only (the `login` block — ranks and
  login state never reach an ordinary admin): no linked login → `not_sent`; a passcode set
  → `active` (since the latest `completed_at`); no stamp → `not_sent`; the latest token unspent and
  unexpired → `sent`; otherwise `expired`.
- **Resend** mints a fresh token and drafts again, retiring the previous link first, so there is never
  more than one live path into an account. For an ACTIVE login it is a reset: the existing passcode
  keeps working until the new link is used, so a link nobody opens locks nobody out.
- **Forgot passcode? (Jake, 2026-10-08, VFO's flow; it had been parked)** — the sign-in page links to
  `/forgot-password`: an email box and **Send reset link**, then ALWAYS "If an account exists for that email, a
  reset link is on its way. It expires in 1 hour." (the call's errors, a throttle included, are swallowed so
  nothing reveals an account). `request_password_reset` (PUBLIC) throttles FIRST on `reset:<email>` (5 / 15 min,
  recorded on every request, so it never touches the sign-in throttle), floors every answer to 1.2 s, and only for
  an existing `admins` row mints a ONE-HOUR token (`issueSetupToken(…, ttlMs)`, retiring earlier links, a pending
  invite included) and sends the `TEAM` / `password_reset` email — the one template that ships on **Send** (a
  locked-out admin cannot wait on a draft; a refused send rings `email_send_failed`). The link lands on the same
  `/set-password` page; `submit_login_setup` now also deletes every `admin_sessions` row for that email, so a reset
  (or any passcode set from a link) signs the person out everywhere. An invalid or expired link offers **Request a
  new link** → `/forgot-password`.
- **Remove Portal Access** (`delete_admin`) removes the `admins` row (the FK sets
  `team_members.admin_email` NULL — the person stays on the team), then that email's
  `admin_sessions`, then its `login_setup_tokens`. Ordered so the identity disappears first:
  `authenticate()` already 401s every session for that email on its next request. Refused outright:
  the caller's own account and the `SUPERADMIN_EMAIL` floor (the button is hidden for both).
- **The floor account** (`fabot@wealthig.com`) is on no team row and needs none; it is the way back in.

## Where the pieces live

| Piece | File |
| --- | --- |
| Team screen, Portal Access tab | `iag-portal/src/components/TeamPanel.jsx` |
| Setup page | `iag-portal/src/pages/SetPassword.jsx` |
| Roster + login status | `iag-admin-api/actions/team/load.ts` |
| Create login, mint link, draft email | `iag-admin-api/actions/team/login-email.ts` |
| Token minting (shared) | `iag-admin-api/actions/admins/setup-token.ts` |
| Tabs by rank (client) / the superadmin-only actions (server) | `iag-portal/src/pages/Portal.jsx` (`canSeeTab`) / `iag-admin-api/router/dispatch.ts` (`superadminOnly`) |
| Remove access | `iag-admin-api/actions/admins/delete.ts` |
| Token validate / spend | `iag-admin-api/actions/login-setup/load.ts`, `submit.ts` |
| Superadmin floor | `iag-admin-api/constants/superadmin.ts` |

## Traps

- `load_team_members` reads the `passcode` column to compute the status. It collapses it to the status
  and must never put a hash on the wire.
- **Hiding a tab is not the boundary.** The tabs follow `session.is_superadmin`, but an action a
  superadmin-only screen calls must ALSO sit behind `superadminOnly()` (or its own `auth.isSuperadmin`
  403) in `router/dispatch.ts` — the auth gate proves a session, not a rank. A new Automation & Config or
  Accounting action that skips it is open to every admin. (Per-person tab grants, and the old "a grant
  lands at the next login" trap, are gone since v80.)
- The tab hides Remove for the caller's own login and for any **effective** superadmin (the column OR
  the `SUPERADMIN_EMAIL` floor, computed as `middleware/auth.ts` does). If those disagree, the UI
  offers a button the backend refuses.
- The fallback copy in `login-email.ts` mirrors the template seed in migration 65 — edit both.
- `/set-password` must stay in the `ROUTES` array in `scripts/emit-route-pages.mjs`. It is a path
  people reach from an emailed link, so it has to return a real 200.
