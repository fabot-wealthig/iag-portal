import { useEffect, useState } from 'react'
import { callApi, getSession } from '../lib/api'
import { BackLink, FeatureTabDropdown, HeroAvatar, ListHeader, TrackHero } from './shared/TrackKit'
import { CardCol, CardRow, FillCard, formLabelStyle, InfoField, InfoGrid, NotesCard, ProfileCard } from './shared/ProfileKit'
import { ListHeaderSkeleton, TableSkeleton } from './shared/Skeleton'
import { reloadTeam } from './shared/TeamPicker'
import { levelOptions, useTeamRates } from './shared/teamRates'
import SandboxToggle from './shared/SandboxToggle'
import StripeConnectCard from './shared/StripeConnectCard'

const SANDBOX_NOTE = "Stripe test mode for this person's payout account. A sandbox payment only pays team members switched to sandbox."
const SANDBOX_LOCKED_NOTE = 'Locked: a Stripe payout account already exists for this person.'

// The open team member's id, or NEW_SCREEN for the Add form, and which of the
// person's tabs is showing, so a refresh lands on the same screen (standing UI
// rule 5). Cleared by Portal on navigation and by AdminLogin on sign-in (#21).
const SELECTED_KEY = 'wigTeamSelected'
const TAB_KEY = 'wigTeamTab'
// The superadmin floor account (constants/superadmin.ts on the server).
const FLOOR_EMAIL = 'fabot@wealthig.com'
const NEW_SCREEN = 'new'

// The level labels carry the CURRENT rates (Automation & Config → Team Share
// Rates, shared/teamRates.js); the server stores the level only.
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
  if (m.is_is_team_lead) roles.push('Implementation Specialist Team Lead')
  if (m.coi_manager_tier === 'qualified') roles.push('COI Manager')
  if (m.coi_manager_tier === 'non_advisor') roles.push('COI Manager (non-advisor)')
  if (m.is_curator) roles.push('COI Curator')
  return roles
}

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const selectStyle = { ...inputStyle, background: 'var(--wig-card)' }
const readOnlyFieldStyle = { ...inputStyle, background: 'var(--wig-tint)', color: 'var(--wig-muted)' }
const noteStyle = { fontSize: '12px', color: 'var(--wig-faint)', margin: '6px 0 0' }
const gradientButtonStyle = { padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
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
      // The pickers elsewhere share one cached copy; a roster edit invalidates it.
      reloadTeam()
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
              <th style={thStyle}>Implementation Specialist</th>
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

  // Just the name and whether they are active (Jake): how they are paid lives
  // in the body.
  return (
    <div>
      <TrackHero
        eyebrow="Team"
        title={member.name}
        avatar={<HeroAvatar name={member.name} />}
        meta={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--wig-ink)' }}>
            <span style={dotStyle(statusColor(member))} />
            {statusLabel(member)}
          </span>
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
      {shown === 'profile_details' && <MemberProfile member={member} canEdit={canEdit} onDataChange={onDataChange} />}
      {shown === 'profile_edit' && <MemberEdit member={member} onDataChange={onDataChange} />}
      {shown === 'portal_access' && <PortalAccess member={member} onDataChange={onDataChange} onEditProfile={() => onSelectTab('profile_edit')} />}
    </div>
  )
}

const yesNo = (v) => (v ? 'Yes' : 'No')

