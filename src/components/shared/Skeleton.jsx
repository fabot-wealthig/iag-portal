// Loading skeletons — the WIG port of VFO's shared/skeletons. The primitives
// come first, the page-shaped compositions after them: one library file is
// enough for a portal this size, and keeping both halves in one place means a
// page skeleton and the block it is built from cannot drift apart.
//
// Every colour is a --wig-* token, so a skeleton renders correctly in both
// themes; the shimmer itself is the .wig-skeleton class in styles.css.
//
// STANDING RULE, kept from VFO: anything the page already knows — a hero, a tab
// strip, a section eyebrow, the Start New Payment card — renders instantly, and
// only the part still waiting on data is drawn as a skeleton. A skeleton that
// replaces the whole screen is a spinner with extra steps.

export function Skeleton({ width = '100%', height = 16, style = {}, className = '' }) {
  return <span className={`wig-skeleton ${className}`} style={{ width, height, ...style }} />
}

export function SkeletonText({ lines = 3, width = '100%', spacing = 8, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing, ...style }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '70%' : width} height={14} />
      ))}
    </div>
  )
}

export function SkeletonRow({ withPill = true, withDate = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--wig-border-soft)' }}>
      <Skeleton width={8} height={8} style={{ borderRadius: '50%', flexShrink: 0 }} />
      <Skeleton width="60%" height={14} style={{ flex: 1 }} />
      {withPill && <Skeleton width={70} height={20} style={{ borderRadius: '999px' }} />}
      {withDate && <Skeleton width={55} height={12} />}
    </div>
  )
}

// The portal's standard section card — the same card every panel draws around
// its own content, so a skeleton occupies exactly the space its page will.
export function CardShell({ children, pad = 24, style = {} }) {
  return (
    <div style={{ background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: pad, marginBottom: '16px', ...style }}>
      {children}
    </div>
  )
}

export function SkeletonCard({ rows = 3, title = true }) {
  return (
    <CardShell>
      {title && <Skeleton width="40%" height={16} style={{ marginBottom: '16px' }} />}
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
    </CardShell>
  )
}

// Mirrors TrackKit's TrackHero: gradient accent strip, eyebrow, big navy title,
// optional meta line, optional stat row and right-side action slot.
export function HeroSkeleton({ stats = 0, action = true, meta = true, progress = false }) {
  return (
    <CardShell pad={0} style={{ overflow: 'hidden', marginBottom: '20px' }}>
      <div style={{ height: '4px', background: 'linear-gradient(90deg, #0F355A 0%, #1D64A8 55%, #2E86C7 100%)' }} />
      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: '220px' }}>
            <Skeleton width={110} height={10} />
            <Skeleton width={250} height={24} />
            {meta && <Skeleton width={190} height={12} />}
          </div>
          {action && <Skeleton width={130} height={34} style={{ borderRadius: '999px' }} />}
        </div>
        {progress && <Skeleton width="100%" height={8} style={{ borderRadius: '99px', marginTop: '16px' }} />}
        {stats > 0 && (
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', marginTop: '18px' }}>
            {Array.from({ length: stats }).map((_, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Skeleton width={34} height={24} />
                <Skeleton width={62} height={9} />
              </div>
            ))}
          </div>
        )}
      </div>
    </CardShell>
  )
}

// Mirrors TrackKit's ListHeader: big title + count chip, optional action.
export function ListHeaderSkeleton({ action = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Skeleton width={140} height={24} />
        <Skeleton width={44} height={20} style={{ borderRadius: '999px' }} />
      </div>
      {action && <Skeleton width={120} height={34} style={{ borderRadius: '8px' }} />}
    </div>
  )
}

// Search input + filter pill + sort select — the portal's standard list toolbar.
export function SearchFilterSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
      <Skeleton width="100%" height={42} style={{ flex: 1, borderRadius: '10px' }} />
      <Skeleton width={84} height={36} style={{ borderRadius: '999px', flexShrink: 0 }} />
      <Skeleton width={150} height={36} style={{ borderRadius: '8px', flexShrink: 0 }} />
    </div>
  )
}

// Generic table: header band, N data rows, optional tinted totals row. `cols` is
// a count or an array of relative widths (e.g. [2, 1, 1, 1]) — pass the real
// table's column shape so the skeleton lands where the cells will.
export function TableSkeleton({ cols = 5, rows = 3, totals = false, card = true }) {
  const widths = Array.isArray(cols) ? cols : Array.from({ length: cols }).map(() => 1)
  const grid = widths.map(w => `${w}fr`).join(' ')
  const body = (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '10px', padding: '11px 18px', background: 'var(--wig-input)', borderBottom: '1px solid var(--wig-border-soft)', alignItems: 'center' }}>
        {widths.map((_, i) => <Skeleton key={i} width="55%" height={10} />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'grid', gridTemplateColumns: grid, gap: '10px', padding: '13px 18px', borderBottom: '1px solid var(--wig-border-soft)', alignItems: 'center' }}>
          {widths.map((_, i) => <Skeleton key={i} width={i === 0 ? '80%' : '60%'} height={13} />)}
        </div>
      ))}
      {totals && (
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '10px', padding: '13px 18px', background: 'var(--wig-tint)', alignItems: 'center' }}>
          {widths.map((_, i) => <Skeleton key={i} width={i === 0 ? '40%' : '50%'} height={13} />)}
        </div>
      )}
    </>
  )
  if (!card) return <div>{body}</div>
  return <CardShell pad={0} style={{ overflow: 'hidden' }}>{body}</CardShell>
}

