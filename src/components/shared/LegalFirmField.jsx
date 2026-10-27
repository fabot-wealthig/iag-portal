// Who is paid the legal fee, asked on the request form and the Edit payment
// request card. A firm chosen here is paid by Stripe transfer once the money
// clears (hard-costs.ts). On LEOS the letter can instead be PAID OUTSIDE THE
// PORTAL (IAG, Brittany 2026-10-27: the opinion-letter firm takes payment
// through its own online system), and that is the default there: the server
// stores no firm, the letter still comes off the top, and Progress offers
// "Legal opinion letter paid" as a tick for an admin once it has been paid.
// NBDT's attorney fee always names its firm, so it never offers the choice.

const selectStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-card)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const labelStyle = { fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }
const hintStyle = { fontSize: '12px', color: 'var(--wig-muted)', marginTop: '6px' }

export const LEGAL_OUTSIDE = 'outside'

/** The choice in force: the firm picked, else (where allowed) paid outside the portal, else none. */
export function legalFirmChoice(pickedId, firms, outsideAllowed) {
  if (firms.some(p => p.id === pickedId)) return pickedId
  return outsideAllowed ? LEGAL_OUTSIDE : ''
}

/** What the request sends for the choice. */
export function legalFirmPayload(choice) {
  return choice === LEGAL_OUTSIDE ? { legal_fee_outside: true } : { legal_fee_payee_id: choice }
}

export default function LegalFirmField({ payees, payeesError, firms, value, onChange, outsideAllowed, emptyMessage }) {
  const showSelect = payees !== null && (outsideAllowed || firms.length > 0)
  return (
    <div style={{ marginTop: '12px' }}>
      <label style={labelStyle}>Legal firm</label>
      {payees === null && <div style={{ fontSize: '12px', color: 'var(--wig-muted)' }}>Loading legal firms...</div>}
      {payeesError && <div style={{ fontSize: '12px', color: '#d93025', marginBottom: showSelect ? '6px' : 0 }}>{`Could not load legal firms: ${payeesError}`}</div>}
      {showSelect ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
          {outsideAllowed
            ? <option value={LEGAL_OUTSIDE}>Paid outside the portal</option>
            : <option value="">-- Select --</option>}
          {firms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      ) : payees !== null && !payeesError && (
        <div style={{ fontSize: '12px', color: 'var(--wig-muted)' }}>{emptyMessage}</div>
      )}
      {outsideAllowed && value === LEGAL_OUTSIDE && (
        <div style={hintStyle}>
          The portal sends the firm nothing. Tick "Legal opinion letter paid" on the payment's Progress once it is paid through the firm's own system.
        </div>
      )}
    </div>
  )
}
