import { useEffect, useRef, useState } from 'react'

// A searchable single-select over every client in the portal, mechanics copied
// from the VFO portal's SearchSelect (standing rule 3): a button trigger, a
// panel that closes on any click outside it, an autofocused search box, and a
// scrolling list of matches. There are hundreds of clients and an admin
// recording a provider's batch knows the NAME, not the number — a plain select
// would be a wall of options.

const listItemStyle = { display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', color: 'var(--wig-ink)' }

/** "First Last (1.2.9999-001) — COI Name" — everything an admin might search on. */
export function clientLabel(c) {
  const name = `${c.first_name || ''} ${c.last_name || ''}`.trim()
  const number = c.client_number ? ` (${c.client_number})` : ''
  const coi = c.coi_name ? ` — ${c.coi_name}` : ''
  return `${name || 'Unnamed client'}${number}${coi}`
}

export default function ClientPicker({ clients = [], valueId, onChange, onAddClient, placeholder = 'Select a client…' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef(null)

  useEffect(() => {
    function onDoc(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selected = clients.find(c => c.client_id === valueId) || null
  const q = query.trim().toLowerCase()
  const filtered = q
    ? clients.filter(c => clientLabel(c).toLowerCase().includes(q))
    : clients

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-card)', fontSize: '13px', color: selected ? 'var(--wig-ink)' : 'var(--wig-faint)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected ? clientLabel(selected) : placeholder}</span>
        <span style={{ fontSize: '10px', opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: 'var(--wig-card)', border: '1px solid var(--wig-border)', borderRadius: '10px', zIndex: 50, boxShadow: '0 14px 36px rgba(20,45,95,0.16)', overflow: 'hidden' }}>
          <input type="search" name="search" autoComplete="off" autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: 'none', borderBottom: '1px solid var(--wig-border-soft)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {filtered.length === 0 && <div style={{ padding: '12px', fontSize: '12px', color: 'var(--wig-faint)' }}>No matches</div>}
            {filtered.map(c => (
              <button key={c.client_id} type="button"
                onClick={() => { onChange(c.client_id); setOpen(false); setQuery('') }}
                style={{ ...listItemStyle, background: c.client_id === valueId ? 'var(--wig-tint)' : 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--wig-tint)'}
                onMouseLeave={e => e.currentTarget.style.background = c.client_id === valueId ? 'var(--wig-tint)' : 'transparent'}>
                {clientLabel(c)}
              </button>
            ))}
          </div>
          {/* Last, and only where the caller can actually take it: the provider
              paid for somebody the portal has never billed, and adding them
              belongs on the line that needs them rather than three screens
              away. */}
          {onAddClient && (
            <button type="button" onClick={() => { setOpen(false); setQuery(''); onAddClient() }}
              style={{ ...listItemStyle, borderTop: '1px solid var(--wig-border-soft)', background: 'transparent', color: '#1D64A8', fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--wig-tint)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              + Add a new client
            </button>
          )}
        </div>
      )}
    </div>
  )
}
