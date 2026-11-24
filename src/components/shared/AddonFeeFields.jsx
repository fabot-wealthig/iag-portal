import DiscountFields, { chargedFee, DISCOUNT_TOO_BIG, discountBlockReason, discountPayload, discountTooBig } from './DiscountFields'
import FeeLinesField, { EMPTY_FEE_LINES, feeLinesBlockReason, feeLinesFromPayment, feeLinesPayload, feeLinesTotal } from './FeeLinesField'

// An Implementation Fee billed IN THE SAME REQUEST as a LEOS fee (IAG, 2026-11-23):
// one link, one charge, one invoice, and a split of its own (the server's
// utils/payment-addon.ts). The same lines and discount an Implementation Fee takes by
// itself; the request form adds it and the Edit request form corrects it.

const linkStyle = { background: 'none', border: 'none', padding: 0, color: '#1D64A8', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }

export const EMPTY_ADDON = { lines: EMPTY_FEE_LINES, discountAmount: '', discountReason: '' }

/** LEOS and LEOS V2: the strategies an Implementation Fee may be billed with. */
export const takesAddon = (strategy) => strategy?.model === 'fee_waterfall'

export const addonStrategyOf = (strategies) => (strategies || []).find(s => s.key === 'IMPL_FEE' && s.active !== false) || null

/** The add-on already on a payment, back into the control. */
export function addonFromPayment(billedWith) {
  return {
    lines: feeLinesFromPayment(billedWith),
    discountAmount: billedWith?.discount_amount == null ? '' : String(billedWith.discount_amount),
    discountReason: billedWith?.discount_reason || '',
  }
}

/** What the client is charged for it, in dollars. */
export const addonCharged = (value) => chargedFee(feeLinesTotal(value.lines), value.discountAmount)

export function addonBlockReason(value) {
  const reason = feeLinesBlockReason(value.lines)
    || discountBlockReason(value.discountAmount, value.discountReason)
    || (discountTooBig(feeLinesTotal(value.lines), value.discountAmount) ? DISCOUNT_TOO_BIG : '')
  return reason ? `Implementation Fee: ${reason}` : ''
}

export function addonPayload(value) {
  return {
    addon: {
      ...feeLinesPayload(value.lines),
      total_fee: undefined,
      standard_fee: String(feeLinesTotal(value.lines)),
      ...discountPayload(value.discountAmount, value.discountReason),
    },
  }
}

export function AddAddonLink({ onClick }) {
  return <button type="button" onClick={onClick} style={linkStyle}>+ Add an Implementation Fee to this request</button>
}

export default function AddonFeeFields({ value, onChange, onRemove, strategies, strategy }) {
  return (
    <>
      <FeeLinesField lines={value.lines} onChange={lines => onChange({ ...value, lines })} strategies={strategies}
        selfKey={strategy?.key || 'IMPL_FEE'} selfName={strategy?.name || 'Implementation Fee'} />
      <DiscountFields amount={value.discountAmount} reason={value.discountReason} standard={feeLinesTotal(value.lines)}
        onChange={({ amount, reason }) => onChange({ ...value, discountAmount: amount, discountReason: reason })} />
      {onRemove && <div style={{ marginTop: '10px' }}><button type="button" onClick={onRemove} style={linkStyle}>Remove the Implementation Fee</button></div>}
    </>
  )
}
