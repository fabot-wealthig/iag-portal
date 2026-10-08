import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { callApi } from '../lib/api'
import AuthShell from '../components/shared/AuthShell'

const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px' }
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--wig-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }

// "Forgot passcode?" (Jake, 2026-10-08, VFO's ForgotPasswordPage). The
// confirmation is deliberately identical whether or not the address has a login,
// including when the call itself fails or is throttled: this page must never
// reveal that an account exists.
export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await callApi('request_password_reset', { email: email.trim() })
    } catch {
      // Swallowed on purpose — the confirmation below is the same either way.
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  return (
    <AuthShell>
      <p style={{ fontSize: '11.5px', color: '#EE6A33', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', margin: '0 0 10px' }}>IAG Revenue Share Portal</p>
      <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--wig-heading)', marginTop: 0, marginBottom: '8px', fontSize: '28px' }}>Reset your passcode</h2>
      <p style={{ color: 'var(--wig-muted)', fontSize: '14px', marginBottom: '28px' }}>Enter the email address you sign in with and we'll send you a link to choose a new passcode.</p>
      {sent ? (
        <p style={{ color: '#16a34a', fontWeight: 500, fontSize: '13px', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: '10px', padding: '12px 14px', margin: 0, lineHeight: 1.6 }}>If an account exists for that email, a reset link is on its way. It expires in 1 hour.</p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input id="email" name="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email" required autoFocus style={inputStyle} />
          </div>
          <button type="submit" disabled={loading} style={{ padding: '13px', borderRadius: '10px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 4px 14px rgba(29,100,168,0.35)', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, marginTop: '4px' }}>{loading ? 'Sending...' : 'Send reset link'}</button>
        </form>
      )}
      <p style={{ color: 'var(--wig-muted)', fontSize: '13px', marginTop: '20px', textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate('/login')}>← Back to sign in</p>
    </AuthShell>
  )
}
