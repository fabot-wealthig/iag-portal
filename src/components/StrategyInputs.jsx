import { MoneyInput, moneyDigitsOnly } from './shared/MoneyInput'

// What a provider strategy has to be told before it can say what it is worth:
// the box on Boxhouse, the premium and the client's year on 831(b), the
// investment and the implementation fee on DCD. One component, one readiness
// rule and one payload mapping, because two screens ask the same three
// questions — the request form asks them once, the receipt form asks them on
// every client line — and a third answer would be a strategy the server prices
// differently from the screen that quoted it.

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const selectStyle = { ...inputStyle, background: 'var(--wig-card)' }
const labelStyle = { fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }
// Inside a table row the label is a hint over a narrow control rather than a
// field label in a form, so it shrinks with the control it names. Exported
// because a row's OTHER controls have to wear the same hint to line up with
// these ones — one style, one label height, one baseline.
export const compactLabelStyle = { ...labelStyle, fontSize: '10px', marginBottom: '4px' }
const compactControlStyle = { ...inputStyle, padding: '8px 10px', fontSize: '13px' }
const compactSelectStyle = { ...compactControlStyle, background: 'var(--wig-card)' }

/** The shape `value` takes, and what a fresh line starts on. */
export const EMPTY_STRATEGY_INPUTS = { tierKey: '', premium: '', clientStatus: 'first', investment: '', implFeeCharged: true }

/** True once this strategy has been told everything it needs to be priced. */
export function providerInputsReady(strategy, value) {
  switch (strategy?.model) {
    case 'fixed_commission': return !!value.tierKey
    case 'retention_share': return Number(value.premium) > 0
    case 'contribution_pct': return Number(value.investment) > 0
    default: return false
  }
}

/**
 * The missing answer, as an imperative phrase — "choose a box size". Both forms
 * word their block reason from this one string rather than each naming the
 * inputs again, so a strategy cannot ask for one thing and complain about
 * another.
 */
export function providerInputPrompt(strategy) {
  switch (strategy?.model) {
    case 'fixed_commission': return 'choose a box size'
    case 'retention_share': return 'enter the premium'
    case 'contribution_pct': return 'enter the investment amount'
    default: return 'fill in the strategy details'
  }
}

/**
 * The per-model half of a row's payload, in the shape both writes take. The DCD
 * fee is held on the form as CHARGED and inverted here, on the way out, the same
 * way the LEOS legal letter is.
 */
export function providerRowPayload(strategy, value) {
  switch (strategy?.model) {
    case 'fixed_commission':
      return { strategy_inputs: { tier_key: value.tierKey } }
    case 'retention_share':
      return { contribution_amount: value.premium, strategy_inputs: { first_year: value.clientStatus === 'first' } }
    default:
      return { contribution_amount: value.investment, strategy_inputs: { implementation_fee_waived: !value.implFeeCharged } }
  }
}

export default function StrategyInputs({ strategy, value, onChange, compact = false }) {
  const model = strategy?.model || ''
  const label = compact ? compactLabelStyle : labelStyle
  const control = compact ? compactControlStyle : inputStyle
  const picker = compact ? compactSelectStyle : selectStyle

  return (
    <div style={{ display: 'flex', gap: compact ? '8px' : '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {model === 'fixed_commission' && (
        <div style={compact ? { width: '150px' } : { flex: '1 1 280px', maxWidth: '280px' }}>
          <label style={label}>Box size</label>
          <select value={value.tierKey} onChange={e => onChange({ tierKey: e.target.value })} style={picker}>
            <option value="">-- Select --</option>
            {((strategy.rules || {}).tiers || []).map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
      )}

      {model === 'retention_share' && (
        <>
          <div style={compact ? { width: '120px' } : { flex: 1, minWidth: '140px' }}>
            <label style={label}>Premium</label>
            {/* Compact is a bare input, not `MoneyInput`: a floating dollar
                sign inside a 120px cell reads as clutter beside the row's own
                money column. Same keystroke filter either way. */}
            {compact
              ? <input value={value.premium} onChange={e => onChange({ premium: moneyDigitsOnly(e.target.value) })}
                  placeholder="0.00" inputMode="decimal" style={control} />
              : <MoneyInput value={value.premium} onChange={v => onChange({ premium: v })} />}
          </div>
          <div style={compact ? { width: '140px' } : { flex: 1, minWidth: '140px' }}>
            <label style={label}>Client status</label>
            <select value={value.clientStatus} onChange={e => onChange({ clientStatus: e.target.value })} style={picker}>
              <option value="first">First-year client</option>
              <option value="returning">Returning client</option>
            </select>
          </div>
        </>
      )}

      {model === 'contribution_pct' && (
        <>
          <div style={compact ? { width: '130px' } : { flex: '1 1 280px', maxWidth: '280px' }}>
            <label style={label}>Investment amount</label>
            {compact
              ? <input value={value.investment} onChange={e => onChange({ investment: moneyDigitsOnly(e.target.value) })}
                  placeholder="0.00" inputMode="decimal" style={control} />
              : <MoneyInput value={value.investment} onChange={v => onChange({ investment: v })} />}
          </div>

          {/* Held as CHARGED rather than as waived, the same way the legal
              letter is on a LEOS payment, so the box reads as the thing being
              turned OFF. Unticking it changes the fee line below AND, for an
              ERT-affiliated COI, the share they take. */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', color: 'var(--wig-ink)',
            ...(compact
              ? { fontSize: '12px', paddingTop: '18px' }
              : { fontSize: '13px', width: '100%', marginTop: '12px' }),
          }}>
            <input type="checkbox" checked={value.implFeeCharged} onChange={e => onChange({ implFeeCharged: e.target.checked })}
              style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
            Implementation fee charged
          </label>
        </>
      )}
    </div>
  )
}
