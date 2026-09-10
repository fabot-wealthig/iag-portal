import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { BackLink, Field, TrackHero } from './shared/TrackKit'
import { PaymentDetailSkeleton } from './shared/Skeleton'
import { sandboxChipStyle } from '../lib/stripeMode'

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const textActionStyle = { background: 'none', border: 'none', padding: 0, color: 'var(--wig-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const outlineButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
// The request form's field, label and inner box, copied rather than imported:
// `ClientPaymentForm` imports FROM this file, so reaching back the other way
// would close a circle. The mark-received card asks for the same figure the
// form asked for, so it has to be the same control wearing the same box.
const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const labelStyle = { fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }
const innerBoxStyle = { background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '8px', padding: '16px' }
// The admin lists' dropdown, copied rather than imported: `SortSelect` owns the
// only instance of this object and does not export the style itself.
const selectStyle = { padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-muted)', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', maxWidth: '280px' }
// Matches the `Field` label in the Details grid below, so the two cards read as
// one screen even though these rows hold controls rather than values.
const assignLabelStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)', marginBottom: '6px' }
const rowErrorStyle = { color: '#d93025', fontSize: '13px', margin: '8px 0 0' }
// Mirrors the VFO step row's chip: a quiet pill that names who the step is
// waiting on without competing with the label beside it. Exported because the
// Client Overview panel names the same owner for the same step.
export const ownerChipStyle = { fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', color: 'var(--wig-muted)', fontWeight: 600, whiteSpace: 'nowrap' }

const GREEN = '#1b9254'
// The amber the portal uses for "still owed", the same one the payments list
// puts under a status pill.
const ORANGE = '#EE6A33'

// The `rev_paid` values, owned by the backend's revenue-share.ts. NOT_DUE is
// terminal with nothing to pay; VIA_ERT is terminal too — the share is settled
// outside the portal, so there is no transfer to retry and no email to draft,
// and what is still outstanding is the admin's tick on the step list. The three
// UNSETTLED ones all mean a share the COI is still owed, which is what makes
// them retryable and worth an orange line.
const REV_NOT_DUE = 'Not Due'
const REV_VIA_ERT = 'Via ERT'
const REV_UNSETTLED = ['Awaiting Payout Account', 'Failed', 'processing']

const capitalise = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1)

