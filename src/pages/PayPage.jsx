import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { callApi } from '../lib/api'
import AuthShell from '../components/shared/AuthShell'
import TokenShell from '../components/shared/TokenShell'

const eyebrowStyle = { fontSize: '11.5px', color: '#EE6A33', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', margin: '0 0 10px' }
const titleStyle = { fontFamily: 'Inter, sans-serif', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--wig-heading)', marginTop: 0, marginBottom: '8px', fontSize: '28px' }
const subStyle = { color: 'var(--wig-muted)', fontSize: '14px', marginTop: 0, marginBottom: '20px', wordBreak: 'break-word' }

const INVALID_LINK = 'This payment link is not valid. Please contact Wealth Innovation Group for a new link.'

const NEXT_STEPS = [
  'Your bank transfer clears in 2 to 4 business days.',
  'We email you a confirmation as soon as the payment arrives.',
  'Your numbered invoice and receipt follow once the payment has settled.',
]

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

  // The Stripe success return carries no token, so this state has no client
  // data to show — it gets the branded standalone landing instead of the
  // split-panel shell the token states use.
  if (status === 'done') {
    return (
      <TokenShell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(27,146,84,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1b9254" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5 L10 17.5 L19 7" />
            </svg>
          </div>
          <p style={eyebrowStyle}>Payment</p>
          <h1 style={{ ...titleStyle, fontSize: '26px' }}>Payment successful</h1>
          <p style={{ color: 'var(--wig-muted)', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
            Thank you. Your bank transfer has been submitted to Stripe and your payment is being processed.
          </p>
        </div>

        <div style={{ background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '10px', padding: '16px 18px', marginTop: '24px', textAlign: 'left' }}>
          <p style={{ ...eyebrowStyle, marginBottom: '12px' }}>What happens next</p>
          {NEXT_STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: i === 0 ? 0 : '10px' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#0F355A', color: '#ffffff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: '13.5px', color: 'var(--wig-ink)', lineHeight: 1.5 }}>{step}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '12.5px', color: 'var(--wig-muted)', lineHeight: 1.6, marginTop: '18px', marginBottom: 0, textAlign: 'left' }}>
          You can close this page. If you have a question, reply to the payment email and the Wealth Innovation Group team will help.
        </p>

        <p style={{ textAlign: 'center', color: 'var(--wig-muted)', fontSize: '12px', marginTop: '24px', marginBottom: 0, lineHeight: 1.6 }}>
          Your payment details are handled securely by Stripe.<br />
          Wealth Innovation Group never sees or stores your payment information.
        </p>
      </TokenShell>
    )
  }

  return (
    <AuthShell tagline="Secure payment of your strategy fee. Bank transfers are handled by Stripe, and Wealth Innovation Group never sees or stores your bank details.">
      <p style={eyebrowStyle}>Wealth IG Portal</p>

      {status === 'loading' && <p style={subStyle}>Loading payment details...</p>}

      {status === 'redirecting' && <p style={subStyle}>Redirecting to Stripe...</p>}

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
