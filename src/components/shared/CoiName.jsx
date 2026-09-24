import { NameLink } from './TrackKit'

// A COI's name, the way EVERY screen shows it (Jake, 2026-09-24): the FIRM is the
// primary name, with the person smaller beneath. A COI who is only a person (IAG
// staff listed as referral sources, "Client Referral") shows the person alone.
//
// Rows carry the firm as `company` (a members row) or `coi_company` (a payment or
// client row), and the person as first/last or `coi_name` — callers pass both in.

const fullName = (m) => `${m?.first_name || ''} ${m?.last_name || ''}`.trim()

/** { firm, person } for a members row. */
export function coiParts(m) {
  return { firm: String(m?.company || '').trim(), person: fullName(m) }
}

/** One line — "Anchor Financial, Inc. – Stacey Andres" — for dropdowns, search and titles. */
export function coiLine(firm, person) {
  const f = String(firm || '').trim()
  const p = String(person || '').trim()
  return f && p ? `${f} – ${p}` : f || p
}

/** The one-line form straight from a members row. */
export function coiLineOf(m) {
  const { firm, person } = coiParts(m)
  return coiLine(firm, person)
}

/**
 * Firm over person. `onClick` makes the firm a shortcut link (standing rule 2);
 * without it the name is plain text, for a row that already opens the COI.
 */
export default function CoiName({ firm, person, onClick, title = 'Open COI profile', primaryStyle, small = false }) {
  const f = String(firm || '').trim()
  const p = String(person || '').trim()
  const primary = f || p
  const secondary = f ? p : ''
  if (!primary) return <span style={{ color: 'var(--wig-faint)' }}>—</span>
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', minWidth: 0 }}>
      <span style={{ fontWeight: small ? 500 : 600, fontSize: small ? '11.5px' : undefined, ...primaryStyle }}>
        <NameLink onClick={onClick} title={title}>{primary}</NameLink>
      </span>
      {secondary && (
        <span style={{ fontSize: small ? '10.5px' : '11.5px', color: 'var(--wig-muted)', fontWeight: 400 }}>{secondary}</span>
      )}
    </span>
  )
}
