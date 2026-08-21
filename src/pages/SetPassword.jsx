import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { callApi } from '../lib/api'

const MIN_PASSCODE_LENGTH = 8

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
    <div className="auth-shell">
      <div className="card auth-card">
        <p className="eyebrow">IAG Portal</p>

        {state === 'loading' && (
          <>
            <h1 className="auth-title">Checking your link…</h1>
            <p className="auth-sub">One moment.</p>
          </>
        )}

        {state === 'invalid' && (
          <>
            <h1 className="auth-title">Link not valid</h1>
            <p className="auth-sub">{loadError || 'This setup link is not valid.'}</p>
            <p className="auth-sub">Please contact us for a new link.</p>
          </>
        )}

        {state === 'already_setup' && (
          <>
            <h1 className="auth-title">Already set up</h1>
            <p className="auth-sub">This link has already been used.</p>
            <Link className="btn-primary btn-link" to="/">Go to sign in</Link>
          </>
        )}

        {state === 'done' && (
          <>
            <h1 className="auth-title">Passcode set</h1>
            <p className="auth-sub">You can now sign in with your email and new passcode.</p>
            <Link className="btn-primary btn-link" to="/">Go to sign in</Link>
          </>
        )}

        {state === 'ok' && (
          <form onSubmit={handleSubmit}>
            <h1 className="auth-title">Choose a passcode</h1>
            <p className="auth-sub">
              {account.name ? `${account.name} · ` : ''}{account.email}
            </p>

            <label className="field">
              <span className="field-label">New passcode</span>
              <input
                type="password"
                name="new-password"
                autoComplete="new-password"
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                required
                autoFocus
              />
            </label>

            <label className="field">
              <span className="field-label">Confirm passcode</span>
              <input
                type="password"
                name="confirm-password"
                autoComplete="new-password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
            </label>

            <p className="field-hint">At least {MIN_PASSCODE_LENGTH} characters.</p>

            {error && <p className="msg-error" role="alert">{error}</p>}

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Set passcode'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
