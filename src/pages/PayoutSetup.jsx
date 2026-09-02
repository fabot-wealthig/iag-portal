import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { callApi } from '../lib/api'
import AuthShell from '../components/shared/AuthShell'

const eyebrowStyle = { fontSize: '11.5px', color: '#EE6A33', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', margin: '0 0 10px' }
const titleStyle = { fontFamily: 'Inter, sans-serif', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--wig-heading)', marginTop: 0, marginBottom: '8px', fontSize: '28px' }
const subStyle = { color: 'var(--wig-muted)', fontSize: '14px', marginTop: 0, marginBottom: '20px', wordBreak: 'break-word' }

const INVALID_LINK = 'This setup link is not valid. Please contact Wealth Innovation Group for a new link.'

// Public, no-login page reached from the COI "Set Up Payment Details" email. The
// link is durable — on every visit the backend mints a FRESH Stripe onboarding
// link and we redirect to it, so a second click never dead-ends. Stripe's own
// mid-flow expiry loops back here (refresh_url) and gets a new link. We never
// see any bank or card details.
export default function PayoutSetup() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const justDone = searchParams.get('done') === '1'

  // 'redirecting' | 'done' | 'error'
  const [status, setStatus] = useState(justDone ? 'done' : (token ? 'redirecting' : 'error'))
  const [error, setError] = useState(token ? '' : INVALID_LINK)

  useEffect(() => {
    if (justDone || !token) return
    let cancelled = false
    // The token is passed explicitly so callApi sends it instead of the admin
    // session token — nobody is signed in on this page.
    callApi('connect_setup_link', { token })
      .then(data => {
        if (cancelled) return
        if (data.url) { window.location.replace(data.url); return }
        setError(data.error || INVALID_LINK)
        setStatus('error')
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message || 'Could not start the setup. Please try again.')
        setStatus('error')
      })
    return () => { cancelled = true }
  }, [])

  return (
    <AuthShell>
      <p style={eyebrowStyle}>Wealth IG Portal</p>

      {status === 'redirecting' && (
        <p style={subStyle}>Taking you to Stripe's secure payment setup...</p>
      )}

      {status === 'done' && (
        <>
          <h1 style={titleStyle}>Payment details submitted</h1>
          <p style={subStyle}>Thanks - your information was securely submitted to Stripe. You can close this page.</p>
        </>
      )}

      {status === 'error' && (
        <>
          <h1 style={titleStyle}>Something went wrong</h1>
          <p style={subStyle}>{error || INVALID_LINK}</p>
          <p style={{ ...subStyle, fontSize: '13px', color: 'var(--wig-faint)' }}>
            If you keep seeing this message, reply to the setup email and we will send you a fresh link.
          </p>
        </>
      )}
    </AuthShell>
  )
}