// Read-only. The name and status are in the hero above, so the body never
// repeats them.
function MemberProfile({ member, canEdit, onDataChange }) {
  const opts = levelOptions(useTeamRates().rates)
  return (
    <div>
      <CardRow>
        <CardCol basis="420px" min="300px">
          <FillCard title="Contact Details">
            <InfoGrid>
              <InfoField label="Email">{member.email}</InfoField>
            </InfoGrid>
          </FillCard>
        </CardCol>
        <CardCol basis="300px" min="260px">
          <FillCard title="Pay">
            <InfoGrid>
              <InfoField label="Paid By">{optionLabel(PAY_METHODS, member.pay_method)}</InfoField>
            </InfoGrid>
          </FillCard>
        </CardCol>
      </CardRow>

      <ProfileCard title="Revenue Share Roles">
        <InfoGrid>
          <InfoField label="Advisor">{member.advisor_level == null ? 'Not an advisor' : optionLabel(opts.advisor, member.advisor_level)}</InfoField>
          <InfoField label="Implementation Specialist">{member.is_level == null ? 'Not an Implementation Specialist' : optionLabel(opts.is, member.is_level)}</InfoField>
          <InfoField label="COI Manager">{member.coi_manager_tier ? optionLabel(opts.manager, member.coi_manager_tier) : 'No'}</InfoField>
          <InfoField label="COI Curator">{yesNo(member.is_curator)}</InfoField>
          <InfoField label="Advisor Lead">{yesNo(member.is_advisor_lead)}</InfoField>
          <InfoField label="Implementation Specialist Team Lead">{yesNo(member.is_is_team_lead)}</InfoField>
        </InfoGrid>
      </ProfileCard>

      {/* Paid by Stripe transfer (Phase C): the payee's Connect card, superadmins only. */}
      {canEdit && member.pay_method === 'stripe' && (
        <StripeConnectCard
          accountId={member.stripe_account_id}
          statusAction="team_connect_status"
          requestAction="team_connect_request"
          idPayload={{ team_member_id: member.id }}
          onDataChange={onDataChange}
          connectedButtonLabel="Resend setup email"
          setupButtonLabel="Send Setup Email"
          noAccountText="This person has not set up their payment details yet."
          entityLabel="team member"
        />
      )}

      <NotesCard kind="team" id={member.id} notes={member.notes} canEdit={canEdit} onSaved={onDataChange} />
    </div>
  )
}

// Selects carry strings; '' is "none" and becomes null on the wire.
const toLevel = (v) => (v === '' ? null : Number(v))

