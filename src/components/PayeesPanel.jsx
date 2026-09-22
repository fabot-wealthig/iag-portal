import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { BackLink, Field, HeroAvatar, ListHeader, TrackHero } from './shared/TrackKit'
import { ListHeaderSkeleton, TableSkeleton } from './shared/Skeleton'
import { sandboxChipStyle } from '../lib/stripeMode'
import SandboxToggle from './shared/SandboxToggle'
import StripeConnectCard from './shared/StripeConnectCard'

// The open payee's id, or NEW_SCREEN for the Add form, so a refresh lands on
// the same screen (standing UI rule 5). Cleared by Portal on navigation and by
// AdminLogin on sign-in (GOTCHA #21).
const SELECTED_KEY = 'wigPayeeSelected'
const NEW_SCREEN = 'new'

const KIND_OPTIONS = [
  { value: 'legal_firm', label: 'Legal firm' },
  { value: 'admin_fee', label: 'Admin fee' },
]
const kindLabel = (k) => (KIND_OPTIONS.find(o => o.value === k) || {}).label || k || '—'

const statusLabel = (p) => (p.active === false ? 'Inactive' : 'Active')
const statusColor = (p) => (p.active === false ? 'var(--wig-faint)' : '#1b9254')
const hasAccount = (p) => String(p.stripe_account_id ?? '').trim() !== ''

