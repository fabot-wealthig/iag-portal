import { useState } from 'react'
import { PAYOUT_BLUE, PAYOUT_ORANGE } from '../../lib/payoutText'

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '22px 24px', marginBottom: '20px' }
const heldStyle = { ...sectionStyle, border: `1px solid ${PAYOUT_ORANGE}`, background: 'var(--wig-tint)' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }
const bodyStyle = { fontSize: '13.5px', lineHeight: 1.55, color: 'var(--wig-ink)', margin: '0 0 12px' }
const primaryButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: 'none', background: PAYOUT_BLUE, color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const holdButtonStyle = { ...primaryButtonStyle, background: PAYOUT_ORANGE }
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
 * on, it is orange, says who held it, when and why, and offers Release.
 * `onSubmit(hold, reason)` calls the action and resolves to its answer (the
 * payment counts and any warning); the write is never retried (lib/api.js).
 */
export default function WideHoldCard({ title, hold, offText, onText, holdLabel, releaseLabel, placeholder, onSubmit }) {
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
        ? `On hold. ${count(res?.held ?? 0, 'payment was', 'payments were')} put on hold, and any payment that clears from now on is held too.`
        : `Released. ${count(res?.released ?? 0, 'payment goes', 'payments go')} back on the payout schedule.${res?.still_held > 0 ? ` ${count(res.still_held, 'payment stays', 'payments stay')} on hold under the other hold.` : ''}`)
      setWarning(res?.warning || '')
      setMode(null); setReason('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={on ? heldStyle : sectionStyle}>
      <div style={{ ...eyebrowStyle, ...(on ? { color: PAYOUT_ORANGE, fontWeight: 700 } : {}) }}>{title}</div>
      {on ? (
        <p style={{ ...bodyStyle, fontWeight: 600, color: PAYOUT_ORANGE }}>
          {`On hold since ${dateText(hold.at)}${hold.by ? `, by ${hold.by}` : ''}${hold.reason ? `: "${hold.reason}"` : ''}. ${onText}`}
        </p>
      ) : (
        <p style={bodyStyle}>{offText}</p>
      )}

      {!mode && (
        <button type="button" onClick={() => { setMode(on ? 'release' : 'hold'); setError(''); setMessage(''); setWarning('') }}
          style={on ? primaryButtonStyle : outlineButtonStyle}>
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
            <p style={bodyStyle}>Each payment keeps its pay date if it is still ahead, or moves to the next pay date. A hold someone placed on a single payment stays.</p>
          )}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="button" disabled={busy} onClick={submit}
              style={{ ...(mode === 'hold' ? holdButtonStyle : primaryButtonStyle), opacity: busy ? 0.7 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Working...' : mode === 'hold' ? `Confirm: ${holdLabel}` : `Confirm: ${releaseLabel}`}
            </button>
            <button type="button" disabled={busy} onClick={() => { setMode(null); setReason(''); setError('') }} style={outlineButtonStyle}>Cancel</button>
          </div>
        </div>
      )}

      {message && <p style={{ fontSize: '13px', color: '#1b9254', margin: '12px 0 0' }}>{message}</p>}
      {warning && <p style={{ fontSize: '13px', color: PAYOUT_ORANGE, fontWeight: 600, margin: '8px 0 0' }}>{warning}</p>}
      {error && <p style={{ fontSize: '13px', color: '#d93025', margin: '12px 0 0' }}>{error}</p>}
    </div>
  )
}
