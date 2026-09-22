import { useState } from 'react'
import { fmtMoney } from '../../lib/revenuePreview'
import { MoneyInput } from './MoneyInput'

// The optional fee discount every strategy's fee can carry: how much was taken
// off the standard fee, and why. RECORD ONLY — the fee typed next to it is still
// the fee charged or received, so nothing here feeds a preview or a total. The
// request form and every line of the receipt form ask it the same way, so the
// control and its rules live here once.

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const labelStyle = { fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }
const compactLabelStyle = { ...labelStyle, fontSize: '10px', marginBottom: '4px' }
const linkStyle = { background: 'none', border: 'none', padding: 0, color: '#1D64A8', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }

export const discountEntered = (amount) => Number(amount) > 0

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

export default function DiscountFields({ amount, reason, onChange, compact = false }) {
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
      <button type="button" onClick={() => { onChange({ amount: '', reason: '' }); setOpen(false) }}
        style={{ ...linkStyle, color: 'var(--wig-muted)', marginTop: '6px' }}>
        Remove
      </button>
    </div>
  )
}
