import { useState } from 'react'
import { callApi } from '../lib/api'

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const selectStyle = { ...inputStyle, background: 'var(--wig-card)' }
const labelStyle = { fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }
const sectionEyebrowStyle = { fontSize: '12px', color: '#1D64A8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }
const innerBoxStyle = { background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }
const rowStyle = (strong) => ({ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px', color: 'var(--wig-ink)', marginBottom: '4px', fontWeight: strong ? 700 : 400 })

// Keystroke filter for a dollar-amount input: digits and AT MOST one decimal
// point, everything else dropped. Deliberately NOT a parse — it returns the
// STRING so a half-typed "12." keeps its point while the admin is still typing.
const moneyDigitsOnly = (raw) => {
  const cleaned = String(raw ?? '').replace(/[^0-9.]/g, '')
  const [whole, ...rest] = cleaned.split('.')
  return rest.length ? `${whole}.${rest.join('')}` : whole
}

const fmtMoney = (n) => (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Percentages arrive from Postgres `numeric` as strings; a trailing ".00" is
// dropped so 1.5% reads as 1.5%.
const pctText = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? `${Number(n.toFixed(2))}%` : '—'
}

const round2 = (n) => Math.round(n * 100) / 100

export default function ClientPaymentForm({ client, member, strategies, onSubmitted, onCancel }) {
  const [strategyKey, setStrategyKey] = useState('')
  const [offsetAmount, setOffsetAmount] = useState('')
  const [totalFee, setTotalFee] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const active = strategies.filter(s => s.active !== false)
  const strategy = active.find(s => s.key === strategyKey) || null

  const offset = Number(offsetAmount)
  const fee = Number(totalFee)
  const amountsReady = Number.isFinite(offset) && offset > 0 && Number.isFinite(fee) && fee > 0

  const preview = (strategy && amountsReady) ? computePreview(strategy, member, offset, fee) : null
  const poolNegative = !!preview && preview.pool < 0

  const blockReason =
    !strategyKey ? 'Choose a strategy before submitting.'
    : !amountsReady ? 'Enter the offset amount and the total client fee before submitting.'
    : poolNegative ? 'The client fee must cover the hard costs and the processing fee.'
    : ''
  const blockSubmit = submitting || !!blockReason

  async function handleSubmit() {
    if (blockSubmit) return
    setSubmitting(true); setError('')
    try {
      const res = await callApi('start_client_payment', {
        client_id: client.id,
        strategy_key: strategyKey,
        offset_amount: offsetAmount,
        total_fee: totalFee,
        notes,
      })
      onSubmitted(res)
    } catch (err) {
      // start_client_payment is a write — the server's wording is the wording
      // the admin sees, including which number it refused.
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div style={{ background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '10px', padding: '16px' }}>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Strategy</label>
        <select value={strategyKey} onChange={e => setStrategyKey(e.target.value)} style={selectStyle}>
          <option value="">-- Select --</option>
          {active.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
      </div>

      {/* The strategy decides every number below it, so nothing else is asked
          for until one is chosen. */}
      {strategy && (
        <>
          <div style={innerBoxStyle}>
            <div style={sectionEyebrowStyle}>Fee details</div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label style={labelStyle}>Offset amount</label>
                <MoneyInput value={offsetAmount} onChange={setOffsetAmount} />
              </div>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label style={labelStyle}>Total client fee</label>
                <MoneyInput value={totalFee} onChange={setTotalFee} />
              </div>
            </div>

            {preview && <RevenuePreview preview={preview} />}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Optional, for reference"
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </>
      )}

      {blockReason && !submitting && (
        <div style={{ fontSize: '12px', color: '#EE6A33', fontWeight: 600, marginBottom: '8px' }}>{blockReason}</div>
      )}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
        <button onClick={handleSubmit} disabled={blockSubmit}
          style={{ flex: 1, padding: '12px', borderRadius: '8px', background: blockSubmit ? '#93b4e8' : 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: blockSubmit ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
          {submitting ? 'Sending...' : 'Send Payment Request'}
        </button>
        <button onClick={onCancel} disabled={submitting}
          style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
          Cancel
        </button>
      </div>

      {error && <p style={{ color: '#d93025', fontSize: '13px', marginTop: '12px', marginBottom: 0 }}>{error}</p>}
    </div>
  )
}

function MoneyInput({ value, onChange }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--wig-muted)', fontSize: '14px' }}>$</span>
      <input value={value} onChange={e => onChange(moneyDigitsOnly(e.target.value))} placeholder="0.00"
        inputMode="decimal" style={{ ...inputStyle, paddingLeft: '28px' }} />
    </div>
  )
}

// DISPLAY ONLY: nothing computed here is sent. The waterfall is derived
// server-side from the strategy rules when the payment clears, so this must
// mirror those rules rather than replace them.
function computePreview(strategy, member, offset, fee) {
  const affiliated = member.mothership_number === 1
  const processingPct = Number(affiliated ? strategy.processing_pct_affiliated : strategy.processing_pct_unaffiliated) || 0
  const adminPct = Number(strategy.admin_fee_pct) || 0
  const legal = round2(Number(strategy.legal_fee_flat) || 0)

  const adminFee = round2(offset * adminPct / 100)
  // ERT's percentage is taken AFTER the two hard costs come off, not from the
  // whole client fee ("Understanding Revenue Share for the LEOS Strategy",
  // Step 2: "After the administrative fee and legal opinion letter have been
  // deducted, ERT receives either 10% or 5%").
  const afterHardCosts = round2(fee - adminFee - legal)
  // ERT cannot take a percentage of a shortfall: once the hard costs have eaten
  // the fee there is nothing to process, and a negative ERT line would read as
  // ERT owing money.
  const processing = afterHardCosts > 0 ? round2(afterHardCosts * processingPct / 100) : 0
  const pool = round2(afterHardCosts - processing)

  const level = String(member.coi_level ?? '')
  const coiPct = Number((strategy.level_percentages || {})[level]) || 0
  const coiShare = round2(pool * coiPct / 100)

  return {
    fee,
    adminFee,
    adminLabel: `Administration fee (${pctText(adminPct)} of offset)`,
    legal,
    processing,
    processingLabel: `ERT processing fee (${pctText(processingPct)} after hard costs, ${affiliated ? 'affiliated' : 'unaffiliated'})`,
    pool,
    coiShare,
    coiLabel: `COI share (Level ${level || '—'}, ${pctText(coiPct)})`,
    net: round2(pool - coiShare),
  }
}

function RevenuePreview({ preview }) {
  return (
    <div style={{ marginTop: '14px', padding: '10px 12px', background: 'var(--wig-card)', borderRadius: '8px', border: '1px solid var(--wig-border-chip)' }}>
      <div style={{ fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Revenue share preview</div>
      <div style={rowStyle(false)}><span>Client fee</span><span>${fmtMoney(preview.fee)}</span></div>
      <div style={rowStyle(false)}><span>{preview.adminLabel}</span><span>${fmtMoney(preview.adminFee)}</span></div>
      <div style={rowStyle(false)}><span>Legal opinion letter</span><span>${fmtMoney(preview.legal)}</span></div>
      <div style={rowStyle(false)}><span>{preview.processingLabel}</span><span>${fmtMoney(preview.processing)}</span></div>
      <div style={{ ...rowStyle(true), borderTop: '1px solid var(--wig-border-chip)', paddingTop: '6px', marginTop: '6px' }}>
        <span>Available Revenue Pool</span><span>${fmtMoney(preview.pool)}</span>
      </div>
      {preview.pool < 0
        ? <div style={{ fontSize: '12px', color: '#d93025', marginTop: '8px' }}>Hard costs and the processing fee exceed the client fee</div>
        : (
          <div style={{ marginTop: '8px' }}>
            <div style={rowStyle(false)}><span>{preview.coiLabel}</span><span>${fmtMoney(preview.coiShare)}</span></div>
            <div style={{ ...rowStyle(true), borderTop: '1px solid var(--wig-border-chip)', paddingTop: '6px', marginTop: '6px' }}>
              <span>Net Profit Pool (Wealth IG)</span><span>${fmtMoney(preview.net)}</span>
            </div>
          </div>
        )}
    </div>
  )
}
