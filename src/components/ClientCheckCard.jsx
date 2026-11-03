import { useState } from 'react'
import { callApi } from '../lib/api'

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const bodyStyle = { fontSize: '13.5px', lineHeight: 1.55, color: 'var(--wig-ink)', margin: '0 0 12px' }
const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const labelStyle = { fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }
const primaryButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const dangerButtonStyle = { ...primaryButtonStyle, background: '#EE6A33' }
const outlineButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }

const todayText = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

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
 * Gone once the check has cleared or the wire is in (Progress and Details carry
 * the number) or on a payment paid through Stripe. The write is never retried (lib/api.js),
 * and it answers the whole payment detail, handed to `onApply`.
 */
export default function ClientCheckCard({ payment, onApply }) {
  const [mode, setMode] = useState(null)
  const [checkNumber, setCheckNumber] = useState('')
  const [reference, setReference] = useState('')
  const [day, setDay] = useState(todayText())
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [warning, setWarning] = useState('')

  const unpaid = !payment.payment_status || payment.payment_status === 'failed'
  const waiting = payment.payment_status === 'processing' && payment.payment_method_type === 'check'
  if (payment.funded_by === 'provider' || payment.refund_status || (!unpaid && !waiting && !message)) return null

  function open(next) {
    setMode(next); setDay(todayText()); setCheckNumber(''); setReference(''); setReason(''); setError(''); setMessage(''); setWarning('')
  }

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
        setWarning(res?.wire?.warning || '')
        setMessage(payment.invoiced_outside
          ? 'Wire recorded as received. The invoice and receipt are filed on the client\'s record (not emailed), and the payout is scheduled.'
          : 'Wire recorded as received. The pay link is closed, reminders have stopped, the invoice and receipt have gone to the client (a Gmail draft), and the payout is scheduled.')
        setMode(null)
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
      setWarning(res?.check?.warning || '')
      setMessage(payment.invoiced_outside
        ? (mode === 'received'
          ? 'Check recorded as received. Mark it cleared once the bank clears it.'
          : mode === 'cleared'
          ? 'Check recorded as cleared. The invoice and receipt are filed on the client\'s record (not emailed), and the payout is scheduled.'
          : 'Check recorded as returned. The client has not been emailed.')
        : mode === 'received'
        ? 'Check recorded as received. Reminders have stopped, the pay link is closed, and the client has been emailed (a Gmail draft).'
        : mode === 'cleared'
        ? 'Check recorded as cleared. The invoice and receipt have gone to the client (a Gmail draft), and the payout is scheduled.'
        : 'Check recorded as returned. The pay link is open again, and the client has been emailed (a Gmail draft).')
      setMode(null)
    } catch (err) {
      setError(err.message)
    } finally {
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
    : mode === 'wire'
    ? `Record a wire for $${money(payment.total_fee)}. The payment is marked paid on this date, ${docs}, and the payout is scheduled. The COI, team and fee transfers come out of the Stripe balance, so add the funds in Stripe before the pay date. If the wire is for a different amount, edit the payment request first.`
    : ''

  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>{waiting ? 'Paid by check' : 'Paid by check or wire'}</div>

      {!mode && unpaid && (
        <>
          <p style={bodyStyle}>If the client mails a check or sends a wire, record it here when it arrives.</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => open('received')} style={outlineButtonStyle}>Check received</button>
            <button type="button" onClick={() => open('wire')} style={outlineButtonStyle}>Wire received</button>
          </div>
        </>
      )}

      {!mode && waiting && (
        <>
          <p style={bodyStyle}>
            <strong>{`Check #${payment.client_check_number || ''} received`}</strong>
            {payment.payment_date ? ` on ${dateText(payment.payment_date)}` : ''}
            {`, waiting to clear. Mark it cleared once the bank clears it, or returned if it bounced.`}
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => open('cleared')} style={primaryButtonStyle}>Check cleared</button>
            <button type="button" onClick={() => open('returned')} style={{ ...outlineButtonStyle, color: '#EE6A33', borderColor: '#EE6A33' }}>Check returned</button>
          </div>
        </>
      )}

      {mode && (
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
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" disabled={busy} onClick={submit}
              style={{ ...(mode === 'returned' ? dangerButtonStyle : primaryButtonStyle), opacity: busy ? 0.7 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Working...' : mode === 'received' ? 'Record check received' : mode === 'wire' ? 'Record wire received' : mode === 'cleared' ? 'Record check cleared' : 'Record check returned'}
            </button>
            <button type="button" disabled={busy} onClick={() => { setMode(null); setError('') }} style={outlineButtonStyle}>Cancel</button>
          </div>
        </div>
      )}

      {message && <p style={{ fontSize: '13px', color: '#1b9254', margin: '12px 0 0' }}>{message}</p>}
      {warning && <p style={{ fontSize: '13px', color: '#EE6A33', fontWeight: 600, margin: '8px 0 0' }}>{warning}</p>}
      {error && <p style={{ fontSize: '13px', color: '#d93025', margin: '12px 0 0' }}>{error}</p>}
    </div>
  )
}
