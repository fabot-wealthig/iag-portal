import { useEffect, useMemo, useState } from 'react'
import { callApi } from '../lib/api'
import { BreakdownCard } from './KpiKit'

// No status lens here: a mothership has no Active/Lost state to slice by, so
// the page is two headline counts and a flat per-firm breakdown rather than the
// hero + lens instrument panel the COI KPIs use.

const statCardStyle = { width: '190px', padding: '20px 18px 16px', background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', fontFamily: 'Inter, sans-serif' }
const statValueStyle = { fontSize: '34px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--wig-heading)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }
const statLabelStyle = { fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.9px', color: 'var(--wig-muted)', textTransform: 'uppercase', marginTop: '9px' }
const rowStyle = { display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', marginBottom: '6px', background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(20,45,95,0.04)' }
const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }

export default function MothershipKpis() {
  const [motherships, setMotherships] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    callApi('load_motherships')
      .then(data => { if (!cancelled) { setMotherships(data.motherships || []); setLoadError('') } })
      .catch(err => { if (!cancelled) setLoadError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // load_motherships already returns coi_count per row, so the COI total is a
  // sum of what is on screen rather than a second read of the roster.
  const totalCois = useMemo(
    () => motherships.reduce((sum, m) => sum + (m.coi_count || 0), 0),
    [motherships],
  )

  if (loading) return <div style={{ textAlign: 'center', fontSize: '13.5px', color: 'var(--wig-muted)', padding: '40px 0' }}>Loading...</div>

  if (loadError) {
    return (
      <div style={sectionStyle}>
        <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{loadError}</p>
      </div>
    )
  }

  const cards = [
    { label: 'Total Motherships', value: motherships.length },
    { label: 'Total COIs', value: totalCois },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '22px' }}>
        {cards.map(c => (
          <div key={c.label} style={statCardStyle}>
            <div style={statValueStyle}>{c.value}</div>
            <div style={statLabelStyle}>{c.label}</div>
          </div>
        ))}
      </div>

      <BreakdownCard title="By Mothership" count={motherships.length}>
        {motherships.length === 0 ? (
          <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--wig-faint)', fontSize: '14px' }}>
            No motherships yet.
          </div>
        ) : (
          <div style={{ marginTop: '10px' }}>
            {motherships.map(m => (
              <div key={m.number} style={rowStyle}>
                <span style={{ fontSize: '12px', color: 'var(--wig-muted)', width: '50px', flexShrink: 0, fontFamily: 'monospace' }}>{m.number}</span>
                <span style={{ fontSize: '14px', color: 'var(--wig-ink)', fontWeight: 600, flex: 1, minWidth: 0 }}>{m.name}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', color: 'var(--wig-muted)', flexShrink: 0 }}>
                  {m.coi_count} {m.coi_count === 1 ? 'COI' : 'COIs'}
                </span>
              </div>
            ))}
          </div>
        )}
      </BreakdownCard>
    </div>
  )
}
