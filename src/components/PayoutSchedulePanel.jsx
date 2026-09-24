import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { TrackHero } from './shared/TrackKit'
import { SkeletonCard } from './shared/Skeleton'
import {
  cadenceText, describePayoutEvent, ordinal, payDateShort, relativeDay,
  PAYOUT_BLUE, PAYOUT_GREEN, PAYOUT_ORANGE, PAYOUT_RED, WEEKDAYS, whenText,
} from '../lib/payoutText'

// Automation & Config → Payout Schedule — WHEN revenue shares and payee fees go
// out. One default cadence plus dated windows that override it (weekly through
// Q4). Any admin may edit it (Jake, 2026-09-24).
//
// A SAVE IS TWO STEPS ON PURPOSE. "Review changes" asks the server what the new
// schedule would do — the next pay dates, and every waiting payment it would move
// from one date to another — and nothing is written until the admin confirms
// that list. A change to when money goes out should never be a surprise.

const inputStyle = { padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const labelStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)', marginBottom: '6px', display: 'block' }
const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }
const gradientButtonStyle = { padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const outlineButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const textButtonStyle = { background: 'none', border: 'none', padding: 0, color: PAYOUT_RED, fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const dateChipStyle = { fontSize: '12px', fontWeight: 600, color: 'var(--wig-ink)', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '999px', padding: '4px 11px', whiteSpace: 'nowrap' }

function toForm(row) {
  return {
    cadence: row?.cadence || 'monthly',
    pay_day_of_month: row?.pay_day_of_month ?? 15,
    pay_weekday: row?.pay_weekday ?? 5,
  }
}

function toPayload(c) {
  return c.cadence === 'weekly'
    ? { cadence: 'weekly', pay_weekday: Number(c.pay_weekday) }
    : { cadence: 'monthly', pay_day_of_month: Number(c.pay_day_of_month) }
}

// The cadence controls, shared by the default and every window.
function CadenceFields({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
      <select value={value.cadence} onChange={e => onChange({ ...value, cadence: e.target.value })} style={inputStyle}>
        <option value="monthly">Monthly</option>
        <option value="weekly">Weekly</option>
      </select>
      {value.cadence === 'monthly' ? (
        <>
          <span style={{ fontSize: '13px', color: 'var(--wig-muted)' }}>on the</span>
          <select value={value.pay_day_of_month} onChange={e => onChange({ ...value, pay_day_of_month: Number(e.target.value) })} style={inputStyle}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{ordinal(d)}</option>)}
          </select>
          <span style={{ fontSize: '13px', color: 'var(--wig-muted)' }}>for business cleared the prior month</span>
        </>
      ) : (
        <>
          <span style={{ fontSize: '13px', color: 'var(--wig-muted)' }}>every</span>
          <select value={value.pay_weekday} onChange={e => onChange({ ...value, pay_weekday: Number(e.target.value) })} style={inputStyle}>
            {WEEKDAYS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
          <span style={{ fontSize: '13px', color: 'var(--wig-muted)' }}>for business cleared the prior Monday to Sunday</span>
        </>
      )}
    </div>
  )
}

export default function PayoutSchedulePanel() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saved, setSaved] = useState(null) // the last load_payout_schedule answer
  const [def, setDef] = useState(toForm(null))
  const [windows, setWindows] = useState([])
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => { load() }, [])

  function applySaved(data) {
    setSaved(data)
    setDef(toForm(data.default))
    setWindows((data.windows || []).map(w => ({ ...toForm(w), starts_on: w.starts_on, ends_on: w.ends_on, label: w.label || '' })))
  }

  async function load() {
    try {
      applySaved(await callApi('load_payout_schedule'))
      setLoadError('')
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function payload() {
    return {
      default: toPayload(def),
      windows: windows.map(w => ({ ...toPayload(w), starts_on: w.starts_on, ends_on: w.ends_on, label: w.label })),
    }
  }

  function edited(fn) {
    fn()
    setPreview(null); setMessage(''); setError('')
  }

  async function review() {
    setBusy(true); setError(''); setMessage('')
    try {
      // A write action by name, but `preview: true` writes nothing. Still never
      // retried: lib/api.js retries only load_* actions.
      setPreview(await callApi('save_payout_schedule', { ...payload(), preview: true }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function confirmSave() {
    setBusy(true); setError('')
    try {
      const res = await callApi('save_payout_schedule', payload())
      applySaved(res)
      setPreview(null)
      const n = Number(res.redated || 0)
      setMessage(`Schedule saved. ${n === 0 ? 'No waiting payments changed date.' : `${n} waiting ${n === 1 ? 'payment was' : 'payments were'} moved to a new date; each one's history shows the move.`}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div>
        <TrackHero eyebrow="Automation & Config" title="Payout Schedule" />
        <SkeletonCard rows={4} />
      </div>
    )
  }

  const today = saved?.today

  return (
    <div>
      <TrackHero eyebrow="Automation & Config" title="Payout Schedule" />

      {loadError ? (
        <div style={sectionStyle}><p style={{ color: PAYOUT_RED, fontSize: '13px', margin: 0 }}>{loadError}</p></div>
      ) : (
        <>
          {/* ─── How it works, and what it produces ─────────────────────── */}
          <div style={sectionStyle}>
            <div style={eyebrowStyle}>How payouts are timed</div>
            <p style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--wig-ink)', margin: '0 0 14px' }}>
              When a payment clears, the portal works out everyone's share straight away and gives the payment a <strong>pay date</strong> from
              this schedule. On that date, in the 6:00 AM Eastern run, the COI's revenue share and any legal or administration fee go out
              automatically. A pay date on a weekend or bank holiday moves to the next business day. Any payment can still be paid early or
              put on hold from its own screen.
            </p>
            <div style={labelStyle}>Next pay dates under the saved schedule</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(saved?.upcoming_pay_dates || []).map(d => (
                <span key={d} style={dateChipStyle}>{payDateShort(d)} <span style={{ color: 'var(--wig-muted)', fontWeight: 400 }}>({relativeDay(d, today)})</span></span>
              ))}
            </div>
          </div>

          {/* ─── The editor ─────────────────────────────────────────────── */}
          <div style={sectionStyle}>
            <div style={eyebrowStyle}>Standard schedule</div>
            <p style={{ fontSize: '12.5px', color: 'var(--wig-muted)', margin: '0 0 12px' }}>Used on every day no window below covers.</p>
            <CadenceFields value={def} onChange={v => edited(() => setDef(v))} />

            <div style={{ ...eyebrowStyle, marginTop: '28px' }}>Date windows</div>
            <p style={{ fontSize: '12.5px', color: 'var(--wig-muted)', margin: '0 0 12px' }}>
              A window overrides the standard schedule for business that clears between its two dates, for example weekly payouts through Q4.
              Windows may not overlap.
            </p>
            {windows.length === 0 && <p style={{ fontSize: '13px', color: 'var(--wig-muted)', margin: '0 0 12px' }}>No windows. The standard schedule applies every day.</p>}
            {windows.map((w, i) => (
              <div key={i} style={{ border: '1px solid var(--wig-border-soft)', borderRadius: '12px', padding: '14px 16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '10px' }}>
                  <div>
                    <label style={labelStyle}>From</label>
                    <input type="date" value={w.starts_on || ''} onChange={e => edited(() => setWindows(ws => ws.map((x, j) => j === i ? { ...x, starts_on: e.target.value } : x)))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>To</label>
                    <input type="date" value={w.ends_on || ''} onChange={e => edited(() => setWindows(ws => ws.map((x, j) => j === i ? { ...x, ends_on: e.target.value } : x)))} style={inputStyle} />
                  </div>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <label style={labelStyle}>Label (optional)</label>
                    <input type="text" value={w.label} maxLength={120} placeholder="e.g. Q4 weekly" onChange={e => edited(() => setWindows(ws => ws.map((x, j) => j === i ? { ...x, label: e.target.value } : x)))} style={{ ...inputStyle, width: '100%' }} />
                  </div>
                  <button type="button" style={textButtonStyle} onClick={() => edited(() => setWindows(ws => ws.filter((_, j) => j !== i)))}>Remove</button>
                </div>
                <CadenceFields value={w} onChange={v => edited(() => setWindows(ws => ws.map((x, j) => j === i ? { ...x, ...v } : x)))} />
              </div>
            ))}
            <button type="button" style={outlineButtonStyle}
              onClick={() => edited(() => setWindows(ws => [...ws, { cadence: 'weekly', pay_weekday: 5, pay_day_of_month: 15, starts_on: today || '', ends_on: '', label: '' }]))}>
              + Add a window
            </button>

            <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--wig-border-soft)', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {!preview && (
                <button type="button" disabled={busy} onClick={review} style={{ ...gradientButtonStyle, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
                  {busy ? 'Checking...' : 'Review changes'}
                </button>
              )}
              <span style={{ fontSize: '12px', color: 'var(--wig-muted)' }}>Nothing is saved until you confirm on the next step.</span>
            </div>

            {/* ─── The confirmation: exactly what this save will do ──────── */}
            {preview && (
              <div style={{ marginTop: '18px', padding: '18px', borderRadius: '12px', border: `1px solid ${PAYOUT_BLUE}`, background: 'var(--wig-tint)' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--wig-heading)', marginBottom: '10px' }}>Confirm the new schedule</div>
                <div style={labelStyle}>Next pay dates after this change</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {(preview.upcoming_pay_dates || []).map(d => <span key={d} style={dateChipStyle}>{payDateShort(d)}</span>)}
                </div>
                <div style={labelStyle}>Payments that will change date</div>
                {(preview.changes || []).length === 0 ? (
                  <p style={{ fontSize: '13px', color: PAYOUT_GREEN, fontWeight: 600, margin: '0 0 14px' }}>None. Every payment already waiting keeps its current pay date.</p>
                ) : (
                  <div style={{ marginBottom: '14px' }}>
                    <p style={{ fontSize: '13px', color: PAYOUT_ORANGE, fontWeight: 600, margin: '0 0 8px' }}>
                      {preview.changes.length} waiting {preview.changes.length === 1 ? 'payment' : 'payments'} will move:
                    </p>
                    {preview.changes.map(c => (
                      <div key={c.payment_id} style={{ display: 'flex', gap: '12px', padding: '6px 0', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '13px', flexWrap: 'wrap' }}>
                        <span style={{ flex: 1, minWidth: '180px' }}>{c.client_name || '—'} <span style={{ fontFamily: 'monospace', color: 'var(--wig-muted)', fontSize: '12px' }}>{c.client_number}</span></span>
                        <span style={{ color: 'var(--wig-muted)' }}>{payDateShort(c.from_date)}</span>
                        <span style={{ color: 'var(--wig-muted)' }}>→</span>
                        <span style={{ fontWeight: 600 }}>{payDateShort(c.to_date)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{ fontSize: '12px', color: 'var(--wig-muted)', margin: '0 0 12px' }}>
                  Payments already due, on hold, or paid early keep their dates. The change and every move are recorded in the payout history.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" disabled={busy} onClick={confirmSave} style={{ ...gradientButtonStyle, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
                    {busy ? 'Saving...' : 'Confirm and save'}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setPreview(null)} style={outlineButtonStyle}>Back to editing</button>
                </div>
              </div>
            )}

            {message && <p style={{ color: PAYOUT_GREEN, fontSize: '13px', marginTop: '14px', marginBottom: 0 }}>{message}</p>}
            {error && <p style={{ color: PAYOUT_RED, fontSize: '13px', marginTop: '14px', marginBottom: 0 }}>{error}</p>}
          </div>

          {/* ─── Who changed it, and when ─────────────────────────────── */}
          <div style={sectionStyle}>
            <div style={eyebrowStyle}>Change log</div>
            {(saved?.changes || []).length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--wig-muted)', margin: 0 }}>No changes yet. The schedule is as first set up.</p>
            ) : (
              saved.changes.map(c => (
                <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--wig-border-soft)' }}>
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: 'var(--wig-muted)', width: '150px', flexShrink: 0 }}>{whenText(c.created_at)}</span>
                    <span style={{ fontSize: '13px', color: 'var(--wig-ink)', flex: 1 }}>{describePayoutEvent({ ...c, event: 'schedule_changed' })}</span>
                  </div>
                  <ScheduleDiff detail={c.detail} />
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

// Before and after, in words, so the log says WHAT changed and not only that
// something did.
function ScheduleDiff({ detail }) {
  if (!detail?.before || !detail?.after) return null
  const describe = (rows) => rows.map(r => r.kind === 'default'
    ? `Standard: ${cadenceText(r)}`
    : `${payDateShort(r.starts_on)} to ${payDateShort(r.ends_on)}: ${cadenceText(r)}`)
  const before = describe(detail.before)
  const after = describe(detail.after)
  return (
    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '6px', marginLeft: '164px' }}>
      <div style={{ minWidth: '220px' }}>
        <div style={{ ...labelStyle, marginBottom: '2px' }}>Before</div>
        {before.map((t, i) => <div key={i} style={{ fontSize: '12px', color: 'var(--wig-muted)' }}>{t}</div>)}
      </div>
      <div style={{ minWidth: '220px' }}>
        <div style={{ ...labelStyle, marginBottom: '2px' }}>After</div>
        {after.map((t, i) => <div key={i} style={{ fontSize: '12px', color: 'var(--wig-ink)' }}>{t}</div>)}
      </div>
    </div>
  )
}
