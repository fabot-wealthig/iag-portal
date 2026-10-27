import { MoneyInput } from './MoneyInput'
import { fmtMoney } from '../../lib/revenuePreview'

// The Implementation Fee's lines (IAG, Olivia via Brittany 2026-10-26): a client
// implementing several strategies is billed ONE fee with a line per strategy —
// "LEOS Implementation Fee $5,000 / DCD Implementation Fee $3,500" — so they see
// what each costs. One line with no strategy is the plain fee it always was. The
// server labels each line "<Strategy> <this strategy's name>" and keeps the
// total equal to the lines (utils/fee-lines.ts); the form and the Edit payment
// request card both ask through this one control.

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-card)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const labelStyle = { fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }
const linkButtonStyle = { background: 'none', border: 'none', padding: 0, color: '#1D64A8', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }

export const FEE_LINES_MAX = 10

export const EMPTY_FEE_LINES = [{ strategyKey: '', amount: '' }]

const toCents = (v) => Math.round(Number(v) * 100)

/** The total the lines add up to, in dollars; NaN-safe (a blank line is 0). */
export function feeLinesTotal(lines) {
  return lines.reduce((sum, l) => sum + (toCents(l.amount) || 0), 0) / 100
}

export function feeLinesBlockReason(lines) {
  if (lines.some(l => !(Number(l.amount) > 0))) return lines.length > 1 ? 'Enter an amount on every line.' : 'Enter the fee amount before submitting.'
  if (lines.length > 1 && lines.some(l => !l.strategyKey)) return 'Choose a strategy on every line.'
  return ''
}

/** What the request sends: the plain fee, or the lines plus their total. */
export function feeLinesPayload(lines) {
  if (lines.length === 1 && !lines[0].strategyKey) return { total_fee: lines[0].amount }
  return {
    fee_lines: lines.map(l => ({ strategy_key: l.strategyKey, amount: l.amount })),
    total_fee: String(feeLinesTotal(lines)),
  }
}

/** A payment's stored lines back into the control, or its plain fee as one line. */
export function feeLinesFromPayment(payment) {
  const stored = Array.isArray(payment?.fee_lines) ? payment.fee_lines : []
  if (stored.length > 0) return stored.map(l => ({ strategyKey: l.strategy_key || '', amount: l.amount == null ? '' : String(l.amount) }))
  return [{ strategyKey: '', amount: payment?.total_fee == null ? '' : String(payment.total_fee) }]
}

/**
 * Under a list row's strategy name: each line's strategy and amount, one per
 * line (Jake, 2026-10-27: the row grows). Nothing for a row with no lines.
 */
export function FeeLineList({ lines }) {
  if (!Array.isArray(lines) || lines.length === 0) return null
  return (
    <ul style={{ margin: '4px 0 0', paddingLeft: '16px', fontSize: '12px', fontWeight: 400, color: 'var(--wig-muted)', lineHeight: 1.5 }}>
      {lines.map((l, i) => <li key={i}>{`${l.name} $${fmtMoney(Number(l.amount) || 0)}`}</li>)}
    </ul>
  )
}

export default function FeeLinesField({ lines, onChange, strategies, selfKey, selfName }) {
  const choices = (strategies || []).filter(s => s.active !== false && s.key !== selfKey)
  const several = lines.length > 1
  const set = (i, patch) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  return (
    <div>
      {lines.map((line, i) => {
        const taken = lines.filter((_, j) => j !== i).map(l => l.strategyKey)
        return (
          <div key={i} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '10px' }}>
            <div style={{ flex: 2, minWidth: '180px' }}>
              {i === 0 && <label style={labelStyle}>Strategy</label>}
              <select value={line.strategyKey} onChange={e => set(i, { strategyKey: e.target.value })} style={inputStyle}>
                <option value="">{several ? '-- Select --' : `None (${selfName})`}</option>
                {choices.filter(s => !taken.includes(s.key)).map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '140px' }}>
              {i === 0 && <label style={labelStyle}>Fee amount</label>}
              <MoneyInput value={line.amount} onChange={v => set(i, { amount: v })} />
            </div>
            {several && (
              <button type="button" onClick={() => onChange(lines.filter((_, j) => j !== i))}
                style={{ ...linkButtonStyle, color: 'var(--wig-muted)', paddingBottom: '11px' }}>Remove</button>
            )}
          </div>
        )
      })}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {lines.length < FEE_LINES_MAX ? (
          <button type="button" onClick={() => onChange([...lines, { strategyKey: '', amount: '' }])} style={linkButtonStyle}>
            + Add a line
          </button>
        ) : <span />}
        {several && (
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--wig-ink)' }}>{`Total $${fmtMoney(feeLinesTotal(lines))}`}</span>
        )}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--wig-muted)', marginTop: '6px' }}>
        {`Bill several strategies on one invoice: each line is shown to the client as "<Strategy> ${selfName}".`}
      </div>
    </div>
  )
}
