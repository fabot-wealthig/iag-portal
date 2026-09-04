import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import CoiClients from './CoiClients'
import ListFilterButton, { matchesFilter, sortMembers, SortSelect, COI_SORT_OPTIONS } from './ListFilterKit'
import { BackLink, FeatureTabDropdown, Field, ListHeader, TrackHero, HeroAvatar } from './shared/TrackKit'

const SELECTED_KEY = 'wigSelectedCoi'
const FEATURE_TAB_KEY = 'wigCoiFeatureTab'
const RETURN_TO_KEY = 'wigCoiReturnTo'
const SELECTED_CLIENT_KEY = 'wigSelectedClient'
const CLIENT_FEATURE_TAB_KEY = 'wigClientFeatureTab'
const SELECTED_PAYMENT_KEY = 'wigSelectedPayment'

// Everything the client takeover owns. Leaving the Clients pane, opening a
// different COI or going back to the list all drop the whole set at once —
// a client id without its pane, or a payment id without its client, would
// restore half a screen.
function clearClientState() {
  sessionStorage.removeItem(SELECTED_CLIENT_KEY)
  sessionStorage.removeItem(CLIENT_FEATURE_TAB_KEY)
  sessionStorage.removeItem(SELECTED_PAYMENT_KEY)
}

// Where each return marker sends the back link. Anything unmarked came from
// this panel's own list, which is what the default covers.
const BACK_LABELS = {
  mothership_search: '← Back to mothership',
  coi_overview: '← Back to COI Overview',
  client_overview: '← Back to Client Overview',
  accounting: '← Back to payments',
}

const fullName = (m) => `${m.first_name || ''} ${m.last_name || ''}`.trim()
// A missing status reads as Active — the source rows leave it null by default.
const statusOf = (m) => m.status || 'Active'
const statusColor = (s) => (s === 'Active' ? '#1b9254' : s === 'Lost' ? '#e74c3c' : 'var(--wig-faint)')

const COI_TYPES = ['Advisor', 'Accountant', 'Other']

// Level labels carry the LEOS share percentages so an admin editing a COI can
// see what the level is worth. Hardcoded to the LEOS defaults, matching AddCoi.
const LEVEL_OPTIONS = [
  { value: 0, label: 'Level 0 - 0%' },
  { value: 1, label: 'Level 1 - 20%' },
  { value: 2, label: 'Level 2 - 30%' },
  { value: 3, label: 'Level 3 - 40%' },
  { value: 4, label: 'Level 4 - 50%' },
]

const FILTER_GROUPS = [
  { key: 'status', label: 'Status', options: ['Active', 'Lost'], get: statusOf },
  { key: 'coi_type', label: 'COI Type', options: COI_TYPES, get: m => m.coi_type || '' },
]

const PROFILE_TAB_OPTIONS = [
  { key: 'profile_details', label: 'Profile' },
  { key: 'profile_edit', label: 'Edit Profile' },
  { key: 'settings', label: 'Settings' },
]

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const selectStyle = { ...inputStyle, background: 'var(--wig-card)' }
const labelStyle = { fontSize: '12px', color: 'var(--wig-muted)', display: 'block', marginBottom: '6px' }
const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const gradientButtonStyle = { padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
const fixedNoteStyle = { fontSize: '12.5px', color: 'var(--wig-faint)', margin: '14px 0 0' }
const readOnlyFieldStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-tint)', color: 'var(--wig-muted)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }

