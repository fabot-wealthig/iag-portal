import { useState } from 'react'
import { callApi } from '../lib/api'

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const bodyStyle = { fontSize: '13.5px', lineHeight: 1.55, color: 'var(--wig-ink)', margin: '0 0 12px' }
const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const labelStyle = { fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }
const dangerButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#EE6A33', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const outlineButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }

function dateText(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * VOIDS an unpaid client request (Beth, 2026-11-05; void_payment_request): the
 * pay link stops working, reminders stop, and the client may be emailed that it
 * was cancelled (never one invoiced outside the portal). Money already in flight
 * is a refund, so the card is gone once the client has paid or a payment is
 * underway. On a voided request it says who voided it and why, and offers the
 * cancellation email if it has not gone. Writes are never retried (lib/api.js);
 * each answers the whole payment detail, handed to `onApply`.
 */
export default function VoidRequestCard({ payment, onApply }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [email, setEmail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [warning, setWarning] = useState('')

  const voided = !!payment.voided_at
  const unpaid = !payment.payment_status || payment.payment_status === 'failed'
  if (payment.funded_by === 'provider' || payment.refund_status || (!voided && !unpaid)) return null
  const outside = payment.invoiced_outside === true

  async function submit() {
    if (!reason.trim()) { setError('Give a reason for voiding the request.'); return }
    setBusy(true); setError('')
    try {
      const res = await callApi('void_payment_request', { payment_id: payment.id, reason: reason.trim(), email: email && !outside }, { timeoutMs: 60000 })
      onApply(res)
      setWarning(res?.void?.warning || '')
      const mail = res?.void?.email
      setMessage(mail?.drafted
        ? `Request voided. The cancellation ${mail.emailed ? 'was sent to' : 'is drafted in Gmail for'} ${mail.to_email}.`
        : 'Request voided. The pay link no longer works and reminders have stopped.')
      if (mail && !mail.drafted) setError(mail.error)
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function sendEmail() {
    setBusy(true); setError(''); setMessage('')
    try {
      const res = await callApi('resend_payment_email', { payment_id: payment.id, kind: 'void' })
      setMessage(`Cancellation ${res.emailed ? 'sent to' : 'drafted in Gmail for'} ${res.to_email}.`)
      // The email stamps the row; reload it through the same detail answer.
      onApply(await callApi('load_client_payment', { payment_id: payment.id }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>{voided ? 'Request voided' : 'Void request'}</div>

      {voided && (
        <>
          <p style={bodyStyle}>
            {`Voided on ${dateText(payment.voided_at)} by ${payment.voided_by || 'an admin'}: ${payment.void_reason || ''}`}
          </p>
          {outside ? null : payment.void_email_sent_at ? (
            <p style={{ ...bodyStyle, color: 'var(--wig-muted)', margin: 0 }}>{`The client was emailed on ${dateText(payment.void_email_sent_at)}.`}</p>
          ) : (
            <button type="button" disabled={busy} onClick={sendEmail} style={{ ...outlineButtonStyle, cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Working...' : 'Send void email'}
            </button>
          )}
        </>
      )}

      {!voided && !open && (
        <button type="button" onClick={() => { setOpen(true); setReason(''); setEmail(false); setError(''); setMessage(''); setWarning('') }}
          style={{ ...outlineButtonStyle, color: '#EE6A33', borderColor: '#EE6A33' }}>
          Void request
        </button>
      )}

      {!voided && open && (
        <div>
          <p style={bodyStyle}>The pay link stops working and reminders stop. This cannot be undone; raise a new request if the client still owes a fee.</p>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Reason</label>
            <input value={reason} onChange={e => setReason(e.target.value)} maxLength={300} placeholder="e.g. wrong amount, sent in error" style={inputStyle} disabled={busy} />
          </div>
          {!outside && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: 'var(--wig-ink)', cursor: 'pointer', marginBottom: '12px' }}>
              <input type="checkbox" checked={email} onChange={e => setEmail(e.target.checked)} disabled={busy}
                style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
              Email the client that the request is cancelled
            </label>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" disabled={busy} onClick={submit}
              style={{ ...dangerButtonStyle, opacity: busy ? 0.7 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Working...' : 'Void request'}
            </button>
            <button type="button" disabled={busy} onClick={() => { setOpen(false); setError('') }} style={outlineButtonStyle}>Cancel</button>
          </div>
        </div>
      )}

      {message && <p style={{ fontSize: '13px', color: '#1b9254', margin: '12px 0 0' }}>{message}</p>}
      {warning && <p style={{ fontSize: '13px', color: '#EE6A33', fontWeight: 600, margin: '8px 0 0' }}>{warning}</p>}
      {error && <p style={{ fontSize: '13px', color: '#d93025', margin: '12px 0 0' }}>{error}</p>}
    </div>
  )
}
