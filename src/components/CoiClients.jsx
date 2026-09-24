import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import PaymentDetail from './PaymentDetail'
import PaymentsGrid from './PaymentsGrid'
import { BackLink, FeatureTabDropdown, Field, ListHeader, NameLink, TrackHero, HeroAvatar } from './shared/TrackKit'
import { DirectoryListSkeleton, PaymentsListSkeleton } from './shared/Skeleton'
import CoiName, { coiLineOf } from './shared/CoiName'

const CLIENT_FEATURE_TAB_KEY = 'wigClientFeatureTab'
const SELECTED_PAYMENT_KEY = 'wigSelectedPayment'

const PROFILE_TAB_OPTIONS = [
  { key: 'client_profile', label: 'Profile' },
  { key: 'client_edit', label: 'Edit Profile' },
  { key: 'client_settings', label: 'Settings' },
]

const fullName = (c) => `${c.first_name || ''} ${c.last_name || ''}`.trim()
const statusOf = (c) => c.status || 'Active'
const statusColor = (s) => (s === 'Active' ? '#1b9254' : s === 'Lost' ? '#e74c3c' : 'var(--wig-faint)')

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const selectStyle = { ...inputStyle, background: 'var(--wig-card)' }
const labelStyle = { fontSize: '12px', color: 'var(--wig-muted)', display: 'block', marginBottom: '6px' }
const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const gradientButtonStyle = { padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
const pillStyle = { padding: '7px 16px', border: 'none', borderRadius: '999px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', marginRight: '4px' }

// `originBack` is the one-click trip out to wherever this visit began, set only
// when the admin arrived here from a screen that deep-linked past the COI. When
// it is set it REPLACES the back link on this screen and on the payment below —
// the first one they see goes home — and when it is null both behave exactly as
// they do on an ordinary walk in from the COI Search list.
export default function CoiClients({ member, selectedClientId, onSelectClient, onOpenCoiProfile, originBack, onOpenReceipt }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  // Restored on every mount, reload included. Portal also seeds it when an
  // overview name deep-links straight to a client's Payments tab; either way the
  // key stands until a back link, a different client or a nav click clears it.
  const [featureTab, setFeatureTab] = useState(() => sessionStorage.getItem(CLIENT_FEATURE_TAB_KEY) || 'client_profile')
  // The open payment lives HERE rather than inside ClientPayments, for the same
  // reason the open client lives in CoiDetail rather than here: it decides
  // whether THIS component draws the client hero and pills at all. Persisted
  // alongside the client and the pane it sits under, so a reload on a payment
  // restores the whole stack rather than half of it.
  const [selectedPaymentId, setSelectedPaymentId] = useState(() => sessionStorage.getItem(SELECTED_PAYMENT_KEY) || null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const data = await callApi('load_clients', { member_number: member.member_number })
      setClients(data.clients || [])
      setLoadError('')
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // The id is owned by CoiDetail (an open client hides the COI hero, so that is
  // where the decision belongs); the row itself is resolved here off the list
  // this component already loaded.
  const selected = selectedClientId ? clients.find(c => c.id === selectedClientId) || null : null

  function selectPayment(id) {
    setSelectedPaymentId(id)
    if (id == null) sessionStorage.removeItem(SELECTED_PAYMENT_KEY)
    else sessionStorage.setItem(SELECTED_PAYMENT_KEY, String(id))
    window.scrollTo(0, 0)
  }

  // Moving off the Payments pane closes whatever payment was open under it.
  function selectFeatureTab(key) {
    setFeatureTab(key)
    sessionStorage.setItem(CLIENT_FEATURE_TAB_KEY, key)
    if (key !== 'client_payments') selectPayment(null)
  }

  function openClient(c) {
    onSelectClient(c.id)
    // A different client can never open on the last client's pane or payment.
    selectFeatureTab('client_profile')
    window.scrollTo(0, 0)
  }

  function closeClient() {
    selectPayment(null)
    onSelectClient(null)
  }

  async function handleDeleted() {
    await load()
    closeClient()
  }

  // No toolbar on this list — the COI's clients are shown whole, with no search
  // or filter above them, so the skeleton must not promise one.
  if (loading) return <DirectoryListSkeleton toolbar={false} />

  if (loadError) {
    return (
      <div style={sectionStyle}>
        <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{loadError}</p>
      </div>
    )
  }

  if (selected) {
    const name = fullName(selected)
    const status = statusOf(selected)
    const paymentOpen = featureTab === 'client_payments' && selectedPaymentId != null
    return (
      <div>
        {/* An open payment takes over the whole content area — its own hero is
            the topmost thing on screen, so the client's hero and pill strip
            stand down until the payment's back link closes it. The same
            takeover an open client performs on the COI above. */}
        {!paymentOpen && (
        <>
        <TrackHero
          eyebrow="Clients"
          title={name}
          avatar={<HeroAvatar name={name} />}
          meta={
            <>
              <span style={{ fontFamily: 'monospace' }}>{selected.client_number}</span>
              <span style={{ color: 'var(--wig-border-mid)' }}>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--wig-ink)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor(status), flexShrink: 0 }} />
                {status}
              </span>
            </>
          }
        />
        <BackLink
          label={originBack ? originBack.label : '← Back to clients'}
          onClick={originBack ? originBack.onClick : closeClient}
        />
        <div style={{ display: 'flex', borderBottom: '1px solid var(--wig-border)', marginBottom: '24px', flexWrap: 'wrap', position: 'relative', zIndex: 50 }}>
          <FeatureTabDropdown
            label="Profile"
            isActive={PROFILE_TAB_OPTIONS.map(o => o.key).includes(featureTab)}
            options={PROFILE_TAB_OPTIONS}
            onSelect={selectFeatureTab}
          />
          <button onClick={() => selectFeatureTab('client_payments')}
            style={{ ...pillStyle, background: featureTab === 'client_payments' ? '#1D64A8' : 'transparent', boxShadow: featureTab === 'client_payments' ? '0 2px 8px rgba(29,100,168,0.28)' : 'none', color: featureTab === 'client_payments' ? '#ffffff' : 'var(--wig-muted)' }}>
            Payments
          </button>
        </div>
        </>
        )}
        {featureTab === 'client_profile' && <ClientProfile client={selected} member={member} onOpenCoiProfile={onOpenCoiProfile} />}
        {featureTab === 'client_edit' && <ClientEdit key={selected.id} client={selected} onDataChange={load} />}
        {featureTab === 'client_settings' && <ClientSettings client={selected} onDeleted={handleDeleted} />}
        {featureTab === 'client_payments' && (
          <ClientPayments
            client={selected}
            selectedPaymentId={selectedPaymentId}
            onSelectPayment={selectPayment}
            backLabel={originBack ? originBack.label : undefined}
            onBack={originBack ? originBack.onClick : undefined}
            onOpenReceipt={onOpenReceipt}
          />
        )}
      </div>
    )
  }

  return (
    <div>
      <ListHeader
        title="Clients"
        count={clients.length}
        action={<button onClick={() => setShowAdd(v => !v)} style={gradientButtonStyle}>+ Add Client</button>}
      />

      {showAdd && (
        <AddClientForm
          member={member}
          onAdded={async () => { await load(); setShowAdd(false) }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {clients.length === 0 && !showAdd && (
        <div style={sectionStyle}>
          <p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0 }}>No clients yet for this COI.</p>
        </div>
      )}

      <div>
        {clients.map(c => {
          const status = statusOf(c)
          return (
            <div key={c.id}
              onClick={() => openClient(c)}
              style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', marginBottom: '6px', background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(20,45,95,0.04)', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(61,155,224,0.4)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--wig-border-soft)'}>
              <span style={{ fontSize: '12px', color: 'var(--wig-muted)', width: '120px', flexShrink: 0, fontFamily: 'monospace' }}>{c.client_number}</span>
              <span style={{ fontSize: '14px', color: 'var(--wig-ink)', fontWeight: 600, width: '200px', flexShrink: 0 }}>{fullName(c)}</span>
              <span style={{ width: '80px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--wig-ink)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: statusColor(status) }} />
                {status}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--wig-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Add one client. Under a COI the COI is already known and `member` names it;
 * called from anywhere else — the receipt form's client picker — `members` is
 * the roster to choose from, because the provider paid for somebody the portal
 * has never billed and the COI is part of what is being added.
 */
export function AddClientForm({ member, members, onAdded, onCancel }) {
  const [memberNumber, setMemberNumber] = useState(member?.member_number || '')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [loading, setLoading] = useState(false)

  const coiOptions = member
    ? []
    : [...(members || [])].sort((a, b) => fullName(a).localeCompare(fullName(b)))

  async function submit() {
    if (!memberNumber) { setStatusType('error'); setStatusMsg('Choose a COI.'); return }
    if (!firstName || !lastName) { setStatusType('error'); setStatusMsg('First name and last name are required.'); return }
    if (!email.trim()) { setStatusType('error'); setStatusMsg('Email is required.'); return }
    setLoading(true)
    try {
      const res = await callApi('add_client', {
        member_number: memberNumber,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
      })
      setStatusType('success'); setStatusMsg(`Client created with number ${res.client_number}`)
      setFirstName(''); setLastName(''); setEmail(''); setPhone('')
      await onAdded(res)
    } catch (err) {
      // add_client is a write — the server's wording is the wording the admin sees.
      setStatusType('error'); setStatusMsg(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>Add Client</div>
      {/* First, because the COI decides the client's number and who earns on
          them. Under a COI there is nothing to ask. */}
      {!member && (
        <div style={{ marginBottom: '16px', maxWidth: '340px' }}>
          <label style={labelStyle}>COI *</label>
          <select value={memberNumber} onChange={e => setMemberNumber(e.target.value)} style={selectStyle}>
            <option value="">-- Select --</option>
            {coiOptions.map(m => <option key={m.member_number} value={m.member_number}>{`${coiLineOf(m)} (${m.member_number})`}</option>)}
          </select>
        </div>
      )}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '160px' }}><label style={labelStyle}>First Name *</label><input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: '160px' }}><label style={labelStyle}>Last Name *</label><input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} /></div>
      </div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}><label style={labelStyle}>Email *</label><input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: '160px' }}><label style={labelStyle}>Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} /></div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={submit} disabled={loading} style={{ ...gradientButtonStyle, padding: '10px 28px', fontSize: '14px' }}>
          {loading ? 'Creating...' : 'Create Client'}
        </button>
        <button onClick={onCancel} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
      </div>
      {statusMsg && <p style={{ color: statusType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{statusMsg}</p>}
    </div>
  )
}

function ClientProfile({ client, member, onOpenCoiProfile }) {
  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>Profile Details</div>
      {/* Name, number and status are all in the hero above. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
        <Field label="Email" value={client.email} />
        <Field label="Phone" value={client.phone} />
        {/* The COI's name, not their number — the number is already on the
            screen you came from, and a name is what an admin recognises. It
            links back up to that COI's own profile. */}
        <Field
          label="COI"
          value={<CoiName firm={member.company} person={fullName(member)} onClick={onOpenCoiProfile} />}
        />
      </div>
    </div>
  )
}

function ClientEdit({ client, onDataChange }) {
  const [firstName, setFirstName] = useState(client.first_name || '')
  const [lastName, setLastName] = useState(client.last_name || '')
  const [email, setEmail] = useState(client.email || '')
  const [phone, setPhone] = useState(client.phone || '')
  const [status, setStatusValue] = useState(statusOf(client))
  const [statusMsg, setStatusMsg] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!firstName || !lastName) { setStatusType('error'); setStatusMsg('First name and last name are required.'); return }
    if (!email.trim()) { setStatusType('error'); setStatusMsg('Email is required.'); return }
    setLoading(true)
    try {
      await callApi('update_client', {
        client_id: client.id,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        status,
      })
      await onDataChange()
      setStatusType('success'); setStatusMsg('Profile updated.')
    } catch (err) {
      // update_client is a write — the server's wording is the wording the admin sees.
      setStatusType('error'); setStatusMsg(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '160px' }}><label style={labelStyle}>First Name *</label><input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: '160px' }}><label style={labelStyle}>Last Name *</label><input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <label style={labelStyle}>Status *</label>
          <select value={status} onChange={e => setStatusValue(e.target.value)} style={selectStyle}>
            {['Active', 'Lost'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}><label style={labelStyle}>Email *</label><input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: '160px' }}><label style={labelStyle}>Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} /></div>
      </div>

      <button onClick={submit} disabled={loading} style={{ ...gradientButtonStyle, padding: '10px 28px', fontSize: '14px' }}>
        {loading ? 'Saving...' : 'Save Changes'}
      </button>
      {statusMsg && <p style={{ color: statusType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{statusMsg}</p>}
    </div>
  )
}

