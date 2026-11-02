import { useState } from 'react'
import { PAYOUT_BLUE, PAYOUT_ORANGE } from '../../lib/payoutText'

// The look of the Payouts screen's own cards (PayoutsPanel.jsx): a white card,
// a small grey label, ink text, and orange only on the one chip that says "On hold".
const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '22px 24px', marginBottom: '20px' }
const labelStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)' }
const chipStyle = { fontSize: '11px', fontWeight: 600, color: PAYOUT_ORANGE, background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '999px', padding: '2px 9px', whiteSpace: 'nowrap' }
const textStyle = { fontSize: '13.5px', lineHeight: 1.55, color: 'var(--wig-ink)', margin: '0 0 4px' }
const mutedStyle = { fontSize: '13px', lineHeight: 1.55, color: 'var(--wig-muted)', margin: '0 0 12px' }
const primaryButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: 'none', background: PAYOUT_BLUE, color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const outlineButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const textareaStyle = { width: '100%', boxSizing: 'border-box', minHeight: '56px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '13px', fontFamily: 'Inter, sans-serif', resize: 'vertical' }

function dateText(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`

/**
 * One WIDE payout hold (IAG, Brittany 2026-10-30; backend utils/payout-holds.ts):
 * Hold all payouts on Accounting → Payouts, and one COI's payouts on their
 * Profile. Off, it explains itself and offers the hold with a required reason;
 * on, an "On hold" chip, who held it, when and why, and Release. `bare` drops
 * the card around it, for a caller that already has one (the COI Profile's
 * ProfileCard). `onSubmit(hold, reason)` calls the action and resolves to its
 * answer (the payment counts and any warning); never retried (lib/api.js).
 */
export default function WideHoldCard({ title, bare = false, hold, offText, onText, holdLabel, releaseLabel, placeholder, onSubmit }) {
  const [mode, setMode] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [warning, setWarning] = useState('')
  const on = hold?.on === true

  async function submit() {
    if (mode === 'hold' && !reason.trim()) { setError('Please give a reason for the hold.'); return }
    setBusy(true); setError(''); setMessage(''); setWarning('')
    try {
      const res = await onSubmit(mode === 'hold', reason.trim())
      setMessage(mode === 'hold'
        ? `${count(res?.held ?? 0, 'payment', 'payments')} put on hold.`
        : `${count(res?.released ?? 0, 'payment', 'payments')} back on the payout schedule.${res?.still_held > 0 ? ` ${count(res.still_held, 'stays', 'stay')} on hold under the other hold.` : ''}`)
      setWarning(res?.warning || '')
      setMode(null); setReason('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const body = (
    <>
      {on ? (
        <>
          <p style={textStyle}>
            <span style={{ ...chipStyle, marginRight: '8px' }}>On hold</span>
            {`Since ${dateText(hold.at)}${hold.by ? `, by ${hold.by}` : ''}${hold.reason ? `: "${hold.reason}"` : ''}`}
          </p>
          <p style={mutedStyle}>{onText}</p>
        </>
      ) : (
        <p style={mutedStyle}>{offText}</p>
      )}

      {!mode && (
        <button type="button" onClick={() => { setMode(on ? 'release' : 'hold'); setError(''); setMessage(''); setWarning('') }} style={outlineButtonStyle}>
          {on ? releaseLabel : holdLabel}
        </button>
      )}

      {mode && (
        <div>
          {mode === 'hold' && (
            <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={300} placeholder={placeholder}
              style={textareaStyle} disabled={busy} />
          )}
          {mode === 'release' && (
            <p style={mutedStyle}>Each payment keeps its pay date if it is still ahead, or moves to the next pay date. A hold placed on a single payment stays.</p>
          )}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="button" disabled={busy} onClick={submit}
              style={{ ...primaryButtonStyle, opacity: busy ? 0.7 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Working...' : mode === 'hold' ? holdLabel : releaseLabel}
            </button>
            <button type="button" disabled={busy} onClick={() => { setMode(null); setReason(''); setError('') }} style={outlineButtonStyle}>Cancel</button>
          </div>
        </div>
      )}

      {message && <p style={{ fontSize: '12.5px', color: 'var(--wig-muted)', margin: '10px 0 0' }}>{message}</p>}
      {warning && <p style={{ fontSize: '13px', color: PAYOUT_ORANGE, fontWeight: 600, margin: '8px 0 0' }}>{warning}</p>}
      {error && <p style={{ fontSize: '13px', color: '#d93025', margin: '10px 0 0' }}>{error}</p>}
    </>
  )

  if (bare) return body
  return (
    <div style={sectionStyle}>
      <div style={{ ...labelStyle, marginBottom: '10px' }}>{title}</div>
      {body}
    </div>
  )
}
