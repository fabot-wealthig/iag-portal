import { useEffect, useState } from 'react'
import { callApi, getSession } from '../lib/api'

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const labelStyle = { fontSize: '12px', color: 'var(--wig-muted)', display: 'block', marginBottom: '6px' }
const primaryButtonStyle = { padding: '10px 28px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '14px', cursor: 'pointer' }
const smallButtonStyle = { padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontWeight: 600, fontSize: '12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }
const dangerOutlineStyle = { ...smallButtonStyle, border: '1px solid rgba(231,76,60,0.4)', color: '#e74c3c' }
const dangerSolidStyle = { ...smallButtonStyle, border: 'none', background: '#e74c3c', color: '#fff' }
const chipBase = { display: 'inline-block', borderRadius: '999px', fontSize: '11px', fontWeight: 700, padding: '2px 9px', letterSpacing: '0.3px' }

// The secondary portal tabs a superadmin can hand out one at a time. Keys must
// match the portal's SECONDARY_TABS and the backend's constants/tabs.ts — a key
// that exists in one and not the others grants nothing.
const TAB_OPTIONS = [
  { key: 'coi_overview', label: 'COI Overview' },
  { key: 'client_overview', label: 'Client Overview' },
  { key: 'tax_strategies', label: 'Tax Strategies' },
  { key: 'automation', label: 'Automation & Config' },
  { key: 'accounting', label: 'Accounting' },
]

function statusStyle(type) {
  return { color: type === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px', marginBottom: 0 }
}

/**
 * The setup link, shown once. The token is only ever handed back in the
 * response that mints it — it is never re-read from load_admins — so this chip
 * is the single chance to copy it before it is gone from the browser.
 */
function SetupLink({ token }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/set-password?token=${token}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, fontFamily: 'monospace', fontSize: '12px', padding: '8px 12px', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '8px', wordBreak: 'break-all', color: 'var(--wig-ink)' }}>
          {url}
        </div>
        <button onClick={copy} style={smallButtonStyle}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <p style={{ fontSize: '11.5px', color: 'var(--wig-faint)', margin: '6px 0 0' }}>
        Share this link with them — it expires in 14 days and can only be used once.
      </p>
    </div>
  )
}

function AdminRow({ admin, canDelete, savingTabs, onIssueLink, onDelete, onToggleTab }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [link, setLink] = useState('')

  async function issueLink() {
    setBusy('link'); setError(''); setLink('')
    try {
      setLink(await onIssueLink(admin.email))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function confirmDelete() {
    setBusy('delete'); setError('')
    try {
      await onDelete(admin.email)
    } catch (err) {
      setError(err.message)
      setBusy('')
      setConfirming(false)
    }
  }

  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--wig-tint)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--wig-ink)' }}>{admin.name}</span>
            {admin.is_superadmin && (
              <span style={{ ...chipBase, background: 'rgba(238,106,51,0.12)', color: '#EE6A33' }}>Superadmin</span>
            )}
            {admin.setup_pending && (
              <span style={{ ...chipBase, background: 'var(--wig-tint)', color: 'var(--wig-muted)' }}>Setup pending</span>
            )}
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--wig-muted)', marginTop: '3px', wordBreak: 'break-all' }}>{admin.email}</div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {confirming ? (
            <>
              <button onClick={confirmDelete} disabled={busy === 'delete'} style={dangerSolidStyle}>
                {busy === 'delete' ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button onClick={() => setConfirming(false)} style={smallButtonStyle}>Cancel</button>
            </>
          ) : (
            <>
              <button onClick={issueLink} disabled={busy === 'link'} style={smallButtonStyle}>
                {busy === 'link' ? 'Working...' : 'New setup link'}
              </button>
              {canDelete && <button onClick={() => setConfirming(true)} style={dangerOutlineStyle}>Delete</button>}
            </>
          )}
        </div>
      </div>

      {/* Tab grants. A superadmin's row shows a badge instead: rank already
          grants every tab, so ticking boxes there would be meaningless. */}
      <div style={{ marginTop: '10px' }}>
        {admin.is_superadmin ? (
          <span style={{ ...chipBase, background: 'rgba(29,100,168,0.12)', color: '#1D64A8' }}>Superadmin - all tabs</span>
        ) : (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            {TAB_OPTIONS.map(t => (
              <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: 'var(--wig-ink)', cursor: 'pointer' }}>
                <input type="checkbox" checked={(admin.allowed_tabs || []).includes(t.key)} disabled={savingTabs} onChange={() => onToggleTab(admin, t.key)} style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
                {t.label}
              </label>
            ))}
            {savingTabs && <span style={{ fontSize: '12px', color: 'var(--wig-faint)' }}>Saving...</span>}
          </div>
        )}
      </div>

      {link && <SetupLink token={link} />}
      {error && <p style={statusStyle('error')}>{error}</p>}
    </div>
  )
}

