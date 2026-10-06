# Internal team revenue share

The IAG internal team's cut of each payment's Net Profit Pool. Today the portal pays the COI and the hard
costs and everything left reads "retained by IAG" (on-screen text only, `TaxStrategiesPanel.jsx`; no stored
figure). This flow splits that remainder to the team. **Built (v: 2026-10-06):** the roster, Phase A (who is on
each COI, client and payment), B1 (the rates), B2 (the calculation), C (Stripe payouts for a member paid
by transfer), **D1** (staff COIs paid with their team pay), **D2** (the payroll report) and **D3** (the
curator review reminder) (v: 2026-10-07). Cleanup migration 76 applied. Nothing in the original scope is left.

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
| COI Curator | per COI, ONE of curator or manager | 2.5%, held one TAX YEAR at a time (Brittany, 2026-10-05 — replaces her doc's 12 months); reviewed every January |
| COI Manager | per COI | 2.5% qualified advisor, 1% non-advisor |

Levels move as people certify; like a COI's level, the level is to be SNAPSHOTTED onto each payment when the
shares are computed, never re-read (Brittany: forward-only).

## Decided (Brittany's answers, 2026-10-05, and Jake's calls)

- **Net Profit Pool = the pool MINUS the COI's share.** $10,000 pool, COI 40% → a 7.5% advisor earns 7.5% of $6,000.
  A COI earning 0% (Not Due, VFO Services) leaves the whole pool.
- **Every strategy**, provider-funded and Via ERT included. The advisor % applies on every strategy (the Data
  tab's "for Implementation fee" heading was wrong). **Katie** takes only her 2.5% as IS on her own clients.
- **How they are paid: option (b).** Carson Grover (1099) by Stripe transfer on the COI pay date, after a
  Connect setup request from his Team profile. Everyone else (W2) through ADP from a **monthly PDF report**,
  drafted on the **15th** (a setting) **To Beth (`beth@wealthig.com`) and Brittany (`brittany@wealthig.com`)
  only**, in an Email Templates template; paid on the 20th; covers last month's cleared shares.
- **Staff COIs** (the 99.3.x rows, 20% as a COI) are paid through the same ADP report; Carson's own COI share
  by Stripe.
- **Curators:** a curated COI carries a tax year; nothing stops on its own (Jake, option A) — the curator is
  paid until someone renews the year or hands the COI off. From January a reminder (an email draft to
  Brittany and Beth + a bell) repeats on the 1st of each month while any COI is behind, and the profile shows
  an orange "Curator review overdue" chip.
- **VFO Services** is a COI at Level 0 (46.3.0182): its deal with IAG is outside the portal; the team is paid
  normally off the whole pool.
- **The payout schedule stays weekly** (Jake: IAG will change it themselves).

## Phase 1 — the roster (LIVE, backend v68, 2026-10-02)

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
  Other roles, Paid by, Login — superadmins only — and Status) opening the person, whose header (name and
  Active/Inactive ONLY, Jake) replaces the list's, on a read-only **Profile** of category cards — Contact
  Details, Pay, Revenue Share Roles, Notes (edited in place, superadmin); no audit fields (added by / dates), Jake — the VFO look shared by
  every IAG profile (`shared/ProfileKit.jsx`); **Profile ▾ → Edit Profile** (Basic Info, Revenue Share
  Roles, Pay & Status) and **Portal Access** are superadmin tabs, as is "Add team member". sessionStorage keys `wigTeamSelected` and `wigTeamTab` (each listed
  TWICE, #21). The level labels carry IAG's rates for reference; the server stores levels only.

## Phase A — assignments (built 2026-10-05, migration 68)

- **COI Manager = a roster person.** `members.coi_manager_id` (FK, SET NULL) + `curator_tax_year` (2020–2100)
  replace the free-text `members.coi_manager` (first names mapped: "Carson" → Carson **Grover**, never
  Cunningham). The text column was dropped by migration 76 (2026-10-07), after the code stopped reading it (#40).
  Ashley's 22 COIs got **Tax Year 2026**. `add_coi` / `update_coi` take `coi_manager_id` + `curator_tax_year`
  (`utils/team-assign.ts` `resolveCoiManager`: active, holds a manager rate or the curator tick; a tax year
  only on a curator). `update_coi` treats both absent as leave-alone.
- **Client defaults.** `clients.advisor_id` / `is_id` — shown on the Profile's Relationship card, set on Edit
  Profile (a **Team** card) and optionally on Add Client. Editing a client no longer requires an email (Jake:
  777 imported clients have none); a request still refuses a client without one.
- **Per payment, REQUIRED (Jake).** `client_payments.advisor_id` / `is_id`: `start_client_payment` and every
  `create_provider_receipt` row refuse without both (`resolveTeamPick`, role-checked: an advisor level, an IS
  level). The forms pre-fill from the client (the Client Overview loader carries the defaults) and a client
  with none set takes the payment's pair (`fillClientDefaults`, empty slots only, never fatal). The advisor
  picker labels the Level-0 stand-in "Brittany Simmons (no advisor)". The payment detail shows both.
- **Pickers** (`shared/TeamPicker.jsx`) list only active people holding the role, keep a no-longer-eligible
  person already on a record visible, and share ONE cached `load_team_members` read (`reloadTeam` after a
  roster edit). `shared/CoiManagerFields.jsx` is the manager + curator control; `CoiManagerSelect` is gone.

## Phase B1 — the rates and the Rank card (built 2026-10-06, migration 69)

- **`team_share_rates`**, ONE row (id 1, deny-all RLS), every figure a percent of the Net Profit Pool,
  seeded with Brittany's: advisor L0–4, the Advisor Lead cap, IS L1–4, the IS Team Lead rate BY THE IS's
  LEVEL (L4 = 0, the lead herself), the two manager rates and the curator rate. Edited on Automation & Config
  → **Team Share Rates** (`TeamRatesPanel.jsx`; view any admin, save superadmin — `load_team_share_rates` /
  `save_team_share_rates`). Phase B2 SNAPSHOTS the rate onto each share, so a save applies to payments that
  clear after it. The Team screen's level labels read the live rates (`shared/teamRates.js`).
- **Superadmin from the Team tab:** the Portal Access **Rank** card (`flows/admin-invite.md` step 6).

## Phase B2 — the calculation (built 2026-10-06, migration 70)

- **`payment_team_shares`** (deny-all RLS): one row per person per ROLE per payment (unique `payment_id, role`),
  every input SNAPSHOTTED — `team_member_id`, `member_name`, `role`, `level`, `rate_pct`, `base_amount` (the
  payment's `net_profit_pool`), `amount` (> 0; zero rows are not written), `pay_method`, `status` `owed` | `void`.
  `client_payments.team_shares_at` is the latch.
- **When:** `runRevenueShare` calls `stampTeamShares` right after the waterfall stamp, before the COI's money — never
  fatal to it. Sweep **leg T** finishes any cleared row (`available_pool` set) whose latch is empty. Rows are UPSERTed
  on-conflict-do-nothing BEFORE the latch, so a run dying between the two is finished by the next, and two at once
  cannot double a row.
- **The rules** (`computeTeamShares`, pure — verified against every case on 2026-10-06, e.g. $6,000 NPP: L1 advisor
  $450, Carson as lead $300, L2 IS $75, Katie $60, curator $150): advisor by level, level 0 (the stand-in) = no
  advisor AND no lead; lead = cap − advisor rate, never to the advisor himself; IS by level; IS Team Lead by the IS's
  level, never on her own client; COI curator rate when the COI carries a tax year AND its manager is a curator,
  else the manager's rate. Leads must be ACTIVE (the first by name if two hold the flag, logged); the assigned
  advisor / IS / manager are paid even if deactivated since.
- **Refunds:** `refund_payment` voids every `owed` share; a payment already refunded when its shares are written
  gets them as `void` rows.
- **The card:** payment detail → **Team shares** (`TeamSharesCard.jsx`, superadmins only — mounted only for them, and
  `load_payment_team_shares` refuses others): the rows, the NPP, the team total and **IAG keeps**. Tax Strategies'
  nine "retained by IAG" lines now say the NPP's team shares come off first.
- **Disputes and dashboard refunds** do not void shares (`stripe-exceptions.ts`); they HOLD the payment, and
  Phase C reads that gate before paying (since v73 the hold is placed even when a team share is the only
  thing owed). The payroll report (D2) reads it too: a held payment's shares wait, and since v78 a payment
whose only owed money is payroll is held as well.
- **Sandbox payments** (v: 2026-10-06, Jake): test money is never owed to a real person, so a SANDBOX
  payment's share to a member whose `team_members.sandbox` is off is written **void, `sandbox payment`**
  at stamp time — never transferred, never on the payroll report. Payroll members included; to test
  Phase D, use temporary members with Sandbox on.
- **Every row names every column** in the bulk write — a mix of void and owed rows failed whole on a NULL
  `status` until v74 (GOTCHA #43).

## Phase C — paying a member by Stripe transfer (built 2026-10-06, migration 71, backend v74)

Carson Grover (1099, `pay_method = 'stripe'`) — and anyone else set to Stripe — is paid each share by
transfer on the payment's pay date, like a COI. Tested in sandbox end to end with a temporary member
(held → onboarded → paid, email drafted, refund refused, a refund voiding an unpaid share).

- **Onboarding:** Team profile → **Stripe Connect** card (superadmins, Stripe-paid members only) →
  `team_connect_request` → the `team_connect_setup` draft → `/payout-setup` (`entity_type 'team'`) →
  `team_connect_status`. The member's `sandbox` toggle decides the mode and locks once an account exists
  (`flows/coi-connect-setup.md`, *Team members*).
- **Statuses** on `payment_team_shares`: `owed` → `processing` → `paid`; `held` (no payable account —
  the `team_share_held` bell when it first lands there), `failed` (Stripe refused, the account unreadable,
  a live payment for a sandbox member — `team_share_failed`, with `failure_reason`); both retried by the
  next run. `void` as before. New columns `transfer_id`, `idempotency_key`, `paid_at`, `failure_reason`,
  `email_sent_at`, `sweep_at`.
- **The transfer** (`actions/payments/team-transfers.ts`, `runTeamShareTransfers`) — `hard-costs.ts`'s
  shape: the payment's `payoutGate` first; the claim matches the EXACT status read; a per-ATTEMPT key
  `teamshare-<share id>-<ms>` written by the claim, reused only to resume a `processing` claim (#22);
  `source_transaction` = the payment's charge when there is one; description "Team Revenue Share -
  <Role> - <Name> - Client: (<number>) <name> - <Strategy>", `metadata[pipeline] = TEAM_SHARE`. One transfer
  per SHARE: Carson as Advisor Lead and COI Manager on one payment is two transfers.
- **The refund race.** A share lives in its own table, so its claim cannot repeat the refund condition in
  the same UPDATE as `rev_paid`'s does. Each side writes, then checks the other: the transfer claims, then
  re-reads `refund_status` and releases the claim if a refund landed; `refund_payment` claims, then reads
  the shares and puts its claim back (409) if one is `processing` or `paid`. Each write commits before its
  check, so both can never go ahead. `refundCheck` takes the shares and greys the button: "A team
  member's share has already been paid, so this refund has to be handled outside the portal." A refund
  voids `owed`, `held` and `failed` shares.
- **When:** sweep **leg P** (`flows/nightly-sweep.md`) on the pay date, and **Pay now**. Not at clearing:
  a pay date is always after the clearing week.
- **The email** (Jake: one per transfer): `TEAM` / `team_share_paid`, the COI revenue-share card with
  "Your role" and "[ROLE] · [SHARE_PCT]% of the Net Profit Pool" (`[ROLE] · [SHARE_BASIS]` since D1);
  latched on `email_sent_at`, so a share paid
  while Gmail was down is drafted by the next run.
- **What staff earn stays superadmin-only**: team lines on Payouts and the amounts on the Team shares
  card are for superadmins; the Payout card, Pay now's answer and the bells carry no amount.
- **One Stripe account for Carson (Jake, 2026-10-06):** his own staff COI (99.3.0159) is paid into the
  account on his Team row — Phase D1.

## Phase D1 — staff COIs paid with their team pay (built 2026-10-06, migration 72, backend v75)

The staff on the COI list (99.3.x) earn a COI share like any COI, paid with their team pay (Brittany).
Tested in sandbox: Cost Segregation receipts on TEST Company (L2 = 30%), a Stripe and a payroll staff
member, refunds voiding the share.

- **Schema:** `members.payout_method` gains `team`, which REQUIRES `members.team_member_id` (FK
  `team_members`, unique where set — one COI per member; a check constraint holds both ways). Set on the
  COI's **Edit Profile** ("With team pay (staff)" + a Team Member picker); Add COI does not offer it.
- **At clearing** `stampTeamShares` (`utils/team-shares.ts`) writes the COI's own share as a
  `payment_team_shares` row, role `staff_coi`: `level` = `coi_level_at_payment`, `rate_pct` =
  `coi_share_pct`, `base_amount` = `available_pool`, `amount` = `coi_share_amount`, `pay_method` = the
  member's. Only while the COI pipeline has moved nothing (`rev_paid` null / Awaiting Payout Account /
  Failed) and not Via ERT.
- **`runRevenueShare` step (e2b)** then writes `rev_paid = "Via Team"` off that SNAPSHOT
  (`hasStaffCoiShare`), never the COI's live payout method — so a COI re-pointed after clearing can
  neither lose its share nor be paid twice. Terminal like Via ERT: no transfer, no COI email; refundable
  (`REFUNDABLE_REV_STATES`); retry refuses it. A staff COI whose shares could not be written waits for the
  sweep rather than falling through to a COI transfer.
- **Paid:** a Stripe staff member (Carson) by Phase C's `team-transfers.ts` into the Team Connect account;
  payroll staff on the payroll report (D2). The `team_share_paid` email's percent line is now
  `[SHARE_BASIS]` ("30% of the Available Revenue Pool" for a staff COI, "... of the Net Profit Pool"
  otherwise). The **Team shares** card lists Staff COI rows outside the NPP team total. The pill reads
  "With team pay".

## Progress and the Payout pill (backend v76–77, 2026-10-06)

- **Progress shows what DOES happen (Jake).** `utils/payment-steps.ts` `present()` drops steps a payment
  never has; new steps "Team shares paid (Stripe)" and "Team shares on payroll report" (no amounts), from
  the counts `applyTeamCounts` / `attachTeamPending` (`utils/team-shares.ts`) attach. Detail in
  `flows/client-payment-request.md`, step 18.
- **The grids' Payout pill** gained `payout_rest` (`restPayoutState`), so a payment owing only a payee fee
  or a team share no longer reads "Not due" (`flows/payout-schedule.md`).

## Phase D2 — the payroll report (built 2026-10-07, migration 73, backend v78)

- **Tables** (deny-all RLS in the same migration): `team_payroll_settings`, ONE row — `cadence`
  `monthly` | `weekly`, `report_day_of_month` 1–28 (default 15), `report_weekday` 1–5, and
  `curator_reminder_period` (D3's latch); `team_payroll_reports` — `period_key` (UNIQUE with `sandbox`),
  `period_label`, `cutoff_date`, `cadence`, `status` `building` | `drafted` | `draft_failed` | `empty`,
  counts, `total`, `draft_count`, `drafted_at`, `draft_error`. Shares gain status `reported`, `report_id`,
  `reported_at`. Template `TEAM` / `team_payroll_report`, To `brittany@wealthig.com` + `beth@wealthig.com`.
- **Periods** (`utils/payroll-report.ts`): monthly — key `YYYY-MM`, due on the day, cutoff = the last day
  of the previous month; weekly — key `week-<Monday>`, due on the weekday, cutoff = the Sunday before.
- **What a report takes:** EVERY `owed` payroll share whose payment cleared on or before the cutoff,
  matching the sandbox flag, not on hold, not refunded (Jake: everything still owed rolls forward). The
  claim is the status flip `owed` → `reported`. The refund race is write-then-check: after the claim,
  reported shares of a payment refunded meanwhile are voided; `refund_payment` refuses once a share is
  `reported` (`TEAM_PAID_STATES` = `processing`, `paid`, `reported`).
- **The email:** one PDF per employee (`html2pdf`) and ONE draft with every PDF and a summary table
  (Jake). An empty period = status `empty`, no email. A re-draft = fresh PDFs and a fresh draft, statuses
  untouched.
- **When:** sweep **leg Y** (after leg P) drafts the due live report once per period and re-drafts failed
  live reports. Sandbox payments' shares go only on a "[SANDBOX]" test report drafted by hand (cutoff =
  today).
- **Actions** (superadmin only, 403 first): `load_team_payroll` (`{}` = settings, next report, owed not
  yet reported, reports; `{report_id}` = one report's lines per employee), `save_team_payroll_settings`,
  `draft_team_payroll` (`{report_id}` re-draft; `{}` the live report now — 409 if done; `{sandbox:true}`
  a test report).
- **Screens** (superadmins only): Automation & Config → **Payroll Report** (frequency + day, Next Report);
  Accounting → **Team Payroll** pill (next report, Draft now, Draft sandbox test report; Owed-not-yet-
  reported per employee, expandable, with "Waiting: …" reasons; the Reports list → a report's lines per
  employee and **Re-draft email**). sessionStorage key `wigTeamPayrollReport` (Portal `SUB_STATE_KEYS` and
  AdminLogin, #21). The Team shares card shows "On payroll report <date>".
- **Tested:** settings in both cadences, a sandbox report draft + PDF + re-draft, a reported share
  blocking a refund, live Draft now → an empty October report.

## Phase D3 — the curator review reminder (built 2026-10-07, migration 75, backend v80)

- **Behind** (`utils/curator-reminder.ts` `overdueCurators`): a COI whose `curator_tax_year` is before the
  current Eastern year AND whose `coi_manager_id` is a roster curator (`is_curator`) — the same test the
  share uses to pay the curator rate. The COI profile's orange "Curator review overdue" chip reads the year.
- **`runCuratorReminder`**: while any COI is behind, ONE email (template `TEAM` / `curator_review_reminder`,
  To `brittany@wealthig.com` + `beth@wealthig.com`, subject "Innovation Advisory Group - Curator review due -
  [COUNT] COIs", `[COI_TABLE]` of COI, Company, Curator, Tax year) and ONE summary bell (Jake: one bell, not
  per COI), "Curator review overdue - N COIs", rule `curator_review_due` (`flows/notifications.md`). Latch
  `team_payroll_settings.curator_reminder_period` (`YYYY-MM`), stamped only after the draft; nothing behind =
  nothing sent and no latch, so a COI falling behind later in the month is caught by the next run.
- **When:** sweep **leg Z** (after Y, before the Gmail probe) every run, honouring the latch — in practice
  the first run of each month. **Draft reminder now:** `draft_curator_reminder` (superadmin, ignores the
  latch; 400 "… nothing to send" when none is behind). `load_team_payroll` also answers `curator_reminder:
  { last_period, overdue[] }`.
- **Screen:** Automation & Config → Payroll Report → **Curator Review Reminder** card (Last sent, COIs
  behind, Draft reminder now). The bell opens COI Overview.
- **Tested** (2026-10-07): TEST Company given Ashley Herbert + tax year 2025 → the card showed 1 behind →
  Draft reminder now → the email (one row) + the bell → the bell opened COI Overview → undone → "nothing
  to send".

## Not built yet

- Nothing. The cleanup migration 76 (`20261007180000_drop_unread_columns.sql`) dropped `members.coi_manager`,
  `client_payments.tax_planner_email` and `admins.allowed_tabs` on 2026-10-07, after backend v81 (which no
  longer reads `allowed_tabs`) went live (GOTCHA #40's order).
