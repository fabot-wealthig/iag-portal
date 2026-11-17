import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { BackLink, FeatureTabDropdown, HeroAvatar, ListHeader, TrackHero } from './shared/TrackKit'
import { formLabelStyle, InfoField, InfoGrid, NotesCard, ProfileCard } from './shared/ProfileKit'
import { ListHeaderSkeleton, TableSkeleton } from './shared/Skeleton'
import { sandboxChipStyle } from '../lib/stripeMode'
import SandboxToggle from './shared/SandboxToggle'
import StripeConnectCard from './shared/StripeConnectCard'
import CoiName from './shared/CoiName'

// COI ▾ → Firm (IAG 2026-11-17): every COI belongs to ONE firm, and the FIRM is
// paid — its Stripe payout account takes every Stripe-paid share of its COIs,
// and its billing email gets the Stripe setup email and the payout statements.
// A COI on their own is a firm of one.
//
// The open firm's id (or NEW_SCREEN for the Add form), its tab, and the COI a
// visit came from, so a refresh lands on the same screen (standing UI rule 5).
// Cleared by Portal on navigation and by AdminLogin on sign-in (GOTCHA #21).
export const FIRM_SELECTED_KEY = 'wigFirmSelected'
export const FIRM_TAB_KEY = 'wigFirmTab'
export const FIRM_RETURN_COI_KEY = 'wigFirmReturnCoi'
export const NEW_FIRM_SCREEN = 'new'

const hasAccount = (f) => String(f.stripe_account_id ?? '').trim() !== ''
const fullName = (m) => `${m.first_name || ''} ${m.last_name || ''}`.trim()

