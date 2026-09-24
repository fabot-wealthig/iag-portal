import { useState } from 'react'

// The COI Manager as a pick-list (Jake, 2026-09-24: "a list instead of typing"):
// the IAG staff already managing COIs, read off the roster so the list grows on
// its own, plus "Add a new manager…" for someone who manages nobody yet — which
// reveals a text box. The value is still the plain name the server stores.

export function managerOptions(members = []) {
  return [...new Set(members.map(m => String(m.coi_manager || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
}

const NEW = '__new__'

export default function CoiManagerSelect({ value, onChange, members = [], selectStyle, inputStyle }) {
  const options = managerOptions(members)
  const current = String(value || '').trim()
  // A typed name not yet on anyone keeps the text box open.
  const [adding, setAdding] = useState(current !== '' && !options.includes(current))

  return (
    <>
      <select
        value={adding ? NEW : current}
        onChange={e => {
          if (e.target.value === NEW) { setAdding(true); onChange('') }
          else { setAdding(false); onChange(e.target.value) }
        }}
        style={selectStyle}>
        <option value="">-- Select --</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
        <option value={NEW}>+ Add a new manager…</option>
      </select>
      {adding && (
        <input value={value} onChange={e => onChange(e.target.value)} placeholder="New manager's name" autoFocus
          style={{ ...inputStyle, marginTop: '8px' }} />
      )}
    </>
  )
}
