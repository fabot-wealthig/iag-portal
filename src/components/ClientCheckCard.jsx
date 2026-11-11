import { useState } from 'react'
import { callApi } from '../lib/api'
import {
  bodyStyle, buttonRowStyle, buttonStyle, dateText, errorTextStyle, inputStyle, labelStyle, money, primaryButtonStyle, withBusy,
} from './shared/actionStyles'

const todayText = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

/**
 * A client paying their fee by paper check (IAG, Brittany 2026-10-27), in the
 * two stages an ACH already runs (Jake, 2026-10-27; client-check.ts):
 *   unpaid    "Check received": reminders stop, the pay link closes, and the
 *             client is emailed that the check arrived
 *   received  "Check cleared": the invoice and receipt go out and the payout is
 *             scheduled; or "Check returned": the link opens again and the
 *             client is told
 * Or by WIRE TRANSFER (Brittany 2026-11-03), in one stage: "Wire received" on
 * an unpaid request books it paid on that day — the link closes, reminders
 * stop, and the invoice, receipt and payout follow (record_client_wire).
 *
 * PaymentActions.jsx offers the buttons (`mode` is received / wire / cleared /
 * returned); `CheckStatus` says a check is waiting to clear. The write is never
 * retried (lib/api.js), and it answers the whole payment detail, handed to `onApply`.
 */
export function checkWaiting(payment) {
  return payment.payment_status === 'processing' && payment.payment_method_type === 'check'
}

export function CheckStatus({ payment }) {
  if (payment.funded_by === 'provider' || payment.refund_status || !checkWaiting(payment)) return null
  return (
    <p style={bodyStyle}>
      <strong>{`Check #${payment.client_check_number || ''} received`}</strong>
      {payment.payment_date ? ` on ${dateText(payment.payment_date)}` : ''}
      {', waiting to clear. Record it cleared once the bank clears it, or returned if it bounced.'}
    </p>
  )
}

export default function ClientCheckForm({ payment, mode, onApply, onDone, onCancel }) {
  const [checkNumber, setCheckNumber] = useState('')
  const [reference, setReference] = useState('')
  const [day, setDay] = useState(todayText())
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (mode === 'received' && !checkNumber.trim()) { setError('Enter the check number.'); return }
    if (!day) { setError('Enter the date.'); return }
    setBusy(true); setError('')
    try {
      if (mode === 'wire') {
        const res = await callApi('record_client_wire', {
          payment_id: payment.id,
          date: day,
          ...(reference.trim() ? { reference: reference.trim() } : {}),
        }, { timeoutMs: 60000 })
        onApply(res)
        onDone({
          message: payment.invoiced_outside
            ? 'Wire recorded as received. The invoice and receipt are filed on the client\'s record (not emailed), and the payout is scheduled.'
            : 'Wire recorded as received. The pay link is closed, reminders have stopped, the invoice and receipt have gone to the client (a Gmail draft), and the payout is scheduled.',
          warning: res?.wire?.warning || '',
        })
        return
      }
      const res = await callApi('record_client_check', {
        payment_id: payment.id,
        stage: mode,
        date: day,
        ...(mode === 'received' ? { check_number: checkNumber.trim() } : {}),
        ...(mode === 'returned' && reason.trim() ? { reason: reason.trim() } : {}),
      }, { timeoutMs: 60000 })
      onApply(res)
      onDone({
        message: payment.invoiced_outside
          ? (mode === 'received'
            ? 'Check recorded as received. Record it cleared once the bank clears it.'
            : mode === 'cleared'
            ? 'Check recorded as cleared. The invoice and receipt are filed on the client\'s record (not emailed), and the payout is scheduled.'
            : 'Check recorded as returned. The client has not been emailed.')
          : mode === 'received'
          ? 'Check recorded as received. Reminders have stopped, the pay link is closed, and the client has been emailed (a Gmail draft).'
          : mode === 'cleared'
          ? 'Check recorded as cleared. The invoice and receipt have gone to the client (a Gmail draft), and the payout is scheduled.'
          : 'Check recorded as returned. The pay link is open again, and the client has been emailed (a Gmail draft).',
        warning: res?.check?.warning || '',
      })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  // Invoiced outside the portal (migration 101): the documents are filed, never emailed.
  const docs = payment.invoiced_outside ? "the invoice and receipt are filed on the client's record (not emailed)" : 'the invoice and receipt go to the client'
  const confirmText = mode === 'received'
    ? `Record a check for $${money(payment.total_fee)}. If the check is for a different amount, edit the payment request first.`
    : mode === 'cleared'
    ? `${docs.charAt(0).toUpperCase()}${docs.slice(1)}, and the payout is scheduled from this date. The COI, team and fee transfers come out of the Stripe balance, so add the funds in Stripe before the pay date.`
    : mode === 'returned'
    ? (payment.invoiced_outside ? 'The payment goes back to unpaid. The client is not emailed.' : 'The pay link opens again, and the client is emailed that the check was returned.')
    : `Record a wire for $${money(payment.total_fee)}. The payment is marked paid on this date, ${docs}, and the payout is scheduled. The COI, team and fee transfers come out of the Stripe balance, so add the funds in Stripe before the pay date. If the wire is for a different amount, edit the payment request first.`

  return (
    <div>
      <p style={bodyStyle}>{confirmText}</p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {mode === 'received' && (
          <div style={{ flex: '1 1 180px' }}>
            <label style={labelStyle}>Check number</label>
            <input value={checkNumber} onChange={e => setCheckNumber(e.target.value)} maxLength={40} style={inputStyle} disabled={busy} />
          </div>
        )}
        {mode === 'wire' && (
          <div style={{ flex: '1 1 180px' }}>
            <label style={labelStyle}>Wire reference (optional)</label>
            <input value={reference} onChange={e => setReference(e.target.value)} maxLength={80} style={inputStyle} disabled={busy} />
          </div>
        )}
        <div style={{ flex: '1 1 180px', maxWidth: '220px' }}>
          <label style={labelStyle}>{mode === 'received' || mode === 'wire' ? 'Date received' : mode === 'cleared' ? 'Date cleared' : 'Date returned'}</label>
          <input type="date" value={day} max={todayText()} onChange={e => setDay(e.target.value)} style={inputStyle} disabled={busy} />
        </div>
      </div>
      {mode === 'returned' && (
        <div style={{ marginBottom: '12px' }}>
          <label style={labelStyle}>Reason (optional)</label>
          <input value={reason} onChange={e => setReason(e.target.value)} maxLength={300} placeholder="e.g. insufficient funds" style={inputStyle} disabled={busy} />
        </div>
      )}
      <div style={buttonRowStyle}>
        <button type="button" disabled={busy} onClick={submit} style={withBusy(primaryButtonStyle, busy)}>
          {busy ? 'Working...' : mode === 'received' ? 'Record check received' : mode === 'wire' ? 'Record wire received' : mode === 'cleared' ? 'Record check cleared' : 'Record check returned'}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} style={withBusy(buttonStyle, busy)}>Cancel</button>
      </div>
      {error && <p style={errorTextStyle}>{error}</p>}
    </div>
  )
}
