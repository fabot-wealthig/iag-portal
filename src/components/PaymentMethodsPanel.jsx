import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { TrackHero } from './shared/TrackKit'
import { SkeletonCard } from './shared/Skeleton'

// Automation & Config → Payment Methods (IAG, 2026-11-23): the day clients stop
// paying by ACH and the wire instructions their payment page shows from then.
// Superadmins only, server included. The day takes effect at midnight Eastern with
// no deploy; "Sandbox payments now" turns it off for test payments alone.

const inputStyle = { padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const labelStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)', marginBottom: '6px', display: 'block' }
const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const primaryButtonStyle = { padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const chip = (on) => ({ fontSize: '11px', lineHeight: 1.35, fontWeight: 600, borderRadius: '999px', padding: '2px 8px', color: on ? '#1b9254' : '#EE6A33', background: on ? 'rgba(27,146,84,0.15)' : 'rgba(238,106,51,0.12)', border: `1px solid ${on ? 'rgba(27,146,84,0.3)' : 'rgba(238,106,51,0.28)'}` })

const dayText = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })
}

const toForm = (o) => ({ ach_off_on: o.ach_off_on || '', sandbox_ach_off: o.sandbox_ach_off === true, wire_instructions: o.wire_instructions || '' })

export default function PaymentMethodsPanel() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saved, setSaved] = useState(null)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    callApi('load_payment_options')
      .then(data => { setSaved(data.options); setForm(toForm(data.options)) })
      .catch(err => setLoadError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function edit(patch) {
    setForm(f => ({ ...f, ...patch }))
    setMessage(''); setError('')
  }

  async function save() {
    setBusy(true); setError(''); setMessage('')
    try {
      const data = await callApi('save_payment_options', form)
      setSaved(data.options); setForm(toForm(data.options))
      setMessage('Saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const dirty = saved && form && JSON.stringify(toForm(saved)) !== JSON.stringify(form)

  return (
    <div>
      <TrackHero eyebrow="Automation & Config" title="Payment Methods" />
      {loading ? <SkeletonCard rows={4} /> : loadError ? (
        <div style={sectionStyle}><p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{loadError}</p></div>
      ) : (
        <>
          <div style={sectionStyle}>
            <span style={{ ...labelStyle, marginBottom: '12px' }}>ACH bank transfer</span>
            <p style={{ fontSize: '13.5px', color: 'var(--wig-ink)', margin: '0 0 18px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={chip(saved.ach_on_live)}>{saved.ach_on_live ? 'On' : 'Off'}</span>
              {saved.ach_off_on ? `${saved.ach_on_live ? 'Stops' : 'Stopped'} ${dayText(saved.ach_off_on)}` : 'No end date'}
              {saved.ach_on_live && !saved.ach_on_sandbox && <span style={chip(false)}>Off on sandbox payments</span>}
            </p>
            <label style={labelStyle} htmlFor="ach-off-on">Stop accepting ACH on</label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input id="ach-off-on" type="date" value={form.ach_off_on} onChange={e => edit({ ach_off_on: e.target.value })} style={inputStyle} disabled={busy} />
              {form.ach_off_on && (
                <button type="button" disabled={busy} onClick={() => edit({ ach_off_on: '' })}
                  style={{ padding: 0, border: 'none', background: 'none', color: '#1D64A8', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  Clear date
                </button>
              )}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--wig-ink)', marginTop: '16px', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.sandbox_ach_off} onChange={e => edit({ sandbox_ach_off: e.target.checked })} disabled={busy} style={{ accentColor: '#1D64A8' }} />
              Off now on sandbox payments
            </label>
            <p style={{ fontSize: '12.5px', color: 'var(--wig-muted)', lineHeight: 1.6, margin: '16px 0 0' }}>
              With ACH off, clients pay by card (2.9% + $0.30 added) or by wire. Bank transfers already started still clear.
            </p>
          </div>

          <div style={sectionStyle}>
            <label style={labelStyle} htmlFor="wire-instructions">Wire instructions</label>
            <textarea id="wire-instructions" value={form.wire_instructions} onChange={e => edit({ wire_instructions: e.target.value })}
              maxLength={saved.wire_instructions_max} rows={9} disabled={busy} autoComplete="off" spellCheck={false}
              style={{ ...inputStyle, width: '100%', resize: 'vertical', lineHeight: 1.6 }} />
            <p style={{ fontSize: '12.5px', color: 'var(--wig-muted)', lineHeight: 1.6, margin: '10px 0 0' }}>
              Shown on the client's payment page exactly as typed, with their client number as the reference. Never put in an email.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={save} disabled={busy || !dirty}
              style={{ ...primaryButtonStyle, opacity: busy || !dirty ? 0.6 : 1, cursor: busy || !dirty ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Saving...' : 'Save'}
            </button>
            {message && <span style={{ fontSize: '13px', color: '#1b9254', fontWeight: 600 }}>{message}</span>}
            {error && <span style={{ fontSize: '13px', color: '#d93025' }}>{error}</span>}
            {saved.updated_by && (
              <span style={{ fontSize: '12.5px', color: 'var(--wig-muted)' }}>
                {`Last changed by ${saved.updated_by}, ${new Date(saved.updated_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
