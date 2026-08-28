import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'

// Level labels carry the LEOS share percentages so the person filling the form
// can see what they are granting. Hardcoded to the LEOS defaults on purpose —
// the live percentages are per-strategy configuration, and a select that
// re-read them per strategy would imply a COI's level means different things in
// different places, which it does not.
const LEVEL_OPTIONS = [
  { value: 0, label: 'Level 0 - 0%' },
  { value: 1, label: 'Level 1 - 20%' },
  { value: 2, label: 'Level 2 - 30%' },
  { value: 3, label: 'Level 3 - 40%' },
  { value: 4, label: 'Level 4 - 50%' },
]

const COI_TYPES = ['Advisor', 'Accountant', 'Other']

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const selectStyle = { ...inputStyle, background: 'var(--wig-card)' }
const labelStyle = { fontSize: '12px', color: 'var(--wig-muted)', display: 'block', marginBottom: '6px' }
const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }

export default function AddCoi({ onDataChange }) {
  const [motherships, setMotherships] = useState([])
  const [mothershipError, setMothershipError] = useState('')
  const [mothership, setMothership] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [coiType, setCoiType] = useState('')
  const [coiLevel, setCoiLevel] = useState('0')
  const [email, setEmail] = useState('')
  const [personalEmail, setPersonalEmail] = useState('')
  const [status, setStatusValue] = useState('')
  const [joinDate, setJoinDate] = useState('')
  const [notes, setNotes] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    callApi('load_motherships')
      .then(data => { if (!cancelled) setMotherships(data.motherships || []) })
      .catch(err => { if (!cancelled) setMothershipError(err.message) })
    return () => { cancelled = true }
  }, [])

  async function submit() {
    if (!mothership) { setStatusType('error'); setStatusMsg('Please pick a mothership.'); return }
    if (!firstName || !lastName || !coiType) { setStatusType('error'); setStatusMsg('First name, last name, and COI type are required.'); return }
    if (!email.trim()) { setStatusType('error'); setStatusMsg('Work email is required.'); return }
    if (!status) { setStatusType('error'); setStatusMsg('Please pick a status.'); return }
    setLoading(true)
    try {
      const res = await callApi('add_coi', {
        mothership_number: Number(mothership),
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
      setMothership(''); setFirstName(''); setLastName(''); setCoiType(''); setCoiLevel('0')
      setEmail(''); setPersonalEmail(''); setStatusValue(''); setJoinDate(''); setNotes('')
      setStatusType('success'); setStatusMsg(`COI created with number ${res.member_number}`)
    } catch (err) {
      // add_coi is a write — the server's wording is the wording the admin sees.
      setStatusType('error'); setStatusMsg(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label style={labelStyle}>Mothership *</label>
          <select value={mothership} onChange={e => setMothership(e.target.value)} style={selectStyle}>
            <option value="">-- Select --</option>
            {motherships.map(m => <option key={m.number} value={m.number}>{m.number} — {m.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label style={labelStyle}>COI Type *</label>
          <select value={coiType} onChange={e => setCoiType(e.target.value)} style={selectStyle}>
            <option value="">-- Select --</option>
            {COI_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label style={labelStyle}>Level *</label>
          <select value={coiLevel} onChange={e => setCoiLevel(e.target.value)} style={selectStyle}>
            {LEVEL_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
      </div>

      <p style={{ fontSize: '12.5px', color: 'var(--wig-faint)', margin: '0 0 16px' }}>
        COI number is assigned automatically. Mothership and COI type are fixed once the COI is created.
      </p>
      {mothershipError && <p style={{ color: '#d93025', fontSize: '13px', marginTop: 0, marginBottom: '16px' }}>{mothershipError}</p>}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '160px' }}><label style={labelStyle}>First Name *</label><input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: '160px' }}><label style={labelStyle}>Last Name *</label><input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <label style={labelStyle}>Status *</label>
          <select value={status} onChange={e => setStatusValue(e.target.value)} style={selectStyle}>
            <option value="">-- Select --</option>
            {['Active', 'Lost'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}><label style={labelStyle}>Work Email *</label><input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: '200px' }}><label style={labelStyle}>Personal Email</label><input value={personalEmail} onChange={e => setPersonalEmail(e.target.value)} type="email" style={inputStyle} /></div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Join Date</label>
        <input value={joinDate} onChange={e => setJoinDate(e.target.value)} type="date" style={{ ...inputStyle, maxWidth: '200px' }} />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: '90px', resize: 'vertical', fontFamily: 'inherit' }} />
      </div>

      <button onClick={submit} disabled={loading} style={{ padding: '10px 28px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>
        {loading ? 'Creating...' : 'Create COI'}
      </button>
      {statusMsg && <p style={{ color: statusType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{statusMsg}</p>}
    </div>
  )
}
