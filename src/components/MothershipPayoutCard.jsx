import { useEffect, useState } from 'react'
import { callApi, getSession } from '../lib/api'
import { NameLink } from './shared/TrackKit'
import { formLabelStyle, InfoField, InfoGrid, ProfileCard } from './shared/ProfileKit'
import { pctText } from '../lib/revenuePreview'

// A mothership paid DIRECTLY on some strategy (IAG, 2026-11-23: Innovative Group
// and DDP): what it is paid, and the FIRM its share goes to, one per Stripe mode.
// The firm's own profile has its billing email and Send Setup Email. Superadmins
// edit; the server says so too.

const selectStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const gradientButtonStyle = { padding: '10px 28px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }

const shareText = (s) => s.contribution_pct != null ? `${pctText(s.contribution_pct)} of the contribution` : `${pctText(s.pct)} of the pool`
const accountText = (f) => !f ? null : f.has_account ? 'Stripe account created' : f.billing_email ? 'Setup email not finished' : 'No billing email'

function FirmValue({ firm, onOpenFirm }) {
  if (!firm) return null
  return onOpenFirm
    ? <NameLink title="Open firm profile" onClick={() => onOpenFirm(firm.id)}>{firm.name}</NameLink>
    : firm.name
}

export default function MothershipPayoutCard({ mothership, onSaved, onOpenFirm }) {
  const canEdit = !!getSession()?.is_superadmin
  const [firms, setFirms] = useState(null)
  const [live, setLive] = useState(mothership.payout_firm?.id || '')
  const [sandbox, setSandbox] = useState(mothership.payout_firm_sandbox?.id || '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  useEffect(() => {
    if (!canEdit) return
    let on = true
    callApi('load_firms')
      .then(d => { if (on) setFirms(d.firms || []) })
      .catch(err => { if (on) { setFirms([]); setMsgType('error'); setMsg(err.message) } })
    return () => { on = false }
  }, [canEdit])

  async function save() {
    setSaving(true); setMsg('')
    try {
      const d = await callApi('save_mothership_payout', { number: mothership.number, payout_firm_id: live || null, payout_firm_sandbox_id: sandbox || null })
      onSaved(d.motherships || [])
      setMsgType('success'); setMsg('Saved.')
    } catch (err) {
      setMsgType('error'); setMsg(err.message)
    } finally { setSaving(false) }
  }

  const dirty = live !== (mothership.payout_firm?.id || '') || sandbox !== (mothership.payout_firm_sandbox?.id || '')
  // While the list loads, the select still names the firm already chosen.
  const options = (isSandbox, current) => {
    const list = (firms || []).filter(f => f.sandbox === isSandbox)
    return current && !list.some(f => f.id === current.id) ? [current, ...list] : list
  }

  return (
    <>
      <ProfileCard title="Paid Directly">
        <InfoGrid>
          {mothership.shares.map(s => <InfoField key={s.strategy_key} label={s.strategy_name}>{shareText(s)}</InfoField>)}
          <InfoField label="Payout firm"><FirmValue firm={mothership.payout_firm} onOpenFirm={onOpenFirm} /></InfoField>
          <InfoField label="Payout account">{accountText(mothership.payout_firm)}</InfoField>
        </InfoGrid>
      </ProfileCard>

      {canEdit && (
        <ProfileCard title="Payout Firm">
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
            <div style={{ flex: '0 1 300px', minWidth: '220px' }}>
              <label style={formLabelStyle} htmlFor="ms-firm-live">Client payments</label>
              <select id="ms-firm-live" value={live} onChange={e => { setLive(e.target.value); setMsg('') }} disabled={saving || firms === null} style={selectStyle}>
                <option value="">None</option>
                {options(false, mothership.payout_firm).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div style={{ flex: '0 1 300px', minWidth: '220px' }}>
              <label style={formLabelStyle} htmlFor="ms-firm-sandbox">Sandbox payments</label>
              <select id="ms-firm-sandbox" value={sandbox} onChange={e => { setSandbox(e.target.value); setMsg('') }} disabled={saving || firms === null} style={selectStyle}>
                <option value="">None</option>
                {options(true, mothership.payout_firm_sandbox).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button onClick={save} disabled={saving || !dirty} style={{ ...gradientButtonStyle, opacity: saving || !dirty ? 0.55 : 1, cursor: saving || !dirty ? 'default' : 'pointer' }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            {msg && <span style={{ color: msgType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px' }}>{msg}</span>}
          </div>
        </ProfileCard>
      )}
    </>
  )
}
