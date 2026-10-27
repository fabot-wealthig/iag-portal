import { useLayoutEffect, useReducer, useRef } from 'react'

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

// "1234567.5" → "1,234,567.5". Commas in the whole dollars only; the cents are
// left exactly as typed, so "12." still shows its point.
export const withCommas = (raw) => {
  const [whole, ...rest] = String(raw ?? '').split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return rest.length ? `${grouped}.${rest.join('')}` : grouped
}

// The bare input under `MoneyInput`, for the places a floating dollar sign does
// not fit. The commas are display only (Jake, 2026-10-27): `onChange` hands back
// the plain digits and the caller's state never holds a comma, so every
// `Number(...)` and payload downstream is unchanged. A comma appearing or
// going away would otherwise throw the caret to the end of the field, so the
// caret is put back after the same count of digits it sat behind. Every
// keystroke renders this input, even one the filter dropped (a letter, a comma
// typed by hand), because the caret is only put back on a render.
export function BareMoneyInput({ value, onChange, placeholder = '0.00', style }) {
  const ref = useRef(null)
  const caretDigits = useRef(null)
  const [, rerender] = useReducer(n => n + 1, 0)

  useLayoutEffect(() => {
    const el = ref.current
    if (caretDigits.current == null || !el || document.activeElement !== el) return
    let seen = 0
    let pos = 0
    while (pos < el.value.length && seen < caretDigits.current) {
      if (el.value[pos] !== ',') seen++
      pos++
    }
    el.setSelectionRange(pos, pos)
    caretDigits.current = null
  })

  return (
    <input ref={ref} value={withCommas(value)} placeholder={placeholder} inputMode="decimal" style={style}
      onChange={e => {
        const typed = e.target.value
        caretDigits.current = typed.slice(0, e.target.selectionStart ?? typed.length).replace(/[^0-9.]/g, '').length
        rerender()
        onChange(moneyDigitsOnly(typed))
      }} />
  )
}

// A dollar field with the sign sitting inside it, so the amount is typed
// without one.
export function MoneyInput({ value, onChange }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--wig-muted)', fontSize: '14px' }}>$</span>
      <BareMoneyInput value={value} onChange={onChange} style={{ ...inputStyle, paddingLeft: '28px' }} />
    </div>
  )
}

export default MoneyInput
