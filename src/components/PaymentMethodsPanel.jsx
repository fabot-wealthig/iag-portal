import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { ListHeader } from './shared/TrackKit'
import { ListHeaderSkeleton, TableSkeleton } from './shared/Skeleton'
import { formLabelStyle, InfoField, InfoGrid, ProfileCard } from './shared/ProfileKit'

// Automation & Config → Payment Methods (IAG, 2026-11-23): the day clients stop
// paying by ACH and the wire instructions their payment page shows from then.
// Superadmins only, server included. The day takes effect at midnight Eastern with
// no deploy; Sandbox payments can turn it off at once, to test. The same cards and
// fields as Payroll Report, titles and fields only (Jake).

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const gradientButtonStyle = { padding: '10px 28px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }

const dayText = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })

const toForm = (o) => ({ ach_off_on: o.ach_off_on || '', sandbox_ach_off: o.sandbox_ach_off === true, wire_instructions: o.wire_instructions || '' })

// "On" / "On until December 1, 2026" / "Off since December 1, 2026" / "Off".
function achText(on, o) {
  if (on) return o.ach_off_on ? `On until ${dayText(o.ach_off_on)}` : 'On'
  return o.ach_on_live ? 'Off' : `Off since ${dayText(o.ach_off_on)}`
}

export default function PaymentMethodsPanel() {
  const [saved, setSaved] = useState(null)
  const [form, setForm] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  const take = (o) => { setSaved(o); setForm(toForm(o)) }

  useEffect(() => {
    let live = true
    callApi('load_payment_options')
      .then(d => { if (live) take(d.options) })
      .catch(err => { if (live) setLoadError(err.message) })
    return () => { live = false }
  }, [])

  function edit(patch) {
    setForm(f => ({ ...f, ...patch }))
    setMsg('')
  }

  async function save() {
    setSaving(true); setMsg('')
    try {
      const d = await callApi('save_payment_options', form)
      take(d.options)
      setMsgType('success'); setMsg('Saved.')
    } catch (err) {
      setMsgType('error'); setMsg(err.message)
    } finally { setSaving(false) }
  }

  if (loadError) return <div><ListHeader title="Payment Methods" /><p style={{ color: '#d93025', fontSize: '13px' }}>{loadError}</p></div>
  if (!saved || !form) return <div><ListHeaderSkeleton /><TableSkeleton cols={[1, 1, 1]} rows={2} /></div>

  const dirty = JSON.stringify(toForm(saved)) !== JSON.stringify(form)

  return (
    <div>
      <ListHeader title="Payment Methods" />

      <ProfileCard title="ACH and Wire">
        <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 1 280px', minWidth: '220px' }}>
            <label style={formLabelStyle} htmlFor="ach-off-on">Stop accepting ACH on</label>
            <input id="ach-off-on" type="date" value={form.ach_off_on} onChange={e => edit({ ach_off_on: e.target.value })} style={inputStyle} disabled={saving} />
          </div>
          <div style={{ flex: '0 1 280px', minWidth: '220px' }}>
            <label style={formLabelStyle} htmlFor="ach-sandbox">Sandbox payments</label>
            <select id="ach-sandbox" value={form.sandbox_ach_off ? 'off' : 'same'} onChange={e => edit({ sandbox_ach_off: e.target.value === 'off' })} style={inputStyle} disabled={saving}>
              <option value="same">Same as client payments</option>
              <option value="off">ACH off now</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: '18px' }}>
          <label style={formLabelStyle} htmlFor="wire-instructions">Wire instructions</label>
          <textarea id="wire-instructions" value={form.wire_instructions} onChange={e => edit({ wire_instructions: e.target.value })}
            maxLength={saved.wire_instructions_max} rows={6} disabled={saving} autoComplete="off" spellCheck={false}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
        </div>
        <div style={{ marginTop: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={save} disabled={saving || !dirty} style={{ ...gradientButtonStyle, opacity: saving || !dirty ? 0.55 : 1, cursor: saving || !dirty ? 'default' : 'pointer' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          {msg && <span style={{ color: msgType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px' }}>{msg}</span>}
        </div>
      </ProfileCard>

      <ProfileCard title="Current Status">
        <InfoGrid>
          <InfoField label="ACH on client payments">{achText(saved.ach_on_live, saved)}</InfoField>
          <InfoField label="ACH on sandbox payments">{achText(saved.ach_on_sandbox, saved)}</InfoField>
          <InfoField label="Wire instructions">{saved.wire_instructions ? 'Added' : 'None'}</InfoField>
        </InfoGrid>
      </ProfileCard>
    </div>
  )
}
