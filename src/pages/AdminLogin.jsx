import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { callApi, getSession, setSession } from '../lib/api'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Already signed in (e.g. hit "/" from a bookmark, or landed here from the
  // catch-all route) — skip the form.
  useEffect(() => {
    if (getSession()) navigate('/members', { replace: true })
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const emailVal = email.trim()
      const data = await callApi('admin_login', { email: emailVal, passcode })
      // Explicit whitelist, never a spread of the response.
      setSession({
        token: data.token,
        name: data.name,
        email: data.email || emailVal,
        is_superadmin: data.is_superadmin,
      })
      navigate('/members', { replace: true })
    } catch (err) {
      // Covers bad credentials and the throttle message alike — the server's
      // wording is the wording the person sees.
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <p className="eyebrow">IAG Portal</p>
        <h1 className="auth-title">Sign in</h1>
        <p className="auth-sub">Enter your team credentials to continue.</p>

        <label className="field">
          <span className="field-label">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field-label">Passcode</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={passcode}
            onChange={e => setPasscode(e.target.value)}
            required
          />
        </label>

        {error && <p className="msg-error" role="alert">{error}</p>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
