# Client Liaisons

**Built 2026-11-19** (migrations 110–111, backend v126). IAG, 2026-11-19: "Liaisons aren't COIs, but they work
directly with a COI to coordinate between clients and IAG. Clients assigned to a liaison should be connected to that
liaison's COI so rev share is paid out correctly."

## Jake's rules (2026-11-19)

- A liaison is a PERSON, not a COI: no number, no level, no share, no login, no Stripe account.
- A liaison works with ONE OR MORE COIs ("if 2 cois work for same company they might have the same liaison").
- A client has at most one liaison, and it must be one who works with the client's COI. The client still sits under
  the COI (its number is `{coi}-NNN`), so the COI is paid the revenue share exactly as before — nothing in the
  waterfall, the team shares or the payouts reads the liaison.
- The liaison is **copied on the client's emails IN ADDITION to the Advisor** (Jake chose (a) over replacing the
  Advisor). Nothing else is sent to them.
- Active / Inactive is a **Status dropdown**, not a tick (Jake). No delete — deactivate (test rows are deleted by SQL).

## Data (migration 110, `20261119130000_client_liaisons`)

- `liaisons` — `id`, `first_name`, `last_name`, `name` (STORED generated), `email` (required), `phone`, `active`,
  `created_at`. Deny-all RLS in the same migration.
- `liaison_cois` — `(liaison_id, member_number)` PK, CASCADE both ways. Deny-all RLS in the same migration.
- `clients.liaison_id` — FK `liaisons`, SET NULL.
- `profile_notes` kind `liaison` (the notes log; `save_notes` refuses it, as it does `firm`).

## Actions

- `load_liaisons` (any admin, `actions/liaisons/load.ts`): every liaison with its `cois` (number, company, names,
  status) and its `clients` (id, number, COI, names, status), plus `clients_count`. One read for every screen
  (`shared/LiaisonPicker.jsx` caches it; `reloadLiaisons` after a save or a client's liaison change).
- `save_liaison` (any admin, `actions/liaisons/save.ts`): add (no `id`) or edit. First, last and email required; phone
  ≤ 40; `active` absent on an edit = leave alone; `member_numbers` ≥ 1, each an existing COI, REPLACING the list. The
  new links are written first, then the liaison is taken off every client of a COI dropped (`unassigned` in the
  answer), then those links are removed — so no client is ever left on a liaison who does not work with its COI.
- `add_client` / `update_client` take `liaison_id` ("" = none; on update, absent = leave alone):
  `utils/liaisons.ts` `resolveClientLiaison` — the liaison must exist, be active (an inactive one only when it is
  already the client's) and work with the client's COI, else a 400 the form shows. A failed read is a 500 (#12).
  `load_clients` and the Client Overview loader return `liaison_id`.

## Emails (migration 111, `20261119140000_liaison_cc`)

- Recipient token `LIAISON` (`utils/email-recipients.ts`, `actions/email-templates/save.ts` `ROLE_TOKENS`, the Email
  Templates editor's "Liaison"): from `ctx.PAYMENT_ID` → the payment's client → its liaison's email, ONLY when the
  liaison is active. No liaison, an inactive one, or a failed read = skipped, never fatal.
- Migration 111 puts `LIAISON` right after `IS` in the Cc of the ten `CLIENT_PAYMENT` templates (request, reminder,
  the three confirmations, failed and failed-check, invoice + receipt, refund, void). Data only, applied after v126.
- The Cc drops anything already in To: a liaison sharing the client's email is NOT shown in the Cc (#59).

## Screens

- **COI ▾ → Liaison → Liaison Search / Add Liaison** (`LiaisonsPanel.jsx`): a searchable list (Liaison, COIs, Clients,
  Email, Status) whose row opens the liaison. The liaison: hero (name, COI count, status), back link, **Profile ▾**
  (Profile · Edit Profile) and a **Clients** pill — the same strip as a COI.
  - **Profile:** Contact Details, COIs (each COI name a link to its profile), Notes.
  - **Clients:** laid out as a COI's Clients tab — count, **+ Add Client** (active liaisons only: `AddClientForm` with
    the liaison's COIs as the choice and the liaison preset), one row per client (number, name, status, COI); a row
    opens the client under its COI.
  - **Edit Profile:** names, **Status** dropdown, email, phone, the COIs as chips with "+ Add a COI…"; removing a COI
    warns in orange how many clients will lose the liaison before saving.
- **COI Profile → Liaisons** card (`CoiSearch.jsx`): each liaison who works with the COI, "N clients here", the email,
  the name a link to the liaison.
- **Client Profile → Relationship:** COI, **Liaison** (second, Jake; a link), Advisor, Implementation Specialist.
  **Edit Profile → Liaison** card: `LiaisonPicker` lists only active liaisons who work with the client's COI ("No
  liaison works with this COI" when none); a deactivated current liaison stays listed "(inactive)". Add Client (from a
  COI, a liaison, or the receipt form) carries the same picker.
- **Navigation:** `openLiaison` (Portal) from a COI or client stores `wigLiaisonReturn` {memberNumber, clientId?}, so
  the liaison's back link reads "← Back to COI" / "← Back to client". From the liaison, a COI opens with return marker
  `liaison` and a client with `liaison_client` (a DEEP return: the client's first back link goes to the liaison's
  Clients tab). Keys `wigLiaisonSelected`, `wigLiaisonTab`, `wigLiaisonReturn` are in Portal `SUB_STATE_KEYS` and
  AdminLogin (#21).

## Tested / untested

- **Tested** (Jake, 2026-11-19, sandbox COIs 1.2.0180 / 99.2.0183): add (refused with no COI), add a client from the
  liaison, every link and back link both ways, an existing client given the liaison, the picker filtered by COI, the
  Cc on an Implementation Fee request draft (after the liaison's email was made different from the client's, #59),
  removing a COI taking the liaison off its clients, deactivating, F5 on every tab.
- **Untested:** the Cc on the other nine templates and on Send; an inactive liaison skipped on a Cc; the Liaison
  picker on Add Client from a COI and on the receipt form; anything LIVE.
