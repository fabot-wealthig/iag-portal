import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import PaymentDetail from './PaymentDetail'
import { AccountingPills } from './AccountingPaymentsPanel'
import { NameLink, TrackHero } from './shared/TrackKit'
import { TableSkeleton } from './shared/Skeleton'
import { sandboxTagStyle } from '../lib/stripeMode'
import PayoutPill from './shared/PayoutPill'
import CoiName from './shared/CoiName'
import {
  cadenceText, describePayoutEvent, moneyText, payDateLong, payDateShort, relativeDay,
  PAYOUT_BLUE, PAYOUT_EVENT_LABEL, PAYOUT_GREEN, PAYOUT_ORANGE, PAYOUT_RED, TRANSFER_KIND_LABEL, whenText,
} from '../lib/payoutText'

// Accounting → Payouts — every revenue share and payee fee still owed, grouped
// by the day it goes out, plus what went out recently and every change to a
// date. The one screen that answers "what is being paid, to whom, and when?"
// (Jake, 2026-09-24: when payments go, and any change to that, must be plain).

// The open payment — the same key Accounting → Payments writes; only one of
// the two panels mounts at a time and Portal's nav clears it between them.
const SELECTED_PAYMENT_KEY = 'wigSelectedPayment'
// Which of the three views is showing, so a refresh lands on it (UI rule 5).
const VIEW_KEY = 'wigPayoutsView'

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '22px 24px', marginBottom: '20px' }
const tableWrapStyle = { overflowX: 'auto', border: '1px solid var(--wig-border-soft)', borderRadius: '14px', background: 'var(--wig-card)', boxShadow: 'var(--wig-shadow-card)', marginBottom: '22px' }
const tableStyle = { width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', fontFamily: 'Inter, sans-serif' }
const thStyle = { textAlign: 'left', padding: '12px 18px', background: 'var(--wig-input)', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-muted)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '12px 18px', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '13px', color: 'var(--wig-ink)', verticalAlign: 'middle', whiteSpace: 'nowrap' }
const chipStyle = (color) => ({ fontSize: '11px', fontWeight: 600, color, background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '999px', padding: '2px 9px', whiteSpace: 'nowrap' })
const viewPillStyle = (active) => ({ padding: '6px 14px', background: active ? 'var(--wig-heading)' : 'transparent', border: active ? 'none' : '1px solid var(--wig-border-mid)', borderRadius: '999px', color: active ? '#ffffff' : 'var(--wig-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' })

const VIEWS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'paid', label: 'Paid' },
  { key: 'changes', label: 'Changes' },
]

const sum = (lines) => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)

