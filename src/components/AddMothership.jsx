import { useState } from 'react'
import { callApi } from '../lib/api'

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const labelStyle = { fontSize: '12px', color: 'var(--wig-muted)', display: 'block', marginBottom: '6px' }
const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }

export default function AddMothership() {
  const [name, setName] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!name.trim()) { setStatusType('error'); setStatusMsg('Mothership name is required.'); return }
    setLoading(true)
    try {
      const res = await callApi('add_mothership', { name: name.trim() })
      setName('')
      setStatusType('success'); setStatusMsg(`${res.name} created as mothership ${res.number}`)
    } catch (err) {
      // add_mothership is a write — the server's wording is the wording the
      // admin sees.
      setStatusType('error'); setStatusMsg(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div style={sectionStyle}>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Mothership Name *</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Firm name" style={inputStyle} />
      </div>

      <p style={{ fontSize: '12.5px', color: 'var(--wig-faint)', margin: '0 0 16px' }}>
        The mothership number is assigned automatically — it becomes the first part of every COI number under this firm.
      </p>

      <button onClick={submit} disabled={loading} style={{ padding: '10px 28px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>
        {loading ? 'Creating...' : 'Create Mothership'}
      </button>
      {statusMsg && <p style={{ color: statusType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{statusMsg}</p>}
    </div>
  )
}
