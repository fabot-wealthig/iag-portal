import { useEffect, useState } from 'react'
import { callApi, getSession } from '../lib/api'
import { ownerChipStyle } from './PaymentDetail'

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const selectStyle = { ...inputStyle, background: 'var(--wig-card)' }
const labelStyle = { fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }
const sectionEyebrowStyle = { fontSize: '12px', color: '#1D64A8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }
const innerBoxStyle = { background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }
// The Notifications card's two styles, copied from `PaymentDetail.jsx` rather
// than imported: neither is exported there, and the request form has to ask for
// the same two things in the same shape, so the admin meets one control twice
// rather than two that behave differently.
const assignLabelStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)', marginBottom: '6px' }
const assignSelectStyle = { padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-muted)', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', maxWidth: '280px' }
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
  // Required by default: a repeat client on the same strategy may not need a new
  // legal opinion letter, but that is the tax advisor's call and it has to be
  // made deliberately. Held as "required" rather than "waived" so the checkbox
  // reads as the thing being turned OFF, and inverted once, on the way out.
  const [legalRequired, setLegalRequired] = useState(true)
  // The people this payment gets raised with. `admins` is null until the roster
  // lands, which is what disables both controls — the form is four fields and a
  // preview, far too small to wear a skeleton, so the controls simply arrive
  // inert and come alive.
  const [admins, setAdmins] = useState(null)
  const [rosterError, setRosterError] = useState('')
  const [taxPlanner, setTaxPlanner] = useState('')
  const [recipientEmails, setRecipientEmails] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // The signed-in admin starts on the list, matched to the roster's own spelling
  // of their address: the person who asked for the money usually wants to hear
  // about it. It is a real chip — remove it and the server seeds exactly what
  // is sent, creator included or not.
  useEffect(() => {
    let live = true
    callApi('load_admin_directory')
      .then(res => {
        if (!live) return
        const roster = res.admins || []
        setAdmins(roster)
        const me = getSession()?.email || ''
        const mine = roster.find(a => a.email.toLowerCase() === me.toLowerCase())
        if (mine) setRecipientEmails([mine.email])
      })
      .catch(() => { if (live) setRosterError('Could not load admins — assign them on the payment afterwards.') })
    return () => { live = false }
  }, [])

  const active = strategies.filter(s => s.active !== false)
  const strategy = active.find(s => s.key === strategyKey) || null

  const offset = Number(offsetAmount)
  const fee = Number(totalFee)
  const amountsReady = Number.isFinite(offset) && offset > 0 && Number.isFinite(fee) && fee > 0

  const preview = (strategy && amountsReady) ? computePreview(strategy, member, offset, fee, !legalRequired) : null
  const poolNegative = !!preview && preview.pool < 0

  const blockReason =
    !strategyKey ? 'Choose a strategy before submitting.'
    : !amountsReady ? 'Enter the offset amount and the total client fee before submitting.'
    : poolNegative ? 'The client fee must cover the hard costs and the processing fee.'
    : ''
  const blockSubmit = submitting || !!blockReason

  // A roster that never arrived leaves both controls inert and the form fully
  // usable: the payment is what matters, and the server seeds the creator on
  // its own, so the assignments can be made on the detail screen instead.
  const roster = admins || []
  const rosterReady = admins !== null && !rosterError
  const chosenRecipients = roster.filter(a => recipientEmails.includes(a.email))
  const addableAdmins = roster.filter(a => !recipientEmails.includes(a.email))

  async function handleSubmit() {
    if (blockSubmit) return
    setSubmitting(true); setError('')
    try {
      const res = await callApi('start_client_payment', {
        client_id: client.id,
        strategy_key: strategyKey,
        offset_amount: offsetAmount,
        total_fee: totalFee,
        legal_fee_waived: !legalRequired,
        notes,
        tax_planner_email: taxPlanner,
        // Sent only when the roster loaded: an absent list tells the server to
        // seed the creator itself, whereas an empty one would mean "nobody".
        ...(rosterReady ? { recipient_emails: recipientEmails } : {}),
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

            {/* Sits with the amounts because it IS one: unticking it takes the
                flat legal fee out of the preview below, and the fee the client
                is invoiced is quoted on the strength of the answer. */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: 'var(--wig-ink)', cursor: 'pointer', marginTop: '12px' }}>
              <input type="checkbox" checked={legalRequired} onChange={e => setLegalRequired(e.target.checked)}
                style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
              Legal opinion letter required
            </label>

            {preview && <RevenuePreview preview={preview} />}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Optional, for reference"
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {/* Who plans this payment and who hears about it, asked WHEN IT IS
              RAISED rather than left to the detail screen: both are known now,
              and a payment nobody was assigned is a payment nobody chases.
              Same two controls as PaymentDetail's Notifications card, so an
              admin meets one control twice rather than two that differ. */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ marginBottom: '14px' }}>
              <div style={assignLabelStyle}>Tax planner</div>
              <select value={taxPlanner} disabled={!rosterReady}
                onChange={e => setTaxPlanner(e.target.value)}
                style={{ ...assignSelectStyle, cursor: rosterReady ? 'pointer' : 'not-allowed' }}>
                <option value="">Unassigned</option>
                {roster.map(a => <option key={a.email} value={a.email}>{a.name}</option>)}
              </select>
            </div>

            <div>
              <div style={assignLabelStyle}>Other notification recipients</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                {chosenRecipients.map(r => (
                  <span key={r.email} style={{ ...ownerChipStyle, fontSize: '12px', padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {r.name}
                    <button type="button" aria-label={`Remove ${r.name}`}
                      onClick={() => setRecipientEmails(recipientEmails.filter(e => e !== r.email))}
                      style={{ border: 'none', background: 'transparent', color: 'var(--wig-muted)', fontSize: '14px', lineHeight: 1, padding: 0, cursor: 'pointer' }}>×</button>
                  </span>
                ))}
              </div>
              {/* Always value="" — the select is an ADD button wearing a
                  dropdown, so it never holds a selection of its own. */}
              <select value="" disabled={!rosterReady || addableAdmins.length === 0}
                onChange={e => { if (e.target.value) setRecipientEmails([...recipientEmails, e.target.value]) }}
                style={{ ...assignSelectStyle, cursor: (!rosterReady || addableAdmins.length === 0) ? 'not-allowed' : 'pointer' }}>
                <option value="">{rosterReady && addableAdmins.length === 0 ? 'All admins added' : 'Add admin…'}</option>
                {addableAdmins.map(a => <option key={a.email} value={a.email}>{a.name}</option>)}
              </select>
            </div>

            {rosterError && <p style={{ color: '#d93025', fontSize: '13px', margin: '10px 0 0' }}>{rosterError}</p>}
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
function computePreview(strategy, member, offset, fee, legalWaived) {
  const affiliated = member.mothership_number === 1
  const processingPct = Number(affiliated ? strategy.processing_pct_affiliated : strategy.processing_pct_unaffiliated) || 0
  const adminPct = Number(strategy.admin_fee_pct) || 0
  // Waived means this payment's legal line is zero; the strategy's flat fee is
  // untouched and the next payment asks again.
  const legal = legalWaived ? 0 : round2(Number(strategy.legal_fee_flat) || 0)

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

  // Path A: an ERT-affiliated COI takes a flat cut of the pool and the level
  // ladder does not apply to them, so their level is not named here either — it
  // is still recorded on the payment, it just does not decide the money.
  const level = String(member.coi_level ?? '')
  const affiliatedPct = Number(strategy.affiliated_share_pct) || 0
  const coiPct = affiliated ? affiliatedPct : (Number((strategy.level_percentages || {})[level]) || 0)
  const coiShare = round2(pool * coiPct / 100)

  return {
    fee,
    adminFee,
    adminLabel: `Administration fee (${pctText(adminPct)} of offset)`,
    legal,
    legalLabel: legalWaived ? 'Legal opinion letter (waived)' : 'Legal opinion letter',
    processing,
    processingLabel: `ERT processing fee (${pctText(processingPct)} after hard costs, ${affiliated ? 'affiliated' : 'unaffiliated'})`,
    pool,
    coiShare,
    coiLabel: affiliated
      ? `ERT affiliated share (${pctText(affiliatedPct)})`
      : `COI share (Level ${level || '—'}, ${pctText(coiPct)})`,
    viaErt: affiliated,
    net: round2(pool - coiShare),
  }
}

function RevenuePreview({ preview }) {
  return (
    <div style={{ marginTop: '14px', padding: '10px 12px', background: 'var(--wig-card)', borderRadius: '8px', border: '1px solid var(--wig-border-chip)' }}>
      <div style={{ fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Revenue share preview</div>
      <div style={rowStyle(false)}><span>Client fee</span><span>${fmtMoney(preview.fee)}</span></div>
      <div style={rowStyle(false)}><span>{preview.adminLabel}</span><span>${fmtMoney(preview.adminFee)}</span></div>
      <div style={rowStyle(false)}><span>{preview.legalLabel}</span><span>${fmtMoney(preview.legal)}</span></div>
      <div style={rowStyle(false)}><span>{preview.processingLabel}</span><span>${fmtMoney(preview.processing)}</span></div>
      <div style={{ ...rowStyle(true), borderTop: '1px solid var(--wig-border-chip)', paddingTop: '6px', marginTop: '6px' }}>
        <span>Available Revenue Pool</span><span>${fmtMoney(preview.pool)}</span>
      </div>
      {preview.pool < 0
        ? <div style={{ fontSize: '12px', color: '#d93025', marginTop: '8px' }}>Hard costs and the processing fee exceed the client fee</div>
        : (
          <div style={{ marginTop: '8px' }}>
            <div style={rowStyle(false)}><span>{preview.coiLabel}</span><span>${fmtMoney(preview.coiShare)}</span></div>
            {/* The figure is real and it is the COI's — it just does not travel
                through the portal, and the admin should know that before the
                request goes out. */}
            {preview.viaErt && (
              <div style={{ fontSize: '12px', color: 'var(--wig-muted)', marginBottom: '4px' }}>
                Paid to ERT outside the portal; ERT pays the COI.
              </div>
            )}
            <div style={{ ...rowStyle(true), borderTop: '1px solid var(--wig-border-chip)', paddingTop: '6px', marginTop: '6px' }}>
              <span>Net Profit Pool (Wealth IG)</span><span>${fmtMoney(preview.net)}</span>
            </div>
          </div>
        )}
    </div>
  )
}
