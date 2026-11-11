import { useState } from 'react'
import { callApi } from '../lib/api'
import { describeRevShare, REV_UNSETTLED, REV_VIA_ERT } from '../lib/revShareText'
import EditRequestForm, { editable } from './EditRequestCard'
import ClientCheckForm, { CheckStatus, checkWaiting } from './ClientCheckCard'
import VoidRequestForm, { VoidStatus } from './VoidRequestCard'
import RefundForm, { RefundStatus, refundLabel, refundOffered } from './RefundCard'
import SandboxDeleteForm from './SandboxDeleteCard'
import {
  buttonRowStyle, buttonStyle, errorTextStyle, eyebrowStyle, okTextStyle, sectionStyle, warnTextStyle, withBusy,
} from './shared/actionStyles'

function shortDate(v) {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

/**
 * EVERYTHING an admin can do to one payment, in one card (Jake, 2026-11-11:
 * "they can be grouped where makes sense"). One row of buttons, each drawn only
 * when it can be used — a button that would only answer "not now" is not drawn.
 * A button with a form (edit, check, wire, void, refund, delete a sandbox test)
 * opens it in this card in place of the row; one that just does its thing (copy
 * the pay link, the client emails, the revenue share) runs at once. What has
 * already happened (voided, a check waiting to clear, a refund) is said in words
 * above the row. The same card on every strategy: a provider-funded record
 * simply has fewer buttons.
 *
 * Every write is never retried (lib/api.js). Writes that answer the whole
 * payment detail hand it to `onApply`; the rest reload it (`reload`).
 */
export default function PaymentActions({ payment, admins, onApply, reload, onDeleted }) {
  // The open form: { key, mode, label }, or null for the row of buttons.
  const [active, setActive] = useState(null)
  // The one-press action under way (its key), and the last result in words.
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState({ message: '', warning: '', error: '' })
  const [copied, setCopied] = useState(false)

  const providerFunded = payment.funded_by === 'provider'
  const voided = !!payment.voided_at
  const failed = payment.payment_status === 'failed'
  const unpaid = !payment.payment_status || failed
  const cleared = providerFunded ? !!payment.revenue_received_at : payment.payment_status === 'succeeded'
  const moneyIn = providerFunded ? !!payment.revenue_received_at : !!payment.payment_status && !failed
  // The client's own emails: never on a provider record, a request invoiced
  // outside the portal (migration 101), or a voided one.
  const clientMail = !providerFunded && !payment.invoiced_outside && !voided
  const live = !providerFunded && !voided && !payment.refund_status

  function open(next) {
    setNotice({ message: '', warning: '', error: '' })
    setActive(next)
  }
  function done(result) {
    setActive(null)
    setNotice({ message: result?.message || '', warning: result?.warning || '', error: result?.error || '' })
  }

  async function sendEmail(kind, label) {
    setBusy(kind); setNotice({ message: '', warning: '', error: '' })
    try {
      let res = await callApi('resend_payment_email', { payment_id: payment.id, kind })
      // The server refuses a silent duplicate: it reports when the last draft
      // went out and waits to be told again. Drafting twice is the admin's
      // call, never ours.
      if (res.already_sent_at) {
        const again = window.confirm(`This email was already done on ${shortDate(res.already_sent_at)}. Do it again?`)
        if (!again) return
        res = await callApi('resend_payment_email', { payment_id: payment.id, kind, force: true })
      }
      // The invoice draft is the only one that mints document numbers. Naming
      // them here is how the admin ties the Gmail draft back to the record.
      const numbers = [res.invoice_number, res.receipt_number].filter(Boolean)
      setNotice({ message: `${label} ${res.emailed ? 'sent to' : 'drafted to Gmail for'} ${res.to_email}${numbers.length ? ` (${numbers.join(', ')})` : ''}.`, warning: '', error: '' })
      await reload()
    } catch (err) {
      setNotice({ message: '', warning: '', error: err.message })
    } finally {
      setBusy(null)
    }
  }

  // One action covers all three ways a revenue share can be unfinished — held,
  // failed, or transferred with the email undrafted — so the words come from
  // what came BACK, not from what the button said.
  async function retryRevShare() {
    setBusy('rev_share'); setNotice({ message: '', warning: '', error: '' })
    try {
      const { ok, text } = describeRevShare(await callApi('retry_revenue_share', { payment_id: payment.id }))
      setNotice(ok ? { message: text, warning: '', error: '' } : { message: '', warning: '', error: text })
      await reload()
    } catch (err) {
      setNotice({ message: '', warning: '', error: err.message })
    } finally {
      setBusy(null)
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(payment.pay_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ─── The row, in the order a payment lives through ───────────────────────
  const buttons = []
  const form = (key, label, mode) => buttons.push({ key: mode ? `${key}:${mode}` : key, label, onClick: () => open({ key, mode, label }) })
  const now = (key, label, run, busyLabel = 'Working...') => buttons.push({ key, label: busy === key ? busyLabel : label, onClick: run })

  if (editable(payment)) form('edit', 'Edit request')
  if (live && unpaid) {
    form('check', 'Check received', 'received')
    form('check', 'Wire received', 'wire')
  }
  if (live && checkWaiting(payment)) {
    form('check', 'Check cleared', 'cleared')
    form('check', 'Check returned', 'returned')
  }
  if (clientMail && unpaid && payment.pay_url) now('copy', copied ? 'Copied' : 'Copy pay link', copyLink)
  if (clientMail && unpaid) {
    now('request', payment.payment_email_sent_at ? 'Resend payment email' : 'Send payment email', () => sendEmail('request', 'Payment request'), 'Drafting...')
  }
  // A payment that settled on booking (a card at checkout) never had a
  // confirmation email: the invoice and receipt are the confirmation.
  if (clientMail && payment.payment_status && !failed && payment.confirmation_status !== 'Not Needed') {
    now('confirmation', 'Resend confirmation', () => sendEmail('confirmation', 'Confirmation'), 'Drafting...')
  }
  if (clientMail && payment.payment_status === 'succeeded') {
    now('invoice_receipt', payment.invoice_email_sent ? 'Resend invoice and receipt' : 'Send invoice and receipt', () => sendEmail('invoice_receipt', 'Invoice and receipt'), 'Drafting...')
  }
  // The revenue share runs itself the moment the money clears, so a button only
  // when it did NOT finish. Not while the payout schedule holds it (the Payout
  // card moves it), and never on "Via ERT", which the server refuses.
  if (cleared && payment.rev_paid !== REV_VIA_ERT
    && !['scheduled', 'on_hold'].includes(payment.payout?.status)
    && (payment.rev_paid == null || REV_UNSETTLED.includes(payment.rev_paid))) {
    now('rev_share', payment.rev_paid == null ? 'Run revenue share' : 'Retry revenue share', retryRevShare)
  }
  if (cleared && payment.rev_paid === 'succeeded' && !payment.rev_email_sent_at) {
    now('rev_share', 'Send revenue share email', retryRevShare, 'Drafting...')
  }
  if (voided && !payment.invoiced_outside && !payment.void_email_sent_at) {
    now('void', 'Send void email', () => sendEmail('void', 'Cancellation'), 'Drafting...')
  }
  if (live && unpaid) form('void', 'Void request')
  if (refundOffered(payment)) form('refund', refundLabel(payment))
  const sandboxDelete = payment.sandbox === true

  const status = (
    <>
      <VoidStatus payment={payment} />
      <CheckStatus payment={payment} />
      <RefundStatus payment={payment} admins={admins} moneyIn={moneyIn} />
    </>
  )
  const hasStatus = voided || checkWaiting(payment) || !!payment.refund_status || (moneyIn && !!payment.refund?.blocked)
  if (buttons.length === 0 && !sandboxDelete && !hasStatus && !notice.message && !notice.error) return null

  const formProps = { payment, onApply, onDone: done, onCancel: () => setActive(null) }

  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>{active ? active.label : 'Actions'}</div>

      {!active && status}

      {active?.key === 'edit' && <EditRequestForm {...formProps} reload={reload} />}
      {active?.key === 'check' && <ClientCheckForm {...formProps} mode={active.mode} />}
      {active?.key === 'void' && <VoidRequestForm {...formProps} />}
      {active?.key === 'refund' && <RefundForm {...formProps} />}
      {active?.key === 'delete' && <SandboxDeleteForm payment={payment} onDeleted={onDeleted} onCancel={() => setActive(null)} />}

      {!active && (buttons.length > 0 || sandboxDelete) && (
        <div style={buttonRowStyle}>
          {buttons.map(b => (
            <button key={b.key} type="button" disabled={busy !== null} onClick={b.onClick} style={withBusy(buttonStyle, busy !== null)}>
              {b.label}
            </button>
          ))}
          {/* Testers' clean-up, set apart from the real actions. */}
          {sandboxDelete && (
            <button type="button" disabled={busy !== null} onClick={() => open({ key: 'delete', label: 'Delete sandbox test' })}
              style={{ ...withBusy(buttonStyle, busy !== null), marginLeft: 'auto' }}>
              Delete sandbox test
            </button>
          )}
        </div>
      )}

      {!active && notice.message && <p style={okTextStyle}>{notice.message}</p>}
      {!active && notice.warning && <p style={warnTextStyle}>{notice.warning}</p>}
      {!active && notice.error && <p style={errorTextStyle}>{notice.error}</p>}
    </div>
  )
}
