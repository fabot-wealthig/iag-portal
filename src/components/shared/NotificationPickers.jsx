import { useEffect } from 'react'
import { useTeamRoster } from './TeamPicker'

// Who hears about this money, asked WHEN IT IS RAISED: the "other notification
// recipients", picked from the TEAM roster (Jake, 2026-10-06 — no Tax Planner, and
// recipients are team members, not admins). The payment's Advisor and
// Implementation Specialist are notified without being picked. A team member with
// no portal login can be picked and carries a "No login" tag: they are never
// notified until they have one. Used by ClientPaymentForm and, per client line, by
// ProviderReceiptForm, in the same shape as the payment's Notifications card.
//
// The list starts empty, by Jake's decision: nobody is pre-selected. The server
// seeds exactly what is sent.

const assignLabelStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)', marginBottom: '6px' }
const assignSelectStyle = { padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-muted)', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', maxWidth: '280px' }
// PaymentDetail's ownerChipStyle, copied: importing it back would make the two files import each other.
const ownerChipStyle = { fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', color: 'var(--wig-muted)', fontWeight: 600, whiteSpace: 'nowrap' }
export const noLoginTagStyle = { fontSize: '10px', fontWeight: 600, color: 'var(--wig-faint)', border: '1px solid var(--wig-border-chip)', borderRadius: '999px', padding: '0 6px' }

/** A recipient chip; `onRemove` absent = a fixed chip (the Advisor / Implementation Specialist). */
export function RecipientChip({ person, label, onRemove, disabled }) {
  return (
    <span style={{ ...ownerChipStyle, fontSize: '12px', padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      {label ? <span style={{ color: 'var(--wig-muted)' }}>{label}:</span> : null}
      {person.name}
      {person.has_login === false && <span style={noLoginTagStyle}>No login</span>}
      {onRemove && (
        <button type="button" disabled={disabled} aria-label={`Remove ${person.name}`} onClick={onRemove}
          style={{ border: 'none', background: 'transparent', color: 'var(--wig-muted)', fontSize: '14px', lineHeight: 1, padding: 0, cursor: disabled ? 'not-allowed' : 'pointer' }}>×</button>
      )}
    </span>
  )
}

/** The add control: every active team member not already chosen. Always value="". */
export function AddRecipientSelect({ team, chosenIds, onAdd, disabled }) {
  const addable = (team || []).filter(m => m.active !== false && !chosenIds.includes(m.id))
  const off = disabled || !team || addable.length === 0
  return (
    <select value="" disabled={off}
      onChange={e => { if (e.target.value) onAdd(e.target.value) }}
      style={{ ...assignSelectStyle, cursor: off ? 'not-allowed' : 'pointer' }}>
      <option value="">{team && addable.length === 0 ? 'Everyone added' : 'Add team member…'}</option>
      {addable.map(m => <option key={m.id} value={m.id}>{m.name}{m.has_login === false ? ' (no login)' : ''}</option>)}
    </select>
  )
}

/**
 * `onRosterReady(ready)` tells the caller whether it may send a recipient list at
 * all: a roster that never arrived leaves the control inert, the form usable, and
 * no list sent (the server seeds nobody; add them on the payment afterwards).
 */
export default function NotificationPickers({ recipientIds, onRecipients, onRosterReady, inline = false }) {
  const { team, error } = useTeamRoster()
  useEffect(() => {
    if (onRosterReady) onRosterReady(!!team && !error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, error])

  const chosen = recipientIds.map(id => (team || []).find(m => m.id === id) || { id, name: 'Unknown team member' })
  const add = <AddRecipientSelect team={error ? null : team} chosenIds={recipientIds} onAdd={id => onRecipients([...recipientIds, id])} />

  return (
    <div>
      <div style={assignLabelStyle}>Other notification recipients</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: inline ? 0 : '10px' }}>
        {chosen.map(p => <RecipientChip key={p.id} person={p} onRemove={() => onRecipients(recipientIds.filter(x => x !== p.id))} />)}
        {inline && add}
      </div>
      {!inline && add}
      {error && <p style={{ color: '#d93025', fontSize: '13px', margin: '10px 0 0' }}>Could not load the team — add recipients on the payment afterwards.</p>}
    </div>
  )
}