const SANDBOX_NOTE = "Stripe test mode for this firm's payout account, its COIs and every one of their clients' payments. No real money moves."
const SANDBOX_LOCKED_NOTE = 'Locked: a Stripe payout account already exists for this firm.'

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const gradientButtonStyle = { padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
const tableStyle = { width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', fontFamily: 'Inter, sans-serif' }
const thStyle = { textAlign: 'left', padding: '12px 18px', background: 'var(--wig-input)', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-muted)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '11px 18px', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '13px', color: 'var(--wig-ink)', verticalAlign: 'middle' }
const dotStyle = (color) => ({ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' })
const statusColor = (s) => (s === 'Lost' ? '#e74c3c' : '#1b9254')

export default function FirmsPanel({ onOpenCoi, onReturnToCoi, onDataChange }) {
  const [firms, setFirms] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState(() => sessionStorage.getItem(FIRM_SELECTED_KEY) || null)
  const [tab, setTab] = useState(() => sessionStorage.getItem(FIRM_TAB_KEY) || 'profile_details')
  const [returnCoi] = useState(() => sessionStorage.getItem(FIRM_RETURN_COI_KEY) || null)
  const [query, setQuery] = useState('')

  async function load() {
    try {
      const data = await callApi('load_firms')
      setFirms(data.firms || [])
      setLoadError('')
    } catch (err) {
      setLoadError(err.message)
      setFirms(prev => prev || [])
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  // A firm's save can rename it or move its mode, which the COI roster shows.
  async function reloadAll() {
    await load()
    if (onDataChange) await onDataChange()
  }

  function open(id) {
    setSelected(id)
    if (id) sessionStorage.setItem(FIRM_SELECTED_KEY, id)
    else sessionStorage.removeItem(FIRM_SELECTED_KEY)
    sessionStorage.removeItem(FIRM_RETURN_COI_KEY)
    selectTab('profile_details')
    window.scrollTo(0, 0)
  }

  function selectTab(key) {
    setTab(key)
    sessionStorage.setItem(FIRM_TAB_KEY, key)
  }

  if (firms === null) {
    return (
      <div>
        <ListHeaderSkeleton action />
        <TableSkeleton cols={[2.5, 0.7, 2, 0.8, 1]} rows={6} />
      </div>
    )
  }

  if (selected === NEW_FIRM_SCREEN) {
    return <AddFirm onBack={() => open(null)} onCreated={async (id) => { await reloadAll(); open(id) }} />
  }

  const current = selected ? firms.find(f => f.id === selected) || null : null
  if (current) {
    // Opened from a COI's profile: the back link returns to that COI.
    const back = returnCoi && onReturnToCoi
      ? { label: '← Back to COI', onClick: () => onReturnToCoi(returnCoi) }
      : { label: '← Back to Firm Search', onClick: () => open(null) }
    return (
      <FirmDetail key={current.id} firm={current} tab={tab} onSelectTab={selectTab} back={back}
        onDataChange={reloadAll} onOpenCoi={onOpenCoi ? (mn) => onOpenCoi(mn, current.id) : undefined} />
    )
  }

  const q = query.trim().toLowerCase()
  const shown = q
    ? firms.filter(f => f.name.toLowerCase().includes(q) || f.cois.some(c => fullName(c).toLowerCase().includes(q) || String(c.member_number).includes(q)))
    : firms

  return (
    <div>
      <ListHeader
        title="Firms"
        count={firms.length}
        action={<button onClick={() => open(NEW_FIRM_SCREEN)} style={gradientButtonStyle}>Add firm</button>}
      />
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by firm, COI name or number"
        style={{ ...inputStyle, marginBottom: '16px' }} />
      {loadError && <p style={{ color: '#d93025', fontSize: '13px', margin: '0 0 12px' }}>{loadError}</p>}
      <div style={{ border: '1px solid var(--wig-border-soft)', borderRadius: '14px', background: 'var(--wig-card)', boxShadow: 'var(--wig-shadow-card)' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Firm</th>
              <th style={thStyle}>COIs</th>
              <th style={thStyle}>Billing email</th>
              <th style={thStyle}>Sandbox</th>
              <th style={thStyle}>Payout account</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '28px 18px', color: 'var(--wig-faint)', fontSize: '13px' }}>{q ? 'No firm matches.' : 'No firms yet.'}</td>
              </tr>
            )}
            {shown.map(f => (
              <tr key={f.id} onClick={() => open(f.id)} style={{ cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--wig-tint)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{f.name}</td>
                <td style={tdStyle}>{f.cois_count}</td>
                <td style={{ ...tdStyle, overflowWrap: 'anywhere' }}>{f.billing_email || '—'}</td>
                <td style={tdStyle}>{f.sandbox === true && <span style={sandboxChipStyle}>Sandbox</span>}</td>
                {/* Only whether an account was CREATED; whether it can be paid is
                    read live from Stripe on the firm's profile. */}
                <td style={tdStyle} title={hasAccount(f) ? 'Stripe account created' : 'No Stripe account yet'}>
                  <span style={dotStyle(hasAccount(f) ? '#16a34a' : 'var(--wig-faint)')} />
                </td>
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

function FirmDetail({ firm, tab, onSelectTab, back, onDataChange, onOpenCoi }) {
  return (
    <div>
      <TrackHero
        eyebrow="Firms"
        title={firm.name}
        avatar={<HeroAvatar name={firm.name} />}
        meta={
          <>
            <span>{firm.cois_count === 1 ? '1 COI' : `${firm.cois_count} COIs`}</span>
            {firm.sandbox === true && <span style={sandboxChipStyle}>Sandbox</span>}
          </>
        }
      />
      <BackLink label={back.label} onClick={back.onClick} />
      <div style={{ display: 'flex', borderBottom: '1px solid var(--wig-border)', marginBottom: '24px', flexWrap: 'wrap', position: 'relative', zIndex: 50 }}>
        <FeatureTabDropdown label="Profile" isActive options={PROFILE_TAB_OPTIONS} onSelect={onSelectTab} />
      </div>
      {tab === 'profile_edit'
        ? <FirmProfileEdit firm={firm} onDataChange={onDataChange} />
        : <FirmProfile firm={firm} onDataChange={onDataChange} onOpenCoi={onOpenCoi} />}
    </div>
  )
}

// Read-only. The name, COI count and sandbox are in the hero above.
function FirmProfile({ firm, onDataChange, onOpenCoi }) {
  return (
    <div>
      <ProfileCard title="Billing">
        <InfoGrid>
          <InfoField label="Billing Email">{firm.billing_email}</InfoField>
        </InfoGrid>
      </ProfileCard>
      <ProfileCard title="COIs">
        {firm.cois.length === 0
          ? <p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0 }}>No COIs in this firm.</p>
          : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>COI</th>
                  <th style={thStyle}>Member #</th>
                  <th style={thStyle}>Primary email</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {firm.cois.map(c => (
                  <tr key={c.member_number}>
                    <td style={tdStyle}>
                      <CoiName person={fullName(c) || c.member_number} onClick={onOpenCoi ? () => onOpenCoi(c.member_number) : undefined} />
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{c.member_number}</td>
                    <td style={{ ...tdStyle, overflowWrap: 'anywhere' }}>{c.email || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
                        <span style={dotStyle(statusColor(c.status))} />
                        {c.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </ProfileCard>
      <StripeConnectCard
        accountId={firm.stripe_account_id}
        statusAction="firm_connect_status"
        requestAction="firm_connect_request"
        idPayload={{ firm_id: firm.id }}
        onDataChange={onDataChange}
        connectedButtonLabel="Resend setup email"
        setupButtonLabel="Send Setup Email"
        noAccountText="This firm has not set up its payment details yet. The setup email goes to the billing email."
        entityLabel="firm"
      />
      <NotesCard kind="firm" id={firm.id} />
    </div>
  )
}

function FirmFields({ form, set, sandboxLocked }) {
  return (
    <ProfileCard title="Basic Info">
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: '220px' }}>
          <label style={formLabelStyle}>Firm Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} maxLength={200} style={inputStyle} />
        </div>
        <div style={{ flex: 2, minWidth: '220px' }}>
          <label style={formLabelStyle}>Billing Email *</label>
          <input value={form.billing_email} onChange={e => set('billing_email', e.target.value)} type="email" style={inputStyle} />
        </div>
      </div>
      <SandboxToggle checked={form.sandbox} onChange={v => set('sandbox', v)} locked={sandboxLocked}
        note={SANDBOX_NOTE} lockedNote={SANDBOX_LOCKED_NOTE} />
    </ProfileCard>
  )
}

function useForm(initial) {
  const [form, setForm] = useState(initial)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return [form, set]
}

function FirmProfileEdit({ firm, onDataChange }) {
  const [form, set] = useForm({ name: firm.name || '', billing_email: firm.billing_email || '', sandbox: firm.sandbox === true })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  async function submit() {
    if (!form.name.trim()) { setMsgType('error'); setMsg('Firm name is required.'); return }
    if (!form.billing_email.trim() && String(firm.billing_email || '').trim()) { setMsgType('error'); setMsg('Billing email is required.'); return }
    setSaving(true); setMsg('')
    try {
      await callApi('save_firm', { id: firm.id, name: form.name, billing_email: form.billing_email, sandbox: form.sandbox })
      await onDataChange()
      setMsgType('success'); setMsg('Firm updated.')
    } catch (err) {
      setMsgType('error'); setMsg(err.message)
    } finally { setSaving(false) }
  }

  return (
    <div>
      <FirmFields form={form} set={set} sandboxLocked={hasAccount(firm)} />
      <button onClick={submit} disabled={saving} style={{ ...gradientButtonStyle, padding: '10px 28px', fontSize: '14px', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
      {msg && <p style={{ color: msgType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{msg}</p>}
    </div>
  )
}

function AddFirm({ onBack, onCreated }) {
  const [form, set] = useForm({ name: '', billing_email: '', sandbox: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!form.name.trim()) { setError('Firm name is required.'); return }
    if (!form.billing_email.trim()) { setError('Billing email is required.'); return }
    setSaving(true); setError('')
    try {
      const res = await callApi('save_firm', { ...form })
      await onCreated(res.firm?.id || null)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div>
      <TrackHero eyebrow="Firms" title="Add firm" />
      <BackLink label="← Back to Firm Search" onClick={onBack} />
      <FirmFields form={form} set={set} sandboxLocked={false} />
      <button onClick={submit} disabled={saving} style={{ ...gradientButtonStyle, padding: '10px 28px', fontSize: '14px', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving...' : 'Add Firm'}
      </button>
      {error && <p style={{ color: '#d93025', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
    </div>
  )
}
