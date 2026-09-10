import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'
import { ownerChipStyle } from '../PaymentDetail'

// Who plans this money and who hears about it, asked WHEN IT IS RAISED rather
// than left to the detail screen: both are known now, and a payment nobody was
// assigned is a payment nobody chases. Extracted from `ClientPaymentForm` so the
// receipt form asks in exactly the same shape — same two controls as
// PaymentDetail's Notifications card, so an admin meets one control three times
// rather than three that behave differently.
//
// The list starts empty, by Jake's decision: nobody is pre-selected, not even
// the admin filling in the form. Whoever should hear about this gets added here
// by hand, and the server seeds exactly what is sent — no more, no less.

const assignLabelStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)', marginBottom: '6px' }
const assignSelectStyle = { padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-muted)', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', maxWidth: '280px' }

/**
 * `onRosterReady(ready)` is how the caller learns whether it may send a
 * recipient list at all: a roster that never arrived leaves both controls inert
 * and the form fully usable — the payment is what matters — and no list is sent
 * in that case, so the server seeds nobody and both are assigned on the detail
 * screen instead.
 *
 * `admins` is the roster handed in by a caller that already holds it — a form
 * that asks these two questions on every client row loads it ONCE and passes it
 * down, rather than firing the same fetch per row. Supplied that way the
 * component makes no call of its own and the caller already knows whether the
 * roster arrived; an empty array is a roster that has not landed yet, which is
 * exactly the inert state the fetch produces. `inline` lays the two controls
 * side by side for that same cramped row.
 */
export default function NotificationPickers({ taxPlanner, onTaxPlanner, recipientEmails, onRecipients, onRosterReady, admins = null, inline = false }) {
  const supplied = Array.isArray(admins)
  const [loaded, setLoaded] = useState(null)
  const [rosterError, setRosterError] = useState('')

  useEffect(() => {
    if (supplied) {
      if (onRosterReady) onRosterReady(true)
      return
    }
    let live = true
    callApi('load_admin_directory')
      .then(res => {
        if (!live) return
        setLoaded(res.admins || [])
        if (onRosterReady) onRosterReady(true)
      })
      .catch(() => {
        if (!live) return
        setRosterError('Could not load admins — assign them on the payment afterwards.')
        if (onRosterReady) onRosterReady(false)
      })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplied])

  // The roster is null until it lands, which is what disables both controls —
  // the form is a handful of fields, far too small to wear a skeleton, so the
  // controls simply arrive inert and come alive.
  const roster = supplied ? admins : (loaded || [])
  const rosterReady = supplied ? roster.length > 0 : (loaded !== null && !rosterError)
  const chosen = roster.filter(a => recipientEmails.includes(a.email))
  const addable = roster.filter(a => !recipientEmails.includes(a.email))

  return (
    <div style={inline ? { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '16px' } : undefined}>
      <div style={inline ? undefined : { marginBottom: '14px' }}>
        <div style={assignLabelStyle}>Tax planner</div>
        <select value={taxPlanner} disabled={!rosterReady}
          onChange={e => onTaxPlanner(e.target.value)}
          style={{ ...assignSelectStyle, cursor: rosterReady ? 'pointer' : 'not-allowed' }}>
          <option value="">Unassigned</option>
          {roster.map(a => <option key={a.email} value={a.email}>{a.name}</option>)}
        </select>
      </div>

      <div>
        <div style={assignLabelStyle}>Other notification recipients</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          {chosen.map(r => (
            <span key={r.email} style={{ ...ownerChipStyle, fontSize: '12px', padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {r.name}
              <button type="button" aria-label={`Remove ${r.name}`}
                onClick={() => onRecipients(recipientEmails.filter(e => e !== r.email))}
                style={{ border: 'none', background: 'transparent', color: 'var(--wig-muted)', fontSize: '14px', lineHeight: 1, padding: 0, cursor: 'pointer' }}>×</button>
            </span>
          ))}
        </div>
        {/* Always value="" — the select is an ADD button wearing a dropdown, so
            it never holds a selection of its own. */}
        <select value="" disabled={!rosterReady || addable.length === 0}
          onChange={e => { if (e.target.value) onRecipients([...recipientEmails, e.target.value]) }}
          style={{ ...assignSelectStyle, cursor: (!rosterReady || addable.length === 0) ? 'not-allowed' : 'pointer' }}>
          <option value="">{rosterReady && addable.length === 0 ? 'All admins added' : 'Add admin…'}</option>
          {addable.map(a => <option key={a.email} value={a.email}>{a.name}</option>)}
        </select>
      </div>

      {rosterError && <p style={{ color: '#d93025', fontSize: '13px', margin: '10px 0 0', ...(inline ? { width: '100%' } : {}) }}>{rosterError}</p>}
    </div>
  )
}
