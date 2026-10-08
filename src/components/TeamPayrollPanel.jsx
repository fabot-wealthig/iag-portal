import { Fragment, useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { AccountingPills } from './AccountingPaymentsPanel'
import { BackLink, Field, TrackHero } from './shared/TrackKit'
import { TableSkeleton } from './shared/Skeleton'
import { sandboxTagStyle } from '../lib/stripeMode'
import { longDay } from './PayrollReportPanel'

// Accounting → Team Payroll (internal team share, Phase D2) — SUPERADMINS ONLY (what
// staff earn; Portal mounts it for nobody else and every action refuses others). The
// payroll report drafted to Beth and Brittany: the next one, what is owed and not yet
// reported, and every report so far, each opening on its lines per employee with a
// Re-draft. Sandbox shares only ever go on a [SANDBOX] test report, drafted by hand.

const REPORT_KEY = 'wigTeamPayrollReport'

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '22px 24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }
const tableWrapStyle = { overflowX: 'auto', border: '1px solid var(--wig-border-soft)', borderRadius: '14px', background: 'var(--wig-card)', boxShadow: 'var(--wig-shadow-card)', marginBottom: '22px' }
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }
const thStyle = { textAlign: 'left', padding: '12px 18px', background: 'var(--wig-input)', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-muted)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '11px 18px', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '13px', color: 'var(--wig-ink)', whiteSpace: 'nowrap' }
const subTdStyle = { ...tdStyle, fontSize: '12px', color: 'var(--wig-muted)', background: 'var(--wig-tint)' }
const primaryButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#1D64A8', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const outlineButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const sectionTitleStyle = { fontSize: '15px', fontWeight: 700, color: 'var(--wig-heading)', margin: '6px 0 10px' }