export default function AdminEditor() {
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [newLink, setNewLink] = useState('')
  const [savingTabs, setSavingTabs] = useState({})

  const myEmail = (getSession()?.email || '').toLowerCase()

  useEffect(() => { loadAdmins() }, [])

  async function loadAdmins() {
    try {
      const data = await callApi('load_admins')
      setAdmins(data.admins || [])
      setListError('')
    } catch (err) {
      setListError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function issueLink(email) {
    const data = await callApi('issue_setup_link', { email })
    // A re-issued link supersedes the old one, so the roster's pending flags
    // are stale the moment this returns.
    loadAdmins()
    return data.setup_token
  }

  async function deleteAdmin(email) {
    await callApi('delete_admin', { email })
    setStatusType('success'); setStatus('Admin removed.')
    setTimeout(() => setStatus(''), 4000)
    loadAdmins()
  }

  // Optimistic: the checkbox flips immediately and only goes back if the server
  // refuses. A tab grant is cheap to re-try and the round trip is long enough
  // that waiting for it makes the box feel broken.
  async function toggleTab(admin, tabKey) {
    const current = admin.allowed_tabs || []
    const next = current.includes(tabKey) ? current.filter(t => t !== tabKey) : [...current, tabKey]
    setAdmins(list => list.map(a => a.email === admin.email ? { ...a, allowed_tabs: next } : a))
    setSavingTabs(s => ({ ...s, [admin.email]: true }))
    try {
      await callApi('admin_update_tabs', { email: admin.email, allowed_tabs: next })
    } catch (err) {
      setAdmins(list => list.map(a => a.email === admin.email ? { ...a, allowed_tabs: current } : a))
      setStatusType('error'); setStatus(err.message)
      setTimeout(() => setStatus(''), 4000)
    } finally {
      setSavingTabs(s => { const n = { ...s }; delete n[admin.email]; return n })
    }
  }

  async function addAdmin() {
    if (!newName.trim()) { setStatusType('error'); setStatus('Name is required.'); return }
    if (!newEmail.trim()) { setStatusType('error'); setStatus('Email is required.'); return }
    setAdding(true); setStatus(''); setNewLink('')
    try {
      const data = await callApi('add_admin', { name: newName.trim(), email: newEmail.trim() })
      setNewName(''); setNewEmail('')
      setNewLink(data.setup_token)
      setStatusType('success'); setStatus(`${data.admin.name} added.`)
      loadAdmins()
    } catch (err) {
      setStatusType('error'); setStatus(err.message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={sectionStyle}>
        <div style={{ ...eyebrowStyle, marginBottom: '6px' }}>Admins</div>
        <p style={{ fontSize: '12px', color: 'var(--wig-faint)', margin: '0 0 16px' }}>
          The COI tabs are open to every admin. Tick the boxes below to grant an admin one of the secondary tabs.
        </p>
        {loading &&<p style={{ color: 'var(--wig-muted)', fontSize: '14px', margin: 0 }}>Loading...</p>}
        {!loading && listError && <p style={statusStyle('error')}>{listError}</p>}
        {!loading && !listError && admins.length === 0 && (
          <p style={{ color: 'var(--wig-muted)', fontSize: '14px', margin: 0 }}>No admins yet.</p>
        )}
        {admins.map(admin => (
          <AdminRow
            key={admin.email}
            admin={admin}
            canDelete={admin.email.toLowerCase() !== myEmail && !admin.is_superadmin}
            savingTabs={!!savingTabs[admin.email]}
            onIssueLink={issueLink}
            onDelete={deleteAdmin}
            onToggleTab={toggleTab}
          />
        ))}
      </div>

      <div style={sectionStyle}>
        <div style={eyebrowStyle}>Add Admin</div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={labelStyle}>Name</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" style={inputStyle} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={labelStyle}>Email</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="name@wealthig.com" style={inputStyle} />
          </div>
        </div>
        <button onClick={addAdmin} disabled={adding} style={primaryButtonStyle}>
          {adding ? 'Adding...' : 'Add Admin'}
        </button>
        {status && <p style={statusStyle(statusType)}>{status}</p>}
        {newLink && <SetupLink token={newLink} />}
      </div>
    </div>
  )
}
