import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'

// The internal team share rates (Automation & Config → Team Share Rates), read once
// per page load and shared by every screen that labels a level with its percent.
// `setTeamRatesCache` replaces the copy after a save.

let cache = null
let inflight = null

function fetchRates() {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = callApi('load_team_share_rates')
      .then(d => { cache = d.rates || null; return cache })
      .finally(() => { inflight = null })
  }
  return inflight
}

export function setTeamRatesCache(rates) { cache = rates }

export function useTeamRates() {
  const [rates, setRates] = useState(cache)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    fetchRates().then(r => { if (live) setRates(r) }).catch(err => { if (live) setError(err.message) })
    return () => { live = false }
  }, [])
  return { rates, error }
}

// "7.5%", or nothing while the rates are still loading.
export const pct = (v) => (v == null || Number.isNaN(Number(v)) ? '' : `${Number(v)}%`)
const withPct = (label, v) => (v == null ? label : `${label} (${pct(v)})`)

// The pick-lists the Team screen shows, labelled with the CURRENT rates.
export function levelOptions(rates) {
  const r = rates || {}
  return {
    advisor: [0, 1, 2, 3, 4].map(n => ({ value: n, label: withPct(`Level ${n}`, r[`advisor_level_${n}`]) })),
    is: [1, 2, 3, 4].map(n => ({ value: n, label: withPct(`Level ${n}`, r[`is_level_${n}`]) })),
    manager: [
      { value: 'qualified', label: withPct('Qualified advisor', r.manager_qualified) },
      { value: 'non_advisor', label: withPct('Non-advisor', r.manager_non_advisor) },
    ],
    curator: withPct('COI Curator', r.curator),
  }
}
