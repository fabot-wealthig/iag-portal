import { payDateShort, PAYOUT_BLUE, PAYOUT_GREEN, PAYOUT_ORANGE, PAYOUT_RED } from '../../lib/payoutText'

// THE Payout pill — where a payment's outgoing money stands, in ONE vocabulary
// and one shape on every screen that shows it (Jake, 2026-09-24: Payments,
// Payouts, the receipt and the payment must never say it three different ways).
// Same shape as the Payment pill (`StatusPill` in PaymentDetail.jsx) beside it.

const MUTED = 'var(--wig-muted)'

/**
 * The pill for one payment's COI share, from the row's own fields:
 * `rev_paid`, `share_payout` ("scheduled" | "on_hold" | null, from the server),
 * `payout_due_on`, `coi_paid_via_ert`, `ert_share_done`, and `cleared` (money in).
 * A Payouts line passes `account` too, so a transfer that cannot land says so.
 * Null when there is nothing to say yet (the money has not arrived).
 */
export function payoutPillFor(row) {
  if (!row?.cleared) return null
  if (row.share_payout === 'on_hold') return { label: 'On hold', color: PAYOUT_ORANGE }
  if (row.account === 'none') return { label: 'No payout account', color: PAYOUT_ORANGE }
  if (row.account === 'not_ready') return { label: 'Payout account not ready', color: PAYOUT_ORANGE }
  if (row.share_payout === 'scheduled') return { label: `Scheduled · ${payDateShort(row.payout_due_on)}`, color: PAYOUT_BLUE }
  switch (row.rev_paid) {
    case 'succeeded': return { label: 'Paid', color: PAYOUT_GREEN }
    case 'processing': return { label: 'In progress', color: PAYOUT_BLUE }
    case 'Failed': return { label: 'Failed', color: PAYOUT_RED }
    case 'Awaiting Payout Account': return { label: 'No payout account', color: PAYOUT_ORANGE }
    case 'Not Due': return { label: 'Not due', color: MUTED }
    case 'Via ERT': return row.ert_share_done ? { label: 'Paid by ERT', color: PAYOUT_GREEN } : { label: 'ERT to pay', color: PAYOUT_ORANGE }
    default: return { label: 'Due now', color: PAYOUT_GREEN }
  }
}

/** Whether a payment's money has arrived — the one condition the payout hangs off. */
export function isCleared(p) {
  return p?.funded_by === 'provider' ? !!p?.revenue_received_at : p?.payment_status === 'succeeded'
}

export default function PayoutPill({ row }) {
  const pill = payoutPillFor(row)
  if (!pill) return <span style={{ fontSize: '12px', color: 'var(--wig-faint)' }}>—</span>
  const filled = pill.color === PAYOUT_GREEN
  return (
    <span style={{
      fontSize: '12px', fontWeight: 600, color: pill.color, borderRadius: '999px', padding: '4px 12px', whiteSpace: 'nowrap',
      background: filled ? 'rgba(27,146,84,0.15)' : 'var(--wig-tint)',
      border: filled ? '1px solid rgba(27,146,84,0.3)' : '1px solid var(--wig-border-chip)',
    }}>
      {pill.label}
    </span>
  )
}