// A stack of plain section cards — the generic profile-ish panel.
export function ProfileTabSkeleton({ sections = 3 }) {
  return (
    <div>
      {Array.from({ length: sections }).map((_, i) => (
        <CardShell key={i} style={{ marginBottom: '20px' }}>
          <Skeleton width={120} height={11} style={{ marginBottom: '16px' }} />
          <Skeleton width="35%" height={20} />
        </CardShell>
      ))}
    </div>
  )
}

// A public token page's card body (title, a few lines, a button) — the pay and
// setup pages while their token loads.
export function TokenFormSkeleton() {
  return (
    <div style={{ padding: '8px 0' }}>
      <Skeleton width={200} height={22} style={{ marginBottom: '14px' }} />
      <SkeletonText lines={3} />
      <Skeleton width={180} height={42} style={{ borderRadius: '10px', marginTop: '20px' }} />
    </div>
  )
}

// --- page-shaped skeletons ---------------------------------------------------
// Each one matches a real screen column for column: the toolbar it draws, the
// number of table columns and their relative widths are the ones the loaded page
// renders, so as little as possible moves when the data lands.

// COI Overview: toolbar, then the nine-column table —
// Clients · Member # · Name · Status · Type · Mothership · Level · Paid · Rev share.
export function CoiOverviewSkeleton() {
  return (
    <div>
      <SearchFilterSkeleton />
      <TableSkeleton cols={[0.6, 0.9, 1.6, 0.8, 0.8, 1, 0.7, 0.6, 1.1]} rows={3} />
    </div>
  )
}

// Client Overview: toolbar, then the nine-column table —
// Client # · Name · Status · COI · Strategy · Payments · Stage · Next action · Owner.
export function ClientOverviewSkeleton() {
  return (
    <div>
      <SearchFilterSkeleton />
      <TableSkeleton cols={[0.9, 1.4, 0.7, 1.3, 1, 0.6, 0.9, 1.6, 0.8]} rows={3} />
    </div>
  )
}

// The payments list, in both the shapes PaymentsGrid renders: the client's own
// tab has no toolbar and no Client column, the Accounting list has both.
export function PaymentsListSkeleton({ withClient = false }) {
  return (
    <div>
      {withClient && <SearchFilterSkeleton />}
      <TableSkeleton
        cols={withClient ? [1.4, 0.8, 1, 0.8, 0.8, 0.9, 1.1] : [0.8, 1.2, 0.8, 0.8, 0.9, 1.1]}
        rows={3}
      />
    </div>
  )
}

// A payment's detail screen: its own hero, the Progress card's step rows, then
// the Details field grid.
export function PaymentDetailSkeleton() {
  return (
    <div>
      <HeroSkeleton action={false} />
      <CardShell style={{ marginBottom: '20px' }}>
        <Skeleton width={90} height={11} style={{ marginBottom: '16px' }} />
        {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} withDate />)}
      </CardShell>
      {/* Assignments: an eyebrow over two short label-and-control rows. */}
      <CardShell style={{ marginBottom: '20px' }}>
        <Skeleton width={100} height={11} style={{ marginBottom: '18px' }} />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: i === 0 ? '22px' : 0 }}>
            <Skeleton width={90} height={10} />
            <Skeleton width={220} height={34} style={{ borderRadius: '8px' }} />
          </div>
        ))}
      </CardShell>
      <CardShell style={{ marginBottom: '20px' }}>
        <Skeleton width={80} height={11} style={{ marginBottom: '18px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton width={70} height={10} />
              <Skeleton width="60%" height={14} />
            </div>
          ))}
        </div>
      </CardShell>
    </div>
  )
}

// The row-card directory lists — COIs, clients, motherships: list header, an
// optional toolbar, then the row cards themselves.
export function DirectoryListSkeleton({ rows = 3, toolbar = true }) {
  return (
    <div>
      <ListHeaderSkeleton />
      {toolbar && <SearchFilterSkeleton />}
      {Array.from({ length: rows }).map((_, i) => (
        <CardShell key={i} pad="14px 20px" style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <Skeleton width={64} height={12} />
            <Skeleton width={150} height={15} />
            <Skeleton width={58} height={20} style={{ borderRadius: '999px' }} />
            <Skeleton width={130} height={12} />
            <Skeleton width={100} height={12} style={{ marginLeft: 'auto' }} />
          </div>
        </CardShell>
      ))}
    </div>
  )
}
