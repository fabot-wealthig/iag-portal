# Internal team revenue share

The IAG internal team's cut of each payment's Net Profit Pool. Today the portal pays the COI and the hard
costs and everything left reads "retained by IAG" (on-screen text only, `TaxStrategiesPanel.jsx`; no stored
figure). This flow splits that remainder to the team. **Built so far: the roster (Phase 1, chat 18).** The
per-client assignment, the calculation and the payouts wait on IAG's answers (below).

## Sources

- IAG's written doc, "Understanding Revenue Share for IAG Internal Team" (Internal Copy, 2026-10-02), and
  the **Data** tab of "Finance COI Number System.xlsx". Both live with Jake, not in git (staff pay).
- Where they disagree the WRITTEN DOC wins until IAG says otherwise: the Data tab has Carson Grover and Jack
  Olson at IS level 4, the doc at 3 (and says Katie is the only level 4). Seeded at 3; put to IAG.

## The rules as IAG wrote them (percent of the Net Profit Pool)

| Role | Held by | Share |
| --- | --- | --- |
| Advisor | per CLIENT | level 0–4 = 0 / 7.5 / 10 / 11.5 / 12.5% |
| Advisor Lead | Carson Grover (all clients) | 12.5% minus the advisor's %; NOTHING when the advisor is Brittany Simmons (the "no advisor" placeholder) |
| Implementation Specialist (IS) | per CLIENT | level 1–4 = 0 / 1.25 / 2.5 / 2.5% |
| IS Team Lead | Katie Williams (all clients) | 1% when the IS is level 1–2, 0.5% when level 3 |
| COI Curator | per COI, ONE of curator or manager | 2.5%, only on introductions in the first 12 months (from the earlier of the engagement signing or the first client) |
| COI Manager | per COI | 2.5% qualified advisor, 1% non-advisor |

Levels move as people certify; like a COI's level, the level is to be SNAPSHOTTED onto each payment when the
shares are computed, never re-read.

**How they are paid — OPEN.** The meeting (Jake + IAG) agreed to auto-send every share; IAG's doc says W2
staff are paid through ADP from a MONTHLY REPORT and only Carson (1099) is auto-paid. `pay_method` covers
either answer. Jake flagged that paying W2 staff outside payroll skips withholding.

**Open with IAG (Jake's question list, 2026-10-02):** auto-send vs payroll report (and the report's format,
recipient, day, and which month a share counts in); is the Net Profit Pool the COI's pool or what is left
after the COI; which strategies (provider-funded, Via ERT, Not Due rows); is the advisor % only on the
Implementation Fee (the Data tab's heading says so); does Katie also take the Team Lead cut on her own
clients; the curators' start dates; level changes forward-only; the advisor and IS on every client (no
source has them), the manager or curator on the ~37 COIs with none; every team member's email.

## Phase 1 — the roster (LIVE once deployed)

- **Table `team_members`** (migration 64, `20261002120000_team_members.sql`, deny-all RLS in the same
  migration). Deliberately NOT columns on `admins` (Jake): an admins row is a login keyed by email, most of
  the team has no email yet, and deleting a login must never erase levels or share history. `admin_email`
  (FK, SET NULL, unique where set) links a team member to their login when they have one.
- The roster records what a person CAN be — `advisor_level` (0–4 / NULL), `is_level` (1–4 / NULL),
  `coi_manager_tier` (`qualified` | `non_advisor` | NULL), `is_curator`, `is_advisor_lead`,
  `is_is_team_lead` — plus `pay_method` (`payroll` | `stripe`), `email` (NOT NULL, '' default, unique where
  set), `active`, `notes`. Which role a person plays is per client or per COI, decided later. Curator vs
  manager is per relationship: Ashley is both.
- **Names** (migration 65): `first_name` (required) and `last_name`; `name` is a STORED generated column
  (`first + ' ' + last`), so every reader of the full name and the unique index keep working.
- **Seeded** with the 13 people in IAG's doc (Carson Grover `stripe`, everyone else `payroll`; no emails).
- **Actions:** `load_team_members` (any admin; a superadmin also gets each `login` block) and
  `save_team_member` (SUPERADMIN only, 403 first — pay data, Jake). Save adds (no `id`) or edits; the form
  sends every field, so an absent level means "not in that role" and an absent flag false; `active` alone
  is "absent = leave alone" (`save_payee`'s rule). `admin_email` is NEVER payload-writable — only
  `team_login_email` sets it — and once set the email is locked. **No delete** — share rows will reference
  the person.
- **Logins live here** (Jake, 2026-10-02): the Admin Editor is gone and every portal login is a team
  member's — someone who logs in but earns nothing (Olivia) is a team member with no roles. The Portal
  Access tab, the status and the email are `flows/admin-invite.md`.
- **Screen:** Automation & Config → **Team** (`TeamPanel.jsx`): a grid (Name, Advisor, Impl. Specialist,
  Other roles, Paid by, Login — superadmins only — and Status) opening the person, whose header replaces the
  list's, on a read-only **Profile**; **Profile ▾ → Edit Profile** and **Portal Access** are superadmin
  tabs, as is "Add team member". sessionStorage keys `wigTeamSelected` and `wigTeamTab` (each listed
  TWICE, #21). The level labels carry IAG's rates for reference; the server stores levels only.

## Not built yet

- Matching `members.coi_manager` (free-text first names: "Evan", "Ashley"…) to roster rows, and a curator
  start date per COI.
- An advisor and an IS on each client (and/or per payment).
- The calculation and its per-person snapshot rows, the Tax Strategies "retained" text, the payroll report,
  and Carson's Stripe Connect payout on the payout schedule.
