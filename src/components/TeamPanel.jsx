import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { BackLink, Field, HeroAvatar, ListHeader, TrackHero } from './shared/TrackKit'
import { ListHeaderSkeleton, TableSkeleton } from './shared/Skeleton'

// The open team member's id, or NEW_SCREEN for the Add form, so a refresh lands
// on the same screen (standing UI rule 5). Cleared by Portal on navigation and
// by AdminLogin on sign-in (GOTCHA #21).
const SELECTED_KEY = 'wigTeamSelected'
const NEW_SCREEN = 'new'

// Levels and rates from IAG's "Understanding Revenue Share for IAG Internal
// Team" (2026-10-02). The server stores the level only.
const ADVISOR_LEVELS = [
  { value: 0, label: 'Level 0 (0%)' },
  { value: 1, label: 'Level 1 (7.5%)' },
  { value: 2, label: 'Level 2 (10%)' },
  { value: 3, label: 'Level 3 (11.5%)' },
  { value: 4, label: 'Level 4 (12.5%)' },
]
const IS_LEVELS = [
  { value: 1, label: 'Level 1 (0%)' },
  { value: 2, label: 'Level 2 (1.25%)' },
  { value: 3, label: 'Level 3 (2.5%)' },
  { value: 4, label: 'Level 4 (2.5%)' },
]
const MANAGER_TIERS = [
  { value: 'qualified', label: 'Qualified advisor (2.5%)' },
  { value: 'non_advisor', label: 'Non-advisor (1%)' },
]
const PAY_METHODS = [
  { value: 'payroll', label: 'Payroll (W2, monthly report)' },
  { value: 'stripe', label: 'Stripe (1099, paid automatically)' },
]
const payLabel = (v) => (v === 'stripe' ? 'Stripe' : 'Payroll')

function otherRoles(m) {
  const roles = []
  if (m.is_advisor_lead) roles.push('Advisor Lead')
  if (m.is_is_team_lead) roles.push('IS Team Lead')
  if (m.coi_manager_tier === 'qualified') roles.push('COI Manager (2.5%)')
  if (m.coi_manager_tier === 'non_advisor') roles.push('COI Manager (1%)')
  if (m.is_curator) roles.push('COI Curator')
  return roles
}

