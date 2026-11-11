import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import DiscountFields, { DISCOUNT_TOO_BIG, discountBlockReason, discountPayload, discountTooBig, standardFeeOf } from './shared/DiscountFields'
import FeeLinesField, { feeLinesBlockReason, feeLinesFromPayment, feeLinesPayload, feeLinesTotal } from './shared/FeeLinesField'
import LegalFirmField, { legalFirmChoice, legalFirmPayload } from './shared/LegalFirmField'
import { MoneyInput } from './shared/MoneyInput'
import { bodyStyle, buttonRowStyle, buttonStyle, errorTextStyle, labelStyle, primaryButtonStyle, withBusy } from './shared/actionStyles'

const asText = (v) => (v == null ? '' : String(v))

/**
 * Edit payment request (IAG, Brittany 2026-10-22): correct an unpaid request —
 * the fee, LEOS's offset and letter, the legal firm, the discount. The server
 * emails the client the updated request when the fee or discount changed, the
 * two things the email states (Jake, 2026-10-26). Only while the client has not paid (a failed payment's
 * link is open again); the server refuses anything else and closes any Stripe
 * page the client already opened at the old amount. The client's profile gets a
 * signed note of what changed. The write is never retried (lib/api.js).
 *
 * PaymentActions.jsx offers "Edit request" only while that is so (`editable`)
 * and mounts this form, filled from the payment, when it is pressed.
 */
export function editable(payment) {
  return payment.funded_by !== 'provider'
    && (!payment.payment_status || payment.payment_status === 'failed')
    && !payment.refund_status
    && !payment.voided_at
}

