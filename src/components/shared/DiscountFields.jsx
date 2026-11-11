import { useState } from 'react'
import { fmtMoney } from '../../lib/revenuePreview'
import { MoneyInput } from './MoneyInput'

// The optional fee discount every strategy's fee can carry: how much was taken
// off the standard fee, and why. On a CLIENT request (Jake, 2026-11-11, after
// Brittany) the fee typed is the STANDARD fee and the client is charged it less
// the discount — `chargedFee` here, and the server's utils/charged-fee.ts, which
// stores what is charged as `total_fee`. Given `standard`, the control says
// "Client is charged: $X" as it is typed. On a PROVIDER receipt line it stays a
// note on money already received (no `standard`). The request form, the Edit
// payment request card and every receipt line ask it the same way.

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const labelStyle = { fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }
const compactLabelStyle = { ...labelStyle, fontSize: '10px', marginBottom: '4px' }
const linkStyle = { background: 'none', border: 'none', padding: 0, color: '#1D64A8', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }

export const discountEntered = (amount) => Number(amount) > 0

const toCents = (v) => Math.round(Number(v) * 100)

/** What the client is charged: the standard fee less the discount, in dollars. */
export function chargedFee(standard, amount) {
  const off = discountEntered(amount) ? toCents(amount) : 0
  return (toCents(standard) - off) / 100
}

/** The standard fee of a stored payment: what was charged plus its discount. */
export function standardFeeOf(payment) {
  const charged = Number(payment?.total_fee)
  if (!Number.isFinite(charged)) return null
  return (toCents(charged) + (discountEntered(payment?.discount_amount) ? toCents(payment.discount_amount) : 0)) / 100
}

// The server refuses the same: nothing is raised for $0 or less.
export const DISCOUNT_TOO_BIG = 'The discount must be less than the standard fee.'
export function discountTooBig(standard, amount) {
  return discountEntered(amount) && Number(standard) > 0 && toCents(amount) >= toCents(standard)
}

// "-$1,000.00", or null when the payment row carries no discount.
export function discountAmountText(row) {
  return discountEntered(row?.discount_amount) ? `-$${fmtMoney(Number(row.discount_amount))}` : null
}

// What stops the submit, or '' — the server refuses the same case.
export function discountBlockReason(amount, reason) {
  return discountEntered(amount) && !String(reason || '').trim() ? 'Enter a reason for the discount' : ''
}

// Sent only when there is a discount, so a request without one reads exactly
// as it did before the field existed.
export function discountPayload(amount, reason) {
  return discountEntered(amount) ? { discount_amount: amount, discount_reason: String(reason || '').trim() } : {}
}

export default function DiscountFields({ amount, reason, onChange, compact = false, standard }) {
  // Open from the start when the parent already holds a discount, so a value
  // can never sit hidden behind the link.
  const [open, setOpen] = useState(() => !!amount || !!reason)
  const label = compact ? compactLabelStyle : labelStyle

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ ...linkStyle, marginTop: compact ? '8px' : '12px' }}>
        + Add a fee discount
      </button>
    )
  }

  return (
    <div style={{ marginTop: compact ? '8px' : '12px' }}>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '0 1 180px', minWidth: '140px' }}>
          <label style={label}>Discount amount</label>
          <MoneyInput value={amount} onChange={v => onChange({ amount: v, reason })} />
        </div>
        <div style={{ flex: '1 1 240px', minWidth: '180px' }}>
          <label style={label}>Reason</label>
          <input value={reason} onChange={e => onChange({ amount, reason: e.target.value })}
            maxLength={500} placeholder="Why the standard fee was reduced" style={inputStyle} />
        </div>
      </div>
      {/* A client request: the figure the client will actually pay. */}
      {standard != null && discountEntered(amount) && Number(standard) > 0 && (
        discountTooBig(standard, amount)
          ? <div style={{ fontSize: '13px', color: '#EE6A33', fontWeight: 600, marginTop: '10px' }}>{DISCOUNT_TOO_BIG}</div>
          : (
            <div style={{ fontSize: '13px', color: 'var(--wig-ink)', marginTop: '10px' }}>
              {`Standard fee $${fmtMoney(Number(standard))} less $${fmtMoney(Number(amount))} discount. `}
              <strong>{`Client is charged: $${fmtMoney(chargedFee(standard, amount))}`}</strong>
            </div>
          )
      )}
      <button type="button" onClick={() => { onChange({ amount: '', reason: '' }); setOpen(false) }}
        style={{ ...linkStyle, color: 'var(--wig-muted)', marginTop: '6px', display: 'block' }}>
        Remove
      </button>
    </div>
  )
}
