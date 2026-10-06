# Internal team revenue share

The IAG internal team's cut of each payment's Net Profit Pool. Today the portal pays the COI and the hard
costs and everything left reads "retained by IAG" (on-screen text only, `TaxStrategiesPanel.jsx`; no stored
figure). This flow splits that remainder to the team. **Built (v: 2026-10-06):** the roster, Phase A (who is on
each COI, client and payment), B1 (the rates), B2 (the calculation) and C (Stripe payouts for a member paid
by transfer). **Not built:** Phase D (the payroll report) and the curator reminder (*Not built yet*).

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
  Cunningham). The text column stays, unread, until a cleanup migration after the deploy (#40's lesson).
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
  thing owed). Phase D must read it too before reporting a share.
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
  "Your role" and "[ROLE] · [SHARE_PCT]% of the Net Profit Pool"; latched on `email_sent_at`, so a share paid
  while Gmail was down is drafted by the next run.
- **What staff earn stays superadmin-only**: team lines on Payouts and the amounts on the Team shares
  card are for superadmins; the Payout card, Pay now's answer and the bells carry no amount.
- **One Stripe account for Carson (Jake, 2026-10-06):** his own staff COI (99.3.0159) is to be paid into
  the account on his Team row — wired in Phase D with the staff-COI link.

## Not built yet

- **Phase D:** the monthly payroll PDF to Beth and Brittany (the 15th, a setting) and Accounting → Team
  Payroll; staff COIs' 20% COI shares on it (a payroll payout path for COIs + a link from each staff COI to
  its team member), Carson's COI share into his Team Connect account.
- **The January curator reminder** (email to Brittany + Beth, a bell, monthly until reviewed) — with Phase D's settings.
- The cleanup migration dropping `members.coi_manager`.
