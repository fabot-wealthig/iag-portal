import { useRef, useState } from 'react'

// Purely presentational kit for list + profile views: list header, hero avatar,
// the accent-strip hero, and the detail view's feature-tab dropdown. No API
// calls, no business logic — callers pass display data only.

// Designed header row for list views (e.g. "COIs"): navy title + count chip on
// the left, caller-provided action on the right.
export function ListHeader({ title, count, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '19px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--wig-heading)' }}>{title}</span>
        {typeof count === 'number' && <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', color: 'var(--wig-muted)' }}>{count}</span>}
      </div>
      {action}
    </div>
  )
}

// Circular hero avatar — a headshot image when `src` is given, else a
// gradient-filled initials circle.
export function HeroAvatar({ src, name, size = 60 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: src ? 'var(--wig-tint)' : 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: '1px solid var(--wig-border-chip)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(29,100,168,0.28)' }}>
      {src
        ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ color: '#fff', fontWeight: 700, fontSize: Math.round(size * 0.36) }}>{initials}</span>}
    </div>
  )
}

// Hover-open pill dropdown for a detail view's feature tabs. Lives here rather
// than beside one of its callers because the COI detail and the client detail
// inside it both render the same strip — two copies would drift apart the first
// time the pill styling changes.
export function FeatureTabDropdown({ label, isActive, options, onSelect }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef(null)

  function handleMouseEnter() { clearTimeout(closeTimer.current); setOpen(true) }
  function handleMouseLeave() { setOpen(false) }

  return (
    <div style={{ position: 'relative' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button style={{ padding: '7px 16px', background: isActive ? '#1D64A8' : 'transparent', border: 'none', borderRadius: '999px', boxShadow: isActive ? '0 2px 8px rgba(29,100,168,0.28)' : 'none', color: isActive ? '#ffffff' : 'var(--wig-muted)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', marginRight: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        {label}<span style={{ fontSize: '9px', opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--wig-card)', border: '1px solid var(--wig-border)', borderRadius: '12px', minWidth: '180px', zIndex: 200, paddingTop: '4px', paddingBottom: '4px', boxShadow: '0 14px 36px rgba(20,45,95,0.16)' }}>
          {options.map(opt => (
            <button key={opt.key} onClick={() => { onSelect(opt.key); setOpen(false) }}
              style={{ display: 'block', width: '100%', padding: '8px 20px', background: 'transparent', border: 'none', color: 'var(--wig-ink)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--wig-tint)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Designed hero for detail views: gradient accent strip, eyebrow + title,
// optional meta line, optional avatar and right-side action node.
// `accent={false}` drops the gradient strip — use that for nested cards so
// stacked heroes don't repeat the same treatment.
export function TrackHero({ eyebrow, title, meta, action, accent = true, avatar = null }) {
  return (
    <div style={{ background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', marginBottom: '20px', overflow: 'hidden' }}>
      {accent && <div style={{ height: '4px', background: 'linear-gradient(90deg, #0F355A 0%, #1D64A8 55%, #2E86C7 100%)' }} />}
      <div style={{ padding: '18px 22px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '200px', flex: 1 }}>
            {avatar}
            <div style={{ minWidth: 0, flex: 1 }}>
              {eyebrow && <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1.2px', color: '#EE6A33', textTransform: 'uppercase', marginBottom: '5px' }}>{eyebrow}</div>}
              {title && <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '22px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--wig-heading)', lineHeight: 1.15 }}>{title}</div>}
              {meta && <div style={{ fontSize: '12.5px', color: 'var(--wig-muted)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>{meta}</div>}
            </div>
          </div>
          {action && <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>{action}</div>}
        </div>
      </div>
    </div>
  )
}
