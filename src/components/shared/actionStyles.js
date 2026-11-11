// ONE look for every button and form on the payment page (Jake, 2026-11-11:
// "the styles keep being different ... lets make consistent and natural").
//
//   buttonStyle         every button: the Actions row, Payout controls, Cancel
//   primaryButtonStyle  only the final Save / Record / Confirm inside an open form
//   dangerButtonStyle   only the final confirm of what cannot be undone
//                       (void, refund, delete a sandbox test)
//
// A button that cannot be used is not drawn, rather than drawn greyed out.

const base = { padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, lineHeight: 1.2, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }

export const buttonStyle = { ...base, border: '1px solid var(--wig-border-mid)', background: 'var(--wig-card)', color: 'var(--wig-ink)' }
export const primaryButtonStyle = { ...base, border: '1px solid transparent', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', color: '#ffffff' }
export const dangerButtonStyle = { ...base, border: '1px solid transparent', background: '#d93025', color: '#ffffff' }

// A button mid-write: dimmed and not clickable.
export const withBusy = (style, busy) => (busy ? { ...style, opacity: 0.6, cursor: 'not-allowed' } : style)

export const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
export const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
export const bodyStyle = { fontSize: '13.5px', lineHeight: 1.55, color: 'var(--wig-ink)', margin: '0 0 12px' }
export const labelStyle = { fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }
export const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
export const textareaStyle = { width: '100%', boxSizing: 'border-box', minHeight: '64px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '13px', fontFamily: 'Inter, sans-serif', resize: 'vertical' }
// A sub-heading inside a card ("What will be paid", "Team shares").
export const subheadStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)', marginBottom: '8px' }
export const buttonRowStyle = { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }

export const okTextStyle = { fontSize: '13px', color: '#1b9254', margin: '12px 0 0' }
export const warnTextStyle = { fontSize: '13px', color: '#EE6A33', fontWeight: 600, margin: '8px 0 0' }
export const errorTextStyle = { fontSize: '13px', color: '#d93025', margin: '12px 0 0' }

export function money(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'
}

export function dateText(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
