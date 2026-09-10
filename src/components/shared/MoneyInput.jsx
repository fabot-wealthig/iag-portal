// The dollar field the portal asks every money question with, and the keystroke
// filter behind it. It lived in `ClientPaymentForm` and was copied into
// `PaymentDetail`, which was two copies of one control; now that a third and a
// fourth form ask for a dollar amount — the receipt total and every client line
// under it — there is one.

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }

// Keystroke filter for a dollar-amount input: digits and AT MOST one decimal
// point, everything else dropped. Deliberately NOT a parse — it returns the
// STRING so a half-typed "12." keeps its point while the admin is still typing.
export const moneyDigitsOnly = (raw) => {
  const cleaned = String(raw ?? '').replace(/[^0-9.]/g, '')
  const [whole, ...rest] = cleaned.split('.')
  return rest.length ? `${whole}.${rest.join('')}` : whole
}

// A dollar field with the sign sitting inside it, so the amount is typed
// without one.
export function MoneyInput({ value, onChange }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--wig-muted)', fontSize: '14px' }}>$</span>
      <input value={value} onChange={e => onChange(moneyDigitsOnly(e.target.value))} placeholder="0.00"
        inputMode="decimal" style={{ ...inputStyle, paddingLeft: '28px' }} />
    </div>
  )
}

export default MoneyInput