const money = (n) => `$${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const shortDay = (d) => d ? new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const when = (t) => t ? new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

const STATUS = {
  drafted: { label: 'Drafted', color: '#1b9254' },
  draft_failed: { label: 'Draft failed', color: '#d93025' },
  empty: { label: 'Nothing to report', color: 'var(--wig-muted)' },
  building: { label: 'Building', color: '#EE6A33' },
}
const statusChip = (s) => {
  const v = STATUS[s] || { label: s, color: 'var(--wig-muted)' }
  return <span style={{ fontSize: '12px', fontWeight: 600, color: v.color }}>{v.label}</span>
}

export default function TeamPayrollPanel({ onSelectSection }) {
  const [reportId, setReportId] = useState(() => sessionStorage.getItem(REPORT_KEY) || null)
  function openReport(id) {
    setReportId(id)
    if (id) sessionStorage.setItem(REPORT_KEY, id)
    else sessionStorage.removeItem(REPORT_KEY)
    window.scrollTo(0, 0)
  }
  return reportId
    ? <ReportDetail reportId={reportId} onBack={() => openReport(null)} />
    : <PayrollHome onSelectSection={onSelectSection} onOpenReport={openReport} />
}

function PayrollHome({ onSelectSection, onOpenReport }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')
  const [expanded, setExpanded] = useState(null)

  async function load() {
    try { setData(await callApi('load_team_payroll')); setError('') } catch (err) { setError(err.message) }
  }
  useEffect(() => { load() }, [])

  async function draft(sandbox) {
    setBusy(sandbox ? 'sandbox' : 'live'); setMsg('')
    try {
      const r = await callApi('draft_team_payroll', sandbox ? { sandbox: true } : {}, { timeoutMs: 120000 })
      setMsgType('success')
      setMsg(r.status === 'empty' ? 'Nothing was owed, so no email was drafted.' : r.emailed ? 'Report sent. Open it below.' : 'Report drafted. Open it below, or check Gmail Drafts.')
      await load()
    } catch (err) {
      setMsgType('error'); setMsg(err.message); await load()
    } finally { setBusy(null) }
  }

  const next = data?.next_report
  return (
    <div>
      <TrackHero eyebrow="Accounting" title="Accounting" />
      <AccountingPills active="team_payroll" onSelect={onSelectSection} />
      {error ? <div style={sectionStyle}><p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{error}</p></div>
        : !data ? <TableSkeleton cols={6} rows={4} />
        : (
          <>
            <div style={sectionStyle}>
              <div style={eyebrowStyle}>Next report</div>
              <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
                <Field label="Period" value={next?.label} />
                <Field label="Drafted on" value={longDay(next?.dueOn)} />
                <Field label="Payments cleared through" value={longDay(next?.cutoff)} />
                <Field label="Schedule" value={data.settings.text} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" style={primaryButtonStyle} disabled={busy !== null} onClick={() => draft(false)}>
                  {busy === 'live' ? 'Drafting...' : 'Draft now'}
                </button>
                <button type="button" style={outlineButtonStyle} disabled={busy !== null} onClick={() => draft(true)}>
                  {busy === 'sandbox' ? 'Drafting...' : 'Draft sandbox test report'}
                </button>
                {msg && <span style={{ fontSize: '13px', color: msgType === 'success' ? '#1b9254' : '#d93025' }}>{msg}</span>}
              </div>
            </div>

            <div style={sectionTitleStyle}>Owed, not yet reported</div>
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead><tr>
                  <th style={thStyle}>Employee</th><th style={thStyle}>Shares</th><th style={thStyle}>On the next report</th><th style={thStyle}>Total owed</th>
                </tr></thead>
                <tbody>
                  {data.owed.length === 0 && <tr><td style={tdStyle} colSpan={4}>Nothing owed.</td></tr>}
                  {data.owed.map(e => (
                    <Fragment key={e.team_member_id}>
                      <tr onClick={() => setExpanded(x => x === e.team_member_id ? null : e.team_member_id)} style={{ cursor: 'pointer' }}>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{expanded === e.team_member_id ? '▾' : '▸'} {e.name}</td>
                        <td style={tdStyle}>{e.lines.length}</td>
                        <td style={tdStyle}>{money(e.next_total)}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{money(e.total)}</td>
                      </tr>
                      {expanded === e.team_member_id && e.lines.map(l => (
                        <tr key={l.share_id}>
                          <td style={subTdStyle}>{l.client_name} <span style={{ fontFamily: 'monospace' }}>{l.client_number}</span>{l.sandbox && <span style={{ ...sandboxTagStyle, marginLeft: '6px' }}>Sandbox</span>}</td>
                          <td style={subTdStyle}>{l.role}</td>
                          <td style={subTdStyle}>{l.next_report ? `Cleared ${shortDay(l.cleared_on)}` : `Waiting: ${l.waiting_because}`}</td>
                          <td style={subTdStyle}>{money(l.amount)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={sectionTitleStyle}>Reports</div>
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead><tr>
                  <th style={thStyle}>Period</th><th style={thStyle}>Cleared through</th><th style={thStyle}>Drafted</th><th style={thStyle}>Employees</th><th style={thStyle}>Shares</th><th style={thStyle}>Total</th><th style={thStyle}>Status</th>
                </tr></thead>
                <tbody>
                  {data.reports.length === 0 && <tr><td style={tdStyle} colSpan={7}>No reports yet.</td></tr>}
                  {data.reports.map(r => (
                    <tr key={r.id} onClick={() => onOpenReport(r.id)} style={{ cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--wig-tint)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{r.period_label}{r.sandbox && <span style={{ ...sandboxTagStyle, marginLeft: '8px' }}>Sandbox</span>}</td>
                      <td style={tdStyle}>{shortDay(r.cutoff_date)}</td>
                      <td style={tdStyle}>{when(r.drafted_at)}</td>
                      <td style={tdStyle}>{r.employee_count}</td>
                      <td style={tdStyle}>{r.share_count}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{money(r.total)}</td>
                      <td style={tdStyle}>{statusChip(r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
    </div>
  )
}

function ReportDetail({ reportId, onBack }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  async function load() {
    try { setData(await callApi('load_team_payroll', { report_id: reportId })); setError('') } catch (err) { setError(err.message) }
  }
  useEffect(() => { load() }, [reportId])

  async function redraft() {
    setBusy(true); setMsg('')
    try {
      const r = await callApi('draft_team_payroll', { report_id: reportId }, { timeoutMs: 120000 })
      setMsgType('success'); setMsg(r.emailed ? `Re-sent to ${r.to || 'Beth and Brittany'}.` : `Re-drafted to ${r.to || 'Beth and Brittany'}. Check Gmail Drafts.`)
      await load()
    } catch (err) {
      setMsgType('error'); setMsg(err.message); await load()
    } finally { setBusy(false) }
  }

  const r = data?.report
  return (
    <div>
      <TrackHero eyebrow="Team Payroll" title={r ? `${r.period_label} payroll report` : 'Payroll report'}
        meta={r ? <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>{statusChip(r.status)}{r.sandbox && <span style={sandboxTagStyle}>Sandbox</span>}</span> : null} />
      <BackLink label="← Back to Team Payroll" onClick={onBack} />
      {error ? <div style={sectionStyle}><p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{error}</p></div>
        : !data ? <TableSkeleton cols={6} rows={4} />
        : (
          <>
            <div style={sectionStyle}>
              <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
                <Field label="Payments cleared through" value={longDay(String(r.cutoff_date).slice(0, 10))} />
                <Field label="Drafted" value={when(r.drafted_at)} />
                <Field label="Times drafted" value={String(r.draft_count)} />
                <Field label="Employees" value={String(r.employee_count)} />
                <Field label="Shares" value={String(r.share_count)} />
                <Field label="Total" value={money(r.total)} />
              </div>
              {r.draft_error && <p style={{ color: '#d93025', fontSize: '13px', margin: '12px 0 0' }}>{r.draft_error}</p>}
              {r.status !== 'empty' && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" style={outlineButtonStyle} disabled={busy} onClick={redraft}>{busy ? 'Drafting...' : 'Re-draft email'}</button>
                  {msg && <span style={{ fontSize: '13px', color: msgType === 'success' ? '#1b9254' : '#d93025' }}>{msg}</span>}
                </div>
              )}
            </div>

            {data.employees.map(e => (
              <Fragment key={e.member_id}>
                <div style={sectionTitleStyle}>{e.name} · {money(e.total)}</div>
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead><tr>
                      <th style={thStyle}>Cleared</th><th style={thStyle}>Client</th><th style={thStyle}>Strategy</th><th style={thStyle}>Role</th><th style={thStyle}>Rate</th><th style={thStyle}>Base</th><th style={thStyle}>Amount</th>
                    </tr></thead>
                    <tbody>
                      {e.lines.map(l => (
                        <tr key={l.share_id}>
                          <td style={tdStyle}>{shortDay(l.cleared_on)}</td>
                          <td style={tdStyle}>{l.client_name}<div style={{ fontSize: '11px', color: 'var(--wig-muted)', fontFamily: 'monospace' }}>{l.client_number}</div></td>
                          <td style={tdStyle}>{l.strategy}</td>
                          <td style={tdStyle}>{l.role}{l.level != null ? ` (L${l.level})` : ''}</td>
                          <td style={tdStyle}>{Number(l.rate_pct.toFixed(3))}%</td>
                          <td style={tdStyle}>{money(l.base_amount)}<div style={{ fontSize: '11px', color: 'var(--wig-muted)' }}>{l.role_key === 'staff_coi' ? 'Available Revenue Pool' : 'Net Profit Pool'}</div></td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{money(l.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Fragment>
            ))}
          </>
        )}
    </div>
  )
}
