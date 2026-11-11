import { useState } from 'react'
import { callApi } from '../lib/api'
import {
  bodyStyle, buttonRowStyle, buttonStyle, dangerButtonStyle, dateText, errorTextStyle, inputStyle, labelStyle, withBusy,
} from './shared/actionStyles'

/**
 * VOIDS an unpaid client request (Beth, 2026-11-05; void_payment_request): the
 * pay link stops working, reminders stop, and the client may be emailed that it
 * was cancelled (never one invoiced outside the portal). Money already in flight
 * is a refund, so Void is offered only while the request is unpaid
 * (PaymentActions.jsx decides). Once voided, `VoidStatus` says who voided it and
 * why; Send void email (resend kind `void`) sits in the Actions row until the
 * client has been told. The write is never retried (lib/api.js); it answers the
 * whole payment detail, handed to `onApply`.
 */
export function VoidStatus({ payment }) {
  if (!payment.voided_at) return null
  return (
    <p style={bodyStyle}>
      <strong>{`Voided on ${dateText(payment.voided_at)}`}</strong>
      {` by ${payment.voided_by || 'an admin'}: ${payment.void_reason || ''}`}
      {!payment.invoiced_outside && payment.void_email_sent_at ? ` The client was emailed on ${dateText(payment.void_email_sent_at)}.` : ''}
    </p>
  )
}

export default function VoidRequestForm({ payment, onApply, onDone, onCancel }) {
  const [reason, setReason] = useState('')
  const [email, setEmail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const outside = payment.invoiced_outside === true

  async function submit() {
    if (!reason.trim()) { setError('Give a reason for voiding the request.'); return }
    setBusy(true); setError('')
    try {
      const res = await callApi('void_payment_request', { payment_id: payment.id, reason: reason.trim(), email: email && !outside }, { timeoutMs: 60000 })
      onApply(res)
      const mail = res?.void?.email
      onDone({
        message: mail?.drafted
          ? `Request voided. The cancellation ${mail.emailed ? 'was sent to' : 'is drafted in Gmail for'} ${mail.to_email}.`
          : 'Request voided. The pay link no longer works and reminders have stopped.',
        warning: res?.void?.warning || '',
        error: mail && !mail.drafted ? mail.error : '',
      })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div>
      <p style={bodyStyle}>The pay link stops working and reminders stop. This cannot be undone; raise a new request if the client still owes a fee.</p>
      <div style={{ marginBottom: '12px' }}>
        <label style={labelStyle}>Reason</label>
        <input value={reason} onChange={e => setReason(e.target.value)} maxLength={300} placeholder="e.g. wrong amount, sent in error" style={inputStyle} disabled={busy} />
      </div>
      {!outside && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: 'var(--wig-ink)', cursor: 'pointer', marginBottom: '14px' }}>
          <input type="checkbox" checked={email} onChange={e => setEmail(e.target.checked)} disabled={busy}
            style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
          Email the client that the request is cancelled
        </label>
      )}
      <div style={buttonRowStyle}>
        <button type="button" disabled={busy} onClick={submit} style={withBusy(dangerButtonStyle, busy)}>
          {busy ? 'Working...' : 'Void request'}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} style={withBusy(buttonStyle, busy)}>Cancel</button>
      </div>
      {error && <p style={errorTextStyle}>{error}</p>}
    </div>
  )
}
