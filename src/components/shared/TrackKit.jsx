// Purely presentational kit for list + profile views: list header, hero avatar,
// and the accent-strip hero. No API calls, no state, no business logic —
// callers pass display data only.

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
