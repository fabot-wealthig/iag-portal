import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'

// Client Liaisons (IAG 2026-11-19): one read of load_liaisons per page load,
// shared by every picker and card on screen (TeamPicker's shape); `reloadLiaisons`
// drops it after a liaison is saved or a client's liaison changes.

let cache = null
let inflight = null

function fetchLiaisons() {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = callApi('load_liaisons')
      .then(d => { cache = d.liaisons || []; return cache })
      .finally(() => { inflight = null })
  }
  return inflight
}

export function reloadLiaisons() { cache = null }

export function useLiaisons(refreshKey) {
  const [liaisons, setLiaisons] = useState(cache)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    fetchLiaisons().then(l => { if (live) setLiaisons(l) }).catch(err => { if (live) setError(err.message) })
    return () => { live = false }
  }, [refreshKey])
  return { liaisons, error }
}

export const liaisonById = (liaisons, id) => (id ? (liaisons || []).find(l => l.id === id) || null : null)

// The liaisons who work with one COI — the only ones a client of that COI can have.
export const liaisonsForCoi = (liaisons, memberNumber) =>
  (liaisons || []).filter(l => l.cois.some(c => c.member_number === memberNumber))

export default function LiaisonPicker({ memberNumber, value, onChange, liaisons, style, disabled }) {
  const eligible = liaisonsForCoi(liaisons, memberNumber).filter(l => l.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name))
  // The client's current liaison stays visible even if deactivated since, so
  // opening the form never silently changes it.
  const current = value && !eligible.some(l => l.id === value) ? liaisonById(liaisons, value) : null
  const placeholder = liaisons === null
    ? 'Loading liaisons...'
    : !memberNumber ? 'Pick the COI first' : eligible.length === 0 ? 'No liaison works with this COI' : 'No liaison'
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)} style={style}
      disabled={disabled || liaisons === null || !memberNumber}>
      <option value="">{placeholder}</option>
      {eligible.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
      {current && <option value={current.id}>{current.name} (inactive)</option>}
    </select>
  )
}
