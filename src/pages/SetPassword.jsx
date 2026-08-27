import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { callApi } from '../lib/api'
import AuthShell from '../components/shared/AuthShell'

const MIN_PASSCODE_LENGTH = 8

const eyebrowStyle = { fontSize: '11.5px', color: '#EE6A33', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', margin: '0 0 10px' }
const titleStyle = { fontFamily: 'Inter, sans-serif', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--wig-heading)', marginTop: 0, marginBottom: '8px', fontSize: '28px' }
const subStyle = { color: 'var(--wig-muted)', fontSize: '14px', marginTop: 0, marginBottom: '20px', wordBreak: 'break-word' }
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px' }
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--wig-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }
const buttonStyle = { display: 'block', width: '100%', padding: '13px', borderRadius: '10px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 4px 14px rgba(29,100,168,0.35)', color: '#fff', fontSize: '15px', fontWeight: 600, fontFamily: 'Inter, sans-serif', cursor: 'pointer', marginTop: '4px', textAlign: 'center', textDecoration: 'none' }

export default function SetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  // 'loading' | 'invalid' | 'already_setup' | 'ok' | 'done'
  const [state, setState] = useState('loading')
  const [account, setAccount] = useState({ name: '', email: '' })
  const [loadError, setLoadError] = useState('')

  const [passcode, setPasscode] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!token) {
      setState('invalid')
      setLoadError('This setup link is missing its token.')
      return
    }
    let cancelled = false
    callApi('load_login_setup', { token })
      .then(data => {
        if (cancelled) return
        if (data.state === 'ok') {
          setAccount({ name: data.name || '', email: data.email || '' })
          setState('ok')
        } else if (data.state === 'already_setup') {
          setState('already_setup')
        } else {
          setLoadError(data.error || 'This setup link is not valid.')
          setState('invalid')
        }
      })
      .catch(err => {
        if (cancelled) return
        setLoadError(err.message)
        setState('invalid')
      })
    return () => { cancelled = true }
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (passcode.length < MIN_PASSCODE_LENGTH) {
      setError(`Passcode must be at least ${MIN_PASSCODE_LENGTH} characters.`)
      return
    }
    if (passcode !== confirm) {
      setError('The two passcodes do not match.')
      return
    }
    setSaving(true)
    try {
      const data = await callApi('submit_login_setup', { token, passcode })
      // The server answers invalid / already_setup with a 200 and a state, so
      // success is not simply "it did not throw".
      if (data.state === 'already_setup') {
        setState('already_setup')
        return
      }
      if (data.state && data.state !== 'ok') {
        setLoadError(data.error || 'This setup link is not valid.')
        setState('invalid')
        return
      }
      setState('done')
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <AuthShell>
      <p style={eyebrowStyle}>Wealth IG Portal</p>

      {state === 'loading' && (
        <>
          <h1 style={titleStyle}>Checking your link…</h1>
          <p style={subStyle}>One moment.</p>
        </>
      )}

      {state === 'invalid' && (
        <>
          <h1 style={titleStyle}>Link not valid</h1>
          <p style={subStyle}>{loadError || 'This setup link is not valid.'}</p>
          <p style={subStyle}>Please contact us for a new link.</p>
        </>
      )}

      {state === 'already_setup' && (
        <>
          <h1 style={titleStyle}>Already set up</h1>
          <p style={subStyle}>This link has already been used.</p>
          <Link style={buttonStyle} to="/login">Go to sign in</Link>
        </>
      )}

      {state === 'done' && (
        <>
          <h1 style={titleStyle}>Passcode set</h1>
          <p style={subStyle}>You can now sign in with your email and new passcode.</p>
          <Link style={buttonStyle} to="/login">Go to sign in</Link>
        </>
      )}

      {state === 'ok' && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h1 style={titleStyle}>Choose a passcode</h1>
            <p style={{ ...subStyle, marginBottom: 0 }}>
              {account.name ? `${account.name} · ` : ''}{account.email}
            </p>
          </div>

          <div>
            <label style={labelStyle}>New passcode</label>
            <input
              type="password"
              name="new-password"
              autoComplete="new-password"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              required
              autoFocus
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Confirm passcode</label>
            <input
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <p style={{ fontSize: '12.5px', color: 'var(--wig-muted)', margin: 0 }}>At least {MIN_PASSCODE_LENGTH} characters.</p>

          {error && <p style={{ color: '#d93025', fontWeight: 500, fontSize: '13px', margin: 0 }} role="alert">{error}</p>}

          <button type="submit" disabled={saving} style={buttonStyle}>
            {saving ? 'Saving…' : 'Set passcode'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