function dateText(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

function moneyText(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

// Keystroke filter for a dollar-amount input: digits and AT MOST one decimal
// point, everything else dropped. Deliberately NOT a parse — it returns the
// STRING so a half-typed "12." keeps its point while the admin is still typing.
// Copied from the request form for the same reason its styles are.
const moneyDigitsOnly = (raw) => {
  const cleaned = String(raw ?? '').replace(/[^0-9.]/g, '')
  const [whole, ...rest] = cleaned.split('.')
  return rest.length ? `${whole}.${rest.join('')}` : whole
}

// Percentages arrive from Postgres `numeric` as strings; a trailing ".00" is
// dropped so 20% reads as 20%. Same rule as the request form's preview.
function pctText(v) {
  const n = Number(v)
  return Number.isFinite(n) ? `${Number(n.toFixed(2))}%` : '—'
}

// "ACH ····1234" — the four dots stand in for the digits Stripe never hands
// back. Nothing at all before there is a payment: an empty method column reads
// as "not paid yet", a dash would read as "paid, method unknown".
export function methodText(payment) {
  if (!payment.payment_method_type) return ''
  const kind = payment.payment_method_type === 'ach' ? 'ACH' : capitalise(payment.payment_method_type)
  return payment.acct_last4 ? `${kind} ····${payment.acct_last4}` : kind
}

// A payment_status from Stripe is the truth once there is one; before that the
// only thing we know is whether the request email actually left. Succeeded gets
// the same green the Active status dot uses in the client hero.
export function statusOfPayment(payment) {
  // A provider strategy is never invoiced, so there is neither a Stripe status
  // nor a request email to have gone out: the record is waiting on the
  // provider's money and on the admin who ticks it off. Both labels are the
  // server's own stage wording, so this pill and the Stage column beside it
  // cannot describe the same record differently.
  if (payment.funded_by === 'provider') {
    return payment.revenue_received_at
      ? { label: 'Revenue received', color: GREEN, background: 'rgba(27,146,84,0.15)', border: '1px solid rgba(27,146,84,0.3)' }
      : { label: 'Awaiting provider payment', color: 'var(--wig-ink)', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)' }
  }
  if (payment.payment_status) {
    const label = capitalise(payment.payment_status)
    return payment.payment_status === 'succeeded'
      ? { label, color: GREEN, background: 'rgba(27,146,84,0.15)', border: '1px solid rgba(27,146,84,0.3)' }
      : { label, color: 'var(--wig-ink)', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)' }
  }
  return payment.payment_email_sent_at
    ? { label: 'Awaiting payment', color: 'var(--wig-ink)', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)' }
    : { label: 'Email not sent', color: '#d93025', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)' }
}

export function StatusPill({ payment }) {
  const s = statusOfPayment(payment)
  return <span style={{ fontSize: '12px', fontWeight: 600, color: s.color, background: s.background, border: s.border, borderRadius: '999px', padding: '4px 12px', whiteSpace: 'nowrap' }}>{s.label}</span>
}

// The one place a revenue-share run is put into words. Two actions finish with
// one — the retry, and marking a provider's money received — and the server runs
// the SAME sequence behind both, so they read the outcome through here rather
// than each spelling the states out and drifting apart. `ok` decides the colour:
// a refused transfer comes back 200 carrying `error` (the run finished, the
// money did not move), so it reads in red with Stripe's own reason.
function describeRevShare(res) {
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
  // The retry can never answer Via ERT (the server refuses it up front), but marking a provider's revenue received on an ERT-affiliated record does, and the helper is shared, so both callers stay aligned.
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

/**
 * One payment, opened from the client's payment list. Renders its OWN hero, so
 * the client hero and the Profile/Payments pills stand down while it is open —
 * the same takeover an open client performs on the COI above it.
 */
export default function PaymentDetail({ paymentId, onBack }) {
  const [payment, setPayment] = useState(null)
  const [steps, setSteps] = useState([])
  // The payment's assignments plus the roster to pick from. The roster ships
  // with the payment because any admin may open one, while `load_admins` is
  // superadmin-only.
  const [taxPlanner, setTaxPlanner] = useState(null)
  const [recipients, setRecipients] = useState([])
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  // Which manual step is mid-write, if any. Every checkbox reads it: two
  // overlapping writes against the same payment would race the waterfall.
  const [busyStep, setBusyStep] = useState(null)
  const [stepError, setStepError] = useState('')
  // The Progress card's own success line, the green twin of stepError. The
  // revenue-received tick reports there because the tick is what the admin just
  // used — the Details card's emailMsg belongs to the buttons in its own row.
  const [stepMsg, setStepMsg] = useState('')
  // One flag for BOTH assignment controls, mirroring busyStep: they write to the
  // same payment and each answers with the whole detail, so a second write
  // landing mid-flight would re-render this card from a payload that predates
  // the first.
  const [busyAssign, setBusyAssign] = useState(false)
  const [plannerError, setPlannerError] = useState('')
  const [recipientError, setRecipientError] = useState('')
  const [busyEmail, setBusyEmail] = useState(null)
  const [emailMsg, setEmailMsg] = useState('')
  const [emailError, setEmailError] = useState('')
  const [copied, setCopied] = useState(false)
  // The mark-received card: closed until asked for, and holding its two fields
  // as typed. The amount is a STRING while it is being typed — `moneyDigitsOnly`
  // never parses — and is only turned into a number on the way out.
  const [markOpen, setMarkOpen] = useState(false)
  const [markAmount, setMarkAmount] = useState('')
  const [markReference, setMarkReference] = useState('')

  useEffect(() => { load() }, [paymentId])

  // The loader and all three writes answer ONE shape, so the screen is replaced
  // wholesale from whichever of them responded rather than patched field by
  // field — the same reason the server shares one loader behind them.
  function applyDetail(data) {
    setPayment(data.payment || null)
    setSteps(data.steps || [])
    setTaxPlanner(data.tax_planner || null)
    setRecipients(data.recipients || [])
    setAdmins(data.admins || [])
  }

  async function load() {
    try {
      const data = await callApi('load_client_payment', { payment_id: paymentId })
      applyDetail(data)
      setLoadError('')
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function toggleStep(step, done) {
    setBusyStep(step); setStepError(''); setStepMsg('')
    try {
      // The server recomputes the whole waterfall from this one flag, so its
      // response replaces the whole view rather than being merged in.
      const res = await callApi('update_payment_step', { payment_id: paymentId, step, done })
      applyDetail(res)
    } catch (err) {
      // update_payment_step is a write — never retried, and the server's
      // wording is the wording the admin sees.
      setStepError(err.message)
    } finally {
      setBusyStep(null)
    }
  }

  // Optimistic, like the Admin Editor's tab checkboxes: the control moves at
  // once and only goes back if the server refuses. An assignment is cheap to
  // re-try and the round trip is long enough that waiting for it makes the
  // control feel broken.
  async function assignTaxPlanner(email) {
    const previous = taxPlanner
    setTaxPlanner(admins.find(a => a.email === email) || null)
    setBusyAssign(true); setPlannerError('')
    try {
      applyDetail(await callApi('set_payment_tax_planner', { payment_id: paymentId, email }))
    } catch (err) {
      setTaxPlanner(previous)
      // set_payment_tax_planner is a write — never retried, and the server's
      // wording is the wording the admin sees.
      setPlannerError(err.message)
    } finally {
      setBusyAssign(false)
    }
  }

  // The optimistic list is rebuilt by FILTERING the roster rather than by
  // splicing the chips, so it comes out in the roster's name order — the same
  // order the server answers in, which keeps the chips from jumping when the
  // response lands.
  async function toggleRecipient(email, subscribed) {
    const previous = recipients
    const nextEmails = new Set(previous.map(r => r.email))
    if (subscribed) nextEmails.add(email); else nextEmails.delete(email)
    setRecipients(admins.filter(a => nextEmails.has(a.email)))
    setBusyAssign(true); setRecipientError('')
    try {
      applyDetail(await callApi('update_payment_recipient', { payment_id: paymentId, email, subscribed }))
    } catch (err) {
      setRecipients(previous)
      // update_payment_recipient is a write — never retried.
      setRecipientError(err.message)
    } finally {
      setBusyAssign(false)
    }
  }

  async function sendEmail(kind, label) {
    setBusyEmail(kind); setEmailMsg(''); setEmailError('')
    try {
      let res = await callApi('resend_payment_email', { payment_id: paymentId, kind })
      // The server refuses a silent duplicate: it reports when the last draft
      // went out and waits to be told again. Drafting twice is the admin's
      // call, never ours.
      if (res.already_sent_at) {
        const again = window.confirm(`Email already drafted on ${dateText(res.already_sent_at)}. Draft again?`)
        if (!again) return
        res = await callApi('resend_payment_email', { payment_id: paymentId, kind, force: true })
      }
      // The invoice draft is the only one that mints document numbers. Naming
      // them here is how the admin ties the Gmail draft back to the record
      // without opening it.
      const numbers = [res.invoice_number, res.receipt_number].filter(Boolean)
      setEmailMsg(`${label} drafted to Gmail for ${res.to_email}${numbers.length ? ` (${numbers.join(', ')})` : ''}`)
      await load()
    } catch (err) {
      // resend_payment_email is a write — the server's wording is what shows.
      setEmailError(err.message)
    } finally {
      setBusyEmail(null)
    }
  }

  // One action covers all three ways a revenue share can be unfinished — held,
  // failed, or transferred with the email undrafted — because the server treats
  // them as one sequence and decides how far to get. The message therefore has
  // to be composed from what came BACK, not from what the button said.
  async function retryRevShare() {
    setBusyEmail('rev_share'); setEmailMsg(''); setEmailError('')
    try {
      const { ok, text } = describeRevShare(await callApi('retry_revenue_share', { payment_id: paymentId }))
      if (ok) setEmailMsg(text)
      else setEmailError(text)
      await load()
    } catch (err) {
      // retry_revenue_share is a WRITE — never retried, and the server's wording
      // is the wording the admin sees.
      setEmailError(err.message)
    } finally {
      setBusyEmail(null)
    }
  }

  // Opens the card on what the record was RAISED on, so the common case — the
  // provider paid exactly what was expected — is a Confirm away, and a different
  // figure is a correction rather than a fresh entry.
  function openMark() {
    setMarkAmount(payment.revenue_expected == null ? '' : moneyDigitsOnly(moneyText(payment.revenue_expected)))
    setMarkReference('')
    setStepMsg(''); setStepError('')
    setMarkOpen(true)
  }

  // The one write on this screen that cannot be undone: it stamps the money as
  // in, runs the whole waterfall behind it, and pays the COI's share. The
  // response is the entire detail again — the same shape the loader answers —
  // so the screen is replaced from it rather than reloaded, and the run that
  // followed is reported in the words a retry would have used.
  async function confirmRevenueReceived() {
    setBusyEmail('revenue_received'); setStepMsg(''); setStepError('')
    try {
      const res = await callApi('mark_revenue_received', {
        payment_id: paymentId,
        amount_received: Number(markAmount),
        reference: markReference.trim(),
      })
      applyDetail(res)
      setMarkOpen(false)
      const { ok, text } = describeRevShare(res.rev_share || {})
      if (ok) setStepMsg(`Revenue received. ${text}`)
      else setStepError(text)
    } catch (err) {
      // mark_revenue_received is a WRITE — never retried, and the server's
      // wording is the wording the admin sees.
      setStepError(err.message)
    } finally {
      setBusyEmail(null)
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(payment.pay_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Nothing on this screen is known before the fetch — not even the title — so
  // the whole of it, hero included, is drawn as a skeleton.
  if (loading) return <PaymentDetailSkeleton />

  if (loadError || !payment) {
    return (
      <div>
        <div style={sectionStyle}>
          <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{loadError || 'Payment not found.'}</p>
        </div>
        <BackLink label="← Back to payments" onClick={onBack} />
      </div>
    )
  }

  const strategy = payment.strategy_name || payment.strategy_key
  // A revenue record rather than a payment: the client paid the provider, and
  // what this screen tracks is the money the provider owes us.
  const providerFunded = payment.funded_by === 'provider'
  // "The money is in" — the one condition the revenue share hangs off, whichever
  // way the money arrived. A client's payment clears through Stripe; a
  // provider's is an admin telling us it landed. Everything downstream of the
  // cash is the same sequence from there, so it reads one flag rather than two.
  const cleared = providerFunded ? !!payment.revenue_received_at : payment.payment_status === 'succeeded'
  const markAmountValid = Number(markAmount) > 0
  const headlineAmount = providerFunded
    ? (payment.revenue_received ?? payment.revenue_expected)
    : payment.total_fee
  const method = methodText(payment)
  const showCopy = !!payment.pay_url && !payment.payment_status
  const recipientEmails = new Set(recipients.map(r => r.email))
  const unassignedAdmins = admins.filter(a => !recipientEmails.has(a.email))
  // The money steps are the fee, split: their amounts sum to total_fee by
  // construction (each is a difference of the one above it), so the total shown
  // is the sum of what is on screen, not the fee column — if the two ever
  // disagreed, that is exactly what the admin should see.
  // WHY `revenue_received` is out: it is the pool the lines below it are made from, not one of them.
  const moneySteps = steps.filter(s => Object.prototype.hasOwnProperty.call(s, 'amount') && s.key !== 'revenue_received')
  const stepsTotal = moneySteps.length > 0 && moneySteps.every(s => s.amount != null)
    ? moneySteps.reduce((sum, s) => sum + Number(s.amount), 0)
    : null

  return (
    <div>
      <TrackHero
        eyebrow="Payment"
        title={`${strategy} - $${moneyText(headlineAmount)}`}
        meta={
          <>
            <span>{payment.client_name}</span>
            <span style={{ color: 'var(--wig-border-mid)' }}>·</span>
            <span style={{ fontFamily: 'monospace' }}>{payment.client_number}</span>
            <span style={{ color: 'var(--wig-border-mid)' }}>·</span>
            <StatusPill payment={payment} />
            {/* Off the ROW, not off the names as they read today: the mode was
                stamped when the payment was raised and is what the money
                actually moved under. */}
            {payment.sandbox === true && <span style={sandboxChipStyle}>Sandbox</span>}
          </>
        }
      />
      <BackLink label="← Back to payments" onClick={onBack} />

      <div style={sectionStyle}>
        <div style={eyebrowStyle}>Progress</div>
        {steps.length === 0
          ? <p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0 }}>No steps yet.</p>
          // `revenue_received` is the admin's to record, exactly like the
          // hard-cost ticks beside it, so it wears the same checkbox — but it
          // carries an amount and pays the COI, so the tick opens the confirm
          // card instead of writing. The server keeps sending `manual: false`
          // on it, which is what keeps `update_payment_step` unable to reach
          // it; `onMark` is the whole of the special case, stated here.
          : steps.map(step => step.key === 'revenue_received' ? (
            <div key={step.key}>
              <StepRow
                step={step}
                busy={busyStep !== null || busyEmail !== null}
                onMark={openMark}
              />
              {/* Opened from the step and sitting under it, so the figure is
                  confirmed against the line that asked for it. The warning is
                  the point of the card: the share is paid out the moment
                  Confirm lands. */}
              {markOpen && (
                <div style={{ ...innerBoxStyle, margin: '12px 0 16px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={labelStyle}>Amount received</label>
                    <MoneyInput value={markAmount} onChange={setMarkAmount} />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={labelStyle}>Reference (optional)</label>
                    <input value={markReference} onChange={e => setMarkReference(e.target.value)}
                      placeholder="e.g. remittance or batch reference" style={inputStyle} />
                  </div>
                  <div style={{ fontSize: '12px', color: ORANGE, fontWeight: 600, marginBottom: '12px' }}>
                    This records the money as received and pays the COI's share. It cannot be undone.
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button type="button" disabled={busyEmail !== null || !markAmountValid} onClick={confirmRevenueReceived}
                      style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                        background: (busyEmail !== null || !markAmountValid) ? '#93b4e8' : 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)',
                        cursor: (busyEmail !== null || !markAmountValid) ? 'not-allowed' : 'pointer' }}>
                      {busyEmail === 'revenue_received' ? 'Working...' : 'Confirm'}
                    </button>
                    <button type="button" disabled={busyEmail !== null} onClick={() => setMarkOpen(false)}
                      style={{ ...outlineButtonStyle, cursor: busyEmail ? 'not-allowed' : 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <StepRow
              key={step.key}
              step={step}
              busy={busyStep !== null}
              onToggle={done => toggleStep(step.key, done)}
            />
          ))}
        {stepsTotal != null && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: '10px', paddingTop: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--wig-muted)' }}>Total</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--wig-ink)' }}>{`$${moneyText(stepsTotal)}`}</span>
          </div>
        )}
        {stepMsg && <p style={{ color: GREEN, fontSize: '13px', marginTop: '12px', marginBottom: 0 }}>{stepMsg}</p>}
        {stepError && <p style={{ color: '#d93025', fontSize: '13px', marginTop: '12px', marginBottom: 0 }}>{stepError}</p>}
      </div>

      {/* Who hears about this payment: the tax planner (the one earner, a hard
          link on the row) and anyone else who wants to follow it. Both controls
          are open to every admin — an assignment is a workload decision the
          team makes among themselves, not a rank. Names are plain text here:
          nothing on this card navigates. */}
      <div style={sectionStyle}>
        <div style={eyebrowStyle}>Notifications</div>

        <div style={{ marginBottom: '22px' }}>
          <div style={assignLabelStyle}>Tax planner</div>
          <select
            value={taxPlanner?.email || ''}
            disabled={busyAssign}
            onChange={e => assignTaxPlanner(e.target.value)}
            style={{ ...selectStyle, cursor: busyAssign ? 'not-allowed' : 'pointer' }}>
            <option value="">Unassigned</option>
            {admins.map(a => <option key={a.email} value={a.email}>{a.name}</option>)}
          </select>
          {plannerError && <p style={rowErrorStyle}>{plannerError}</p>}
        </div>

        <div>
          <div style={assignLabelStyle}>Other notification recipients</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            {recipients.length === 0 && (
              <span style={{ fontSize: '13px', color: 'var(--wig-muted)' }}>No recipients yet.</span>
            )}
            {recipients.map(r => (
              <span key={r.email} style={{ ...ownerChipStyle, fontSize: '12px', padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {r.name}
                <button type="button" disabled={busyAssign} aria-label={`Remove ${r.name}`}
                  onClick={() => toggleRecipient(r.email, false)}
                  style={{ border: 'none', background: 'transparent', color: 'var(--wig-muted)', fontSize: '14px', lineHeight: 1, padding: 0, cursor: busyAssign ? 'not-allowed' : 'pointer' }}>×</button>
              </span>
            ))}
          </div>
          {/* Always value="" — the select is an ADD button wearing a dropdown,
              so it never holds a selection of its own. */}
          <select
            value=""
            disabled={busyAssign || unassignedAdmins.length === 0}
            onChange={e => { if (e.target.value) toggleRecipient(e.target.value, true) }}
            style={{ ...selectStyle, cursor: (busyAssign || unassignedAdmins.length === 0) ? 'not-allowed' : 'pointer' }}>
            <option value="">{unassignedAdmins.length === 0 ? 'All admins added' : 'Add admin…'}</option>
            {unassignedAdmins.map(a => <option key={a.email} value={a.email}>{a.name}</option>)}
          </select>
          {recipientError && <p style={rowErrorStyle}>{recipientError}</p>}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={eyebrowStyle}>Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
          <Field label="Client" value={payment.client_name} />
          <Field label="Client number" value={payment.client_number} />
          <Field label="Strategy" value={strategy} />
          {/* Two different records share this grid. A provider one has no
              offset, no client fee, no method and no documents — every one of
              those fields would be an em dash claiming something is missing —
              so it shows the inputs it WAS raised on and what the provider
              owes, and the waterfall below picks up unchanged. */}
          {providerFunded ? (
            <>
              {payment.strategy_model === 'fixed_commission' && (
                <Field label="Box size" value={(payment.strategy_inputs || {}).tier_label} />
              )}
              {payment.strategy_model === 'retention_share' && (
                <>
                  <Field label="Premium" value={payment.contribution_amount == null ? null : `$${moneyText(payment.contribution_amount)}`} />
                  <Field label="Client status" value={(payment.strategy_inputs || {}).first_year ? 'First-year' : 'Returning'} />
                </>
              )}
              {payment.strategy_model === 'contribution_pct' && (
                <>
                  <Field label="Investment amount" value={payment.contribution_amount == null ? null : `$${moneyText(payment.contribution_amount)}`} />
                  <Field label="Implementation fee"
                    value={(payment.strategy_inputs || {}).implementation_fee_waived
                      ? 'Waived'
                      : payment.implementation_fee_amount == null ? null : `$${moneyText(payment.implementation_fee_amount)}`} />
                </>
              )}
              <Field label="Expected revenue" value={payment.revenue_expected == null ? null : `$${moneyText(payment.revenue_expected)}`} />
              <Field label="Revenue received" value={payment.revenue_received == null ? null : `$${moneyText(payment.revenue_received)}`} />
              <Field label="Received on" value={payment.revenue_received_at ? dateText(payment.revenue_received_at) : null} />
              <Field label="Reference" value={payment.revenue_reference} />
              {/* Never comes off the pool — somebody else bills it — so it is
                  named as what it is rather than sitting among the split. DCD
                  states it above, beside the waiver that decides it. */}
              {payment.strategy_model !== 'contribution_pct' && (
                <Field label="Implementation fee (billed separately)"
                  value={payment.implementation_fee_amount == null ? null : `$${moneyText(payment.implementation_fee_amount)}`} />
              )}
            </>
          ) : (
            <>
              <Field label="Offset amount" value={`$${moneyText(payment.offset_amount)}`} />
              <Field label="Total fee" value={`$${moneyText(payment.total_fee)}`} />
              {/* Decided on the request form and never revisited, so it belongs
                  with the fees rather than with the waterfall below: it is an
                  input to those numbers, not one of them. */}
              <Field label="Legal opinion letter"
                value={payment.legal_fee_waived
                  ? 'Waived'
                  : payment.legal_fee_amount == null ? null : `$${moneyText(payment.legal_fee_amount)}`} />
              <Field label="Payment method" value={method} />
              <Field label="Payment date" value={payment.payment_date ? dateText(payment.payment_date) : null} />
              <Field label="Payment intent id" value={payment.payment_intent_id} />
              <Field label="Invoice number" value={payment.invoice_number} />
              <Field label="Receipt number" value={payment.receipt_number} />
            </>
          )}
          {/* The waterfall, once the payment has cleared and stamped it. Each
              value is passed through as null while it is unstamped, so `Field`
              renders its own em dash rather than "$NaN". */}
          <Field label="Available pool" value={payment.available_pool == null ? null : `$${moneyText(payment.available_pool)}`} />
          <Field label="COI level at payment" value={payment.coi_level_at_payment == null ? null : String(payment.coi_level_at_payment)} />
          <Field label="COI share" value={payment.coi_share_amount == null ? null : `${pctText(payment.coi_share_pct)} · $${moneyText(payment.coi_share_amount)}${payment.coi_paid_via_ert ? ' · via ERT' : ''}`} />
          <Field label="Net profit pool" value={payment.net_profit_pool == null ? null : `$${moneyText(payment.net_profit_pool)}`} />
          <Field label="Revenue share status" value={payment.rev_paid} />
          <Field label="Transfer id" value={payment.rev_transfer_id} />
          <Field label="Stripe sandbox" value={payment.sandbox ? 'Yes' : 'No'} />
          <Field label="Created by" value={payment.created_by} />
          <Field label="Created at" value={dateText(payment.created_at)} />
        </div>
        <div style={{ marginTop: '14px' }}>
          <Field label="Notes" value={payment.notes} preWrap />
        </div>

        {/* Two records share this row. The pay link and the three client emails
            belong to a Stripe payment and are gated on `!providerFunded` one by
            one, so a provider record never meets a button that would ask a
            client for money it does not owe. What both records share is the
            money landing: from there the revenue share is the same sequence,
            hung off `cleared` rather than off Stripe's status. */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--wig-border-soft)' }}>
          {!providerFunded && (
            <>
              {showCopy && (
                <button type="button" onClick={copyLink} style={textActionStyle}>
                  {copied ? 'Copied' : 'Copy pay link'}
                </button>
              )}
              {/* Which emails are on offer follows where the payment actually
                  is: the request while it is unpaid, and once Stripe has taken
                  the money the confirmation — joined by the invoice and receipt
                  once the charge has cleared, since only a cleared payment has
                  documents to send. */}
              {!payment.payment_status && !payment.payment_email_sent_at && (
                <button type="button" disabled={busyEmail !== null} onClick={() => sendEmail('request', 'Payment request')}
                  style={{ ...outlineButtonStyle, cursor: busyEmail ? 'not-allowed' : 'pointer' }}>
                  {busyEmail === 'request' ? 'Drafting...' : 'Send payment email'}
                </button>
              )}
              {!payment.payment_status && payment.payment_email_sent_at && (
                <button type="button" disabled={busyEmail !== null} onClick={() => sendEmail('request', 'Payment request')}
                  style={{ ...outlineButtonStyle, cursor: busyEmail ? 'not-allowed' : 'pointer' }}>
                  {busyEmail === 'request' ? 'Drafting...' : 'Resend payment email'}
                </button>
              )}
              {payment.payment_status && (
                <button type="button" disabled={busyEmail !== null} onClick={() => sendEmail('confirmation', 'Confirmation')}
                  style={{ ...outlineButtonStyle, cursor: busyEmail ? 'not-allowed' : 'pointer' }}>
                  {busyEmail === 'confirmation' ? 'Drafting...' : 'Resend confirmation'}
                </button>
              )}
              {payment.payment_status === 'succeeded' && (
                <button type="button" disabled={busyEmail !== null} onClick={() => sendEmail('invoice_receipt', 'Invoice and receipt')}
                  style={{ ...outlineButtonStyle, cursor: busyEmail ? 'not-allowed' : 'pointer' }}>
                  {busyEmail === 'invoice_receipt'
                    ? 'Drafting...'
                    : payment.invoice_email_sent ? 'Resend invoice and receipt' : 'Send invoice and receipt'}
                </button>
              )}
            </>
          )}
          {/* Nothing has arrived on its own on a provider record: the money is
              reported by the admin who saw it land. That is a TICK on the
              progress list, not a button down here — it belongs beside the
              other steps the admin records by hand. */}
          {/* The revenue share runs itself the moment the money clears, so a
              button only appears when it did NOT finish: money still owed
              (held, failed, or a run that died mid-transfer), or a transfer
              that landed with the COI's email undrafted. A NULL rev_paid on a
              cleared payment is the third case and the reason the button says
              "Run" rather than "Retry" — nothing has run yet at all, either
              because the payment cleared before Phase F shipped or because the
              webhook died before writing a state.

              "Via ERT" is excluded by name rather than by falling through the
              list: the server refuses a retry on one outright, and spelling it
              out here is what stops a future state being added to REV_UNSETTLED
              and quietly putting a dead button on a Path A payment. */}
          {cleared && payment.rev_paid !== REV_VIA_ERT
            && (payment.rev_paid == null || REV_UNSETTLED.includes(payment.rev_paid)) && (
            <button type="button" disabled={busyEmail !== null} onClick={retryRevShare}
              style={{ ...outlineButtonStyle, cursor: busyEmail ? 'not-allowed' : 'pointer' }}>
              {busyEmail === 'rev_share'
                ? 'Working...'
                : payment.rev_paid == null ? 'Run revenue share' : 'Retry revenue share'}
            </button>
          )}
          {cleared && payment.rev_paid === 'succeeded' && !payment.rev_email_sent_at && (
            <button type="button" disabled={busyEmail !== null} onClick={retryRevShare}
              style={{ ...outlineButtonStyle, cursor: busyEmail ? 'not-allowed' : 'pointer' }}>
              {busyEmail === 'rev_share' ? 'Drafting...' : 'Send revenue share email'}
            </button>
          )}
        </div>

        {emailMsg && <p style={{ color: '#1b9254', fontSize: '13px', marginTop: '12px', marginBottom: 0 }}>{emailMsg}</p>}
        {emailError && <p style={{ color: '#d93025', fontSize: '13px', marginTop: '12px', marginBottom: 0 }}>{emailError}</p>}
      </div>
    </div>
  )
}

// A dollar field with the sign sitting inside it, so the amount is typed
// without one. Copied from the request form: it is the same control asking for
// the same kind of figure, and importing it would close a circle.
function MoneyInput({ value, onChange }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--wig-muted)', fontSize: '14px' }}>$</span>
      <input value={value} onChange={e => onChange(moneyDigitsOnly(e.target.value))} placeholder="0.00"
        inputMode="decimal" style={{ ...inputStyle, paddingLeft: '28px' }} />
    </div>
  )
}

// One step line, mirroring the VFO track row: indicator, label, owner chip
// pushed right, date in a fixed right-hand column. A step the backend marks
// manual is the admin's to tick, so it gets a real checkbox where the automatic
// steps get a read-only mark.
//
// `onMark` is the one exception, and it is passed in rather than sniffed for:
// the step is the admin's to record like the manual ticks, so it wears the same
// checkbox, but it carries an amount and pays the COI, so ticking it OPENS a
// confirm instead of writing. The live checkbox is only there while the step is
// not done — that write cannot be undone, so once the server says done the step
// wears the same green tick every other done step wears, rather than a disabled
// box the browser greys out.
function StepRow({ step, busy, onToggle, onMark }) {
  const na = step.applicable === false
  const showAmount = Object.prototype.hasOwnProperty.call(step, 'amount')
  const done = !!step.done
  // WHY: Jake's rule — "steps that aren't calculated yet because prior steps
  // aren't done are NOT clickable AND greyed out." Nothing can have been paid
  // that has not been calculated yet, so a step carrying a null amount reads
  // greyed like an inapplicable one and its manual checkbox stays locked, with
  // the "Pending calculation" text beside it saying why. The entry step that
  // supplies the figure is exempt — it is the one the admin is meant to click.
  const amountPending = showAmount && step.amount == null && !onMark

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--wig-border-soft)', flexWrap: 'wrap', opacity: (na || amountPending) ? 0.45 : 1 }}>
      {onMark
        ? done
          ? <StepMark done />
          : <input type="checkbox" checked={false} disabled={busy || na}
              onChange={() => onMark()}
              style={{ margin: 0, width: '14px', height: '14px', flexShrink: 0, cursor: (busy || na) ? 'not-allowed' : 'pointer' }} />
        : step.manual
        ? <input type="checkbox" checked={done} disabled={busy || na || amountPending}
            onChange={e => onToggle(e.target.checked)}
            style={{ margin: 0, width: '14px', height: '14px', flexShrink: 0, cursor: (busy || na || amountPending) ? 'not-allowed' : 'pointer' }} />
        : <StepMark done={done} />}
      <span style={{ fontSize: '13px', color: step.done ? 'var(--wig-muted)' : 'var(--wig-ink)', flex: 1, minWidth: '140px' }}>
        {step.label}
        {showAmount && (
          <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--wig-muted)' }}>
            {step.state === REV_NOT_DUE
              ? 'No share due'
              // Nothing is being calculated on the provider's step — the figure
              // is simply not in yet, and an admin types it when it lands.
              : step.amount == null ? (step.key === 'revenue_received' ? 'Pending' : 'Pending calculation')
              : `$${moneyText(step.amount)}`}
          </span>
        )}
        {/* Greying a step out says it does not apply; the note says WHY, so the
            admin is not left inferring it from a strategy rule or a checkbox
            they cannot tick. Same muted 12px as the amount beside it — a reason,
            not a warning. */}
        {step.note && (
          <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--wig-muted)' }}>
            {`· ${step.note}`}
          </span>
        )}
        {/* The one step whose not-done has kinds. Money is owed in every state
            named here, so it carries the same orange the payments list uses for
            "still outstanding" rather than reading as a silent blank. */}
        {REV_UNSETTLED.includes(step.state) && (
          <span style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 600, color: ORANGE }}>
            {`· ${step.state}`}
          </span>
        )}
      </span>
      {step.owner && <span style={{ ...ownerChipStyle, marginLeft: 'auto' }}>{step.owner}</span>}
      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--wig-muted)', display: 'inline-block', width: '76px', textAlign: 'right', flexShrink: 0 }}>
        {step.at ? dateText(step.at) : '—'}
      </span>
    </div>
  )
}

// Filled tick when the step is done, hollow ring when it is not — the VFO track
// dot, with the tick added because these steps are a checklist rather than a
// status cascade.
function StepMark({ done }) {
  if (!done) {
    return <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'transparent', border: '1.5px solid var(--wig-border-mid)', flexShrink: 0, display: 'inline-block' }} />
  }
  return (
    <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: GREEN, border: `1.5px solid ${GREEN}`, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M1.6 5.2 L4 7.4 L8.4 2.6" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
