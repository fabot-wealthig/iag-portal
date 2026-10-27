import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import DiscountFields, { discountBlockReason, discountPayload } from './shared/DiscountFields'
import FeeLinesField, { feeLinesBlockReason, feeLinesFromPayment, feeLinesPayload, feeLinesTotal } from './shared/FeeLinesField'
import { MoneyInput } from './shared/MoneyInput'

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const bodyStyle = { fontSize: '13.5px', lineHeight: 1.55, color: 'var(--wig-ink)', margin: '0 0 12px' }
const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const selectStyle = { ...inputStyle, background: 'var(--wig-card)' }
const labelStyle = { fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }
const primaryButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const outlineButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }

const asText = (v) => (v == null ? '' : String(v))

/**
 * Edit payment request (IAG, Brittany 2026-10-22): correct an unpaid request —
 * the fee, LEOS's offset and letter, the legal firm, the discount. The server
 * emails the client the updated request when the fee or discount changed, the
 * two things the email states (Jake, 2026-10-26). Only while the client has not paid (a failed payment's
 * link is open again); the server refuses anything else and closes any Stripe
 * page the client already opened at the old amount. The client's profile gets a
 * signed note of what changed. The write is never retried (lib/api.js).
 */
export default function EditRequestCard({ payment, onSaved }) {
  const [open, setOpen] = useState(false)
  const [totalFee, setTotalFee] = useState('')
  const [offsetAmount, setOffsetAmount] = useState('')
  const [legalRequired, setLegalRequired] = useState(true)
  const [legalFirmId, setLegalFirmId] = useState('')
  const [discountAmount, setDiscountAmount] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [payees, setPayees] = useState(null)
  const [payeesError, setPayeesError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  // The Implementation Fee's lines (FeeLinesField) and the strategies they name.
  const [feeLines, setFeeLines] = useState([])
  const [strategies, setStrategies] = useState(null)

  const model = payment.strategy_model || 'fee_waterfall'
  const feeOnly = model === 'client_fee_pool' || model === 'fee_pct_waterfall'
  const clientFeePool = model === 'client_fee_pool'
  const needsLegalFirm = model === 'fee_pct_waterfall' || (!feeOnly && legalRequired)

  useEffect(() => {
    if (!open || payees !== null) return
    let live = true
    callApi('load_payees')
      .then(res => { if (live) setPayees(res.payees || []) })
      .catch(err => {
        if (!live) return
        setPayeesError(err.message)
        setPayees([])
      })
    return () => { live = false }
  }, [open])

  useEffect(() => {
    if (!open || !clientFeePool || strategies !== null) return
    let live = true
    callApi('load_strategies')
      .then(res => { if (live) setStrategies(res.strategies || []) })
      .catch(err => {
        if (!live) return
        setError(`Could not load strategies: ${err.message}`)
        setStrategies([])
      })
    return () => { live = false }
  }, [open])

  const editable = payment.funded_by !== 'provider'
    && (!payment.payment_status || payment.payment_status === 'failed')
    && !payment.refund_status
  if (!editable) return null

  function start() {
    setTotalFee(asText(payment.total_fee))
    setFeeLines(feeLinesFromPayment(payment))
    setOffsetAmount(asText(payment.offset_amount))
    setLegalRequired(payment.legal_fee_waived !== true)
    setLegalFirmId(payment.legal_fee_payee_id || '')
    setDiscountAmount(asText(payment.discount_amount))
    setDiscountReason(payment.discount_reason || '')
    setError('')
    setResult(null)
    setOpen(true)
  }

  // Same mode as the payment; the firm already on it stays offered even if it
  // has since been deactivated.
  const legalFirms = (payees || []).filter(p => p.kind === 'legal_firm'
    && (p.sandbox === true) === (payment.sandbox === true)
    && (p.active !== false || p.id === payment.legal_fee_payee_id))
  const chosenLegalFirm = legalFirms.some(p => p.id === legalFirmId) ? legalFirmId : ''

  const fee = clientFeePool ? feeLinesTotal(feeLines) : Number(totalFee)
  const offset = Number(offsetAmount)
  const blockReason =
    clientFeePool && strategies === null ? 'Loading strategies...'
    : clientFeePool && feeLinesBlockReason(feeLines) ? feeLinesBlockReason(feeLines)
    : !(fee > 0) ? 'Enter the fee amount.'
    : !feeOnly && !(offset > 0) ? 'Enter the offset amount.'
    : needsLegalFirm && !chosenLegalFirm ? 'Choose the legal firm.'
    : discountBlockReason(discountAmount, discountReason)

  async function save() {
    if (busy || blockReason) return
    setBusy(true)
    setError('')
    try {
      const res = await callApi('edit_payment_request', {
        payment_id: payment.id,
        ...(clientFeePool ? feeLinesPayload(feeLines) : { total_fee: totalFee }),
        ...(feeOnly ? {} : { offset_amount: offsetAmount, legal_fee_waived: !legalRequired }),
        ...(needsLegalFirm ? { legal_fee_payee_id: chosenLegalFirm } : {}),
        ...discountPayload(discountAmount, discountReason),
      })
      setResult(res)
      setOpen(false)
      setBusy(false)
      await onSaved()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>Edit payment request</div>
      {!open ? (
        <>
          <p style={bodyStyle}>
            The client has not paid yet, so the request can still be corrected. A wrong client name is fixed on the client's profile.
          </p>
          <button type="button" onClick={start} style={outlineButtonStyle}>Edit payment request</button>
        </>
      ) : (
        <>
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
                <label style={labelStyle}>{feeOnly ? 'Fee amount' : 'Total client fee'}</label>
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
            <div style={{ marginTop: '12px' }}>
              <label style={labelStyle}>Legal firm</label>
              {payees === null ? (
                <div style={{ fontSize: '12px', color: 'var(--wig-muted)' }}>Loading legal firms...</div>
              ) : payeesError ? (
                <div style={{ fontSize: '12px', color: '#d93025' }}>{`Could not load legal firms: ${payeesError}`}</div>
              ) : (
                <select value={chosenLegalFirm} onChange={e => setLegalFirmId(e.target.value)} style={selectStyle}>
                  <option value="">-- Select --</option>
                  {legalFirms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>
          )}

          <DiscountFields amount={discountAmount} reason={discountReason}
            onChange={({ amount, reason }) => { setDiscountAmount(amount); setDiscountReason(reason) }} />

          <div style={{ fontSize: '12px', color: 'var(--wig-muted)', marginTop: '14px' }}>
            If the fee{clientFeePool ? ' (or its lines)' : ''} or the discount changes, the client is emailed the updated request. Other changes are internal and send nothing.
          </div>

          {blockReason && !busy && (
            <div style={{ fontSize: '12px', color: '#EE6A33', fontWeight: 600, marginTop: '12px' }}>{blockReason}</div>
          )}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
            <button type="button" disabled={busy || !!blockReason} onClick={save}
              style={{ ...primaryButtonStyle, opacity: busy || blockReason ? 0.6 : 1, cursor: busy || blockReason ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Saving...' : 'Save changes'}
            </button>
            <button type="button" disabled={busy} onClick={() => { setOpen(false); setError('') }} style={outlineButtonStyle}>Cancel</button>
          </div>
        </>
      )}

      {result && !open && (
        <div style={{ marginTop: '12px', fontSize: '13px', lineHeight: 1.55 }}>
          <div style={{ color: '#1b9254' }}>
            {`Saved: ${(result.changes || []).join('; ')}.`}
            {result.email_drafted ? ` Updated request ${result.emailed ? 'sent to' : 'drafted to Gmail for'} ${result.to_email}.` : ''}
          </div>
          {result.email_error && <div style={{ color: '#d93025', marginTop: '4px' }}>{result.email_error}</div>}
          {result.warning && <div style={{ color: '#EE6A33', fontWeight: 600, marginTop: '4px' }}>{result.warning}</div>}
        </div>
      )}
      {error && <p style={{ color: '#d93025', fontSize: '13px', marginTop: '12px', marginBottom: 0 }}>{error}</p>}
    </div>
  )
}
