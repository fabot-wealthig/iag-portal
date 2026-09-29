import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { TableSkeleton } from './shared/Skeleton'

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const thStyle = { textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)', padding: '8px 10px', borderBottom: '1px solid var(--wig-border)', whiteSpace: 'nowrap' }
const tdStyle = { textAlign: 'left', fontSize: '13px', color: 'var(--wig-ink)', padding: '10px', borderBottom: '1px solid var(--wig-border-soft)', whiteSpace: 'nowrap' }
const mutedTd = { ...tdStyle, color: 'var(--wig-muted)' }

function money(v) {
  const n = Number(v)
  return v == null || !Number.isFinite(n) ? '—' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function dateText(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function sizeText(bytes) {
  if (!bytes) return '—'
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * The client's Vault (chat 17, Phase 3): every invoice and receipt the portal
 * issued them, filed automatically when it was emailed. View-only (Jake,
 * 2026-09-29) — no upload, no delete. The WHOLE ROW opens the file in a new
 * tab through a five-minute signed link (standing UI rule 4: no action controls
 * in list rows). The tab is opened before the link is fetched so a popup
 * blocker does not eat it.
 */
export default function ClientVault({ client }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    callApi('load_client_vault', { client_id: client.id })
      .then(res => { if (!cancelled) setFiles(res.files || []) })
      .catch(err => { if (!cancelled) setError(err.message || 'Could not load the vault.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [client.id])

  async function openFile(f) {
    setError('')
    const tab = window.open('', '_blank')
    if (!tab) {
      setError('Your browser blocked the new tab. Allow pop-ups for the portal, then click the document again.')
      return
    }
    tab.opener = null
    try {
      const res = await callApi('load_vault_file_url', { client_id: client.id, path: f.path })
      tab.location = res.url
    } catch (err) {
      if (tab) tab.close()
      setError(err.message || 'Could not open the file.')
    }
  }

  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>Invoices / Receipts</div>
      {loading ? (
        <TableSkeleton cols={[1.6, 0.8, 1.2, 0.9, 1, 1, 0.7]} rows={2} card={false} />
      ) : files.length === 0 ? (
        <p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0 }}>
          No documents yet. Every invoice and receipt issued to this client is filed here automatically.
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={thStyle}>Document</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Strategy</th>
              <th style={thStyle}>Amount</th>
              <th style={thStyle}>Payment date</th>
              <th style={thStyle}>Filed</th>
              <th style={thStyle}>Size</th>
            </tr>
          </thead>
          <tbody>
            {files.map(f => (
              <tr key={f.path}
                onClick={() => openFile(f)}
                onMouseEnter={() => setHovered(f.path)}
                onMouseLeave={() => setHovered(null)}
                title="Open in a new tab"
                style={{ cursor: 'pointer', background: hovered === f.path ? 'var(--wig-tint)' : 'transparent' }}>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600 }}>{f.name}</td>
                <td style={tdStyle}>{f.kind === 'invoice' ? 'Invoice' : f.kind === 'receipt' ? 'Receipt' : 'Document'}</td>
                <td style={tdStyle}>{f.strategy || '—'}</td>
                <td style={mutedTd}>{money(f.amount)}</td>
                <td style={mutedTd}>{dateText(f.payment_date)}</td>
                <td style={mutedTd}>{dateText(f.filed_at)}</td>
                <td style={mutedTd}>{sizeText(f.size)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {error && <p style={{ color: '#d93025', fontSize: '13px', margin: '12px 0 0' }}>{error}</p>}
    </div>
  )
}
