import { useState } from 'react'
import { callApi } from '../lib/api'
import { bodyStyle, buttonRowStyle, buttonStyle, dangerButtonStyle, errorTextStyle, withBusy } from './shared/actionStyles'

/**
 * Delete sandbox test (Jake, 2026-10-13): testers clean up after themselves.
 * Only on a SANDBOX payment (PaymentActions.jsx offers it; the server refuses a
 * live one too), any admin, confirmed in this form. A provider record goes with
 * its WHOLE receipt. The write is never retried (lib/api.js); on success the
 * screen goes back to where it came from, since the payment no longer exists.
 */
export default function SandboxDeleteForm({ payment, onDeleted, onCancel }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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
    <div>
      <p style={bodyStyle}>
        {wholeReceipt
          ? 'Deletes this whole test receipt (every client line on it), its team shares, payout history and notifications.'
          : 'Deletes this test payment, its team shares, payout history, notifications and its invoice and receipt PDFs.'}
        {' '}The test COI and client stay, so you can test again. This cannot be undone.
      </p>
      <div style={buttonRowStyle}>
        <button type="button" disabled={busy} onClick={remove} style={withBusy(dangerButtonStyle, busy)}>
          {busy ? 'Deleting...' : 'Delete sandbox test'}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} style={withBusy(buttonStyle, busy)}>Cancel</button>
      </div>
      {error && <p style={errorTextStyle}>{error}</p>}
    </div>
  )
}
