import { useState } from 'react'
import { callApi } from '../lib/api'
import { BackLink, FeatureTabDropdown, HeroAvatar, ListHeader, TrackHero } from './shared/TrackKit'
import { formLabelStyle, InfoField, InfoGrid, NotesCard, ProfileCard } from './shared/ProfileKit'
import { ListHeaderSkeleton, TableSkeleton } from './shared/Skeleton'
import CoiName, { coiLineOf } from './shared/CoiName'
import { reloadLiaisons, useLiaisons } from './shared/LiaisonPicker'
import { AddClientForm } from './CoiClients'

// COI ▾ → Liaison (IAG 2026-11-19). A liaison is not a COI: they work with one or
// more COIs (two COIs at one firm may share one) and coordinate between the
// clients and IAG. They earn nothing; a client assigned to them sits under one of
// their COIs, which is paid the revenue share. They are Cc'd on their clients'
// emails (the LIAISON token on the client templates).
//
// The open liaison's id (or NEW_LIAISON_SCREEN), its tab, and where a visit came
// from (a COI or a client, JSON), so a refresh lands on the same screen (standing
// UI rule 5). Cleared by Portal on navigation and by AdminLogin on sign-in (#21).
export const LIAISON_SELECTED_KEY = 'wigLiaisonSelected'
export const LIAISON_TAB_KEY = 'wigLiaisonTab'
export const LIAISON_RETURN_KEY = 'wigLiaisonReturn'
export const NEW_LIAISON_SCREEN = 'new'