// The cards both forms share. Notes are not here: they are edited in place on
// the Profile (save_notes), and save_team_member leaves them alone.
function MemberFields({ form, set, emailLocked, sandboxLocked }) {
  const opts = levelOptions(useTeamRates().rates)
  return (
    <>
      <ProfileCard title="Basic Info">
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={formLabelStyle}>First Name *</label>
            <input value={form.first_name} onChange={e => set('first_name', e.target.value)} maxLength={120} style={inputStyle} />
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={formLabelStyle}>Last Name</label>
            <input value={form.last_name} onChange={e => set('last_name', e.target.value)} maxLength={120} style={inputStyle} />
          </div>
        </div>
        <div style={{ maxWidth: '420px' }}>
          <label style={formLabelStyle}>Email</label>
          {emailLocked ? (
            <>
              <div style={readOnlyFieldStyle}>{form.email}</div>
              <p style={noteStyle}>Locked: this is their portal login. Remove their portal access to change it.</p>
            </>
          ) : (
            <input value={form.email} onChange={e => set('email', e.target.value)} type="email" style={inputStyle} />
          )}
        </div>
      </ProfileCard>

      <ProfileCard title="Revenue Share Roles">
        <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={formLabelStyle}>Advisor Level</label>
            <select value={form.advisor_level} onChange={e => set('advisor_level', e.target.value)} style={selectStyle}>
              <option value="">Not an advisor</option>
              {opts.advisor.map(o => <option key={o.value} value={String(o.value)}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={formLabelStyle}>Implementation Specialist Level</label>
            <select value={form.is_level} onChange={e => set('is_level', e.target.value)} style={selectStyle}>
              <option value="">Not an implementation specialist</option>
              {opts.is.map(o => <option key={o.value} value={String(o.value)}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={formLabelStyle}>COI Manager Rate</label>
            <select value={form.coi_manager_tier} onChange={e => set('coi_manager_tier', e.target.value)} style={selectStyle}>
              <option value="">Not a COI manager</option>
              {opts.manager.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
          <label style={checkLabelStyle}>
            <input type="checkbox" checked={form.is_curator} onChange={e => set('is_curator', e.target.checked)} style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
            {opts.curator}, held per tax year
          </label>
          <label style={checkLabelStyle}>
            <input type="checkbox" checked={form.is_advisor_lead} onChange={e => set('is_advisor_lead', e.target.checked)} style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
            Advisor Lead
          </label>
          <label style={checkLabelStyle}>
            <input type="checkbox" checked={form.is_is_team_lead} onChange={e => set('is_is_team_lead', e.target.checked)} style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
            Implementation Specialist Team Lead
          </label>
        </div>
      </ProfileCard>

      <ProfileCard title="Pay & Status">
        <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '0 1 320px', minWidth: '220px' }}>
            <label style={formLabelStyle}>Paid By</label>
            <select value={form.pay_method} onChange={e => set('pay_method', e.target.value)} style={selectStyle}>
              {PAY_METHODS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <label style={{ ...checkLabelStyle, paddingBottom: '10px' }}>
            <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
            Active
          </label>
        </div>
        <SandboxToggle checked={form.sandbox} onChange={v => set('sandbox', v)} locked={sandboxLocked}
          note={SANDBOX_NOTE} lockedNote={SANDBOX_LOCKED_NOTE} style={{ marginTop: '16px' }} />
      </ProfileCard>
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
  is_advisor_lead: false, is_is_team_lead: false, is_curator: false, active: true, sandbox: false,
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
  sandbox: m.sandbox === true,
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
    <div>
      <MemberFields form={form} set={set} emailLocked={!!member.admin_email} sandboxLocked={!!member.stripe_account_id} />
      <button onClick={submit} disabled={saving} style={{ ...gradientButtonStyle, padding: '10px 28px', fontSize: '14px', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
      {msg && <p style={{ color: msgType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{msg}</p>}
    </div>
  )
}

// The VFO member login card's wording, with the send state folded in.
function loginSentence(member, login) {
  const first = member.first_name || 'They'
  switch (login?.status) {
    case 'active':
      return <>{first} can sign in as <strong>{member.admin_email}</strong>. Send a setup email to let them set a new password.</>
    case 'sent':
      return <>No login yet. A setup email was sent {fmtDate(login.email_sent_at)}; the link expires {fmtDate(login.link_expires_at)}.</>
    case 'expired':
      return <>No login yet. The setup email sent {fmtDate(login.email_sent_at)} has expired or been replaced. Send a new one.</>
    default:
      return <>No login yet. Send a setup email so {member.first_name || 'they'} can create their own password.</>
  }
}

// Superadmin only, laid out like the VFO portal's member login: the login card,
// the tab grants, a danger zone. team_login_email is the ONE place a login is
// created; admin_update_tabs and delete_admin are the other two. "Send" drafts
// the email in Gmail — the portal has no direct-send path.
function PortalAccess({ member, onDataChange, onEditProfile }) {
  const login = member.login || { status: 'not_sent', allowed_tabs: [] }
  const hasLogin = !!member.admin_email
  const isSelf = hasLogin && member.admin_email === (getSession()?.email || '').toLowerCase()
  // The floor account's rank is fixed (constants/superadmin.ts on the server,
  // which refuses it anyway); the card is simply not offered for it or for yourself.
  const rankChangeable = hasLogin && !isSelf && member.admin_email !== FLOOR_EMAIL
  const [rankConfirming, setRankConfirming] = useState(false)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null) // { ok, text, where }
  const [tabs, setTabs] = useState(login.allowed_tabs || [])
  const [confirming, setConfirming] = useState(false)

  const noEmail = !String(member.email || '').trim()
  const inactive = member.active === false
  const blocked = noEmail || inactive

  async function send() {
    setBusy('send'); setMsg(null)
    try {
      const res = await callApi('team_login_email', { id: member.id })
      await onDataChange()
      setMsg({ ok: true, where: 'login', text: `Setup email drafted to ${res.to_email}. Review and send it from Gmail.` })
    } catch (err) {
      setMsg({ ok: false, where: 'login', text: err.message })
      onDataChange()
    } finally { setBusy('') }
  }

  // Optimistic, as the Admin Editor was: the box flips at once and only goes
  // back if the server refuses.
  async function toggleTab(key) {
    const prev = tabs
    const next = prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]
    setTabs(next); setBusy('tabs'); setMsg(null)
    try {
      await callApi('admin_update_tabs', { email: member.admin_email, allowed_tabs: next })
      onDataChange()
    } catch (err) {
      setTabs(prev); setMsg({ ok: false, where: 'tabs', text: err.message })
    } finally { setBusy('') }
  }

  async function removeAccess() {
    setBusy('remove'); setMsg(null)
    try {
      await callApi('delete_admin', { email: member.admin_email })
      await onDataChange()
      setConfirming(false)
      setMsg({ ok: true, where: 'login', text: 'Portal access removed. Their team profile is unchanged.' })
    } catch (err) {
      setMsg({ ok: false, where: 'danger', text: err.message })
      setConfirming(false)
    } finally { setBusy('') }
  }

  async function setRank(next) {
    setBusy('rank'); setMsg(null)
    try {
      await callApi('admin_set_superadmin', { email: member.admin_email, is_superadmin: next })
      await onDataChange()
      setMsg({ ok: true, where: 'rank', text: next
        ? `${member.first_name || 'They'} is now a superadmin. They were signed out and get every tab when they sign back in.`
        : `${member.first_name || 'They'} is no longer a superadmin and was signed out. Their tab access below applies from their next sign-in.` })
    } catch (err) {
      setMsg({ ok: false, where: 'rank', text: err.message })
    } finally { setBusy(''); setRankConfirming(false) }
  }

  const msgLine = (where) => msg && msg.where === where && (
    <p style={{ fontSize: '13px', marginTop: '12px', marginBottom: 0, color: msg.ok ? '#1b9254' : '#d93025' }}>{msg.text}</p>
  )

  return (
    <div>
      <ProfileCard title="Portal Login">
        {login.is_superadmin && <span style={{ ...chipStyle, background: 'rgba(238,106,51,0.12)', color: '#EE6A33', marginBottom: '12px' }}>Superadmin</span>}
        <p style={{ color: 'var(--wig-muted)', fontSize: '14px', margin: '0 0 16px', lineHeight: 1.5 }}>
          {noEmail
            ? <>No login yet, and no email on file. Add one on <button onClick={onEditProfile} style={{ background: 'none', border: 'none', padding: 0, color: '#1D64A8', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Edit Profile</button> first.</>
            : loginSentence(member, login)}
        </p>
        <button onClick={send} disabled={busy !== '' || blocked}
          style={{ padding: '10px 24px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '14px', cursor: blocked ? 'not-allowed' : busy ? 'default' : 'pointer', opacity: blocked || busy === 'send' ? 0.6 : 1 }}>
          {busy === 'send' ? 'Drafting...' : 'Send account-setup email'}
        </button>
        <p style={{ fontSize: '12px', color: 'var(--wig-muted)', marginTop: '10px', marginBottom: 0 }}>
          {inactive && !noEmail
            ? 'This person is inactive. Make them active on Edit Profile to send a setup email.'
            : 'Drafts a Gmail with a secure link. They set their own password.'}
        </p>
        {msgLine('login')}
      </ProfileCard>

      {rankChangeable && (
        <ProfileCard title="Rank">
          <p style={{ color: 'var(--wig-muted)', fontSize: '14px', margin: '0 0 16px', lineHeight: 1.5 }}>
            {login.is_superadmin
              ? <>{member.first_name || 'They'} is a <strong>superadmin</strong>: every tab, the Team roster and rates, and everyone's portal access.</>
              : <>{member.first_name || 'They'} is an <strong>admin</strong>, with the tabs ticked below. A superadmin sees every tab, edits the Team roster and rates, and manages everyone's portal access.</>}
          </p>
          {!rankConfirming
            ? <button onClick={() => setRankConfirming(true)} disabled={busy !== ''}
                style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-ink)', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                {login.is_superadmin ? 'Remove Superadmin' : 'Make Superadmin'}
              </button>
            : <div>
                <p style={{ color: '#EE6A33', fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>
                  {login.is_superadmin ? `Remove ${member.first_name || 'their'} superadmin rank?` : `Make ${member.first_name || 'them'} a superadmin?`} They will be signed out.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setRank(!login.is_superadmin)} disabled={busy === 'rank'}
                    style={{ padding: '10px 24px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', color: '#fff', fontSize: '14px', cursor: busy === 'rank' ? 'not-allowed' : 'pointer', opacity: busy === 'rank' ? 0.6 : 1 }}>
                    {busy === 'rank' ? 'Saving...' : login.is_superadmin ? 'Yes, Remove' : 'Yes, Make Superadmin'}
                  </button>
                  <button onClick={() => setRankConfirming(false)} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>}
          {msgLine('rank')}
        </ProfileCard>
      )}

      {hasLogin && (
        <ProfileCard title="Tab Access">
          {login.is_superadmin ? (
            <span style={{ ...chipStyle, background: 'rgba(29,100,168,0.12)', color: '#1D64A8' }}>Superadmin - all tabs</span>
          ) : (
            <>
              <p style={{ color: 'var(--wig-muted)', fontSize: '14px', margin: '0 0 14px' }}>The COI tabs are open to everyone. Tick the tabs {member.first_name || 'they'} can also see.</p>
              <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
                {TAB_OPTIONS.map(t => (
                  <label key={t.key} style={checkLabelStyle}>
                    <input type="checkbox" checked={tabs.includes(t.key)} disabled={busy !== ''} onChange={() => toggleTab(t.key)} style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
                    {t.label}
                  </label>
                ))}
                {busy === 'tabs' && <span style={{ fontSize: '12px', color: 'var(--wig-faint)' }}>Saving...</span>}
              </div>
              <p style={{ ...noteStyle, marginTop: '12px' }}>A change takes effect the next time they sign in.</p>
            </>
          )}
          {msgLine('tabs')}
        </ProfileCard>
      )}

      {hasLogin && !login.is_superadmin && !isSelf && (
        <ProfileCard title="Danger Zone" danger>
          <p style={{ fontSize: '13px', color: 'var(--wig-muted)', margin: '0 0 16px' }}>Remove {member.first_name || 'their'}{member.first_name ? "'s" : ''} portal login. They are signed out at once; their team profile stays.</p>
          {!confirming
            ? <button onClick={() => setConfirming(true)} disabled={busy !== ''} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid rgba(231,76,60,0.4)', background: 'transparent', color: '#e74c3c', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}>Remove Portal Access</button>
            : <div>
                <p style={{ color: '#e74c3c', fontWeight: 500, fontSize: '14px', marginBottom: '12px' }}>Are you sure? They will need a new setup email to sign in again.</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={removeAccess} disabled={busy === 'remove'} style={{ padding: '10px 24px', borderRadius: '8px', background: '#e74c3c', border: 'none', color: '#fff', fontSize: '14px', cursor: busy === 'remove' ? 'not-allowed' : 'pointer', opacity: busy === 'remove' ? 0.6 : 1 }}>
                    {busy === 'remove' ? 'Removing...' : 'Yes, Remove'}
                  </button>
                  <button onClick={() => setConfirming(false)} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>}
          {msgLine('danger')}
        </ProfileCard>
      )}
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
      <MemberFields form={form} set={set} emailLocked={false} />
      <button onClick={submit} disabled={saving} style={{ ...gradientButtonStyle, padding: '10px 28px', fontSize: '14px', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving...' : 'Add Team Member'}
      </button>
      {error && <p style={{ color: '#d93025', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
    </div>
  )
}