function ClientSettings({ client, onDeleted }) {
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteStatus, setDeleteStatus] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function deleteClient() {
    setDeleting(true); setDeleteStatus('')
    try {
      await callApi('delete_client', { client_id: client.id })
      await onDeleted()
    } catch (err) {
      setDeleteStatus(err.message)
      setDeleting(false)
    }
  }

  return (
    <div style={{ ...sectionStyle, border: '1px solid rgba(231,76,60,0.3)' }}>
      <div style={{ ...eyebrowStyle, color: '#e74c3c', fontWeight: 500 }}>Danger Zone</div>
      <p style={{ fontSize: '13px', color: 'var(--wig-muted)', marginBottom: '16px' }}>Permanently delete this client and their payment history.</p>
      {!deleteConfirm
        ? <button onClick={() => setDeleteConfirm(true)} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid rgba(231,76,60,0.4)', background: 'transparent', color: '#e74c3c', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}>Delete Client</button>
        : <div>
            <p style={{ color: '#e74c3c', fontWeight: 500, fontSize: '14px', marginBottom: '12px' }}>Are you sure? This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={deleteClient} disabled={deleting} style={{ padding: '10px 24px', borderRadius: '8px', background: '#e74c3c', border: 'none', color: '#fff', fontSize: '14px', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1 }}>
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button onClick={() => setDeleteConfirm(false)} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
            </div>
            {deleteStatus && <p style={{ color: '#d93025', fontWeight: 500, fontSize: '13px', marginTop: '12px' }}>{deleteStatus}</p>}
          </div>
      }
    </div>
  )
}

