// The `rev_paid` values, owned by the backend's revenue-share.ts, and the one
// place a revenue-share run is put into words. NOT_DUE is terminal with nothing
// to pay; VIA_ERT is terminal too — the share is settled outside the portal, so
// there is no transfer to retry and no email to draft, and what is still
// outstanding is the admin's tick on the step list. The three UNSETTLED ones all
// mean a share the COI is still owed, which is what makes them retryable and
// worth an orange line.
import { payDateLong } from './payoutText'

export const REV_NOT_DUE = 'Not Due'
export const REV_VIA_ERT = 'Via ERT'
export const REV_UNSETTLED = ['Awaiting Payout Account', 'Failed', 'processing']

function moneyText(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

/**
 * Two screens finish with a revenue-share run — the payment detail's retry, and
 * a provider receipt paying every COI it covered — and the server runs the SAME
 * sequence behind both, so they read the outcome through here rather than each
 * spelling the states out and drifting apart. `ok` decides the colour: a refused
 * transfer comes back 200 carrying `error` (the run finished, the money did
 * not move), so it reads in red with Stripe's own reason.
 */
export function describeRevShare(res) {
  // Held back by the payout schedule: the split is worked out and locked, and
  // the money goes out on the pay date (or when a hold is released).
  if (res.deferred === 'scheduled') {
    return { ok: true, text: `Revenue share of $${moneyText(res.share_amount)} is scheduled to pay ${payDateLong(res.payout_due_on)}.` }
  }
  if (res.deferred === 'on_hold') {
    return { ok: true, text: `Revenue share of $${moneyText(res.share_amount)} is on hold and will not pay until the hold is released.` }
  }
  if (res.rev_paid === 'succeeded') {
    return {
      ok: true,
      text: res.to_email
        ? `Revenue share of $${moneyText(res.share_amount)} transferred; email drafted to ${res.to_email}`
        : `Revenue share of $${moneyText(res.share_amount)} transferred — the COI has no email on file, so nothing was drafted`,
    }
  }
  if (res.rev_paid === 'Awaiting Payout Account') {
    return { ok: true, text: 'Revenue share held: awaiting payout account. Send the COI their payout setup link, then retry.' }
  }
  if (res.rev_paid === REV_NOT_DUE) {
    return { ok: true, text: 'No revenue share was due on this payment.' }
  }
  // The retry can never answer Via ERT (the server refuses it up front), but a receipt covering an ERT-affiliated COI does, and the helper is shared, so both callers stay aligned.
  if (res.rev_paid === REV_VIA_ERT) {
    return { ok: true, text: `Revenue share of $${moneyText(res.share_amount)} is paid to ERT outside the portal — tick it off on the progress list once ERT has been paid.` }
  }
  return {
    ok: false,
    text: res.error
      ? `Revenue share failed: ${res.error}`
      : `Revenue share is ${res.rev_paid || 'unresolved'} — try again shortly.`,
  }
}
