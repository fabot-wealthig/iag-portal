import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'

// The Team roster as pick-lists (internal team share, Phase A): a COI's manager,
// a client's or payment's Advisor and Implementation Specialist. One read of
// load_team_members per page load, shared by every picker on screen; `reloadTeam`
// drops it after the roster changes.

let cache = null
let inflight = null

function fetchTeam() {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = callApi('load_team_members')
      .then(d => { cache = d.team || []; return cache })
      .finally(() => { inflight = null })
  }
  return inflight
}

export function reloadTeam() { cache = null }

export function useTeamRoster() {
  const [team, setTeam] = useState(cache)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    fetchTeam().then(t => { if (live) setTeam(t) }).catch(err => { if (live) setError(err.message) })
    return () => { live = false }
  }, [])
  return { team, error }
}

// Who may sit in each slot — mirrors utils/team-assign.ts on the server.
const HOLDS = {
  advisor: m => m.advisor_level != null,
  is: m => m.is_level != null,
  manager: m => m.coi_manager_tier != null || m.is_curator === true,
}

const NO_ADVISOR_NOTE = 'no advisor'

export function teamName(team, id) {
  if (!id) return null
  const m = (team || []).find(t => t.id === id)
  return m ? m.name : 'Unknown team member'
}

// The label a person carries in a picker and on a profile. Level 0 on the
// advisor slot is the roster's "no advisor" stand-in (Brittany's doc).
export function teamLabel(team, id, role) {
  const m = (team || []).find(t => t.id === id)
  if (!m) return id ? 'Unknown team member' : null
  if (role === 'advisor' && m.advisor_level === 0) return `${m.name} (${NO_ADVISOR_NOTE})`
  return m.name
}

export default function TeamPicker({ role, value, onChange, team, style, placeholder = '-- Select --', disabled }) {
  const eligible = (team || []).filter(m => m.active !== false && HOLDS[role](m))
  // A person already on the record who has since left the role or gone inactive
  // still shows, so opening a form never silently changes who is assigned.
  const current = value && !eligible.some(m => m.id === value) ? (team || []).find(m => m.id === value) : null
  const options = [...eligible].sort((a, b) => {
    // The "no advisor" stand-in sorts last on the advisor slot.
    if (role === 'advisor' && (a.advisor_level === 0) !== (b.advisor_level === 0)) return a.advisor_level === 0 ? 1 : -1
    return a.name.localeCompare(b.name)
  })
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)} style={style} disabled={disabled || team === null}>
      <option value="">{team === null ? 'Loading team...' : placeholder}</option>
      {options.map(m => <option key={m.id} value={m.id}>{teamLabel(team, m.id, role)}</option>)}
      {current && <option value={current.id}>{current.name} (no longer eligible)</option>}
    </select>
  )
}
