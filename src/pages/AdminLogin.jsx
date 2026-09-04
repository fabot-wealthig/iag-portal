import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { callApi, getSession, setSession } from '../lib/api'
import AuthShell from '../components/shared/AuthShell'

const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px' }
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--wig-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }

export default function AdminLogin() {
  const navigate = useNavigate()
  const emailRef = useRef(null)
  const passRef = useRef(null)
  const [email, setEmail] = useState('')
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Already signed in (e.g. hit "/login" from a bookmark) — skip the form.
  useEffect(() => {
    if (getSession()) navigate('/portal', { replace: true })
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Fall back to the DOM value: password-manager autofill can populate the
      // field without firing React's onChange, leaving the state empty.
      const emailVal = (email || emailRef.current?.value || '').trim()
      const passVal = passcode || passRef.current?.value || ''
      const data = await callApi('admin_login', { email: emailVal, passcode: passVal })
      // Explicit whitelist, never a spread of the response.
      setSession({
        token: data.token,
        name: data.name,
        email: data.email || emailVal,
        is_superadmin: data.is_superadmin,
        allowed_tabs: data.allowed_tabs,
      })
      // A fresh sign-in never inherits the previous user's portal UI state —
      // including which secondary tab they were on, which the new admin may not
      // even be allowed to see.
      sessionStorage.removeItem('wigActiveTab')
      sessionStorage.removeItem('wigCoiSection')
      sessionStorage.removeItem('wigSelectedCoi')
      sessionStorage.removeItem('wigCoiFeatureTab')
      sessionStorage.removeItem('wigAutomationSection')
      sessionStorage.removeItem('wigAccountingSection')
      // The drill-in keys too: they now outlive a reload, so without this a new
      // admin would inherit the last one's open mothership, client or payment.
      sessionStorage.removeItem('wigSelectedMothership')
      sessionStorage.removeItem('wigSelectedClient')
      sessionStorage.removeItem('wigClientFeatureTab')
      sessionStorage.removeItem('wigSelectedPayment')
      sessionStorage.removeItem('wigCoiReturnTo')
      navigate('/portal', { replace: true })
    } catch (err) {
      // Covers bad credentials and the throttle message alike — the server's
      // wording is the wording the person sees.
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <p style={{ fontSize: '11.5px', color: '#EE6A33', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', margin: '0 0 10px' }}>Wealth IG Portal</p>
      <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--wig-heading)', marginTop: 0, marginBottom: '8px', fontSize: '28px' }}>Sign in</h2>
      <p style={{ color: 'var(--wig-muted)', fontSize: '14px', marginBottom: '28px' }}>Welcome back — enter your admin credentials.</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={labelStyle}>Email</label>
          <input ref={emailRef} id="email" name="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} type="email" required autoFocus style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Passcode</label>
          <input ref={passRef} id="password" name="password" autoComplete="current-password" value={passcode} onChange={e => setPasscode(e.target.value)} placeholder="••••••••" type="password" required style={inputStyle} />
        </div>
        {error && <p style={{ color: '#d93025', fontWeight: 500, fontSize: '13px', margin: 0 }} role="alert">{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: '13px', borderRadius: '10px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 4px 14px rgba(29,100,168,0.35)', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}>{loading ? 'Signing in...' : 'Sign In'}</button>
      </form>
      <p style={{ color: 'var(--wig-muted)', fontSize: '13px', marginTop: '20px', textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate('/')}>← Back to portal selection</p>
    </AuthShell>
  )
}
