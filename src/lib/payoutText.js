// The payout schedule in words — the ONE place a pay date, a payout status and a
// change to either is phrased, so the payment detail, Accounting → Payouts and
// the schedule settings can never describe the same fact two ways (Jake,
// 2026-09-24: when money goes out, and anything that changed that, must be
// plain to see).
//
// Pay dates arrive as "YYYY-MM-DD" Eastern calendar days. They are formatted at
// UTC midnight so no browser timezone can shift them a day.

export const PAYOUT_ORANGE = '#EE6A33'
export const PAYOUT_GREEN = '#1b9254'
export const PAYOUT_BLUE = '#1D64A8'
export const PAYOUT_RED = '#d93025'

function parseDay(day) {
  if (!day) return null
  const [y, m, d] = String(day).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d))
}

/** "Friday, October 2, 2026" — the headline form. */
export function payDateLong(day) {
  const d = parseDay(day)
  return d ? d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '—'
}

/** "Fri, Oct 2" — the compact form for rows and history lines. */
export function payDateShort(day) {
  const d = parseDay(day)
  return d ? d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }) : '—'
}

/** "Sep 24, 2026, 3:14 PM" — when something was DONE, in the viewer's own clock. */
export function whenText(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Whole days from `today` to `day` (both "YYYY-MM-DD"); negative when past. */
export function daysUntil(day, today) {
  const a = parseDay(today)
  const b = parseDay(day)
  if (!a || !b) return null
  return Math.round((b - a) / 86400000)
}

/** "today", "tomorrow", "in 8 days", "3 days ago". */
export function relativeDay(day, today) {
  const n = daysUntil(day, today)
  if (n == null) return ''
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n > 1) return `in ${n} days`
  if (n === -1) return 'yesterday'
  return `${-n} days ago`
}

export function moneyText(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

export const TRANSFER_KIND_LABEL = {
  rev_share: 'COI revenue share',
  legal_fee: 'Legal fee',
  admin_fee: 'Administration fee',
}

export const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
]

/** "Weekly, every Friday" / "Monthly, on the 15th". */
export function cadenceText(row) {
  if (!row) return '—'
  if (row.cadence === 'weekly') {
    const wd = WEEKDAYS.find(w => w.value === Number(row.pay_weekday))
    return `Weekly, every ${wd ? wd.label : 'weekday'} (for the prior Monday to Sunday)`
  }
  return `Monthly, on the ${ordinal(row.pay_day_of_month)} (for the prior month)`
}

export function ordinal(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  const s = ['th', 'st', 'nd', 'rd']
  const m = v % 100
  return v + (s[(m - 20) % 10] || s[m] || s[0])
}

/**
 * A payout status as a pill: Scheduled (blue), On hold (orange), Due (green —
 * it goes out on the next run). `status` is the server's word.
 */
export function payoutStatusPill(status) {
  if (status === 'on_hold') return { label: 'On hold', color: PAYOUT_ORANGE }
  if (status === 'scheduled') return { label: 'Scheduled', color: PAYOUT_BLUE }
  if (status === 'due') return { label: 'Due now', color: PAYOUT_GREEN }
  return null
}

/**
 * One payout_events line as a sentence. `nameOf` turns an admin email into a
 * name where the caller has the roster; "system" is the pipeline itself.
 */
export function describePayoutEvent(e, nameOf = (x) => x) {
  const who = e.actor === 'system' ? 'the system' : nameOf(e.actor)
  switch (e.event) {
    case 'scheduled':
      return `Payment cleared ${payDateShort(e.from_date)}. Scheduled to pay ${payDateLong(e.to_date)}.`
    case 'held':
      return `Put on hold by ${who}${e.reason ? `: "${e.reason}"` : ''}. It will not pay until released.`
    case 'released':
      return `Hold released by ${who}. Now pays ${payDateLong(e.to_date)}${e.from_date && e.from_date !== e.to_date ? ` (was ${payDateShort(e.from_date)})` : ''}.`
    case 'paid_now':
      return `Paid now by ${who}, ahead of its scheduled date (${payDateShort(e.from_date)})${e.reason ? `: "${e.reason}"` : ''}.`
    case 'redated':
      return `Moved from ${payDateShort(e.from_date)} to ${payDateLong(e.to_date)} because ${who} changed the payout schedule.`
    case 'schedule_changed': {
      const n = Number(e.detail?.redated ?? 0)
      return `Payout schedule changed by ${who}. ${n === 0 ? 'No waiting payments changed date.' : `${n} waiting ${n === 1 ? 'payment' : 'payments'} moved to a new date.`}`
    }
    default:
      return `${e.event} by ${who}.`
  }
}

/** The headline word for a change, for chips and feed rows. */
export const PAYOUT_EVENT_LABEL = {
  scheduled: 'Scheduled',
  held: 'Held',
  released: 'Released',
  paid_now: 'Paid early',
  redated: 'Date moved',
  schedule_changed: 'Schedule changed',
}
