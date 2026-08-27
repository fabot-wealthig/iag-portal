import { useMemo, useState } from 'react'
import { KpiHero, SplitDonut, BreakdownRows, BreakdownCard } from './KpiKit'

// ── Status lenses ─────────────────────────────────────────────────────
// A missing status reads as Active, so every COI always lands in exactly one
// bar segment and the Active/Lost split adds up to the total.
const LENSES = [
  { key: 'active', label: 'Active', color: '#1b9254', desc: 'of total' },
  { key: 'lost', label: 'Lost', color: '#e74c3c', desc: 'of total' },
  { key: 'all', label: 'Total', color: '#1D64A8', desc: 'all COIs' },
]

const statusOf = (m) => m.status || 'Active'

const LENS_PREDICATE = {
  all: () => true,
  active: (m) => statusOf(m) === 'Active',
  lost: (m) => statusOf(m) === 'Lost',
}

// Display order for the COI-type breakdown; "Unspecified" collects rows with no
// coi_type so nothing is silently dropped from the count.
const TYPES = [
  { key: 'Advisor', label: 'Advisor' },
  { key: 'Accountant', label: 'Accountant' },
  { key: '', label: 'Unspecified' },
]

export default function CoiKpis({ members = [] }) {
  const [lens, setLens] = useState('active')

  // Headline counts always read off the FULL pool so the lens row stays stable
  // regardless of which lens is selected.
  const counts = useMemo(() => ({
    all: members.length,
    active: members.filter(LENS_PREDICATE.active).length,
    lost: members.filter(LENS_PREDICATE.lost).length,
  }), [members])

  // Everything below the hero re-scopes to the selected status.
  const scoped = useMemo(() => members.filter(LENS_PREDICATE[lens]), [members, lens])

  const typeCounts = useMemo(() => {
    const map = {}
    scoped.forEach((m) => { const k = m.coi_type || ''; map[k] = (map[k] || 0) + 1 })
    return map
  }, [scoped])

  const rows = TYPES
    .filter((t) => (typeCounts[t.key] || 0) > 0)
    .map((t) => ({ key: t.key || 'unspecified', label: t.label, count: typeCounts[t.key] }))

  const activeLens = LENSES.find((l) => l.key === lens)

  return (
    <div>
      <KpiHero
        title="COIs"
        subtitle="Centers of influence"
        lenses={LENSES}
        counts={counts}
        lens={lens}
        setLens={setLens}
        unitLabel="COIs"
      />

      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Left — the primary breakdown: large and wide. */}
        <div style={{ flex: '3 1 560px', minWidth: '300px' }}>
          <BreakdownCard
            title="By COI Type"
            count={scoped.length}
            activeLens={lens !== 'all' ? activeLens : null}
            onClearLens={() => setLens('all')}
          >
            {rows.length === 0 ? (
              <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--wig-faint)', fontSize: '14px' }}>
                No COIs match the <strong>{activeLens.label}</strong> status.
              </div>
            ) : (
              <BreakdownRows rows={rows} denom={scoped.length} />
            )}
          </BreakdownCard>
        </div>

        {/* Right — the Advisor / Accountant split (narrower, taller). */}
        <div style={{ flex: '1 1 240px', minWidth: '230px', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SplitDonut
            stack
            title="Advisors vs Accountants"
            total={scoped.length}
            segments={[
              { label: 'Advisor', n: typeCounts['Advisor'] || 0, color: '#2E86C7' },
              { label: 'Accountant', n: typeCounts['Accountant'] || 0, color: '#8a9bbd' },
              ...((typeCounts[''] || 0) > 0 ? [{ label: 'Unspecified', n: typeCounts[''], color: '#b9c6dd' }] : []),
            ]}
          />
        </div>
      </div>
    </div>
  )
}
