import TeamPicker, { teamName } from './TeamPicker'

// A COI's manager (internal team share, Phase A): a Team roster person, and — when
// that person is a COI Curator holding this COI as one — the tax year they hold it
// for (Brittany, 2026-10-05: reviewed every January). Replaces the free-text
// manager pick-list. Used by Add COI and the COI's Edit Profile.

const thisYear = () => new Date().getFullYear()

export function curatorOverdue(year) {
  return year != null && Number(year) < thisYear()
}

export const overdueChipStyle = { display: 'inline-block', marginLeft: '8px', padding: '2px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: 'rgba(238,106,51,0.12)', color: '#EE6A33', verticalAlign: 'middle' }

// Read-only: "Ashley Herbert" and, for a curated COI, "Curator · Tax Year 2026"
// with an orange chip once that year has passed and nobody has reviewed it.
export function CoiManagerText({ team, managerId, taxYear }) {
  const name = teamName(team, managerId)
  if (!name) return null
  return (
    <>
      {name}
      {taxYear != null && (
        <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--wig-muted)', marginTop: '3px' }}>
          Curator · Tax Year {taxYear}
          {curatorOverdue(taxYear) && <span style={overdueChipStyle}>Curator review overdue</span>}
        </div>
      )}
    </>
  )
}

export default function CoiManagerFields({ team, managerId, taxYear, onChange, selectStyle, inputStyle, labelStyle }) {
  const person = (team || []).find(t => t.id === managerId)
  const canCurate = person?.is_curator === true
  const curated = taxYear != null && taxYear !== ''

  function pick(id) {
    const next = (team || []).find(t => t.id === id)
    // A tax year only means something on a curator; switching to someone else clears it.
    onChange({ managerId: id, taxYear: next?.is_curator ? taxYear : null })
  }

  return (
    <div>
      <label style={labelStyle}>COI Manager</label>
      <TeamPicker role="manager" value={managerId} onChange={pick} team={team} style={selectStyle} placeholder="No COI manager" />
      {canCurate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: 'var(--wig-ink)', cursor: 'pointer' }}>
            <input type="checkbox" checked={curated} style={{ accentColor: '#1D64A8', cursor: 'pointer' }}
              onChange={e => onChange({ managerId, taxYear: e.target.checked ? thisYear() : null })} />
            Held as Curator for tax year
          </label>
          {curated && (
            <input type="number" min={2020} max={2100} value={taxYear} style={{ ...inputStyle, width: '100px' }}
              onChange={e => onChange({ managerId, taxYear: e.target.value === '' ? '' : Number(e.target.value) })} />
          )}
          {curated && curatorOverdue(taxYear) && <span style={overdueChipStyle}>Review overdue — renew or hand off</span>}
        </div>
      )}
    </div>
  )
}
