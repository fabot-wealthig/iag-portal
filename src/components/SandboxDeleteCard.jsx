import { useState } from 'react'
import { callApi } from '../lib/api'

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const dangerButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#d93025', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const outlineButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const bodyStyle = { fontSize: '13.5px', lineHeight: 1.55, color: 'var(--wig-ink)', margin: '0 0 12px' }

/**
 * Delete sandbox test (Jake, 2026-10-13): testers clean up after themselves.
 * Only on a SANDBOX payment (the server refuses a live one too), any admin,
 * two steps like the Refund card. A provider record goes with its WHOLE
 * receipt. The write is never retried (lib/api.js); on success the screen goes
 * back to where it came from, since the payment no longer exists.
 */
export default function SandboxDeleteCard({ payment, onDeleted }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (payment.sandbox !== true) return null
  const wholeReceipt = !!payment.receipt_id

  async function remove() {
    setBusy(true)
    setError('')
    try {
      await callApi('delete_sandbox_test', { payment_id: payment.id }, { timeoutMs: 60000 })
      onDeleted()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>Delete sandbox test</div>
      <p style={bodyStyle}>
        {wholeReceipt
          ? 'Deletes this whole test receipt (every client line on it), its team shares, payout history and notifications.'
          : 'Deletes this test payment, its team shares, payout history, notifications and its invoice and receipt PDFs.'}
        {' '}The test COI and client stay, so you can test again. This cannot be undone.
      </p>
      {confirming ? (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" disabled={busy} onClick={remove} style={{ ...dangerButtonStyle, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy ? 'Deleting...' : 'Confirm delete'}
          </button>
          <button type="button" disabled={busy} onClick={() => { setConfirming(false); setError('') }} style={outlineButtonStyle}>Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} style={outlineButtonStyle}>Delete sandbox test</button>
      )}
      {error && <p style={{ color: '#d93025', fontSize: '13px', marginTop: '12px', marginBottom: 0 }}>{error}</p>}
    </div>
  )
}
