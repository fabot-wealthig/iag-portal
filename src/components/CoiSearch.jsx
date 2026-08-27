import { useRef, useState } from 'react'
import { callApi } from '../lib/api'
import ListFilterButton, { matchesFilter, sortMembers, SortSelect, COI_SORT_OPTIONS } from './ListFilterKit'
import { ListHeader, TrackHero, HeroAvatar } from './shared/TrackKit'

const SELECTED_KEY = 'wigSelectedCoi'
const FEATURE_TAB_KEY = 'wigCoiFeatureTab'

const fullName = (m) => `${m.first_name || ''} ${m.last_name || ''}`.trim()
// A missing status reads as Active — the source rows leave it null by default.
const statusOf = (m) => m.status || 'Active'
const statusColor = (s) => (s === 'Active' ? '#1b9254' : s === 'Lost' ? '#e74c3c' : 'var(--wig-faint)')

const FILTER_GROUPS = [
  { key: 'status', label: 'Status', options: ['Active', 'Lost'], get: statusOf },
  { key: 'coi_type', label: 'COI Type', options: ['Advisor', 'Accountant'], get: m => m.coi_type || '' },
]

const PROFILE_TAB_OPTIONS = [
  { key: 'profile_details', label: 'Profile' },
  { key: 'profile_edit', label: 'Edit Profile' },
  { key: 'settings', label: 'Settings' },
]