const fullName = (m) => `${m.first_name || ''} ${m.last_name || ''}`.trim()

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const selectStyle = { ...inputStyle, background: 'var(--wig-card)' }
const gradientButtonStyle = { padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
const tableStyle = { width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', fontFamily: 'Inter, sans-serif' }
const thStyle = { textAlign: 'left', padding: '12px 18px', background: 'var(--wig-input)', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-muted)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '11px 18px', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '13px', color: 'var(--wig-ink)', verticalAlign: 'middle' }
const dotStyle = (color) => ({ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' })
const chipStyle = { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '999px', border: '1px solid var(--wig-border-mid)', fontSize: '12.5px', color: 'var(--wig-ink)', background: 'var(--wig-card)' }
const chipRemoveStyle = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--wig-muted)', fontSize: '14px', lineHeight: 1 }

function StatusDot({ active, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
      <span style={dotStyle(active ? '#1b9254' : 'var(--wig-faint)')} />
      {label}
    </span>
  )
}

function readReturn() {
  try { return JSON.parse(sessionStorage.getItem(LIAISON_RETURN_KEY) || 'null') } catch { return null }
}

export default function LiaisonsPanel({ members = [], onOpenCoi, onOpenClient, onReturn }) {
  const [refresh, setRefresh] = useState(0)
  const { liaisons, error: loadError } = useLiaisons(refresh)
  const [selected, setSelected] = useState(() => sessionStorage.getItem(LIAISON_SELECTED_KEY) || null)
  const [tab, setTab] = useState(() => sessionStorage.getItem(LIAISON_TAB_KEY) || 'profile_details')
  const [returnTo] = useState(readReturn)
  const [query, setQuery] = useState('')

  function reload() {
    reloadLiaisons()
    setRefresh(n => n + 1)
  }

  function open(id) {
    setSelected(id)
    if (id) sessionStorage.setItem(LIAISON_SELECTED_KEY, id)
    else sessionStorage.removeItem(LIAISON_SELECTED_KEY)
    sessionStorage.removeItem(LIAISON_RETURN_KEY)
    selectTab('profile_details')
    window.scrollTo(0, 0)
  }

  function selectTab(key) {
    setTab(key)
    sessionStorage.setItem(LIAISON_TAB_KEY, key)
  }

  if (liaisons === null) {
    if (loadError) return <p style={{ color: '#d93025', fontSize: '13px' }}>{loadError}</p>
    return (
      <div>
        <ListHeaderSkeleton action />
        <TableSkeleton cols={[2, 2.5, 0.7, 2, 0.8]} rows={6} />
      </div>
    )
  }

  if (selected === NEW_LIAISON_SCREEN) {
    return <AddLiaison members={members} onBack={() => open(null)} onCreated={(id) => { reload(); open(id) }} />
  }

  const current = selected ? liaisons.find(l => l.id === selected) || null : null
  if (current) {
    // Opened from a COI or a client: the back link returns there.
    const back = returnTo && onReturn
      ? { label: returnTo.clientId ? '← Back to client' : '← Back to COI', onClick: () => onReturn(returnTo) }
      : { label: '← Back to Liaison Search', onClick: () => open(null) }
    return (
      <LiaisonDetail key={current.id} liaison={current} members={members} tab={tab} onSelectTab={selectTab} back={back}
        onDataChange={reload}
        onOpenCoi={onOpenCoi ? (mn) => onOpenCoi(mn, current.id) : undefined}
        onOpenClient={onOpenClient ? (mn, clientId) => onOpenClient(mn, clientId, current.id) : undefined} />
    )
  }

  const q = query.trim().toLowerCase()
  const shown = q
    ? liaisons.filter(l => l.name.toLowerCase().includes(q) || String(l.email || '').toLowerCase().includes(q) ||
      l.cois.some(c => coiLineOf(c).toLowerCase().includes(q) || String(c.member_number).includes(q)))
    : liaisons

  return (
    <div>
      <ListHeader
        title="Liaisons"
        count={liaisons.length}
        action={<button onClick={() => open(NEW_LIAISON_SCREEN)} style={gradientButtonStyle}>Add liaison</button>}
      />
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by liaison, email, COI name or number"
        style={{ ...inputStyle, marginBottom: '16px' }} />
      {loadError && <p style={{ color: '#d93025', fontSize: '13px', margin: '0 0 12px' }}>{loadError}</p>}
      <div style={{ border: '1px solid var(--wig-border-soft)', borderRadius: '14px', background: 'var(--wig-card)', boxShadow: 'var(--wig-shadow-card)' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Liaison</th>
              <th style={thStyle}>COIs</th>
              <th style={thStyle}>Clients</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '28px 18px', color: 'var(--wig-faint)', fontSize: '13px' }}>{q ? 'No liaison matches.' : 'No liaisons yet.'}</td>
              </tr>
            )}
            {shown.map(l => (
              <tr key={l.id} onClick={() => open(l.id)} style={{ cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--wig-tint)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{l.name}</td>
                <td style={tdStyle}>{l.cois.map(c => coiLineOf(c)).join(', ')}</td>
                <td style={tdStyle}>{l.clients_count}</td>
                <td style={{ ...tdStyle, overflowWrap: 'anywhere' }}>{l.email}</td>
                <td style={tdStyle}><StatusDot active={l.active !== false} label={l.active !== false ? 'Active' : 'Inactive'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const PROFILE_TAB_OPTIONS = [
  { key: 'profile_details', label: 'Profile' },
  { key: 'profile_edit', label: 'Edit Profile' },
]

function LiaisonDetail({ liaison, members, tab, onSelectTab, back, onDataChange, onOpenCoi, onOpenClient }) {
  const active = liaison.active !== false
  return (
    <div>
      <TrackHero
        eyebrow="Liaisons"
        title={liaison.name}
        avatar={<HeroAvatar name={liaison.name} />}
        meta={
          <>
            <span>{liaison.cois.length === 1 ? '1 COI' : `${liaison.cois.length} COIs`}</span>
            <span style={{ color: 'var(--wig-border-mid)' }}>·</span>
            <StatusDot active={active} label={active ? 'Active' : 'Inactive'} />
          </>
        }
      />
      <BackLink label={back.label} onClick={back.onClick} />
      <div style={{ display: 'flex', borderBottom: '1px solid var(--wig-border)', marginBottom: '24px', flexWrap: 'wrap', position: 'relative', zIndex: 50 }}>
        <FeatureTabDropdown label="Profile" isActive={tab !== 'clients'} options={PROFILE_TAB_OPTIONS} onSelect={onSelectTab} />
        {/* A plain pill, as on a COI: Clients has no sub-options. */}
        <button onClick={() => onSelectTab('clients')}
          style={{ padding: '7px 16px', background: tab === 'clients' ? '#1D64A8' : 'transparent', border: 'none', borderRadius: '999px', boxShadow: tab === 'clients' ? '0 2px 8px rgba(29,100,168,0.28)' : 'none', color: tab === 'clients' ? '#ffffff' : 'var(--wig-muted)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', marginRight: '4px' }}>
          Clients
        </button>
      </div>
      {tab === 'profile_edit' && <LiaisonProfileEdit liaison={liaison} members={members} onDataChange={onDataChange} />}
      {tab === 'clients' && <LiaisonClients liaison={liaison} onDataChange={onDataChange} onOpenClient={onOpenClient} />}
      {tab !== 'profile_edit' && tab !== 'clients' && <LiaisonProfile liaison={liaison} onOpenCoi={onOpenCoi} />}
    </div>
  )
}

// Read-only. The name, COI count and status are in the hero above.
function LiaisonProfile({ liaison, onOpenCoi }) {
  return (
    <div>
      <ProfileCard title="Contact Details">
        <InfoGrid>
          <InfoField label="Email">{liaison.email}</InfoField>
          <InfoField label="Phone">{liaison.phone}</InfoField>
        </InfoGrid>
        <p style={{ fontSize: '12px', color: 'var(--wig-faint)', margin: '12px 0 0' }}>Copied on the emails sent to this liaison's clients.</p>
      </ProfileCard>
      <ProfileCard title="COIs">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>COI</th>
              <th style={thStyle}>Member #</th>
              <th style={thStyle}>Clients</th>
            </tr>
          </thead>
          <tbody>
            {liaison.cois.map(c => (
              <tr key={c.member_number}>
                <td style={tdStyle}>
                  <CoiName firm={c.company} person={fullName(c) || c.member_number} onClick={onOpenCoi ? () => onOpenCoi(c.member_number) : undefined} />
                </td>
                <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{c.member_number}</td>
                <td style={tdStyle}>{liaison.clients.filter(x => x.coi_member_number === c.member_number).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ProfileCard>
      <NotesCard kind="liaison" id={liaison.id} />
    </div>
  )
}

// The Clients tab, laid out as a COI's: the list, "+ Add Client" above it. A new
// client goes under one of the liaison's COIs with the liaison already set; an
// existing client is given the liaison on its own Edit Profile. A row opens the
// client under its COI.
function LiaisonClients({ liaison, onDataChange, onOpenClient }) {
  const [adding, setAdding] = useState(false)
  const coiOf = (mn) => liaison.cois.find(c => c.member_number === mn) || null
  const canAdd = liaison.active !== false
  return (
    <div>
      <ListHeader
        title="Clients"
        count={liaison.clients.length}
        action={canAdd ? <button onClick={() => setAdding(v => !v)} style={gradientButtonStyle}>+ Add Client</button> : null}
      />
      {adding && (
        <AddClientForm
          members={liaison.cois}
          presetLiaisonId={liaison.id}
          onAdded={async () => { setAdding(false); await onDataChange() }}
          onCancel={() => setAdding(false)}
        />
      )}
      {liaison.clients.length === 0 && !adding && (
        <div style={{ background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }}>
          <p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0 }}>
            No clients assigned to this liaison yet.{canAdd ? ' Add a new one above, or give an existing client this liaison on its Edit Profile.' : ''}
          </p>
        </div>
      )}
      <div>
        {liaison.clients.map(c => {
          const coi = coiOf(c.coi_member_number)
          const status = c.status || 'Active'
          return (
            <div key={c.id}
              onClick={onOpenClient ? () => onOpenClient(c.coi_member_number, c.id) : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', marginBottom: '6px', background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(20,45,95,0.04)', cursor: onOpenClient ? 'pointer' : 'default' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(61,155,224,0.4)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--wig-border-soft)' }}>
              <span style={{ fontSize: '12px', color: 'var(--wig-muted)', width: '120px', flexShrink: 0, fontFamily: 'monospace' }}>{c.client_number}</span>
              <span style={{ fontSize: '14px', color: 'var(--wig-ink)', fontWeight: 600, width: '200px', flexShrink: 0 }}>{fullName(c)}</span>
              <span style={{ width: '80px', flexShrink: 0 }}><StatusDot active={status === 'Active'} label={status} /></span>
              <span style={{ fontSize: '12px', color: 'var(--wig-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{coi ? coiLineOf(coi) : c.coi_member_number}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// The COIs a liaison works with: chips, plus a picker to add one more.
function CoiListField({ numbers, onChange, members }) {
  const byNumber = new Map(members.map(m => [m.member_number, m]))
  const options = [...members]
    .filter(m => !numbers.includes(m.member_number))
    .sort((a, b) => coiLineOf(a).localeCompare(coiLineOf(b)))
  return (
    <div>
      <label style={formLabelStyle}>COIs they work with *</label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: numbers.length ? '10px' : 0 }}>
        {numbers.map(n => {
          const m = byNumber.get(n)
          return (
            <span key={n} style={chipStyle}>
              {m ? `${coiLineOf(m)} (${n})` : n}
              <button type="button" title="Remove" style={chipRemoveStyle} onClick={() => onChange(numbers.filter(x => x !== n))}>×</button>
            </span>
          )
        })}
      </div>
      <select value="" onChange={e => { if (e.target.value) onChange([...numbers, e.target.value]) }} style={{ ...selectStyle, maxWidth: '420px' }}>
        <option value="">+ Add a COI...</option>
        {options.map(m => <option key={m.member_number} value={m.member_number}>{`${coiLineOf(m)} (${m.member_number})`}</option>)}
      </select>
    </div>
  )
}

function LiaisonFields({ form, set, members, showActive }) {
  return (
    <>
      <ProfileCard title="Basic Info">
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={formLabelStyle}>First Name *</label>
            <input value={form.first_name} onChange={e => set('first_name', e.target.value)} maxLength={100} style={inputStyle} />
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={formLabelStyle}>Last Name *</label>
            <input value={form.last_name} onChange={e => set('last_name', e.target.value)} maxLength={100} style={inputStyle} />
          </div>
          {showActive && (
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={formLabelStyle}>Status *</label>
              <select value={form.active ? 'Active' : 'Inactive'} onChange={e => set('active', e.target.value === 'Active')} style={selectStyle}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: '220px' }}>
            <label style={formLabelStyle}>Email *</label>
            <input value={form.email} onChange={e => set('email', e.target.value)} type="email" style={inputStyle} />
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={formLabelStyle}>Phone</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} maxLength={40} style={inputStyle} />
          </div>
        </div>
        {showActive && (
          <p style={{ fontSize: '12px', color: 'var(--wig-faint)', margin: '8px 0 0' }}>An inactive liaison is not copied on emails and cannot be given new clients.</p>
        )}
      </ProfileCard>
      <ProfileCard title="COIs">
        <CoiListField numbers={form.member_numbers} onChange={v => set('member_numbers', v)} members={members} />
        <p style={{ fontSize: '12px', color: 'var(--wig-faint)', margin: '10px 0 0' }}>A client given this liaison must sit under one of these COIs; that COI is paid the revenue share.</p>
      </ProfileCard>
    </>
  )
}

function useForm(initial) {
  const [form, setForm] = useState(initial)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return [form, set]
}

function validate(form) {
  if (!form.first_name.trim() || !form.last_name.trim()) return 'First name and last name are required.'
  if (!form.email.trim()) return 'Email is required.'
  if (form.member_numbers.length === 0) return 'Pick at least one COI the liaison works with.'
  return ''
}

function LiaisonProfileEdit({ liaison, members, onDataChange }) {
  const [form, set] = useForm({
    first_name: liaison.first_name || '',
    last_name: liaison.last_name || '',
    email: liaison.email || '',
    phone: liaison.phone || '',
    active: liaison.active !== false,
    member_numbers: liaison.cois.map(c => c.member_number),
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  const dropped = liaison.cois.filter(c => !form.member_numbers.includes(c.member_number))
  const losing = liaison.clients.filter(c => dropped.some(d => d.member_number === c.coi_member_number)).length

  async function submit() {
    const err = validate(form)
    if (err) { setMsgType('error'); setMsg(err); return }
    setSaving(true); setMsg('')
    try {
      const res = await callApi('save_liaison', { id: liaison.id, ...form })
      await onDataChange()
      setMsgType('success')
      setMsg(res.unassigned ? `Liaison updated. ${res.unassigned === 1 ? '1 client' : `${res.unassigned} clients`} of the removed COIs no longer have this liaison.` : 'Liaison updated.')
    } catch (e) {
      setMsgType('error'); setMsg(e.message)
    } finally { setSaving(false) }
  }

  return (
    <div>
      <LiaisonFields form={form} set={set} members={members} showActive />
      {losing > 0 && (
        <p style={{ fontSize: '13px', color: '#EE6A33', fontWeight: 600, margin: '0 0 12px' }}>
          Saving takes this liaison off {losing === 1 ? '1 client' : `${losing} clients`} of the COI{dropped.length === 1 ? '' : 's'} you removed.
        </p>
      )}
      <button onClick={submit} disabled={saving} style={{ ...gradientButtonStyle, padding: '10px 28px', fontSize: '14px', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
      {msg && <p style={{ color: msgType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{msg}</p>}
    </div>
  )
}

function AddLiaison({ members, onBack, onCreated }) {
  const [form, set] = useForm({ first_name: '', last_name: '', email: '', phone: '', active: true, member_numbers: [] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    const err = validate(form)
    if (err) { setError(err); return }
    setSaving(true); setError('')
    try {
      const res = await callApi('save_liaison', { ...form })
      onCreated(res.liaison?.id || null)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div>
      <TrackHero eyebrow="Liaisons" title="Add liaison" />
      <BackLink label="← Back to Liaison Search" onClick={onBack} />
      <LiaisonFields form={form} set={set} members={members} showActive={false} />
      <button onClick={submit} disabled={saving} style={{ ...gradientButtonStyle, padding: '10px 28px', fontSize: '14px', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving...' : 'Add Liaison'}
      </button>
      {error && <p style={{ color: '#d93025', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
    </div>
  )
}