// This client's payments, tracked. Nothing is STARTED here: a LEOS request and
// a provider's receipt are both raised on the Tax Strategies tab, which is where
// an admin arrives holding the strategy rather than the client.
function ClientPayments({ client, selectedPaymentId, onSelectPayment, backLabel, onBack, onOpenReceipt }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => { loadAll() }, [client.id])

  async function loadAll() {
    try {
      const list = await callApi('load_client_payments', { client_id: client.id })
      setPayments(list.payments || [])
      setLoadError('')
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // An open payment replaces this whole pane (the hero and pills above it are
  // already standing down); coming back re-reads the list, because a step
  // ticked in the detail changes the row it came from.
  //
  // Unless the caller named somewhere else to go: a visit that deep-linked
  // straight to this payment leaves for its origin instead, and there is no list
  // to re-read because this pane is not what the admin lands on.
  if (selectedPaymentId) {
    return (
      <PaymentDetail
        paymentId={selectedPaymentId}
        onBack={onBack || (() => { onSelectPayment(null); loadAll() })}
        backLabel={backLabel}
        onOpenReceipt={onOpenReceipt}
      />
    )
  }

  if (loading) return <PaymentsListSkeleton />

  if (loadError) {
    return (
      <div style={sectionStyle}>
        <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{loadError}</p>
      </div>
    )
  }

  return (
    <div>
      {payments.length === 0
        ? (
          <div style={sectionStyle}>
            <p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0 }}>No payments yet.</p>
          </div>
        )
        : <PaymentsGrid payments={payments} onOpen={p => onSelectPayment(p.id)} />}
    </div>
  )
}
