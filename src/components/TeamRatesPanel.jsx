import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { ListHeader } from './shared/TrackKit'
import { ListHeaderSkeleton, TableSkeleton } from './shared/Skeleton'
import { formLabelStyle, ProfileCard } from './shared/ProfileKit'
import { setTeamRatesCache } from './shared/teamRates'

// Automation & Config → Team Share Rates (Jake, 2026-10-06: "editable from the
// portal"). Every figure is a percent of a payment's Net Profit Pool — what is left
// after the COI's share. Anyone with the tab sees them; a superadmin edits. A save
// applies to payments that clear AFTER it: each team share snapshots its rate.

const GROUPS = [
  { title: 'Advisor', fields: [0, 1, 2, 3, 4].map(n => [`advisor_level_${n}`, n === 0 ? 'Level 0 (no advisor)' : `Level ${n}`]) },
  { title: 'Advisor Lead', fields: [['advisor_lead_cap', 'Lead cap']] },
  { title: 'Implementation Specialist', fields: [1, 2, 3, 4].map(n => [`is_level_${n}`, `Level ${n}`]) },
  { title: 'Implementation Specialist Team Lead', fields: [1, 2, 3, 4].map(n => [`is_lead_for_level_${n}`, `Specialist at Level ${n}`]) },
  { title: 'COI Manager & Curator', fields: [['manager_qualified', 'Qualified advisor manager'], ['manager_non_advisor', 'Non-advisor manager'], ['curator', 'COI Curator']] },
]

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const gradientButtonStyle = { padding: '10px 28px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }
const valueStyle = { fontSize: '15px', color: 'var(--wig-ink)', fontWeight: 600, marginTop: '5px' }

const toForm = (rates) => Object.fromEntries(GROUPS.flatMap(g => g.fields).map(([k]) => [k, rates?.[k] == null ? '' : String(rates[k])]))

export default function TeamRatesPanel({ canEdit }) {
  const [rates, setRates] = useState(null)
  const [form, setForm] = useState({})
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  useEffect(() => {
    let live = true
    callApi('load_team_share_rates')
      .then(d => { if (live) { setRates(d.rates); setForm(toForm(d.rates)) } })
      .catch(err => { if (live) { setLoadError(err.message); setRates({}) } })
    return () => { live = false }
  }, [])

  const dirty = rates && Object.entries(form).some(([k, v]) => Number(v) !== Number(rates[k]))
  const invalid = Object.values(form).some(v => v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 100)

  async function save() {
    if (invalid) { setMsgType('error'); setMsg('Every rate must be a percent between 0 and 100.'); return }
    setSaving(true); setMsg('')
    try {
      const d = await callApi('save_team_share_rates', Object.fromEntries(Object.entries(form).map(([k, v]) => [k, Number(v)])))
      setRates(d.rates); setForm(toForm(d.rates)); setTeamRatesCache(d.rates)
      setMsgType('success'); setMsg('Rates saved. They apply to payments that clear from now on.')
    } catch (err) {
      setMsgType('error'); setMsg(err.message)
    } finally { setSaving(false) }
  }

  if (rates === null) {
    return <div><ListHeaderSkeleton /><TableSkeleton cols={[1, 1, 1, 1, 1]} rows={4} /></div>
  }

  return (
    <div>
      <ListHeader title="Team Share Rates" />
      {loadError && <p style={{ color: '#d93025', fontSize: '13px', margin: '0 0 12px' }}>{loadError}</p>}

      {GROUPS.map(g => (
        <ProfileCard key={g.title} title={g.title}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px 18px' }}>
            {g.fields.map(([key, label]) => (
              <div key={key}>
                <label style={formLabelStyle}>{label}</label>
                {canEdit ? (
                  <div style={{ position: 'relative' }}>
                    <input type="number" min={0} max={100} step="0.001" value={form[key] ?? ''}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ ...inputStyle, paddingRight: '30px' }} />
                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--wig-muted)', fontSize: '14px' }}>%</span>
                  </div>
                ) : (
                  <div style={valueStyle}>{rates[key] == null ? '—' : `${Number(rates[key])}%`}</div>
                )}
              </div>
            ))}
          </div>
        </ProfileCard>
      ))}

      {canEdit && (
        <div>
          <button onClick={save} disabled={saving || !dirty}
            style={{ ...gradientButtonStyle, opacity: saving || !dirty ? 0.6 : 1, cursor: saving || !dirty ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : 'Save Rates'}
          </button>
          {msg && <p style={{ color: msgType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{msg}</p>}
        </div>
      )}
    </div>
  )
}
