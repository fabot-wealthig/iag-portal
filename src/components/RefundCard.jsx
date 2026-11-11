import { useState } from 'react'
import { callApi } from '../lib/api'
import {
  bodyStyle, buttonRowStyle, buttonStyle, dangerButtonStyle, dateText, errorTextStyle, money, subheadStyle, textareaStyle, warnTextStyle, withBusy,
} from './shared/actionStyles'

/**
 * Refunds (chat 17, Jake's rules). Offered only while nothing has gone out —
 * the server says whether (`payment.refund`, utils/refund.ts). PaymentActions.jsx
 * draws the Refund button only when it can be used (`refundOffered`); once there
 * is money in and it cannot, `RefundStatus` says why in words. Two wordings, so
 * nobody thinks the portal sent money back when it did not: "Refund" / "Confirm
 * refund" for a payment made through Stripe, "Record refund" / "Confirm refund
 * recorded" for a provider-funded record or a client's cleared check. A reason
 * is required. The write is never retried (lib/api.js), and it answers the
 * whole payment detail, handed to `onApply`.
 */
const refundCheck = (payment) => payment.refund || { blocked: 'Refund status unavailable.', warnings: [], kind: 'stripe', amount: null }

// A "processing" refund the server calls stale (no answer for 5 minutes) is
// offered again: pressing it resumes the same refund at Stripe.
export function refundDone(payment) {
  const status = payment.refund_status || null
  return status === 'refunded' || status === 'recorded' || status === 'pending' || (status === 'processing' && !!refundCheck(payment).blocked)
}

export function refundOffered(payment) {
  return !refundDone(payment) && !refundCheck(payment).blocked
}

export function refundLabel(payment) {
  return refundCheck(payment).kind === 'record_only' ? 'Record refund' : 'Refund'
}

// `moneyIn`: the client (or provider) has paid, so a refund is a fair question
// and "why not" is worth a line. Before that there is simply nothing to refund.
export function RefundStatus({ payment, admins = [], moneyIn }) {
  const check = refundCheck(payment)
  const status = payment.refund_status || null
  const nameOf = (email) => (admins.find(a => String(a.email).toLowerCase() === String(email || '').toLowerCase())?.name) || email || 'an admin'

  if (refundDone(payment)) {
    return (
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
    )
  }
  return (
    <>
      {status === 'failed' && (
        <p style={{ ...bodyStyle, color: '#EE6A33', fontWeight: 600 }}>
          {`The last refund attempt did not go through: ${payment.refund_failure_reason || 'unknown reason'}. Nothing reached the client. You can try again.`}
        </p>
      )}
      {moneyIn && check.blocked && (
        <p style={{ ...bodyStyle, fontSize: '12.5px', color: 'var(--wig-muted)' }}>{check.blocked}</p>
      )}
    </>
  )
}

export default function RefundForm({ payment, onApply, onDone, onCancel }) {
  const check = refundCheck(payment)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const recordOnly = check.kind === 'record_only'
  const amount = check.amount ?? payment.refund_amount

  // What the form says the button will do — the approved wording.
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
    setBusy(true); setError('')
    try {
      const res = await callApi('refund_payment', { payment_id: payment.id, reason: reason.trim() }, { timeoutMs: 60000 })
      onApply(res)
      const st = res?.payment?.refund_status
      onDone({
        message: st === 'recorded'
          ? 'Refund recorded. The client has been emailed (a Gmail draft), and nothing will be paid out on this payment.'
          : st === 'pending'
          ? 'Refund sent to Stripe. It is on its way to the client, who has been emailed (a Gmail draft). Nothing will be paid out on this payment.'
          : 'Refunded. The client has been emailed (a Gmail draft), and nothing will be paid out on this payment.',
      })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div>
      <p style={bodyStyle}>{confirmText}</p>
      {(check.warnings || []).map(w => (
        <p key={w} style={{ ...warnTextStyle, margin: '0 0 12px' }}>{w}</p>
      ))}
      <div style={subheadStyle}>Reason (required)</div>
      <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} style={textareaStyle} disabled={busy} />
      <div style={{ ...buttonRowStyle, marginTop: '12px' }}>
        <button type="button" disabled={busy} onClick={submit} style={withBusy(dangerButtonStyle, busy)}>
          {busy ? 'Working...' : recordOnly ? 'Confirm refund recorded' : 'Confirm refund'}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} style={withBusy(buttonStyle, busy)}>Cancel</button>
      </div>
      {error && <p style={errorTextStyle}>{error}</p>}
    </div>
  )
}