// Nothing is wired to a mail sender yet — every Stripe button in the detail view
// shows this instead of calling the API.
const EMAIL_PENDING_NOTE = "Email sending isn't wired up yet."

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const selectStyle = { ...inputStyle, background: 'var(--wig-card)' }
const labelStyle = { fontSize: '12px', color: 'var(--wig-muted)', display: 'block', marginBottom: '6px' }
const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const gradientButtonStyle = { padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
const pendingNoteStyle = { fontSize: '12.5px', color: 'var(--wig-faint)', marginTop: '12px' }

export default function CoiSearch({ members = [], onDataChange }) {
  // The selection survives a nav round-trip (Portal clears the key when the user
  // navigates away or picks a different section).
  const [selectedNumber, setSelectedNumber] = useState(() => sessionStorage.getItem(SELECTED_KEY) || null)
  const [featureTab, setFeatureTab] = useState(() => sessionStorage.getItem(FEATURE_TAB_KEY) || 'profile_details')
  const [search, setSearch] = useState('')
  const [listFilter, setListFilter] = useState({ status: ['Active'] })
  const [listSort, setListSort] = useState('number_asc')

  // Read the selected row out of the live list so a reload refreshes the detail.
  const selected = selectedNumber ? members.find(m => m.member_number === selectedNumber) || null : null

  const searched = search
    ? members.filter(m => fullName(m).toLowerCase().includes(search) || (m.member_number || '').toLowerCase().includes(search))
    : members
  const filtered = searched.filter(m => matchesFilter(m, FILTER_GROUPS, listFilter))

  function selectFeatureTab(key) {
    setFeatureTab(key)
    sessionStorage.setItem(FEATURE_TAB_KEY, key)
  }

  function openMember(m) {
    setSelectedNumber(m.member_number)
    sessionStorage.setItem(SELECTED_KEY, m.member_number)
    // Opening a COI always lands on the profile, never on whichever pane the
    // previously-opened COI was left on.
    selectFeatureTab('profile_details')
    window.scrollTo(0, 0)
  }

  function backToList() {
    setSelectedNumber(null)
    sessionStorage.removeItem(SELECTED_KEY)
    sessionStorage.removeItem(FEATURE_TAB_KEY)
  }

  async function handleDeleted() {
    await onDataChange()
    backToList()
  }

  if (selected) {
    return (
      <CoiDetail
        key={selected.member_number}
        member={selected}
        featureTab={featureTab}
        onSelectFeatureTab={selectFeatureTab}
        onBack={backToList}
        onDataChange={onDataChange}
        onDeleted={handleDeleted}
      />
    )
  }

  return (
    <div>
      <ListHeader title="COIs" count={filtered.length} />
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input type="search" name="search" autoComplete="off" placeholder="Search by name or number..."
          value={search} onChange={e => setSearch(e.target.value.toLowerCase())}
          style={{ ...inputStyle, flex: 1 }} />
        <ListFilterButton groups={FILTER_GROUPS} value={listFilter} onChange={setListFilter} />
        <SortSelect value={listSort} onChange={setListSort} options={COI_SORT_OPTIONS} />
      </div>
      <div>
        {sortMembers(filtered, listSort).map(m => {
          const status = statusOf(m)
          return (
            <div key={m.member_number}
              onClick={() => openMember(m)}
              style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', marginBottom: '6px', background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(20,45,95,0.04)', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(61,155,224,0.4)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--wig-border-soft)'}>
              <span style={{ fontSize: '12px', color: 'var(--wig-muted)', width: '70px', flexShrink: 0, fontFamily: 'monospace' }}>{m.member_number}</span>
              <span style={{ fontSize: '14px', color: 'var(--wig-ink)', fontWeight: 600, width: '200px', flexShrink: 0 }}>{fullName(m)}</span>
              <span style={{ width: '80px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--wig-ink)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: statusColor(status) }} />
                {status}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--wig-muted)', width: '160px', flexShrink: 0 }}>{m.coi_type || '—'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Hover-open pill dropdown for the detail view's feature tabs.
function FeatureTabDropdown({ label, isActive, options, onSelect }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef(null)

  function handleMouseEnter() { clearTimeout(closeTimer.current); setOpen(true) }
  function handleMouseLeave() { setOpen(false) }

  return (
    <div style={{ position: 'relative' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button style={{ padding: '7px 16px', background: isActive ? '#1D64A8' : 'transparent', border: 'none', borderRadius: '999px', boxShadow: isActive ? '0 2px 8px rgba(29,100,168,0.28)' : 'none', color: isActive ? '#ffffff' : 'var(--wig-muted)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', marginRight: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        {label}<span style={{ fontSize: '9px', opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--wig-card)', border: '1px solid var(--wig-border)', borderRadius: '12px', minWidth: '180px', zIndex: 200, paddingTop: '4px', paddingBottom: '4px', boxShadow: '0 14px 36px rgba(20,45,95,0.16)' }}>
          {options.map(opt => (
            <button key={opt.key} onClick={() => { onSelect(opt.key); setOpen(false) }}
              style={{ display: 'block', width: '100%', padding: '8px 20px', background: 'transparent', border: 'none', color: 'var(--wig-ink)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--wig-tint)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Detail view for one COI: hero, feature-tab strip, and the active pane.
function CoiDetail({ member, featureTab, onSelectFeatureTab, onBack, onDataChange, onDeleted }) {
  const name = fullName(member)
  const status = statusOf(member)
  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#3D9BE0', fontWeight: 500, fontSize: '13px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>← Back to list</button>
      <TrackHero
        eyebrow="COIs"
        title={name}
        avatar={<HeroAvatar name={name} />}
        meta={
          <>
            <span style={{ fontFamily: 'monospace' }}>{member.member_number}</span>
            {member.coi_type && <><span style={{ color: 'var(--wig-border-mid)' }}>·</span><span>{member.coi_type}</span></>}
            <span style={{ color: 'var(--wig-border-mid)' }}>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--wig-ink)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor(status), flexShrink: 0 }} />
              {status}
            </span>
          </>
        }
      />
      <div style={{ display: 'flex', borderBottom: '1px solid var(--wig-border)', marginBottom: '24px', flexWrap: 'wrap', position: 'relative', zIndex: 50 }}>
        <FeatureTabDropdown
          label="Profile"
          isActive={PROFILE_TAB_OPTIONS.map(o => o.key).includes(featureTab)}
          options={PROFILE_TAB_OPTIONS}
          onSelect={onSelectFeatureTab}
        />
      </div>
      {featureTab === 'profile_details' && <CoiProfileDetails member={member} />}
      {featureTab === 'profile_edit' && <CoiProfileEdit member={member} onDataChange={onDataChange} />}
      {featureTab === 'settings' && <CoiSettings member={member} onDeleted={onDeleted} />}
    </div>
  )
}

function CoiProfileDetails({ member }) {
  return (
    <div>
      <div style={sectionStyle}>
        <div style={eyebrowStyle}>Profile Details</div>
        {/* Name, member number, type and status are all in the hero above. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
          <Field label="Work Email" value={member.email} />
          <Field label="Personal Email" value={member.personal_email} />
          <Field label="Join Date" value={member.join_date} />
        </div>
        <div style={{ marginTop: '14px' }}>
          <Field label="Notes" value={member.notes} preWrap />
        </div>
      </div>
      <StripeConnectCard member={member} connectedButtonLabel={null} setupButtonLabel="Send Setup Email" />
    </div>
  )
}

// Stripe Connect state for one COI. No API call is made from here yet — the
// buttons only surface the pending note, and the connected state is read from
// the roster row rather than from Stripe.
function StripeConnectCard({ member, connectedButtonLabel, setupButtonLabel }) {
  const [note, setNote] = useState('')
  const connected = !!member.stripe_account_id

  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>Stripe Connect</div>
      {connected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '13px', padding: '8px 12px', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '8px', color: 'var(--wig-ink)' }}>{member.stripe_account_id}</span>
          <span style={{ background: 'rgba(27,146,84,0.12)', color: '#1b9254', borderRadius: '999px', fontSize: '11px', fontWeight: 700, padding: '5px 12px' }}>Connected</span>
          {connectedButtonLabel && (
            <button onClick={() => setNote(EMAIL_PENDING_NOTE)} style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {connectedButtonLabel}
            </button>
          )}
        </div>
      ) : (
        <div>
          <p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', marginBottom: '14px' }}>This COI has not set up their payment details yet.</p>
          <button onClick={() => setNote(EMAIL_PENDING_NOTE)} style={gradientButtonStyle}>{setupButtonLabel}</button>
        </div>
      )}
      {note && <p style={pendingNoteStyle}>{note}</p>}
    </div>
  )
}

// Edit form for one COI. CoiDetail is keyed on member_number, so a different COI
// remounts this and the useState initialisers re-read from the new row.
function CoiProfileEdit({ member, onDataChange }) {
  const [firstName, setFirstName] = useState(member.first_name || '')
  const [lastName, setLastName] = useState(member.last_name || '')
  const [coiType, setCoiType] = useState(member.coi_type || '')
  const [email, setEmail] = useState(member.email || '')
  const [personalEmail, setPersonalEmail] = useState(member.personal_email || '')
  const [status, setStatusValue] = useState(statusOf(member))
  const [joinDate, setJoinDate] = useState(member.join_date || '')
  const [notes, setNotes] = useState(member.notes || '')
  const [statusMsg, setStatusMsg] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!firstName || !lastName || !coiType) { setStatusType('error'); setStatusMsg('First name, last name, and COI type are required.'); return }
    if (!email.trim()) { setStatusType('error'); setStatusMsg('Work email is required.'); return }
    if (!status) { setStatusType('error'); setStatusMsg('Please pick a status.'); return }
    setLoading(true)
    try {
      await callApi('update_coi', {
        member_number: member.member_number,
        first_name: firstName,
        last_name: lastName,
        coi_type: coiType,
        email,
        personal_email: personalEmail,
        status,
        join_date: joinDate || null,
        notes,
      })
      await onDataChange()
      setStatusType('success'); setStatusMsg('Profile updated.')
    } catch (err) {
      // update_coi is a write — the server's wording is the wording the admin sees.
      setStatusType('error'); setStatusMsg(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '160px' }}><label style={labelStyle}>First Name *</label><input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: '160px' }}><label style={labelStyle}>Last Name *</label><input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label style={labelStyle}>COI Type *</label>
          <select value={coiType} onChange={e => setCoiType(e.target.value)} style={selectStyle}>
            <option value="">-- Select --</option>
            {['Advisor', 'Accountant'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}><label style={labelStyle}>Work Email *</label><input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: '200px' }}><label style={labelStyle}>Personal Email</label><input value={personalEmail} onChange={e => setPersonalEmail(e.target.value)} type="email" style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <label style={labelStyle}>Status *</label>
          <select value={status} onChange={e => setStatusValue(e.target.value)} style={selectStyle}>
            <option value="">-- Select --</option>
            {['Active', 'Lost'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Join Date</label>
        <input value={joinDate} onChange={e => setJoinDate(e.target.value)} type="date" style={{ ...inputStyle, maxWidth: '200px' }} />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: '90px', resize: 'vertical', fontFamily: 'inherit' }} />
      </div>

      <button onClick={submit} disabled={loading} style={{ ...gradientButtonStyle, padding: '10px 28px', fontSize: '14px' }}>
        {loading ? 'Saving...' : 'Save Changes'}
      </button>
      {statusMsg && <p style={{ color: statusType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{statusMsg}</p>}
    </div>
  )
}

function CoiSettings({ member, onDeleted }) {
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteStatus, setDeleteStatus] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function deleteCoi() {
    setDeleting(true); setDeleteStatus('')
    try {
      await callApi('delete_coi', { member_number: member.member_number })
      await onDeleted()
    } catch (err) {
      setDeleteStatus(err.message)
      setDeleting(false)
    }
  }

  return (
    <div>
      <StripeConnectCard member={member} connectedButtonLabel="Resend setup email" setupButtonLabel="Set Up Payment Details" />
      <div style={{ ...sectionStyle, border: '1px solid rgba(231,76,60,0.3)' }}>
        <div style={{ ...eyebrowStyle, color: '#e74c3c', fontWeight: 500 }}>Danger Zone</div>
        <p style={{ fontSize: '13px', color: 'var(--wig-muted)', marginBottom: '16px' }}>Permanently delete this COI and their profile data.</p>
        {!deleteConfirm
          ? <button onClick={() => setDeleteConfirm(true)} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid rgba(231,76,60,0.4)', background: 'transparent', color: '#e74c3c', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}>Delete COI</button>
          : <div>
              <p style={{ color: '#e74c3c', fontWeight: 500, fontSize: '14px', marginBottom: '12px' }}>Are you sure? This cannot be undone.</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={deleteCoi} disabled={deleting} style={{ padding: '10px 24px', borderRadius: '8px', background: '#e74c3c', border: 'none', color: '#fff', fontSize: '14px', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1 }}>
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button onClick={() => setDeleteConfirm(false)} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              </div>
              {deleteStatus && <p style={{ color: '#d93025', fontWeight: 500, fontSize: '13px', marginTop: '12px' }}>{deleteStatus}</p>}
            </div>
        }
      </div>
    </div>
  )
}

function Field({ label, value, preWrap }) {
  const empty = value == null || value === ''
  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '14px', color: 'var(--wig-ink)', whiteSpace: preWrap ? 'pre-wrap' : undefined, wordBreak: 'break-word' }}>{empty ? '—' : value}</div>
    </div>
  )
}
