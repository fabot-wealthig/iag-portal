import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { ListHeader } from './shared/TrackKit'
import { ListHeaderSkeleton, TableSkeleton } from './shared/Skeleton'
import { formLabelStyle, InfoField, InfoGrid, ProfileCard } from './shared/ProfileKit'

// Automation & Config → Payroll Report (internal team share, Phase D2; Jake,
// 2026-10-06: the frequency is a setting). How often the payroll report is drafted
// to Beth and Brittany: monthly on a day (1–28) or weekly on a weekday. Superadmins
// only — Portal shows the entry to nobody else. Titles and fields only (Jake).

const selectStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const gradientButtonStyle = { padding: '10px 28px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }
const WEEKDAYS = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday']]

export const longDay = (d) => d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '—'

export default function PayrollReportPanel() {
  const [data, setData] = useState(null)
  const [form, setForm] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')
  const [reminding, setReminding] = useState(false)
  const [remindMsg, setRemindMsg] = useState('')
  const [remindType, setRemindType] = useState('success')

  async function remindNow() {
    setReminding(true); setRemindMsg('')
    try {
      const r = await callApi('draft_curator_reminder', {}, { timeoutMs: 60000 })
      setRemindType('success'); setRemindMsg(`Drafted to ${r.to} (${r.count} COI${r.count === 1 ? '' : 's'}). Check Gmail Drafts.`)
      take(await callApi('load_team_payroll'))
    } catch (err) {
      setRemindType('error'); setRemindMsg(err.message)
    } finally { setReminding(false) }
  }

  const take = (d) => {
    setData(d)
    setForm({ cadence: d.settings.cadence, report_day_of_month: String(d.settings.report_day_of_month), report_weekday: String(d.settings.report_weekday) })
  }

  useEffect(() => {
    let live = true
    callApi('load_team_payroll')
      .then(d => { if (live) take(d) })
      .catch(err => { if (live) setLoadError(err.message) })
    return () => { live = false }
  }, [])

  async function save() {
    setSaving(true); setMsg('')
    try {
      const d = await callApi('save_team_payroll_settings', {
        cadence: form.cadence,
        report_day_of_month: Number(form.report_day_of_month),
        report_weekday: Number(form.report_weekday),
      })
      take(d)
      setMsgType('success'); setMsg('Saved.')
    } catch (err) {
      setMsgType('error'); setMsg(err.message)
    } finally { setSaving(false) }
  }

  if (loadError) return <div><ListHeader title="Payroll Report" /><p style={{ color: '#d93025', fontSize: '13px' }}>{loadError}</p></div>
  if (!data || !form) return <div><ListHeaderSkeleton /><TableSkeleton cols={[1, 1, 1]} rows={2} /></div>

  const dirty = form.cadence !== data.settings.cadence ||
    (form.cadence === 'monthly' ? Number(form.report_day_of_month) !== data.settings.report_day_of_month : Number(form.report_weekday) !== data.settings.report_weekday)
  const next = data.next_report

  return (
    <div>
      <ListHeader title="Payroll Report" />
      <ProfileCard title="Schedule">
        <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 1 280px', minWidth: '220px' }}>
            <label style={formLabelStyle}>Frequency</label>
            <select value={form.cadence} onChange={e => setForm(f => ({ ...f, cadence: e.target.value }))} style={selectStyle}>
              <option value="monthly">Monthly on a day</option>
              <option value="weekly">Weekly on a weekday</option>
            </select>
          </div>
          <div style={{ flex: '0 1 220px', minWidth: '180px' }}>
            <label style={formLabelStyle}>{form.cadence === 'monthly' ? 'Day of the month' : 'Weekday'}</label>
            {form.cadence === 'monthly' ? (
              <select value={form.report_day_of_month} onChange={e => setForm(f => ({ ...f, report_day_of_month: e.target.value }))} style={selectStyle}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={String(d)}>{d}</option>)}
              </select>
            ) : (
              <select value={form.report_weekday} onChange={e => setForm(f => ({ ...f, report_weekday: e.target.value }))} style={selectStyle}>
                {WEEKDAYS.map(([v, l]) => <option key={v} value={String(v)}>{l}</option>)}
              </select>
            )}
          </div>
        </div>
        <div style={{ marginTop: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={save} disabled={saving || !dirty} style={{ ...gradientButtonStyle, opacity: saving || !dirty ? 0.55 : 1, cursor: saving || !dirty ? 'default' : 'pointer' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          {msg && <span style={{ color: msgType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px' }}>{msg}</span>}
        </div>
      </ProfileCard>

      <ProfileCard title="Curator Review Reminder">
        <InfoGrid>
          <InfoField label="Last sent">{data.curator_reminder?.last_period ? new Date(`${data.curator_reminder.last_period}-01T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }) : 'Never'}</InfoField>
          <InfoField label="COIs behind">{String(data.curator_reminder?.overdue?.length ?? 0)}</InfoField>
        </InfoGrid>
        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <button onClick={remindNow} disabled={reminding} style={{ ...gradientButtonStyle, opacity: reminding ? 0.55 : 1 }}>
            {reminding ? 'Drafting...' : 'Draft reminder now'}
          </button>
          {remindMsg && <span style={{ color: remindType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px' }}>{remindMsg}</span>}
        </div>
      </ProfileCard>

      <ProfileCard title="Next Report">
        <InfoGrid>
          <InfoField label="Period">{next?.label}</InfoField>
          <InfoField label="Drafted on">{longDay(next?.dueOn)}</InfoField>
          <InfoField label="Payments cleared through">{longDay(next?.cutoff)}</InfoField>
        </InfoGrid>
      </ProfileCard>
    </div>
  )
}
