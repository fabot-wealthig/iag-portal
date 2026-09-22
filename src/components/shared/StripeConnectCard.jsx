import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const gradientButtonStyle = { padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }

// Stripe Connect state for one payout entity, a COI or a payee: draft the setup
// email, and show what Stripe currently says about the account. Having an
// account id is NOT proof onboarding finished, so the pill comes from a live
// status call, never from the row. `statusAction` / `requestAction` name the
// entity's pair of actions and `idPayload` is the body that identifies it.
export default function StripeConnectCard({
  accountId: accountIdProp,
  statusAction,
  requestAction,
  idPayload,
  onDataChange,
  connectedButtonLabel,
  setupButtonLabel,
  noAccountText,
  entityLabel = 'COI',
}) {
  const [connectStatus, setConnectStatus] = useState(null)
  const [connectLoading, setConnectLoading] = useState(false)
  const [connectRefresh, setConnectRefresh] = useState(0)
  const [requesting, setRequesting] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  const accountId = accountIdProp || ''
  // Callers pass a fresh object literal every render; the effect keys on its content.
  const idKey = JSON.stringify(idPayload || {})

  useEffect(() => {
    if (!accountId) { setConnectStatus(null); setConnectLoading(false); return }
    let alive = true
    setConnectLoading(true)
    callApi(statusAction, JSON.parse(idKey))
      .then(res => { if (alive) setConnectStatus(res || { status: 'unavailable' }) })
      .catch(() => { if (alive) setConnectStatus({ status: 'unavailable' }) })
      .finally(() => { if (alive) setConnectLoading(false) })
    return () => { alive = false }
  }, [accountId, statusAction, idKey, connectRefresh])

  async function sendRequest() {
    setRequesting(true); setMsg('')
    try {
      const ids = JSON.parse(idKey)
      let res = await callApi(requestAction, ids)
      if (res.already_sent_at) {
        if (!window.confirm(`A setup email was already drafted for this ${entityLabel} on ${new Date(res.already_sent_at).toLocaleString()}. Draft another?`)) return
        res = await callApi(requestAction, { ...ids, force: true })
      }
      setMsgType('success')
      setMsg(`Setup email drafted to ${res.to_email}${res.sandbox ? ' (sandbox)' : ''}. Stripe account ${res.stripe_account_id} is ready.`)
      // The loaded row is where stripe_account_id comes from, so it has to be
      // re-read before the status call has anything to ask about.
      await onDataChange()
      setConnectRefresh(n => n + 1)
    } catch (err) { setMsgType('error'); setMsg(err.message) }
    finally { setRequesting(false) }
  }

  const connectState = (connectLoading || !connectStatus) ? 'loading' : (connectStatus.status || 'unavailable')
  const connectPill =
    connectState === 'complete' ? { dot: '#16a34a', label: 'Account Set up' }
    : connectState === 'eligible_capped' ? { dot: '#f59e0b', label: 'Account setup — payouts eligible to $3,000' }
    : connectState === 'pending' ? { dot: '#dc2626', label: 'Setup pending' }
    : connectState === 'mode_mismatch' ? { dot: 'var(--wig-faint)', label: `Status unavailable (account created in ${connectStatus.found_in_sandbox ? 'sandbox' : 'live'} mode)` }
    : connectState === 'loading' ? { dot: 'var(--wig-faint)', label: 'Checking status…' }
    : { dot: 'var(--wig-faint)', label: 'Status unavailable' }

  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>Stripe Connect</div>
      {accountId ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '13px', padding: '8px 12px', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '8px', color: 'var(--wig-ink)' }}>{accountId}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 600, color: 'var(--wig-ink)', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '999px', padding: '4px 12px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: connectPill.dot, flexShrink: 0 }} />
            {connectPill.label}
          </span>
          <button type="button" onClick={() => setConnectRefresh(n => n + 1)} disabled={connectLoading}
            style={{ background: 'none', border: 'none', padding: 0, color: '#1D64A8', fontSize: '12px', fontWeight: 600, cursor: connectLoading ? 'wait' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Refresh
          </button>
          {connectedButtonLabel && (
            <button onClick={sendRequest} disabled={requesting} style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '13px', cursor: requesting ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: requesting ? 0.6 : 1 }}>
              {requesting ? 'Sending...' : connectedButtonLabel}
            </button>
          )}
        </div>
      ) : (
        <div>
          <p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', marginBottom: '14px' }}>{noAccountText}</p>
          <button onClick={sendRequest} disabled={requesting} style={{ ...gradientButtonStyle, cursor: requesting ? 'not-allowed' : 'pointer', opacity: requesting ? 0.6 : 1 }}>
            {requesting ? 'Working…' : setupButtonLabel}
          </button>
        </div>
      )}
      {msg && <p style={{ color: msgType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{msg}</p>}
    </div>
  )
}
