import { useEffect, useState } from 'react'
import { callApi, getSession } from '../lib/api'
import { BackLink, FeatureTabDropdown, Field, HeroAvatar, ListHeader, TrackHero } from './shared/TrackKit'
import { ListHeaderSkeleton, TableSkeleton } from './shared/Skeleton'

// The open team member's id, or NEW_SCREEN for the Add form, and which of the
// person's tabs is showing, so a refresh lands on the same screen (standing UI
// rule 5). Cleared by Portal on navigation and by AdminLogin on sign-in (#21).
const SELECTED_KEY = 'wigTeamSelected'
const TAB_KEY = 'wigTeamTab'
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
// The secondary portal tabs a superadmin can hand out one at a time. Keys must
// match the portal's SECONDARY_TABS and the backend's constants/tabs.ts — a key
// that exists in one and not the others grants nothing.
const TAB_OPTIONS = [
  { key: 'coi_overview', label: 'COI Overview' },
  { key: 'client_overview', label: 'Client Overview' },
  { key: 'tax_strategies', label: 'Tax Strategies' },
  { key: 'automation', label: 'Automation & Config' },
  { key: 'accounting', label: 'Accounting' },
]
const LOGIN_LABELS = { not_sent: 'Not sent', sent: 'Sent', expired: 'Link expired', active: 'Active' }
const LOGIN_COLORS = { not_sent: 'var(--wig-faint)', sent: '#1D64A8', expired: '#EE6A33', active: '#1b9254' }

const payLabel = (v) => (v === 'stripe' ? 'Stripe' : 'Payroll')
const optionLabel = (list, v) => (list.find(o => o.value === v) || {}).label
const levelText = (v) => (v == null ? '—' : `Level ${v}`)
const statusLabel = (m) => (m.active === false ? 'Inactive' : 'Active')
const statusColor = (m) => (m.active === false ? 'var(--wig-faint)' : '#1b9254')
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '')

