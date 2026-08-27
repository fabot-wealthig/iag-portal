import { useState } from 'react'
import { callApi } from '../lib/api'
import AppearanceCard from './shared/AppearanceCard'

const MIN_PASSCODE_LENGTH = 8

export default function AdminSettings({ session }) {
  const [newPasscode, setNewPasscode] = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('success')

  function showStatus(type, msg) {
    setStatusType(type); setStatus(msg)
    setTimeout(() => setStatus(''), 4000)
  }

  async function updatePasscode() {
    if (!newPasscode) { showStatus('error', 'Passcode is required.'); return }
    if (newPasscode.length < MIN_PASSCODE_LENGTH) { showStatus('error', `Passcode must be at least ${MIN_PASSCODE_LENGTH} characters.`); return }
    if (newPasscode !== confirmPasscode) { showStatus('error', 'Passcodes do not match.'); return }
    try {
      await callApi('update_passcode', { new_passcode: newPasscode })
      setNewPasscode('')
      setConfirmPasscode('')
      showStatus('success', 'Passcode updated.')
    } catch (err) { showStatus('error', err.message) }
  }

  const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
  const labelStyle = { fontSize: '12px', color: 'var(--wig-muted)', display: 'block', marginBottom: '6px' }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Account Settings</div>
        <div style={{ marginBottom: '12px' }}>
          <label style={labelStyle}>Email</label>
          <input value={session?.email || ''} readOnly style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} />
        </div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>New Passcode</label>
            <input type="password" autoComplete="new-password" value={newPasscode} onChange={e => setNewPasscode(e.target.value)} placeholder="Leave blank to keep current" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Confirm Passcode</label>
            <input type="password" autoComplete="new-password" value={confirmPasscode} onChange={e => setConfirmPasscode(e.target.value)} placeholder="Confirm new passcode" style={inputStyle} />
          </div>
        </div>
        <button onClick={updatePasscode} style={{ padding: '10px 28px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>
          Update Passcode
        </button>
        {status && <p style={{ color: statusType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{status}</p>}
      </div>
      <AppearanceCard />
    </div>
  )
}