export default function PayoutsPanel({ onSelectSection, onOpenCoi, onOpenClient, onOpenReceipt }) {
  const [data, setData] = useState(null)
  const [schedule, setSchedule] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [view, setView] = useState(() => sessionStorage.getItem(VIEW_KEY) || 'upcoming')
  const [selectedPaymentId, setSelectedPaymentId] = useState(() => sessionStorage.getItem(SELECTED_PAYMENT_KEY) || null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [payouts, sched] = await Promise.all([callApi('load_payouts'), callApi('load_payout_schedule')])
      setData(payouts)
      setSchedule(sched)
      setLoadError('')
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function chooseView(key) {
    setView(key)
    sessionStorage.setItem(VIEW_KEY, key)
  }

  function openPayment(id) {
    setSelectedPaymentId(id)
    if (id == null) sessionStorage.removeItem(SELECTED_PAYMENT_KEY)
    else sessionStorage.setItem(SELECTED_PAYMENT_KEY, String(id))
    window.scrollTo(0, 0)
  }

  if (selectedPaymentId) {
    return (
      <PaymentDetail
        paymentId={selectedPaymentId}
        backLabel="← Back to payouts"
        onBack={() => { openPayment(null); load() }}
        onOpenReceipt={onOpenReceipt}
      />
    )
  }

  const today = data?.today
  const lines = data?.lines || []
  const held = lines.filter(l => l.status === 'on_hold')
  const due = lines.filter(l => l.status === 'due')
  const scheduled = lines.filter(l => l.status === 'scheduled')
  // Scheduled lines by pay date, soonest first.
  const byDate = new Map()
  for (const l of scheduled) {
    const list = byDate.get(l.pay_date) || []
    list.push(l)
    byDate.set(l.pay_date, list)
  }
  const dates = [...byDate.keys()].sort()
  const nextDate = due.length > 0 ? null : dates[0]
  const nextLines = nextDate ? byDate.get(nextDate) : due

  // A client's NAME opens their profile; the row itself opens the payment.
  const openClient = (l) => onOpenClient && l.coi_member_number && onOpenClient(l.coi_member_number, l.client_id, { returnTo: 'accounting_payouts' })

  return (
    <div>
      <TrackHero eyebrow="Accounting" title="Accounting" />
      <AccountingPills active="payouts" onSelect={onSelectSection} />

      {loading ? (
        <TableSkeleton cols={6} rows={4} />
      ) : loadError ? (
        <div style={sectionStyle}><p style={{ color: PAYOUT_RED, fontSize: '13px', margin: 0 }}>{loadError}</p></div>
      ) : (
        <>
          {/* ─── The answer first: what goes out next, and when ─────────── */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '28px', alignItems: 'flex-start' }}>
              <div style={{ flex: 2, minWidth: '280px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)', marginBottom: '6px' }}>Next payout</div>
                {due.length > 0 ? (
                  <>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: PAYOUT_GREEN, letterSpacing: '-0.02em' }}>Due now: ${moneyText(sum(due))}</div>
                    <div style={{ fontSize: '13px', color: 'var(--wig-muted)', marginTop: '4px' }}>
                      {due.length} {due.length === 1 ? 'payout' : 'payouts'} whose date has come. They go out in the next 6:00 AM Eastern run.
                    </div>
                  </>
                ) : nextDate ? (
                  <>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--wig-heading)', letterSpacing: '-0.02em' }}>{payDateLong(nextDate)}</div>
                    <div style={{ fontSize: '13px', color: 'var(--wig-muted)', marginTop: '4px' }}>
                      {relativeDay(nextDate, today)}: ${moneyText(sum(nextLines))} in {nextLines.length} {nextLines.length === 1 ? 'payout' : 'payouts'}, sent automatically at 6:00 AM Eastern.
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '15px', color: 'var(--wig-muted)' }}>Nothing is waiting to be paid.</div>
                )}
                {held.length > 0 && (
                  <div style={{ fontSize: '13px', color: PAYOUT_ORANGE, fontWeight: 600, marginTop: '10px' }}>
                    {held.length} {held.length === 1 ? 'payout is' : 'payouts are'} on hold (${moneyText(sum(held))}) and will not pay until released.
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)', marginBottom: '6px' }}>Current schedule</div>
                <ScheduleSummary schedule={schedule} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
            {VIEWS.map(v => (
              <button key={v.key} type="button" onClick={() => chooseView(v.key)} style={viewPillStyle(view === v.key)}>
                {v.label}
                {v.key === 'upcoming' && lines.length > 0 ? ` (${lines.length})` : ''}
              </button>
            ))}
          </div>

          {view === 'upcoming' && (
            lines.length === 0
              ? <div style={sectionStyle}><p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0 }}>Nothing is waiting to be paid.</p></div>
              : (
                <>
                  {held.length > 0 && (
                    <UpcomingGroup
                      title="On hold"
                      subtitle="Will not pay until someone releases the hold. Open a payment to release it or pay it now."
                      color={PAYOUT_ORANGE}
                      lines={held}
                      today={today}
                      onOpen={openPayment}
                      onOpenClient={openClient}
                      onOpenCoi={onOpenCoi}
                    />
                  )}
                  {due.length > 0 && (
                    <UpcomingGroup
                      title="Due now"
                      subtitle="The pay date has come. These go out in the next 6:00 AM Eastern run."
                      color={PAYOUT_GREEN}
                      lines={due}
                      today={today}
                      onOpen={openPayment}
                      onOpenClient={openClient}
                      onOpenCoi={onOpenCoi}
                    />
                  )}
                  {dates.map(d => (
                    <UpcomingGroup
                      key={d}
                      title={payDateLong(d)}
                      subtitle={`${relativeDay(d, today)}, at 6:00 AM Eastern`}
                      color={PAYOUT_BLUE}
                      lines={byDate.get(d)}
                      today={today}
                      onOpen={openPayment}
                      onOpenClient={openClient}
                      onOpenCoi={onOpenCoi}
                    />
                  ))}
                </>
              )
          )}

          {view === 'paid' && <PaidTable data={data} onOpen={openPayment} onOpenClient={openClient} />}
          {view === 'changes' && <ChangesTable changes={data?.recent_changes || []} onOpen={openPayment} />}
        </>
      )}
    </div>
  )
}

