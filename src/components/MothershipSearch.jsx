import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { BackLink, ListHeader, TrackHero } from './shared/TrackKit'
import { DirectoryListSkeleton } from './shared/Skeleton'

const SELECTED_KEY = 'wigSelectedMothership'

const fullName = (m) => `${m.first_name || ''} ${m.last_name || ''}`.trim()
// A missing status reads as Active — the source rows leave it null by default.
const statusOf = (m) => m.status || 'Active'
const statusColor = (s) => (s === 'Active' ? '#1b9254' : s === 'Lost' ? '#e74c3c' : 'var(--wig-faint)')

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const rowStyle = { display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', marginBottom: '6px', background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(20,45,95,0.04)' }
const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }

export default function MothershipSearch({ members = [], onOpenCoi }) {
  const [motherships, setMotherships] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  // The open mothership is stored as a NUMBER, not the row object: the rows
  // arrive from a fetch that has not finished at mount, and the number is what
  // survives a remount. Portal clears this key on any nav click, so it lives
  // just long enough for the round trip out to a COI profile and back.
  const [selectedNumber, setSelectedNumber] = useState(() => {
    const raw = sessionStorage.getItem(SELECTED_KEY)
    return raw ? Number(raw) : null
  })
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    callApi('load_motherships')
      .then(data => { if (!cancelled) { setMotherships(data.motherships || []); setLoadError('') } })
      .catch(err => { if (!cancelled) setLoadError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  function openMothership(m) {
    setSelectedNumber(m.number)
    sessionStorage.setItem(SELECTED_KEY, String(m.number))
    window.scrollTo(0, 0)
  }

  function backToMotherships() {
    setSelectedNumber(null)
    sessionStorage.removeItem(SELECTED_KEY)
  }

  // The list header and the row cards are what wait on the fetch; the filter
  // pill and sort select the full toolbar skeleton draws do not exist here.
  if (loading) return <DirectoryListSkeleton toolbar={false} />

  if (loadError) {
    return (
      <div style={sectionStyle}>
        <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{loadError}</p>
      </div>
    )
  }

  // Resolved after the fetch has landed, so a restored selection waits for the
  // list rather than falling back to the top level.
  const selected = selectedNumber != null ? motherships.find(m => m.number === selectedNumber) || null : null

  if (selected) {
    // The COIs under a mothership come from the roster the portal already
    // loaded — no second request for something the page is holding.
    const cois = members.filter(m => m.mothership_number === selected.number)
    return (
      <div>
        <TrackHero
          eyebrow="Motherships"
          title={selected.name}
          meta={<span style={{ fontFamily: 'monospace' }}>Mothership {selected.number}</span>}
        />
        <BackLink label="← Back to motherships" onClick={backToMotherships} />
        <ListHeader title="COIs" count={cois.length} />
        {cois.length === 0
          ? <div style={sectionStyle}><p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0 }}>No COIs under this mothership yet.</p></div>
          : cois.map(m => {
              const status = statusOf(m)
              return (
                // Opens the COI's profile under COI Search rather than a second
                // detail view of its own — one door, one selection key.
                <div key={m.member_number}
                  onClick={() => onOpenCoi(m.member_number, { returnTo: 'mothership_search', mothershipNumber: selected.number })}
                  style={{ ...rowStyle, cursor: 'pointer' }}
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
    )
  }

  const filtered = search
    ? motherships.filter(m => (m.name || '').toLowerCase().includes(search) || String(m.number).includes(search))
    : motherships

  return (
    <div>
      <ListHeader title="Motherships" count={filtered.length} />
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input type="search" name="search" autoComplete="off" placeholder="Search by name or number..."
          value={search} onChange={e => setSearch(e.target.value.toLowerCase())}
          style={{ ...inputStyle, flex: 1 }} />
      </div>
      <div>
        {filtered.map(m => (
          <div key={m.number}
            onClick={() => openMothership(m)}
            style={{ ...rowStyle, cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(61,155,224,0.4)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--wig-border-soft)'}>
            <span style={{ fontSize: '12px', color: 'var(--wig-muted)', width: '50px', flexShrink: 0, fontFamily: 'monospace' }}>{m.number}</span>
            <span style={{ fontSize: '14px', color: 'var(--wig-ink)', fontWeight: 600, flex: 1, minWidth: 0 }}>{m.name}</span>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', color: 'var(--wig-muted)', flexShrink: 0 }}>
              {m.coi_count} {m.coi_count === 1 ? 'COI' : 'COIs'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
