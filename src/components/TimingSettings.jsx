import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'

// Notification Editor → Timing (Jake, 2026-10-07; VFO's per-rule delay_days): how
// long each timed step of the morning payment check waits — the reminder emails,
// the follow-up bells and the stuck-item alarms. A save takes effect on the next
// morning run; nothing is deployed. Superadmins only, like the editor.

const groupStyle = { marginBottom: '12px', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', overflow: 'hidden', background: 'var(--wig-card)', boxShadow: 'var(--wig-shadow-card)' }
const countBadgeStyle = { fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', color: 'var(--wig-muted)' }
const inputStyle = { width: '64px', padding: '7px 9px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '13px', fontFamily: 'Inter, sans-serif', textAlign: 'right' }
const saveButtonStyle = { padding: '7px 18px', borderRadius: '8px', border: 'none', background: '#1D64A8', color: '#fff', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const resetButtonStyle = { padding: '7px 18px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }

const unitText = (n, unit) => `${unit === 'business' ? 'business ' : ''}day${Number(n) === 1 ? '' : 's'}`

export default function TimingSettings() {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState(null)
  const [draft, setDraft] = useState({})
  const [limits, setLimits] = useState({ min: 1, max: 60 })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    callApi('load_reminder_timing')
      .then(apply)
      .catch(err => setError(err.message))
  }, [])

  function apply(data) {
    const list = data.timing || []
    setRows(list)
    setDraft(Object.fromEntries(list.map(r => [r.key, String(r.days)])))
    setLimits({ min: data.min ?? 1, max: data.max ?? 60 })
  }

  const changed = (rows || []).filter(r => draft[r.key] !== String(r.days))
  const editedCount = (rows || []).filter(r => r.days !== r.default_days).length
  const invalid = changed.find(r => {
    const n = Number(draft[r.key])
    return !Number.isInteger(n) || n < limits.min || n > limits.max
  })

  async function save(reset) {
    setSaving(true); setMsg(''); setError('')
    try {
      const payload = reset ? { reset: true } : { days: Object.fromEntries(changed.map(r => [r.key, Number(draft[r.key])])) }
      apply(await callApi('save_reminder_timing', payload))
      setMsg(reset ? 'Every step is back to its default.' : 'Saved. The next morning run uses these.')
      setTimeout(() => setMsg(''), 4000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={groupStyle}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', background: open ? 'var(--wig-tint)' : 'var(--wig-input)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '10px', color: 'var(--wig-primary)', display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--wig-heading)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Timing</span>
          {editedCount > 0 && <span style={{ fontSize: '10px', fontWeight: 700, color: '#EE6A33' }}>{editedCount} edited</span>}
        </div>
        {rows && <span style={countBadgeStyle}>{rows.length}</span>}
      </div>
      {open && (
        <div style={{ padding: '14px 18px 16px' }}>
          <p style={{ fontSize: '12.5px', color: 'var(--wig-muted)', margin: '0 0 12px', lineHeight: 1.6 }}>
            How long each timed step of the morning payment check waits. Business days skip weekends. A change takes
            effect on the next morning run (6, 8 and 10 AM Eastern). Each reminder email follows its template&rsquo;s Draft / Send switch.
          </p>
          {error && <div style={{ color: '#d93025', fontSize: '13px', marginBottom: '10px' }}>{error}</div>}
          {!rows ? (
            !error && <p style={{ fontSize: '13px', color: 'var(--wig-muted)', margin: 0 }}>Loading…</p>
          ) : (
            <>
              {rows.map(r => {
                const edited = r.days !== r.default_days
                return (
                  <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 0', borderBottom: '1px solid var(--wig-border-soft)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--wig-ink)' }}>
                        {r.label}{edited && <span style={{ fontSize: '10px', fontWeight: 700, color: '#EE6A33', marginLeft: '8px' }}>edited · default {r.default_days}</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--wig-muted)', marginTop: '2px', lineHeight: 1.5 }}>{r.description}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                      <input type="number" min={limits.min} max={limits.max} step={1} value={draft[r.key] ?? ''}
                        onChange={e => setDraft(d => ({ ...d, [r.key]: e.target.value }))} style={inputStyle} />
                      <span style={{ fontSize: '12.5px', color: 'var(--wig-muted)', width: '92px' }}>{unitText(draft[r.key], r.unit)}</span>
                    </div>
                  </div>
                )
              })}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => save(false)} disabled={saving || changed.length === 0 || !!invalid}
                  style={{ ...saveButtonStyle, opacity: saving || changed.length === 0 || invalid ? 0.5 : 1 }}>
                  {saving ? 'Saving...' : 'Save timing'}
                </button>
                <button type="button" onClick={() => save(true)} disabled={saving || editedCount === 0}
                  style={{ ...resetButtonStyle, opacity: saving || editedCount === 0 ? 0.5 : 1 }}>
                  Reset all to default
                </button>
                {invalid && <span style={{ fontSize: '12.5px', color: '#d93025' }}>Each wait must be a whole number from {limits.min} to {limits.max}.</span>}
                {msg && <span style={{ fontSize: '12.5px', color: '#1b9254' }}>{msg}</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