export default function EditRequestForm({ payment, reload, onDone, onCancel }) {
  // The STANDARD fee (what is charged plus the discount): the discount comes off
  // again on save, on the server (utils/charged-fee.ts, Jake 2026-11-11).
  const [totalFee, setTotalFee] = useState(asText(standardFeeOf(payment)))
  const [offsetAmount, setOffsetAmount] = useState(asText(payment.offset_amount))
  const [legalRequired, setLegalRequired] = useState(payment.legal_fee_waived !== true)
  const [legalFirmId, setLegalFirmId] = useState(payment.legal_fee_payee_id || '')
  const [discountAmount, setDiscountAmount] = useState(asText(payment.discount_amount))
  const [discountReason, setDiscountReason] = useState(payment.discount_reason || '')
  const [payees, setPayees] = useState(null)
  const [payeesError, setPayeesError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // The Implementation Fee's lines (FeeLinesField) and the strategies they name.
  const [feeLines, setFeeLines] = useState(() => feeLinesFromPayment(payment))
  const [strategies, setStrategies] = useState(null)

  const model = payment.strategy_model || 'fee_waterfall'
  const feeOnly = model === 'client_fee_pool' || model === 'fee_pct_waterfall'
  const clientFeePool = model === 'client_fee_pool'
  const needsLegalFirm = model === 'fee_pct_waterfall' || (!feeOnly && legalRequired)

  useEffect(() => {
    if (payees !== null) return
    let live = true
    callApi('load_payees')
      .then(res => { if (live) setPayees(res.payees || []) })
      .catch(err => {
        if (!live) return
        setPayeesError(err.message)
        setPayees([])
      })
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!clientFeePool || strategies !== null) return
    let live = true
    callApi('load_strategies')
      .then(res => { if (live) setStrategies(res.strategies || []) })
      .catch(err => {
        if (!live) return
        setError(`Could not load strategies: ${err.message}`)
        setStrategies([])
      })
    return () => { live = false }
  }, [])

  // Same mode as the payment; the firm already on it stays offered even if it
  // has since been deactivated. A LEOS letter with no firm on it was paid
  // outside the portal, and reopens that way (shared/LegalFirmField.jsx).
  const legalFirms = (payees || []).filter(p => p.kind === 'legal_firm'
    && (p.sandbox === true) === (payment.sandbox === true)
    && (p.active !== false || p.id === payment.legal_fee_payee_id))
  const chosenLegalFirm = legalFirmChoice(legalFirmId, legalFirms, !feeOnly)

  const fee = clientFeePool ? feeLinesTotal(feeLines) : Number(totalFee)
  const offset = Number(offsetAmount)
  const blockReason =
    clientFeePool && strategies === null ? 'Loading strategies...'
    : clientFeePool && feeLinesBlockReason(feeLines) ? feeLinesBlockReason(feeLines)
    : !(fee > 0) ? 'Enter the fee amount.'
    : !feeOnly && !(offset > 0) ? 'Enter the offset amount.'
    : needsLegalFirm && !chosenLegalFirm ? 'Choose the legal firm.'
    : discountBlockReason(discountAmount, discountReason) || (discountTooBig(fee, discountAmount) ? DISCOUNT_TOO_BIG : '')

  async function save() {
    if (busy || blockReason) return
    setBusy(true)
    setError('')
    try {
      const res = await callApi('edit_payment_request', {
        payment_id: payment.id,
        ...(clientFeePool ? { ...feeLinesPayload(feeLines), total_fee: undefined, standard_fee: String(fee) } : { standard_fee: totalFee }),
        ...(feeOnly ? {} : { offset_amount: offsetAmount, legal_fee_waived: !legalRequired }),
        ...(needsLegalFirm ? legalFirmPayload(chosenLegalFirm) : {}),
        ...discountPayload(discountAmount, discountReason),
      })
      await reload()
      onDone({
        message: `Saved: ${(res.changes || []).join('; ')}.${res.email_drafted ? ` Updated request ${res.emailed ? 'sent to' : 'drafted to Gmail for'} ${res.to_email}.` : ''}`,
        warning: res.warning || '',
        error: res.email_error || '',
      })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div>
          <p style={bodyStyle}>
            The client has not paid yet, so the request can still be corrected. A wrong client name is fixed on the client's profile.
          </p>
          {clientFeePool ? (
            <FeeLinesField lines={feeLines} onChange={setFeeLines} strategies={strategies || []}
              selfKey={payment.strategy_key} selfName={payment.strategy_name || 'Implementation Fee'} />
          ) : (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {!feeOnly && (
                <div style={{ flex: 1, minWidth: '140px' }}>
                  <label style={labelStyle}>Offset amount</label>
                  <MoneyInput value={offsetAmount} onChange={setOffsetAmount} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label style={labelStyle}>{feeOnly ? 'Standard fee' : 'Standard client fee'}</label>
                <MoneyInput value={totalFee} onChange={setTotalFee} />
              </div>
            </div>
          )}

          {!feeOnly && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: 'var(--wig-ink)', cursor: 'pointer', marginTop: '12px' }}>
              <input type="checkbox" checked={legalRequired} onChange={e => setLegalRequired(e.target.checked)}
                style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
              Legal opinion letter required
            </label>
          )}

          {needsLegalFirm && (
            <LegalFirmField payees={payees} payeesError={payeesError} firms={legalFirms}
              value={chosenLegalFirm} onChange={setLegalFirmId} outsideAllowed={!feeOnly}
              emptyMessage={`No legal firm is set up in ${payment.sandbox === true ? 'sandbox' : 'live'} mode. Add one under Automation & Config → Payees.`} />
          )}

          <DiscountFields amount={discountAmount} reason={discountReason} standard={fee}
            onChange={({ amount, reason }) => { setDiscountAmount(amount); setDiscountReason(reason) }} />

          <div style={{ fontSize: '12px', color: 'var(--wig-muted)', marginTop: '14px' }}>
            {payment.invoiced_outside
              ? 'Invoiced outside the portal: the client is not emailed about any change.'
              : `If the fee${clientFeePool ? ' (or its lines)' : ''} or the discount changes, the client is emailed the updated request. Other changes are internal and send nothing.`}
          </div>

          {blockReason && !busy && (
            <div style={{ fontSize: '12px', color: '#EE6A33', fontWeight: 600, marginTop: '12px' }}>{blockReason}</div>
          )}
          <div style={{ ...buttonRowStyle, marginTop: '14px' }}>
            <button type="button" disabled={busy || !!blockReason} onClick={save} style={withBusy(primaryButtonStyle, busy || !!blockReason)}>
              {busy ? 'Saving...' : 'Save changes'}
            </button>
            <button type="button" disabled={busy} onClick={onCancel} style={withBusy(buttonStyle, busy)}>Cancel</button>
          </div>
      {error && <p style={errorTextStyle}>{error}</p>}
    </div>
  )
}
