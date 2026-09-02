import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import ClientPaymentForm from './ClientPaymentForm'
import { BackLink, FeatureTabDropdown, ListHeader, NameLink, TrackHero, HeroAvatar } from './shared/TrackKit'

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

export default function CoiClients({ member, selectedClientId, onSelectClient, onOpenCoiProfile }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [featureTab, setFeatureTab] = useState('client_profile')

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

  function openClient(c) {
    onSelectClient(c.id)
    setFeatureTab('client_profile')
    window.scrollTo(0, 0)
  }

  async function handleDeleted() {
    await load()
    onSelectClient(null)
  }

  if (loading) return <div style={{ textAlign: 'center', fontSize: '13.5px', color: 'var(--wig-muted)', padding: '40px 0' }}>Loading...</div>

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
    return (
      <div>
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
        <BackLink label="← Back to clients" onClick={() => onSelectClient(null)} />
        <div style={{ display: 'flex', borderBottom: '1px solid var(--wig-border)', marginBottom: '24px', flexWrap: 'wrap', position: 'relative', zIndex: 50 }}>
          <FeatureTabDropdown
            label="Profile"
            isActive={PROFILE_TAB_OPTIONS.map(o => o.key).includes(featureTab)}
            options={PROFILE_TAB_OPTIONS}
            onSelect={setFeatureTab}
          />
          <button onClick={() => setFeatureTab('client_payments')}
            style={{ ...pillStyle, background: featureTab === 'client_payments' ? '#1D64A8' : 'transparent', boxShadow: featureTab === 'client_payments' ? '0 2px 8px rgba(29,100,168,0.28)' : 'none', color: featureTab === 'client_payments' ? '#ffffff' : 'var(--wig-muted)' }}>
            Payments
          </button>
        </div>
        {featureTab === 'client_profile' && <ClientProfile client={selected} member={member} onOpenCoiProfile={onOpenCoiProfile} />}
        {featureTab === 'client_edit' && <ClientEdit key={selected.id} client={selected} onDataChange={load} />}
        {featureTab === 'client_settings' && <ClientSettings client={selected} onDeleted={handleDeleted} />}
        {featureTab === 'client_payments' && <ClientPayments client={selected} member={member} />}
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

function AddClientForm({ member, onAdded, onCancel }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!firstName || !lastName) { setStatusType('error'); setStatusMsg('First name and last name are required.'); return }
    if (!email.trim()) { setStatusType('error'); setStatusMsg('Email is required.'); return }
    setLoading(true)
    try {
      const res = await callApi('add_client', {
        member_number: member.member_number,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
      })
      setStatusType('success'); setStatusMsg(`Client created with number ${res.client_number}`)
      setFirstName(''); setLastName(''); setEmail(''); setPhone('')
      await onAdded()
    } catch (err) {
      // add_client is a write — the server's wording is the wording the admin sees.
      setStatusType('error'); setStatusMsg(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>Add Client</div>
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
          value={<NameLink onClick={onOpenCoiProfile} title="Open COI profile">{fullName(member)}</NameLink>}
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

function ClientPayments({ client, member }) {
  const [payments, setPayments] = useState([])
  const [strategies, setStrategies] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [sentMsg, setSentMsg] = useState('')

  useEffect(() => { loadAll() }, [client.id])

  async function loadAll() {
    try {
      const [list, rules] = await Promise.all([
        callApi('load_client_payments', { client_id: client.id }),
        callApi('load_strategies'),
      ])
      setPayments(list.payments || [])
      setStrategies(rules.strategies || [])
      setLoadError('')
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitted(res) {
    setShowForm(false)
    setSentMsg(`Payment request drafted to Gmail for ${res.to_email}${res.sandbox ? ' (sandbox)' : ''}`)
    await loadAll()
  }

  if (loading) return <div style={{ textAlign: 'center', fontSize: '13.5px', color: 'var(--wig-muted)', padding: '40px 0' }}>Loading...</div>

  if (loadError) {
    return (
      <div style={sectionStyle}>
        <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{loadError}</p>
      </div>
    )
  }

  return (
    <div>
      <div style={sectionStyle}>
        <div style={eyebrowStyle}>Payments</div>
        <button onClick={() => setShowForm(v => !v)} style={gradientButtonStyle}>Start New Payment</button>
        {sentMsg && !showForm && <p style={{ color: '#1b9254', fontSize: '13px', marginTop: '12px', marginBottom: 0 }}>{sentMsg}</p>}
        {showForm && (
          <div style={{ marginTop: '16px' }}>
            <ClientPaymentForm
              client={client}
              member={member}
              strategies={strategies}
              onSubmitted={handleSubmitted}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}
      </div>

      <div style={sectionStyle}>
        {payments.length === 0
          ? <p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0 }}>No payments yet.</p>
          : payments.map(p => <PaymentRow key={p.id} payment={p} />)}
      </div>
    </div>
  )
}

function PaymentRow({ payment }) {
  const [copied, setCopied] = useState(false)

  function copyLink() {
    navigator.clipboard.writeText(payment.pay_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // A payment_status from Stripe is the truth once there is one; before that the
  // only thing we know is whether the request email actually left.
  const status = payment.payment_status
    ? { label: capitalise(payment.payment_status), color: 'var(--wig-ink)' }
    : payment.payment_email_sent_at
      ? { label: 'Awaiting payment', color: 'var(--wig-ink)' }
      : { label: 'Email not sent', color: '#d93025' }

  return (
    <div style={{ padding: '12px 16px', marginBottom: '6px', background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(20,45,95,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--wig-muted)', width: '100px', flexShrink: 0, fontFamily: 'monospace' }}>{dateText(payment.created_at)}</span>
        <span style={{ fontSize: '14px', color: 'var(--wig-ink)', fontWeight: 600, width: '200px', flexShrink: 0 }}>{payment.strategy_name || payment.strategy_key}</span>
        <span style={{ fontSize: '12px', color: 'var(--wig-muted)', flexShrink: 0 }}>Offset ${moneyText(payment.offset_amount)}</span>
        <span style={{ fontSize: '12px', color: 'var(--wig-muted)', flexShrink: 0 }}>Fee ${moneyText(payment.total_fee)}</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: status.color, background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '999px', padding: '4px 12px', flexShrink: 0 }}>{status.label}</span>
        {payment.pay_url && (
          <button type="button" onClick={copyLink}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--wig-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            {copied ? 'Copied' : 'Copy pay link'}
          </button>
        )}
      </div>
      {payment.notes && <div style={{ fontSize: '12px', color: 'var(--wig-muted)', marginTop: '6px', wordBreak: 'break-word' }}>{payment.notes}</div>}
    </div>
  )
}

const capitalise = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1)

function dateText(v) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

function moneyText(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

function Field({ label, value }) {
  const empty = value == null || value === ''
  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '14px', color: 'var(--wig-ink)', wordBreak: 'break-word' }}>{empty ? '—' : value}</div>
    </div>
  )
}