export default function CoiSearch({ members = [], onDataChange, onReturnToOrigin }) {
  // The selection survives both a reload and a nav round-trip (Portal clears the
  // key when the user navigates away or picks a different section).
  const [selectedNumber, setSelectedNumber] = useState(() => sessionStorage.getItem(SELECTED_KEY) || null)
  const [featureTab, setFeatureTab] = useState(() => sessionStorage.getItem(FEATURE_TAB_KEY) || 'profile_details')
  // Where this COI was opened from, when it was not this panel's own list. Read
  // at mount: Portal writes it just before remounting us, and a nav click
  // anywhere else clears it.
  const [returnTo] = useState(() => sessionStorage.getItem(RETURN_TO_KEY) || null)
  const [search, setSearch] = useState('')
  const [listFilter, setListFilter] = useState({ status: ['Active'] })
  const [listSort, setListSort] = useState('number_asc')
  // Loaded once for the whole panel: the profile shows a mothership's NAME, and
  // the roster rows only carry its number.
  const [motherships, setMotherships] = useState([])

  useEffect(() => {
    let cancelled = false
    callApi('load_motherships')
      .then(data => { if (!cancelled) setMotherships(data.motherships || []) })
      .catch(() => { /* the profile falls back to showing the bare number */ })
    return () => { cancelled = true }
  }, [])

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
    // Opening a COI always lands on the profile, never on whichever pane — or
    // whichever client and payment — the previously-opened COI was left on.
    clearClientState()
    selectFeatureTab('profile_details')
    window.scrollTo(0, 0)
  }

  // Back goes wherever the COI was opened FROM. Without a return marker that is
  // this panel's own list; with one, the portal takes over and navigates to the
  // section the admin actually came from.
  function backToList() {
    sessionStorage.removeItem(SELECTED_KEY)
    sessionStorage.removeItem(FEATURE_TAB_KEY)
    clearClientState()
    if (returnTo && onReturnToOrigin) {
      onReturnToOrigin(returnTo)
      return
    }
    setSelectedNumber(null)
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
        motherships={motherships}
        featureTab={featureTab}
        onSelectFeatureTab={selectFeatureTab}
        onBack={backToList}
        backLabel={BACK_LABELS[returnTo] || '← Back to list'}
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
              <span style={{ fontSize: '12px', color: 'var(--wig-muted)', width: '90px', flexShrink: 0, fontFamily: 'monospace' }}>{m.member_number}</span>
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

// Detail view for one COI: hero, feature-tab strip, and the active pane.
//
// The open client lives HERE rather than inside CoiClients, because it decides
// what this component renders — CoiClients still resolves the client object off
// its own loaded list, so the id is the single source of truth and neither side
// holds a second copy.
function CoiDetail({ member, motherships, featureTab, onSelectFeatureTab, onBack, backLabel, onDataChange, onDeleted }) {
  const name = fullName(member)
  const status = statusOf(member)
  // Restored on every mount, reload included. Portal also seeds it when an
  // overview name deep-links past this COI to one of its clients; either way the
  // key stands until a back link, a different COI or a nav click clears it.
  const [selectedClientId, setSelectedClientId] = useState(() => sessionStorage.getItem(SELECTED_CLIENT_KEY) || null)

  function selectClient(id) {
    setSelectedClientId(id)
    if (id == null) clearClientState()
    else sessionStorage.setItem(SELECTED_CLIENT_KEY, String(id))
  }

  // Leaving the Clients pane closes whatever was open inside it.
  function selectFeatureTab(key) {
    if (key !== 'clients') selectClient(null)
    onSelectFeatureTab(key)
  }

  const clientOpen = featureTab === 'clients' && selectedClientId != null
  return (
    <div>
      {/* An open client takes over the whole content area: its own hero is the
          topmost thing on screen, so the COI's hero and tab strip stand down
          until "Back to clients" closes it. */}
      {!clientOpen && (
        <>
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
          <BackLink label={backLabel} onClick={onBack} />
          <div style={{ display: 'flex', borderBottom: '1px solid var(--wig-border)', marginBottom: '24px', flexWrap: 'wrap', position: 'relative', zIndex: 50 }}>
            <FeatureTabDropdown
              label="Profile"
              isActive={PROFILE_TAB_OPTIONS.map(o => o.key).includes(featureTab)}
              options={PROFILE_TAB_OPTIONS}
              onSelect={selectFeatureTab}
            />
            {/* A plain pill: the FeatureTabDropdown button style without the
                caret, because Clients has no sub-options to drop down to. */}
            <button onClick={() => selectFeatureTab('clients')}
              style={{ padding: '7px 16px', background: featureTab === 'clients' ? '#1D64A8' : 'transparent', border: 'none', borderRadius: '999px', boxShadow: featureTab === 'clients' ? '0 2px 8px rgba(29,100,168,0.28)' : 'none', color: featureTab === 'clients' ? '#ffffff' : 'var(--wig-muted)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', marginRight: '4px' }}>
              Clients
            </button>
          </div>
        </>
      )}
      {featureTab === 'profile_details' && <CoiProfileDetails member={member} motherships={motherships} onDataChange={onDataChange} />}
      {featureTab === 'profile_edit' && <CoiProfileEdit member={member} motherships={motherships} onDataChange={onDataChange} />}
      {featureTab === 'settings' && <CoiSettings member={member} onDataChange={onDataChange} onDeleted={onDeleted} />}
      {featureTab === 'clients' && (
        <CoiClients
          member={member}
          selectedClientId={selectedClientId}
          onSelectClient={selectClient}
          onOpenCoiProfile={() => selectFeatureTab('profile_details')}
        />
      )}
    </div>
  )
}

function CoiProfileDetails({ member, motherships = [], onDataChange }) {
  const mothershipText = mothershipLabel(member, motherships)
  const levelOption = LEVEL_OPTIONS.find(l => l.value === member.coi_level)

  return (
    <div>
      {/* Two cards, split by what can move: the identity facts baked into the
          COI number, then everything an admin is free to edit. */}
      <div style={sectionStyle}>
        <div style={eyebrowStyle}>Classification</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
          <Field label="Mothership" value={mothershipText} />
          <Field label="COI Type" value={member.coi_type} />
          <Field label="Level" value={levelOption ? levelOption.label : null} />
        </div>
        <p style={fixedNoteStyle}>COI type and mothership are fixed at creation — both are part of the COI number.</p>
      </div>

      <div style={sectionStyle}>
        <div style={eyebrowStyle}>Contact Details</div>
        {/* Name, member number and status are all in the hero above. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
          <Field label="Work Email" value={member.email} />
          <Field label="Personal Email" value={member.personal_email} />
          <Field label="Join Date" value={member.join_date} />
        </div>
        <div style={{ marginTop: '14px' }}>
          <Field label="Notes" value={member.notes} preWrap />
        </div>
      </div>

      <StripeConnectCard member={member} onDataChange={onDataChange} connectedButtonLabel={null} setupButtonLabel="Send Setup Email" />
    </div>
  )
}

// Stripe Connect state for one COI: draft the setup email, and show what Stripe
// currently says about the account. Having an account id is NOT proof the COI
// finished onboarding, so the pill comes from a live status call, never from the
// roster row.
function StripeConnectCard({ member, onDataChange, connectedButtonLabel, setupButtonLabel }) {
  const [connectStatus, setConnectStatus] = useState(null)
  const [connectLoading, setConnectLoading] = useState(false)
  const [connectRefresh, setConnectRefresh] = useState(0)
  const [requesting, setRequesting] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  const accountId = member.stripe_account_id || ''

  useEffect(() => {
    if (!accountId) { setConnectStatus(null); setConnectLoading(false); return }
    let alive = true
    setConnectLoading(true)
    callApi('coi_connect_status', { member_number: member.member_number })
      .then(res => { if (alive) setConnectStatus(res || { status: 'unavailable' }) })
      .catch(() => { if (alive) setConnectStatus({ status: 'unavailable' }) })
      .finally(() => { if (alive) setConnectLoading(false) })
    return () => { alive = false }
  }, [accountId, member.member_number, connectRefresh])

  async function sendRequest() {
    setRequesting(true); setMsg('')
    try {
      let res = await callApi('coi_stripe_connect_request', { member_number: member.member_number })
      if (res.already_sent_at) {
        if (!window.confirm(`A setup email was already drafted for this COI on ${new Date(res.already_sent_at).toLocaleString()}. Draft another?`)) return
        res = await callApi('coi_stripe_connect_request', { member_number: member.member_number, force: true })
      }
      setMsgType('success')
      setMsg(`Setup email drafted to ${res.to_email}${res.sandbox ? ' (sandbox)' : ''}. Stripe account ${res.stripe_account_id} is ready.`)
      // The roster row is where stripe_account_id comes from, so it has to be
      // re-read before the status call has anything to ask about.
      await onDataChange()
      setConnectRefresh(n => n + 1)
    } catch (err) { setMsgType('error'); setMsg(err.message) }
    finally { setRequesting(false) }
  }

  const connectState = (connectLoading || !connectStatus) ? 'loading' : (connectStatus.status || 'unavailable')
  const connectPill =
    connectState === 'complete' ? { dot: '#16a34a', label: 'Account Set up' }
    : connectState === 'eligible_capped' ? { dot: '#f59e0b', label: 'Account setup — payouts eligible to $3,000' }
    : connectState === 'pending' ? { dot: '#dc2626', label: 'Setup pending' }
    : connectState === 'mode_mismatch' ? { dot: 'var(--wig-faint)', label: `Status unavailable (account created in ${connectStatus.found_in_sandbox ? 'sandbox' : 'live'} mode)` }
    : connectState === 'loading' ? { dot: 'var(--wig-faint)', label: 'Checking status…' }
    : { dot: 'var(--wig-faint)', label: 'Status unavailable' }

  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>Stripe Connect</div>
      {accountId ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '13px', padding: '8px 12px', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '8px', color: 'var(--wig-ink)' }}>{accountId}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 600, color: 'var(--wig-ink)', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '999px', padding: '4px 12px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: connectPill.dot, flexShrink: 0 }} />
            {connectPill.label}
          </span>
          <button type="button" onClick={() => setConnectRefresh(n => n + 1)} disabled={connectLoading}
            style={{ background: 'none', border: 'none', padding: 0, color: '#1D64A8', fontSize: '12px', fontWeight: 600, cursor: connectLoading ? 'wait' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Refresh
          </button>
          {connectedButtonLabel && (
            <button onClick={sendRequest} disabled={requesting} style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '13px', cursor: requesting ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: requesting ? 0.6 : 1 }}>
              {requesting ? 'Sending...' : connectedButtonLabel}
            </button>
          )}
        </div>
      ) : (
        <div>
          <p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', marginBottom: '14px' }}>This COI has not set up their payment details yet.</p>
          <button onClick={sendRequest} disabled={requesting} style={{ ...gradientButtonStyle, cursor: requesting ? 'not-allowed' : 'pointer', opacity: requesting ? 0.6 : 1 }}>
            {requesting ? 'Working…' : setupButtonLabel}
          </button>
        </div>
      )}
      {msg && <p style={{ color: msgType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{msg}</p>}
    </div>
  )
}

// Edit form for one COI. CoiDetail is keyed on member_number, so a different COI
// remounts this and the useState initialisers re-read from the new row.
function CoiProfileEdit({ member, motherships = [], onDataChange }) {
  const mothershipText = mothershipLabel(member, motherships)
  const [firstName, setFirstName] = useState(member.first_name || '')
  const [lastName, setLastName] = useState(member.last_name || '')
  // coi_type is not editable — it is baked into member_number — but it is still
  // sent, because update_coi checks it matches and refuses a mismatch.
  const coiType = member.coi_type || ''
  const [coiLevel, setCoiLevel] = useState(String(member.coi_level ?? 0))
  const [email, setEmail] = useState(member.email || '')
  const [personalEmail, setPersonalEmail] = useState(member.personal_email || '')
  const [status, setStatusValue] = useState(statusOf(member))
  const [joinDate, setJoinDate] = useState(member.join_date || '')
  const [notes, setNotes] = useState(member.notes || '')
  const [statusMsg, setStatusMsg] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!firstName || !lastName) { setStatusType('error'); setStatusMsg('First name and last name are required.'); return }
    if (!email.trim()) { setStatusType('error'); setStatusMsg('Work email is required.'); return }
    if (!status) { setStatusType('error'); setStatusMsg('Please pick a status.'); return }
    setLoading(true)
    try {
      await callApi('update_coi', {
        member_number: member.member_number,
        first_name: firstName,
        last_name: lastName,
        coi_type: coiType,
        coi_level: Number(coiLevel),
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
    <div>
      {/* Same two-card split as the read-only pane: the fixed identity facts,
          then everything that is genuinely editable. */}
      <div style={sectionStyle}>
        <div style={eyebrowStyle}>Classification</div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={labelStyle}>Mothership</label>
            <div style={readOnlyFieldStyle}>{mothershipText || '—'}</div>
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={labelStyle}>COI Type</label>
            <div style={readOnlyFieldStyle}>{coiType || '—'}</div>
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={labelStyle}>Level *</label>
            <select value={coiLevel} onChange={e => setCoiLevel(e.target.value)} style={selectStyle}>
              {LEVEL_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>
        <p style={fixedNoteStyle}>COI type and mothership are fixed at creation — both are part of the COI number.</p>
      </div>

      <div style={sectionStyle}>
        <div style={eyebrowStyle}>Contact Details</div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '160px' }}><label style={labelStyle}>First Name *</label><input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} /></div>
          <div style={{ flex: 1, minWidth: '160px' }}><label style={labelStyle}>Last Name *</label><input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} /></div>
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
    </div>
  )
}

function CoiSettings({ member, onDataChange, onDeleted }) {
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
      <StripeConnectCard member={member} onDataChange={onDataChange} connectedButtonLabel="Resend setup email" setupButtonLabel="Set Up Payment Details" />
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

// "1 — ERT" when load_motherships has landed, the bare number until it has (or
// if it failed), null when the COI has no mothership at all.
function mothershipLabel(member, motherships) {
  if (member.mothership_number == null) return null
  const hit = motherships.find(m => m.number === member.mothership_number)
  return hit ? `${hit.number} — ${hit.name}` : String(member.mothership_number)
}

