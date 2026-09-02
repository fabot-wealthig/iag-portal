import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { callApi } from '../lib/api'
import AuthShell from '../components/shared/AuthShell'

const eyebrowStyle = { fontSize: '11.5px', color: '#EE6A33', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', margin: '0 0 10px' }
const titleStyle = { fontFamily: 'Inter, sans-serif', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--wig-heading)', marginTop: 0, marginBottom: '8px', fontSize: '28px' }
const subStyle = { color: 'var(--wig-muted)', fontSize: '14px', marginTop: 0, marginBottom: '20px', wordBreak: 'break-word' }

const INVALID_LINK = 'This payment link is not valid. Please contact Wealth Innovation Group for a new link.'

// Public, no-login page reached from the client "payment request" email. The
// portal collects client fees by ACH only — a product decision — so this page
// offers no card option. We never see any bank details: Stripe collects them on
// its own hosted page.
export default function PayPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const justDone = searchParams.get('done') === '1'

  // 'loading' | 'ready' | 'redirecting' | 'done' | 'error'
  const [status, setStatus] = useState(justDone ? 'done' : (token ? 'loading' : 'error'))
  const [error, setError] = useState(token || justDone ? '' : INVALID_LINK)
  const [data, setData] = useState(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (justDone || !token) return
    let cancelled = false
    // The token is passed explicitly so callApi sends it instead of a session
    // token — nobody is signed in on this page.
    callApi('load_pay_link', { token })
      .then(res => {
        if (cancelled) return
        if (res.state === 'ready') { setData(res); setStatus('ready'); return }
        setError(res.error || INVALID_LINK)
        setStatus('error')
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message || 'Could not load this payment. Please try again.')
        setStatus('error')
      })
    return () => { cancelled = true }
  }, [])

  async function startCheckout() {
    setStatus('redirecting')
    try {
      const res = await callApi('pay_link_checkout', { token })
      if (res.url) { window.location.href = res.url; return }
      setError(res.error || INVALID_LINK)
      setStatus('error')
    } catch (err) {
      setError(err.message || 'Could not start the payment. Please try again.')
      setStatus('error')
    }
  }

  return (
    <AuthShell>
      <p style={eyebrowStyle}>Wealth IG Portal</p>

      {status === 'loading' && <p style={subStyle}>Loading payment details...</p>}

      {status === 'redirecting' && <p style={subStyle}>Redirecting to Stripe...</p>}

      {status === 'done' && (
        <>
          <h1 style={titleStyle}>Payment submitted</h1>
          <p style={subStyle}>Thanks - your bank transfer has been submitted to Stripe. It takes 2-4 business days to clear, and we will email your invoice and receipt once it has settled. You can close this page.</p>
        </>
      )}

      {status === 'error' && (
        <>
          <h1 style={titleStyle}>Something went wrong</h1>
          <p style={subStyle}>{error || INVALID_LINK}</p>
          <p style={{ ...subStyle, fontSize: '13px', color: 'var(--wig-faint)' }}>
            If you keep seeing this message, reply to the payment email and we will send you a fresh link.
          </p>
        </>
      )}

      {status === 'ready' && data && (
        <>
          <h1 style={titleStyle}>Complete your payment</h1>
          <p style={subStyle}>{data.payment_label} · {data.client_name}</p>

          <div
            onClick={startCheckout}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              border: '2px solid', borderColor: hovered ? '#3D9BE0' : 'var(--wig-border)',
              background: hovered ? 'rgba(61,155,224,0.05)' : 'transparent',
              borderRadius: '16px', padding: '28px', cursor: 'pointer', transition: 'all 0.2s',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--wig-ink)' }}>ACH Bank Transfer</span>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'rgba(34,197,94,0.15)', color: '#16a34a', whiteSpace: 'nowrap' }}>No Fee</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--wig-ink)', marginBottom: '16px' }}>${fmtMoney(data.payment_amount)}</div>
            <div style={{ marginBottom: '16px' }}>
              <div style={detailRowStyle}>
                <span style={{ color: 'var(--wig-muted)' }}>{data.payment_label}</span>
                <span style={{ color: 'var(--wig-ink-2)', fontWeight: 600 }}>${fmtMoney(data.payment_amount)}</span>
              </div>
              <div style={detailRowStyle}>
                <span style={{ color: 'var(--wig-muted)' }}>Processing Fee</span>
                <span style={{ color: '#16a34a', fontWeight: 600 }}>$0.00</span>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--wig-muted)', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--wig-border-soft)' }}>
              Funds transfer directly from your bank account. Takes 2-4 business days to process.
            </div>
          </div>

          <p style={{ textAlign: 'center', color: 'var(--wig-muted)', fontSize: '12px', marginTop: '24px', lineHeight: 1.6 }}>
            Your payment details are handled securely by Stripe.<br />
            Wealth Innovation Group never sees or stores your payment information.
          </p>
        </>
      )}
    </AuthShell>
  )
}

const detailRowStyle = { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '4px 0', fontSize: '13px' }

const fmtMoney = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