function otherRoles(m) {
  const roles = []
  if (m.is_advisor_lead) roles.push('Advisor Lead')
  if (m.is_is_team_lead) roles.push('IS Team Lead')
  if (m.coi_manager_tier === 'qualified') roles.push('COI Manager (2.5%)')
  if (m.coi_manager_tier === 'non_advisor') roles.push('COI Manager (1%)')
  if (m.is_curator) roles.push('COI Curator')
  return roles
}

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const selectStyle = { ...inputStyle, background: 'var(--wig-card)' }
const readOnlyFieldStyle = { ...inputStyle, background: 'var(--wig-tint)', color: 'var(--wig-muted)' }
const labelStyle = { fontSize: '12px', color: 'var(--wig-muted)', display: 'block', marginBottom: '6px' }
const noteStyle = { fontSize: '12px', color: 'var(--wig-faint)', margin: '6px 0 0' }
const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const gradientButtonStyle = { padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
const smallButtonStyle = { padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }
const dangerOutlineStyle = { ...smallButtonStyle, border: '1px solid rgba(231,76,60,0.4)', color: '#e74c3c' }
const dangerSolidStyle = { ...smallButtonStyle, border: 'none', background: '#e74c3c', color: '#fff' }
const chipStyle = { display: 'inline-block', borderRadius: '999px', fontSize: '11px', fontWeight: 700, padding: '2px 9px', letterSpacing: '0.3px' }
const pillStyle = (active) => ({ padding: '7px 16px', background: active ? '#1D64A8' : 'transparent', border: 'none', borderRadius: '999px', boxShadow: active ? '0 2px 8px rgba(29,100,168,0.28)' : 'none', color: active ? '#ffffff' : 'var(--wig-muted)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', marginRight: '4px' })
const tableStyle = { width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', fontFamily: 'Inter, sans-serif' }
const thStyle = { textAlign: 'left', padding: '12px 18px', background: 'var(--wig-input)', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-muted)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '11px 18px', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '13px', color: 'var(--wig-ink)', verticalAlign: 'middle', whiteSpace: 'nowrap' }
const dotStyle = (color) => ({ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' })
const checkLabelStyle = { display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: 'var(--wig-ink)', cursor: 'pointer' }

function Dot({ color, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
      <span style={dotStyle(color)} />
      {children}
    </span>
  )
}

// Automation & Config → Team: the IAG internal team who earn a share of the Net
// Profit Pool, and — since the Admin Editor was removed — the ONLY place a
// portal login is created. Any admin may view the roster; a superadmin edits it
// and gets each person's Portal Access tab (pay data and logins, Jake).
export default function TeamPanel({ canEdit }) {
  const [team, setTeam] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState(() => sessionStorage.getItem(SELECTED_KEY) || null)
  const [tab, setTab] = useState(() => sessionStorage.getItem(TAB_KEY) || 'profile_details')

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  function selectTab(key) {
    setTab(key)
    sessionStorage.setItem(TAB_KEY, key)
  }

  function open(id) {
    setSelected(id)
    if (id) sessionStorage.setItem(SELECTED_KEY, id)
    else sessionStorage.removeItem(SELECTED_KEY)
    selectTab('profile_details')
    window.scrollTo(0, 0)
  }

  if (team === null) {
    return (
      <div>
        <ListHeaderSkeleton action />
        <TableSkeleton cols={canEdit ? [2, 1, 1, 2.5, 1, 1, 1] : [2, 1, 1, 2.5, 1, 1]} rows={6} />
      </div>
    )
  }

  if (selected === NEW_SCREEN && canEdit) {
    return <AddMember onBack={() => open(null)} onCreated={async (id) => { await load(); open(id) }} />
  }

  const current = selected ? team.find(m => m.id === selected) || null : null
  if (current) {
    return (
      <MemberDetail key={current.id} member={current} canEdit={canEdit} tab={tab} onSelectTab={selectTab}
        onBack={() => open(null)} onDataChange={load} />
    )
  }

  const cols = canEdit ? 7 : 6
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
              {canEdit && <th style={thStyle}>Login</th>}
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {team.length === 0 && (
              <tr>
                <td colSpan={cols} style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--wig-faint)', fontSize: '13px' }}>No team members yet.</td>
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
                {canEdit && (
                  <td style={tdStyle}>
                    <Dot color={LOGIN_COLORS[m.login?.status] || 'var(--wig-faint)'}>{LOGIN_LABELS[m.login?.status] || 'Not sent'}</Dot>
                  </td>
                )}
                <td style={tdStyle}><Dot color={statusColor(m)}>{statusLabel(m)}</Dot></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MemberDetail({ member, canEdit, tab, onSelectTab, onBack, onDataChange }) {
  const profileOptions = canEdit
    ? [{ key: 'profile_details', label: 'Profile' }, { key: 'profile_edit', label: 'Edit Profile' }]
    : [{ key: 'profile_details', label: 'Profile' }]
  // A stale key (an ordinary admin, or a tab that no longer applies) falls back
  // to the read-only profile rather than a blank pane.
  const shown = canEdit || tab === 'profile_details' ? tab : 'profile_details'

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
      <div style={{ display: 'flex', borderBottom: '1px solid var(--wig-border)', marginBottom: '24px', flexWrap: 'wrap', position: 'relative', zIndex: 50 }}>
        <FeatureTabDropdown
          label="Profile"
          isActive={shown === 'profile_details' || shown === 'profile_edit'}
          options={profileOptions}
          onSelect={onSelectTab}
        />
        {canEdit && (
          <button onClick={() => onSelectTab('portal_access')} style={pillStyle(shown === 'portal_access')}>
            Portal Access
          </button>
        )}
      </div>
      {shown === 'profile_details' && <MemberProfile member={member} />}
      {shown === 'profile_edit' && <MemberEdit member={member} onDataChange={onDataChange} />}
      {shown === 'portal_access' && <PortalAccess member={member} onDataChange={onDataChange} onEditProfile={() => onSelectTab('profile_edit')} />}
    </div>
  )
}

function MemberProfile({ member }) {
  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>Profile</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '18px 14px' }}>
        <Field label="First Name" value={member.first_name} />
        <Field label="Last Name" value={member.last_name} />
        <Field label="Email" value={member.email} />
        <Field label="Paid By" value={optionLabel(PAY_METHODS, member.pay_method)} />
        <Field label="Advisor Level" value={optionLabel(ADVISOR_LEVELS, member.advisor_level)} />
        <Field label="Implementation Specialist Level" value={optionLabel(IS_LEVELS, member.is_level)} />
        <Field label="COI Manager Rate" value={optionLabel(MANAGER_TIERS, member.coi_manager_tier)} />
        <Field label="Other Roles" value={otherRoles(member).filter(r => !r.startsWith('COI Manager')).join(' · ')} />
        <Field label="Status" value={statusLabel(member)} />
        <Field label="Added By" value={member.created_by} />
        <Field label="Last Updated" value={member.updated_at ? new Date(member.updated_at).toLocaleString() : null} />
      </div>
      <div style={{ marginTop: '18px' }}>
        <Field label="Notes" value={member.notes} preWrap />
      </div>
    </div>
  )
}

// Selects carry strings; '' is "none" and becomes null on the wire.
const toLevel = (v) => (v === '' ? null : Number(v))

function MemberFields({ form, set, emailLocked }) {
  return (
    <>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label style={labelStyle}>First Name *</label>
          <input value={form.first_name} onChange={e => set('first_name', e.target.value)} maxLength={120} style={inputStyle} />
        </div>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label style={labelStyle}>Last Name</label>
          <input value={form.last_name} onChange={e => set('last_name', e.target.value)} maxLength={120} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={labelStyle}>Email</label>
          {emailLocked ? (
            <>
              <div style={readOnlyFieldStyle}>{form.email}</div>
              <p style={noteStyle}>Locked: this is their portal login. Remove their portal access to change it.</p>
            </>
          ) : (
            <input value={form.email} onChange={e => set('email', e.target.value)} type="email" style={inputStyle} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={labelStyle}>Paid By</label>
          <select value={form.pay_method} onChange={e => set('pay_method', e.target.value)} style={selectStyle}>
            {PAY_METHODS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
  first_name: '', last_name: '', email: '', pay_method: 'payroll',
  advisor_level: '', is_level: '', coi_manager_tier: '',
  is_advisor_lead: false, is_is_team_lead: false, is_curator: false, active: true, notes: '',
}

const formFrom = (m) => ({
  first_name: m.first_name || '',
  last_name: m.last_name || '',
  email: m.email || '',
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

function MemberEdit({ member, onDataChange }) {
  const [form, set] = useForm(formFrom(member))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  async function submit() {
    if (!form.first_name.trim()) { setMsgType('error'); setMsg('First name is required.'); return }
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
      <div style={eyebrowStyle}>Edit Profile</div>
      <MemberFields form={form} set={set} emailLocked={!!member.admin_email} />
      <button onClick={submit} disabled={saving} style={{ ...gradientButtonStyle, padding: '10px 28px', fontSize: '14px', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
      {msg && <p style={{ color: msgType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{msg}</p>}
    </div>
  )
}

function loginLine(login) {
  switch (login?.status) {
    case 'active':
      return `Active: password set${login.active_since ? ` ${fmtDate(login.active_since)}` : ''}.`
    case 'sent':
      return `Login email sent ${fmtDate(login.email_sent_at)}, not used yet. The link expires ${fmtDate(login.link_expires_at)}.`
    case 'expired':
      return `Login email sent ${fmtDate(login.email_sent_at)}, but the link has expired or been replaced. Resend to send a fresh one.`
    default:
      return 'No login email has been sent.'
  }
}

// Superadmin only. The ONE place a login is created (team_login_email), its
// tab grants set (admin_update_tabs) and removed (delete_admin). "Send" drafts
// the email in Gmail — the portal has no direct-send path.
function PortalAccess({ member, onDataChange, onEditProfile }) {
  const login = member.login || { status: 'not_sent', allowed_tabs: [] }
  const hasLogin = !!member.admin_email
  const isSelf = hasLogin && member.admin_email === (getSession()?.email || '').toLowerCase()
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')
  const [tabs, setTabs] = useState(login.allowed_tabs || [])
  const [confirming, setConfirming] = useState(false)

  const noEmail = !String(member.email || '').trim()
  const inactive = member.active === false
  const everSent = !!login.email_sent_at || login.status === 'active'

  async function send() {
    setBusy('send'); setMsg('')
    try {
      const res = await callApi('team_login_email', { id: member.id })
      await onDataChange()
      setMsgType('success'); setMsg(`Login email drafted in Gmail to ${res.to_email}. Open Gmail to send it.`)
    } catch (err) {
      setMsgType('error'); setMsg(err.message)
      onDataChange()
    } finally { setBusy('') }
  }

  // Optimistic, as the Admin Editor was: the box flips at once and only goes
  // back if the server refuses.
  async function toggleTab(key) {
    const prev = tabs
    const next = prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]
    setTabs(next); setBusy('tabs'); setMsg('')
    try {
      await callApi('admin_update_tabs', { email: member.admin_email, allowed_tabs: next })
      onDataChange()
    } catch (err) {
      setTabs(prev); setMsgType('error'); setMsg(err.message)
    } finally { setBusy('') }
  }

  async function removeAccess() {
    setBusy('remove'); setMsg('')
    try {
      await callApi('delete_admin', { email: member.admin_email })
      await onDataChange()
      setConfirming(false)
      setMsgType('success'); setMsg('Portal access removed. Their team profile is unchanged.')
    } catch (err) {
      setMsgType('error'); setMsg(err.message)
      setConfirming(false)
    } finally { setBusy('') }
  }

  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>Portal Access</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
        <Dot color={LOGIN_COLORS[login.status] || 'var(--wig-faint)'}>{LOGIN_LABELS[login.status] || 'Not sent'}</Dot>
        {login.is_superadmin && <span style={{ ...chipStyle, background: 'rgba(238,106,51,0.12)', color: '#EE6A33' }}>Superadmin</span>}
      </div>
      <p style={{ fontSize: '13.5px', color: 'var(--wig-ink)', margin: '0 0 4px' }}>{loginLine(login)}</p>
      {login.status === 'active' && login.email_sent_at && (
        <p style={{ ...noteStyle, marginTop: 0 }}>Last login email {fmtDate(login.email_sent_at)}.</p>
      )}

      <div style={{ marginTop: '16px' }}>
        <button onClick={send} disabled={busy !== '' || noEmail || inactive}
          style={{ ...gradientButtonStyle, opacity: busy === 'send' || noEmail || inactive ? 0.6 : 1, cursor: noEmail || inactive ? 'not-allowed' : 'pointer' }}>
          {busy === 'send' ? 'Drafting...' : everSent ? 'Resend Login Email' : 'Send Login Email'}
        </button>
        {noEmail && (
          <p style={noteStyle}>
            Add an email first: <button onClick={onEditProfile} style={{ background: 'none', border: 'none', padding: 0, color: '#1D64A8', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Edit Profile</button>.
          </p>
        )}
        {!noEmail && inactive && <p style={noteStyle}>This person is inactive. Make them active on Edit Profile to send a login email.</p>}
        {!noEmail && !inactive && login.status === 'active' && (
          <p style={noteStyle}>Resending works as a password reset: their current password keeps working until they use the new link.</p>
        )}
      </div>

      {hasLogin && (
        <div style={{ borderTop: '1px solid var(--wig-border-soft)', marginTop: '22px', paddingTop: '18px' }}>
          <div style={{ ...labelStyle, marginBottom: '10px' }}>Tabs they can see (the COI tabs are open to everyone)</div>
          {login.is_superadmin ? (
            <span style={{ ...chipStyle, background: 'rgba(29,100,168,0.12)', color: '#1D64A8' }}>Superadmin - all tabs</span>
          ) : (
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              {TAB_OPTIONS.map(t => (
                <label key={t.key} style={checkLabelStyle}>
                  <input type="checkbox" checked={tabs.includes(t.key)} disabled={busy !== ''} onChange={() => toggleTab(t.key)} style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
                  {t.label}
                </label>
              ))}
              {busy === 'tabs' && <span style={{ fontSize: '12px', color: 'var(--wig-faint)' }}>Saving...</span>}
            </div>
          )}
          <p style={noteStyle}>A change takes effect the next time they sign in.</p>
        </div>
      )}

      {hasLogin && !login.is_superadmin && !isSelf && (
        <div style={{ borderTop: '1px solid var(--wig-border-soft)', marginTop: '22px', paddingTop: '18px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {confirming ? (
            <>
              <span style={{ fontSize: '13px', color: 'var(--wig-ink)' }}>Remove {member.first_name}'s portal login? They are signed out at once.</span>
              <button onClick={removeAccess} disabled={busy === 'remove'} style={dangerSolidStyle}>
                {busy === 'remove' ? 'Removing...' : 'Yes, Remove'}
              </button>
              <button onClick={() => setConfirming(false)} style={smallButtonStyle}>Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)} disabled={busy !== ''} style={dangerOutlineStyle}>Remove Portal Access</button>
          )}
        </div>
      )}

      {msg && <p style={{ color: msgType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '14px' }}>{msg}</p>}
    </div>
  )
}

function AddMember({ onBack, onCreated }) {
  const [form, set] = useForm(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!form.first_name.trim()) { setError('First name is required.'); return }
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
        <MemberFields form={form} set={set} emailLocked={false} />
        <button onClick={submit} disabled={saving} style={{ ...gradientButtonStyle, padding: '10px 28px', fontSize: '14px', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : 'Add Team Member'}
        </button>
        {error && <p style={{ color: '#d93025', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
      </div>
    </div>
  )
}
