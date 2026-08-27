import { useEffect, useRef, useState } from 'react'

// Presentation only for now — there is no notifications API yet, so the bell
// always renders the empty state and never polls.
export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        title="Notifications"
        style={{
          position: 'relative', background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.55)',
          borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif'
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '8px',
          background: 'var(--wig-card)', border: '1px solid var(--wig-border-strong)',
          borderRadius: '10px', width: '480px', maxWidth: 'calc(100vw - 32px)', maxHeight: '420px', overflowY: 'auto',
          zIndex: 300, boxShadow: '0 8px 32px rgba(20,45,95,0.25)'
        }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--wig-tint-deep)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--wig-ink)' }}>Notifications</span>
          </div>
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--wig-muted)', fontSize: '13px' }}>
            No new notifications
          </div>
        </div>
      )}
    </div>
  )
}