const SANDBOX_NOTE = "Stripe test mode for this payee's payout account. No real money moves."
const SANDBOX_LOCKED_NOTE = 'Locked: a Stripe payout account already exists for this payee.'

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const selectStyle = { ...inputStyle, background: 'var(--wig-card)' }
const labelStyle = { fontSize: '12px', color: 'var(--wig-muted)', display: 'block', marginBottom: '6px' }
const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const gradientButtonStyle = { padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
const readOnlyFieldStyle = { ...inputStyle, background: 'var(--wig-tint)', color: 'var(--wig-muted)' }
const tableStyle = { width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', fontFamily: 'Inter, sans-serif' }
const thStyle = { textAlign: 'left', padding: '12px 18px', background: 'var(--wig-input)', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-muted)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '11px 18px', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '13px', color: 'var(--wig-ink)', verticalAlign: 'middle', whiteSpace: 'nowrap' }
const dotStyle = (color) => ({ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' })

// Automation & Config → Payees: the firms the LEOS hard costs are paid to (the
// legal firm, GFX). A list, a detail screen per payee that replaces the list
// header, and an Add form.
export default function PayeesPanel() {
  const [payees, setPayees] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState(() => sessionStorage.getItem(SELECTED_KEY) || null)

  async function load() {
    try {
      const data = await callApi('load_payees')
      setPayees(data.payees || [])
      setLoadError('')
    } catch (err) {
      setLoadError(err.message)
      setPayees(prev => prev || [])
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  function open(id) {
    setSelected(id)
    if (id) sessionStorage.setItem(SELECTED_KEY, id)
    else sessionStorage.removeItem(SELECTED_KEY)
    window.scrollTo(0, 0)
  }

  if (payees === null) {
    return (
      <div>
        <ListHeaderSkeleton action />
        <TableSkeleton cols={[2, 1, 1.5, 2, 1, 1, 1]} rows={3} />
      </div>
    )
  }

  if (selected === NEW_SCREEN) {
    return <AddPayee onBack={() => open(null)} onCreated={async (id) => { await load(); open(id) }} />
  }

  const current = selected ? payees.find(p => p.id === selected) || null : null
  if (current) {
    return <PayeeDetail key={current.id} payee={current} onBack={() => open(null)} onDataChange={load} />
  }

  return (
    <div>
      <ListHeader
        title="Payees"
        count={payees.length}
        action={<button onClick={() => open(NEW_SCREEN)} style={gradientButtonStyle}>Add payee</button>}
      />
      {loadError && <p style={{ color: '#d93025', fontSize: '13px', margin: '0 0 12px' }}>{loadError}</p>}
      <div style={{ overflowX: 'auto', border: '1px solid var(--wig-border-soft)', borderRadius: '14px', background: 'var(--wig-card)', boxShadow: 'var(--wig-shadow-card)' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Kind</th>
              <th style={thStyle}>Contact</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Sandbox</th>
              <th style={thStyle}>Payout account</th>
            </tr>
          </thead>
          <tbody>
            {payees.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--wig-faint)', fontSize: '13px' }}>No payees yet.</td>
              </tr>
            )}
            {payees.map(p => (
              <tr key={p.id} onClick={() => open(p.id)} style={{ cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--wig-tint)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{p.name}</td>
                <td style={tdStyle}>{kindLabel(p.kind)}</td>
                <td style={tdStyle}>{p.contact_name || '—'}</td>
                <td style={tdStyle}>{p.email || '—'}</td>
                <td style={tdStyle}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
                    <span style={dotStyle(statusColor(p))} />
                    {statusLabel(p)}
                  </span>
                </td>
                <td style={tdStyle}>{p.sandbox === true && <span style={sandboxChipStyle}>Sandbox</span>}</td>
                {/* Only whether an account was CREATED; whether it can be paid is
                    read live from Stripe on the detail screen. */}
                <td style={tdStyle} title={hasAccount(p) ? 'Stripe account created' : 'No Stripe account yet'}>
                  <span style={dotStyle(hasAccount(p) ? '#16a34a' : 'var(--wig-faint)')} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PayeeDetail({ payee, onBack, onDataChange }) {
  return (
    <div>
      <TrackHero
        eyebrow="Payees"
        title={payee.name}
        avatar={<HeroAvatar name={payee.name} />}
        meta={
          <>
            <span>{kindLabel(payee.kind)}</span>
            <span style={{ color: 'var(--wig-border-mid)' }}>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--wig-ink)' }}>
              <span style={dotStyle(statusColor(payee))} />
              {statusLabel(payee)}
            </span>
            {payee.sandbox === true && <span style={sandboxChipStyle}>Sandbox</span>}
          </>
        }
      />
      <BackLink label="← Back to Payees" onClick={onBack} />
      <PayeeProfileEdit payee={payee} onDataChange={onDataChange} />
      <StripeConnectCard
        accountId={payee.stripe_account_id}
        statusAction="payee_connect_status"
        requestAction="payee_connect_request"
        idPayload={{ payee_id: payee.id }}
        onDataChange={onDataChange}
        connectedButtonLabel="Resend setup email"
        setupButtonLabel="Send Setup Email"
        noAccountText="This payee has not set up their payment details yet."
        entityLabel="payee"
      />
    </div>
  )
}

// The fields both forms share. Kind is a select on Add and read-only on the
// detail, because save_payee never rewrites it.
function PayeeFields({ form, set, kindEditable, sandboxLocked }) {
  return (
    <>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: '220px' }}>
          <label style={labelStyle}>Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} maxLength={120} style={inputStyle} />
        </div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label style={labelStyle}>Kind{kindEditable ? ' *' : ''}</label>
          {kindEditable ? (
            <select value={form.kind} onChange={e => set('kind', e.target.value)} style={selectStyle}>
              <option value="">-- Select --</option>
              {KIND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <div style={readOnlyFieldStyle}>{kindLabel(form.kind)}</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={labelStyle}>Contact Name</label>
          <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} maxLength={120} style={inputStyle} />
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={labelStyle}>Email</label>
          <input value={form.email} onChange={e => set('email', e.target.value)} type="email" style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '28px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: 'var(--wig-ink)', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
          Active
        </label>
        <SandboxToggle checked={form.sandbox} onChange={v => set('sandbox', v)} locked={sandboxLocked}
          note={SANDBOX_NOTE} lockedNote={SANDBOX_LOCKED_NOTE} />
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

function PayeeProfileEdit({ payee, onDataChange }) {
  const [form, set] = useForm({
    kind: payee.kind,
    name: payee.name || '',
    contact_name: payee.contact_name || '',
    email: payee.email || '',
    active: payee.active !== false,
    sandbox: payee.sandbox === true,
    notes: payee.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  async function submit() {
    if (!form.name.trim()) { setMsgType('error'); setMsg('Name is required.'); return }
    setSaving(true); setMsg('')
    try {
      await callApi('save_payee', {
        id: payee.id,
        name: form.name,
        contact_name: form.contact_name,
        email: form.email,
        active: form.active,
        sandbox: form.sandbox,
        notes: form.notes,
      })
      await onDataChange()
      setMsgType('success'); setMsg('Payee updated.')
    } catch (err) {
      setMsgType('error'); setMsg(err.message)
    } finally { setSaving(false) }
  }

  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>Profile</div>
      <PayeeFields form={form} set={set} kindEditable={false} sandboxLocked={hasAccount(payee)} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px' }}>
        <Field label="Added By" value={payee.created_by} />
        <Field label="Setup Email Drafted" value={payee.connect_setup_email_sent_at ? new Date(payee.connect_setup_email_sent_at).toLocaleString() : null} />
      </div>
      <button onClick={submit} disabled={saving} style={{ ...gradientButtonStyle, padding: '10px 28px', fontSize: '14px', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
      {msg && <p style={{ color: msgType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{msg}</p>}
    </div>
  )
}

function AddPayee({ onBack, onCreated }) {
  const [form, set] = useForm({ kind: '', name: '', contact_name: '', email: '', active: true, sandbox: false, notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!form.kind) { setError('Please pick a kind.'); return }
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true); setError('')
    try {
      const res = await callApi('save_payee', { ...form })
      await onCreated(res.payee?.id || null)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div>
      <TrackHero eyebrow="Payees" title="Add payee" />
      <BackLink label="← Back to Payees" onClick={onBack} />
      <div style={sectionStyle}>
        <div style={eyebrowStyle}>Profile</div>
        <PayeeFields form={form} set={set} kindEditable sandboxLocked={false} />
        <button onClick={submit} disabled={saving} style={{ ...gradientButtonStyle, padding: '10px 28px', fontSize: '14px', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : 'Add Payee'}
        </button>
        {error && <p style={{ color: '#d93025', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
      </div>
    </div>
  )
}
