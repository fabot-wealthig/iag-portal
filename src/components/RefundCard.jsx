import { useState } from 'react'
import { callApi } from '../lib/api'

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const dangerButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#EE6A33', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const outlineButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const textareaStyle = { width: '100%', boxSizing: 'border-box', minHeight: '64px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '13px', fontFamily: 'Inter, sans-serif', resize: 'vertical' }
const bodyStyle = { fontSize: '13.5px', lineHeight: 1.55, color: 'var(--wig-ink)', margin: '0 0 12px' }

function money(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'
}
function dateText(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * The Refund card (chat 17, Jake's rules). Offered only while nothing has gone
 * out — the server says whether (`payment.refund`, utils/refund.ts) and the
 * button greys out with its reason when not. Two wordings, so nobody thinks the
 * portal sent money back when it did not: "Refund" / "Confirm refund" for a
 * payment made through Stripe, "Record refund" / "Confirm refund recorded" for
 * a provider-funded record. A reason is required. The write is never retried
 * (lib/api.js), and it answers the whole payment detail, handed to `onApply`.
 */
export default function RefundCard({ payment, admins = [], onApply }) {
  const check = payment.refund || { blocked: 'Refund status unavailable.', warnings: [], kind: 'stripe', amount: null }
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const recordOnly = check.kind === 'record_only'
  const status = payment.refund_status || null
  const nameOf = (email) => (admins.find(a => String(a.email).toLowerCase() === String(email || '').toLowerCase())?.name) || email || 'an admin'
  const amount = check.amount ?? payment.refund_amount

  // What the confirm box says the button will do — the approved wording.
  const card = payment.payment_method_type === 'card'
  const confirmText = recordOnly
    ? `This records that $${money(amount)} was returned to the client outside the portal (${payment.strategy_name}). No money moves here.`
    : payment.payment_status === 'processing'
    ? `Send $${money(amount)} back to the client's bank account through Stripe? The transfer has not finished clearing, so Stripe will cancel it if it still can (no money leaves their account), or otherwise refund it as soon as it settles.`
    : card
    ? `Send $${money(amount)} back to the client's card through Stripe? The card processing fee${Number(payment.card_processing_fee) > 0 ? ` of $${money(payment.card_processing_fee)}` : ''} is not refundable.`
    : `Send $${money(amount)} back to the client's bank account through Stripe?`

  async function submit() {
    if (!reason.trim()) { setError('Please give a reason for the refund.'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      const res = await callApi('refund_payment', { payment_id: payment.id, reason: reason.trim() }, { timeoutMs: 60000 })
      onApply(res)
      const st = res?.payment?.refund_status
      setMessage(st === 'recorded'
        ? 'Refund recorded. The client has been emailed (a Gmail draft), and nothing will be paid out on this payment.'
        : st === 'pending'
        ? 'Refund sent to Stripe. It is on its way to the client, who has been emailed (a Gmail draft). Nothing will be paid out on this payment.'
        : 'Refunded. The client has been emailed (a Gmail draft), and nothing will be paid out on this payment.')
      setOpen(false); setReason('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // A "processing" refund the server calls stale (no answer for 5 minutes) is
  // offered again: pressing it resumes the same refund at Stripe.
  const done = status === 'refunded' || status === 'recorded' || status === 'pending' || (status === 'processing' && !!check.blocked)

  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>Refund</div>

      {done ? (
        <p style={bodyStyle}>
          <strong>
            {status === 'recorded' ? 'Refund recorded' : status === 'refunded' ? 'Refunded' : status === 'pending' ? 'Refund on its way' : 'Refund in progress'}
            {` — $${money(payment.refund_amount)}`}
          </strong>
          {payment.refund_kind === 'pi_cancel' && ' (the bank transfer was cancelled before it was collected, so no money moved)'}
          {payment.refund_kind === 'record_only' && ' (returned outside the portal)'}
          {`. ${payment.refund_by ? `By ${nameOf(payment.refund_by)}` : ''}${payment.refund_requested_at ? ` on ${dateText(payment.refund_requested_at)}` : ''}${payment.refund_reason ? ` — "${payment.refund_reason}"` : ''}.`}
          {status === 'pending' && ' Stripe is returning the money to the client; this updates by itself when it lands.'}
          {' No share or fee will be paid on this payment.'}
        </p>
      ) : (
        <>
          {status === 'failed' && (
            <p style={{ ...bodyStyle, color: '#EE6A33', fontWeight: 600 }}>
              {`The last refund attempt did not go through: ${payment.refund_failure_reason || 'unknown reason'}. Nothing reached the client. You can try again.`}
            </p>
          )}
          {!open && (
            <>
              <button type="button" disabled={!!check.blocked} onClick={() => { setOpen(true); setError(''); setMessage('') }}
                style={{ ...outlineButtonStyle, color: check.blocked ? 'var(--wig-faint)' : '#EE6A33', borderColor: check.blocked ? 'var(--wig-border-soft)' : '#EE6A33', cursor: check.blocked ? 'not-allowed' : 'pointer' }}>
                {recordOnly ? 'Record refund' : 'Refund'}
              </button>
              {check.blocked && (
                <p style={{ fontSize: '12.5px', color: 'var(--wig-muted)', margin: '10px 0 0' }}>{check.blocked}</p>
              )}
            </>
          )}
          {open && (
            <div>
              <p style={bodyStyle}>{confirmText}</p>
              {(check.warnings || []).map(w => (
                <p key={w} style={{ ...bodyStyle, color: '#EE6A33', fontWeight: 600 }}>{w}</p>
              ))}
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)', marginBottom: '8px' }}>Reason (required)</div>
              <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} style={textareaStyle} disabled={busy} />
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button type="button" disabled={busy} onClick={submit} style={{ ...dangerButtonStyle, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
                  {busy ? 'Working...' : recordOnly ? 'Confirm refund recorded' : 'Confirm refund'}
                </button>
                <button type="button" disabled={busy} onClick={() => { setOpen(false); setReason(''); setError('') }} style={outlineButtonStyle}>Cancel</button>
              </div>
            </div>
          )}
        </>
      )}
      {message && <p style={{ fontSize: '13px', color: '#1b9254', margin: '12px 0 0' }}>{message}</p>}
      {error && <p style={{ fontSize: '13px', color: '#d93025', margin: '12px 0 0' }}>{error}</p>}
    </div>
  )
}