function ScheduleSummary({ schedule }) {
  if (!schedule) return <div style={{ fontSize: '13px', color: 'var(--wig-muted)' }}>—</div>
  return (
    <div style={{ fontSize: '13px', color: 'var(--wig-ink)', lineHeight: 1.6 }}>
      <div>{cadenceText(schedule.default)}</div>
      <div style={{ color: 'var(--wig-muted)', fontSize: '12px', marginTop: '4px' }}>
        Edit under Automation &amp; Config → Payout Schedule.
      </div>
    </div>
  )
}

// One pay date's payouts (or the On hold / Due now groups), with its total.
// Rows open the payment; the client and COI names are shortcuts past it.
function UpcomingGroup({ title, subtitle, color, lines, onOpen, onOpenClient, onOpenCoi }) {
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', margin: '0 4px 10px' }}>
        <span style={{ fontSize: '15px', fontWeight: 800, color, letterSpacing: '-0.01em' }}>{title}</span>
        <span style={{ fontSize: '12.5px', color: 'var(--wig-muted)' }}>{subtitle}</span>
        <span style={{ marginLeft: 'auto', fontSize: '13px', fontWeight: 700, color: 'var(--wig-ink)' }}>
          {lines.length} {lines.length === 1 ? 'payout' : 'payouts'} · ${moneyText(sum(lines))}
        </span>
      </div>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Client</th>
              <th style={thStyle}>Paid to</th>
              <th style={thStyle}>For</th>
              <th style={thStyle}>Amount</th>
              <th style={thStyle}>Payout</th>
              <th style={thStyle}>Last change</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => (
              <tr key={`${l.payment_id}-${l.kind}`} onClick={() => onOpen(l.payment_id)} style={{ cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--wig-tint)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <td style={tdStyle}>
                  <div><NameLink onClick={onOpenClient ? () => onOpenClient(l) : undefined} title="Open client profile">{l.client_name || '—'}</NameLink></div>
                  <div style={{ fontSize: '11px', color: 'var(--wig-muted)', fontFamily: 'monospace' }}>{l.client_number}</div>
                  {l.sandbox && <span style={sandboxTagStyle}>Sandbox</span>}
                </td>
                <td style={tdStyle}>
                  {l.recipient_type === 'coi'
                    ? <CoiName firm={l.recipient_company} person={l.recipient_name} onClick={onOpenCoi && l.coi_member_number ? () => onOpenCoi(l.coi_member_number, { returnTo: 'accounting_payouts' }) : undefined} />
                    : (l.recipient_name || '—')}
                  <div style={{ fontSize: '11px', color: 'var(--wig-muted)' }}>{l.recipient_type === 'coi' ? 'COI' : 'Payee'}</div>
                </td>
                <td style={tdStyle}>
                  {TRANSFER_KIND_LABEL[l.kind]}
                  <div style={{ fontSize: '11px', color: 'var(--wig-muted)' }}>{l.strategy_name}</div>
                </td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{l.amount == null ? '—' : `$${moneyText(l.amount)}`}</td>
                <td style={tdStyle}>
                  {/* The SAME pill Accounting → Payments and the receipt show. The
                      pay date is the group heading above, so a Scheduled pill here
                      repeats it on purpose: the pill reads the same everywhere. */}
                  <PayoutPill row={{
                    cleared: true,
                    rev_paid: l.state,
                    share_payout: l.status === 'due' ? null : l.status,
                    payout_due_on: l.pay_date,
                    account: l.account === 'none' || l.account === 'not_ready' ? l.account : null,
                  }} />
                </td>
                <td style={{ ...tdStyle, whiteSpace: 'normal', minWidth: '200px' }}>
                  <LastChange line={l} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// The one most recent thing anybody did to this payout's date, in a line: a
// hold (and why), a release, or a move by a schedule change. A dash when
// nothing has — the date is simply the one it was given when the payment
// cleared. The full history is on the payment.
function LastChange({ line }) {
  const c = line.last_change
  if (!c) return <span style={{ fontSize: '12px', color: 'var(--wig-faint)' }}>—</span>
  const who = c.actor === 'system' ? 'system' : c.actor
  const when = payDateShort(String(c.at).slice(0, 10))
  let text
  if (c.event === 'held') text = `On hold${c.reason ? `: "${c.reason}"` : ''} (${who}, ${when})`
  else if (c.event === 'released') text = `Hold released (${who}, ${when})`
  else if (c.event === 'redated') text = `Moved from ${payDateShort(c.from_date)} (schedule change)`
  else text = `${PAYOUT_EVENT_LABEL[c.event] || c.event} (${who}, ${when})`
  return <span style={{ fontSize: '12px', color: c.event === 'held' ? PAYOUT_ORANGE : 'var(--wig-ink)' }}>{text}</span>
}

function PaidTable({ data, onOpen, onOpenClient }) {
  const paid = data?.paid || []
  if (paid.length === 0) {
    return <div style={sectionStyle}><p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0 }}>Nothing paid in the last {data?.paid_window_days || 45} days.</p></div>
  }
  return (
    <>
      <p style={{ fontSize: '12.5px', color: 'var(--wig-muted)', margin: '0 4px 10px' }}>What went out in the last {data.paid_window_days} days, newest first.</p>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Sent</th>
              <th style={thStyle}>Client</th>
              <th style={thStyle}>Paid to</th>
              <th style={thStyle}>For</th>
              <th style={thStyle}>Amount</th>
              <th style={thStyle}>Timing</th>
            </tr>
          </thead>
          <tbody>
            {paid.map(p => (
              <tr key={`${p.payment_id}-${p.kind}`} onClick={() => onOpen(p.payment_id)} style={{ cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--wig-tint)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <td style={tdStyle}>{whenText(p.paid_at)}</td>
                <td style={tdStyle}>
                  <NameLink onClick={onOpenClient && p.coi_member_number ? () => onOpenClient(p) : undefined} title="Open client profile">{p.client_name || '—'}</NameLink>
                  <div style={{ fontSize: '11px', color: 'var(--wig-muted)', fontFamily: 'monospace' }}>{p.client_number}</div>
                  {p.sandbox && <span style={sandboxTagStyle}>Sandbox</span>}
                </td>
                <td style={tdStyle}>{p.recipient_type === 'coi' ? <CoiName firm={p.recipient_company} person={p.recipient_name} /> : (p.recipient_name || '—')}<div style={{ fontSize: '11px', color: 'var(--wig-muted)' }}>{p.recipient_type === 'coi' ? 'COI' : 'Payee'}</div></td>
                <td style={tdStyle}>{TRANSFER_KIND_LABEL[p.kind]}<div style={{ fontSize: '11px', color: 'var(--wig-muted)' }}>{p.strategy_name}</div></td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>${moneyText(p.amount)}</td>
                <td style={{ ...tdStyle, whiteSpace: 'normal' }}>
                  {p.check_number && <div style={{ fontSize: '12px', color: 'var(--wig-ink)', fontWeight: 600 }}>By check #{p.check_number}</div>}
                  {p.early_at
                    ? <span style={{ fontSize: '12px', color: PAYOUT_ORANGE, fontWeight: 600 }}>Paid early by {p.early_by}</span>
                    : <span style={{ fontSize: '12px', color: 'var(--wig-muted)' }}>{p.pay_date ? `On its pay date (${payDateShort(p.pay_date)})` : 'Paid on clearing'}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ChangesTable({ changes, onOpen }) {
  if (changes.length === 0) {
    return <div style={sectionStyle}><p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0 }}>No payout changes yet. Holds, releases, early payments and schedule edits will be listed here.</p></div>
  }
  return (
    <>
      <p style={{ fontSize: '12.5px', color: 'var(--wig-muted)', margin: '0 4px 10px' }}>Every hold, release, early payment and schedule change, newest first.</p>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>When</th>
              <th style={thStyle}>Change</th>
              <th style={thStyle}>Client</th>
              <th style={thStyle}>What happened</th>
            </tr>
          </thead>
          <tbody>
            {changes.map(e => (
              <tr key={e.id} onClick={e.payment_id ? () => onOpen(e.payment_id) : undefined} style={{ cursor: e.payment_id ? 'pointer' : 'default' }}
                onMouseEnter={ev => { if (e.payment_id) ev.currentTarget.style.background = 'var(--wig-tint)' }}
                onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent' }}>
                <td style={tdStyle}>{whenText(e.created_at)}</td>
                <td style={tdStyle}><span style={chipStyle(e.event === 'held' ? PAYOUT_ORANGE : e.event === 'paid_now' ? PAYOUT_GREEN : PAYOUT_BLUE)}>{PAYOUT_EVENT_LABEL[e.event] || e.event}</span></td>
                <td style={tdStyle}>
                  {e.payment_id ? (e.client_name || '—') : <span style={{ color: 'var(--wig-muted)' }}>All payments</span>}
                  {e.client_number && <div style={{ fontSize: '11px', color: 'var(--wig-muted)', fontFamily: 'monospace' }}>{e.client_number}</div>}
                </td>
                <td style={{ ...tdStyle, whiteSpace: 'normal', minWidth: '260px' }}>{describePayoutEvent(e)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