const levelText = (v) => (v == null ? '—' : `Level ${v}`)
const statusLabel = (m) => (m.active === false ? 'Inactive' : 'Active')
const statusColor = (m) => (m.active === false ? 'var(--wig-faint)' : '#1b9254')

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const selectStyle = { ...inputStyle, background: 'var(--wig-card)' }
const labelStyle = { fontSize: '12px', color: 'var(--wig-muted)', display: 'block', marginBottom: '6px' }
const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const gradientButtonStyle = { padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
const tableStyle = { width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', fontFamily: 'Inter, sans-serif' }
const thStyle = { textAlign: 'left', padding: '12px 18px', background: 'var(--wig-input)', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-muted)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '11px 18px', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '13px', color: 'var(--wig-ink)', verticalAlign: 'middle', whiteSpace: 'nowrap' }
const dotStyle = (color) => ({ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' })
const checkLabelStyle = { display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: 'var(--wig-ink)', cursor: 'pointer' }

// Automation & Config → Team: the IAG internal team who earn a share of the Net
// Profit Pool — their levels, the roles they can hold, and how they are paid.
// Any admin may view it; only a superadmin may add or edit (pay data, Jake).
// There is no delete: share rows will reference a person, so they go Inactive.
export default function TeamPanel({ canEdit }) {
  const [team, setTeam] = useState(null)
  const [admins, setAdmins] = useState([])
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState(() => sessionStorage.getItem(SELECTED_KEY) || null)

  async function load() {
    try {
      const data = await callApi('load_team_members')
      setTeam(data.team || [])
      setLoadError('')
    } catch (err) {
      setLoadError(err.message)
      setTeam(prev => prev || [])
    }
  }

  useEffect(() => {
    load()
    // Only the login picker needs it; a failure leaves the picker empty.
    callApi('load_admin_directory').then(res => setAdmins(res.admins || [])).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function open(id) {
    setSelected(id)
    if (id) sessionStorage.setItem(SELECTED_KEY, id)
    else sessionStorage.removeItem(SELECTED_KEY)
    window.scrollTo(0, 0)
  }

  if (team === null) {
    return (
      <div>
        <ListHeaderSkeleton action />
        <TableSkeleton cols={[2, 1, 1, 2.5, 1, 1]} rows={6} />
      </div>
    )
  }

  if (selected === NEW_SCREEN && canEdit) {
    return <AddMember admins={admins} onBack={() => open(null)} onCreated={async (id) => { await load(); open(id) }} />
  }

  const current = selected ? team.find(m => m.id === selected) || null : null
  if (current) {
    return <MemberDetail key={current.id} member={current} admins={admins} canEdit={canEdit} onBack={() => open(null)} onDataChange={load} />
  }

  return (
    <div>
      <ListHeader
        title="Team"
        count={team.length}
        action={canEdit ? <button onClick={() => open(NEW_SCREEN)} style={gradientButtonStyle}>Add team member</button> : null}
      />
      {loadError && <p style={{ color: '#d93025', fontSize: '13px', margin: '0 0 12px' }}>{loadError}</p>}
      <div style={{ overflowX: 'auto', border: '1px solid var(--wig-border-soft)', borderRadius: '14px', background: 'var(--wig-card)', boxShadow: 'var(--wig-shadow-card)' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Advisor</th>
              <th style={thStyle}>Impl. Specialist</th>
              <th style={thStyle}>Other roles</th>
              <th style={thStyle}>Paid by</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {team.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--wig-faint)', fontSize: '13px' }}>No team members yet.</td>
              </tr>
            )}
            {team.map(m => (
              <tr key={m.id} onClick={() => open(m.id)} style={{ cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--wig-tint)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{m.name}</td>
                <td style={tdStyle}>{levelText(m.advisor_level)}</td>
                <td style={tdStyle}>{levelText(m.is_level)}</td>
                <td style={{ ...tdStyle, whiteSpace: 'normal' }}>{otherRoles(m).join(' · ') || '—'}</td>
                <td style={tdStyle}>{payLabel(m.pay_method)}</td>
                <td style={tdStyle}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
                    <span style={dotStyle(statusColor(m))} />
                    {statusLabel(m)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MemberDetail({ member, admins, canEdit, onBack, onDataChange }) {
  return (
    <div>
      <TrackHero
        eyebrow="Team"
        title={member.name}
        avatar={<HeroAvatar name={member.name} />}
        meta={
          <>
            <span>{payLabel(member.pay_method)}</span>
            <span style={{ color: 'var(--wig-border-mid)' }}>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--wig-ink)' }}>
              <span style={dotStyle(statusColor(member))} />
              {statusLabel(member)}
            </span>
          </>
        }
      />
      <BackLink label="← Back to Team" onClick={onBack} />
      {canEdit
        ? <MemberEdit member={member} admins={admins} onDataChange={onDataChange} />
        : <MemberReadOnly member={member} admins={admins} />}
    </div>
  )
}

const optionLabel = (list, v) => (list.find(o => o.value === v) || {}).label
const adminLabel = (admins, email) => {
  if (!email) return null
  const a = admins.find(x => x.email === email)
  return a ? `${a.name} (${a.email})` : email
}

function MemberReadOnly({ member, admins }) {
  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>Profile</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
        <Field label="Email" value={member.email} />
        <Field label="Portal Login" value={adminLabel(admins, member.admin_email)} />
        <Field label="Paid By" value={optionLabel(PAY_METHODS, member.pay_method)} />
        <Field label="Advisor Level" value={optionLabel(ADVISOR_LEVELS, member.advisor_level)} />
        <Field label="Implementation Specialist Level" value={optionLabel(IS_LEVELS, member.is_level)} />
        <Field label="COI Manager Rate" value={optionLabel(MANAGER_TIERS, member.coi_manager_tier)} />
        <Field label="Other Roles" value={otherRoles(member).filter(r => !r.startsWith('COI Manager')).join(' · ')} />
        <Field label="Notes" value={member.notes} preWrap />
      </div>
    </div>
  )
}

// Selects carry strings; '' is "none" and becomes null on the wire.
const toLevel = (v) => (v === '' ? null : Number(v))

function MemberFields({ form, set, admins }) {
  return (
    <>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={labelStyle}>Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} maxLength={120} style={inputStyle} />
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={labelStyle}>Email</label>
          <input value={form.email} onChange={e => set('email', e.target.value)} type="email" style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={labelStyle}>Paid By</label>
          <select value={form.pay_method} onChange={e => set('pay_method', e.target.value)} style={selectStyle}>
            {PAY_METHODS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={labelStyle}>Portal Login</label>
          <select value={form.admin_email} onChange={e => set('admin_email', e.target.value)} style={selectStyle}>
            <option value="">None</option>
            {admins.map(a => <option key={a.email} value={a.email}>{a.name} ({a.email})</option>)}
            {form.admin_email && !admins.some(a => a.email === form.admin_email) && (
              <option value={form.admin_email}>{form.admin_email}</option>
            )}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label style={labelStyle}>Advisor Level</label>
          <select value={form.advisor_level} onChange={e => set('advisor_level', e.target.value)} style={selectStyle}>
            <option value="">Not an advisor</option>
            {ADVISOR_LEVELS.map(o => <option key={o.value} value={String(o.value)}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label style={labelStyle}>Implementation Specialist Level</label>
          <select value={form.is_level} onChange={e => set('is_level', e.target.value)} style={selectStyle}>
            <option value="">Not an implementation specialist</option>
            {IS_LEVELS.map(o => <option key={o.value} value={String(o.value)}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label style={labelStyle}>COI Manager Rate</label>
          <select value={form.coi_manager_tier} onChange={e => set('coi_manager_tier', e.target.value)} style={selectStyle}>
            <option value="">Not a COI manager</option>
            {MANAGER_TIERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '28px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <label style={checkLabelStyle}>
          <input type="checkbox" checked={form.is_advisor_lead} onChange={e => set('is_advisor_lead', e.target.checked)} style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
          Advisor Lead
        </label>
        <label style={checkLabelStyle}>
          <input type="checkbox" checked={form.is_is_team_lead} onChange={e => set('is_is_team_lead', e.target.checked)} style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
          IS Team Lead
        </label>
        <label style={checkLabelStyle}>
          <input type="checkbox" checked={form.is_curator} onChange={e => set('is_curator', e.target.checked)} style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
          COI Curator (2.5%, first 12 months)
        </label>
        <label style={checkLabelStyle}>
          <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
          Active
        </label>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} maxLength={2000}
          style={{ ...inputStyle, minHeight: '90px', resize: 'vertical', fontFamily: 'inherit' }} />
      </div>
    </>
  )
}

function useForm(initial) {
  const [form, setForm] = useState(initial)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return [form, set]
}

const EMPTY_FORM = {
  name: '', email: '', admin_email: '', pay_method: 'payroll',
  advisor_level: '', is_level: '', coi_manager_tier: '',
  is_advisor_lead: false, is_is_team_lead: false, is_curator: false, active: true, notes: '',
}

const formFrom = (m) => ({
  name: m.name || '',
  email: m.email || '',
  admin_email: m.admin_email || '',
  pay_method: m.pay_method || 'payroll',
  advisor_level: m.advisor_level == null ? '' : String(m.advisor_level),
  is_level: m.is_level == null ? '' : String(m.is_level),
  coi_manager_tier: m.coi_manager_tier || '',
  is_advisor_lead: m.is_advisor_lead === true,
  is_is_team_lead: m.is_is_team_lead === true,
  is_curator: m.is_curator === true,
  active: m.active !== false,
  notes: m.notes || '',
})

const payloadFrom = (form) => ({
  ...form,
  advisor_level: toLevel(form.advisor_level),
  is_level: toLevel(form.is_level),
})

function MemberEdit({ member, admins, onDataChange }) {
  const [form, set] = useForm(formFrom(member))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  async function submit() {
    if (!form.name.trim()) { setMsgType('error'); setMsg('Name is required.'); return }
    setSaving(true); setMsg('')
    try {
      await callApi('save_team_member', { id: member.id, ...payloadFrom(form) })
      await onDataChange()
      setMsgType('success'); setMsg('Team member updated.')
    } catch (err) {
      setMsgType('error'); setMsg(err.message)
    } finally { setSaving(false) }
  }

  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>Profile</div>
      <MemberFields form={form} set={set} admins={admins} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px' }}>
        <Field label="Added By" value={member.created_by} />
        <Field label="Last Updated" value={member.updated_at ? new Date(member.updated_at).toLocaleString() : null} />
      </div>
      <button onClick={submit} disabled={saving} style={{ ...gradientButtonStyle, padding: '10px 28px', fontSize: '14px', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
      {msg && <p style={{ color: msgType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{msg}</p>}
    </div>
  )
}

function AddMember({ admins, onBack, onCreated }) {
  const [form, set] = useForm(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true); setError('')
    try {
      const res = await callApi('save_team_member', payloadFrom(form))
      await onCreated(res.member?.id || null)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div>
      <TrackHero eyebrow="Team" title="Add team member" />
      <BackLink label="← Back to Team" onClick={onBack} />
      <div style={sectionStyle}>
        <div style={eyebrowStyle}>Profile</div>
        <MemberFields form={form} set={set} admins={admins} />
        <button onClick={submit} disabled={saving} style={{ ...gradientButtonStyle, padding: '10px 28px', fontSize: '14px', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : 'Add Team Member'}
        </button>
        {error && <p style={{ color: '#d93025', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
      </div>
    </div>
  )
}
