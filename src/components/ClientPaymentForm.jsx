import { useState } from 'react'
import { callApi } from '../lib/api'
import { isSandboxCoi } from '../lib/stripeMode'
import { computeClientFeePoolPreview, computeFeePctWaterfallPreview, computePreview, computeProviderPreview, fmtMoney } from '../lib/revenuePreview'
import { MoneyInput } from './shared/MoneyInput'
import NotificationPickers from './shared/NotificationPickers'
import StrategyInputs, { EMPTY_STRATEGY_INPUTS, providerInputPrompt, providerInputsReady, providerRowPayload } from './StrategyInputs'

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const selectStyle = { ...inputStyle, background: 'var(--wig-card)' }
const labelStyle = { fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }
const sectionEyebrowStyle = { fontSize: '12px', color: '#1D64A8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }
const innerBoxStyle = { background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }
const rowStyle = (strong) => ({ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px', color: 'var(--wig-ink)', marginBottom: '4px', fontWeight: strong ? 700 : 400 })

/**
 * One client, one strategy, one request. `clientPicker` is rendered as the first
 * question when the caller has no client in hand yet — the Tax Strategies tab
 * starts from the strategy and asks who it is for — and `fixedStrategyKey`
 * hides the strategy select where the screen has already chosen one.
 */
export default function ClientPaymentForm({ client, member, strategies, fixedStrategyKey, clientPicker, onSubmitted, onCancel }) {
  const [strategyKey, setStrategyKey] = useState(fixedStrategyKey || '')
  const [offsetAmount, setOffsetAmount] = useState('')
  const [totalFee, setTotalFee] = useState('')
  const [notes, setNotes] = useState('')
  // Required by default: a repeat client on the same strategy may not need a new
  // legal opinion letter, but that is the tax advisor's call and it has to be
  // made deliberately. Held as "required" rather than "waived" so the checkbox
  // reads as the thing being turned OFF, and inverted once, on the way out.
  const [legalRequired, setLegalRequired] = useState(true)
  // The provider strategies' inputs, held apart from the two amounts above
  // rather than reusing them: only one set is ever on screen, and a premium
  // left behind in the offset field would be sent as an offset.
  const [strategyInputs, setStrategyInputs] = useState(EMPTY_STRATEGY_INPUTS)
  // Whether the roster behind the two pickers actually arrived. It decides one
  // thing only: whether a recipient list is sent at all.
  const [rosterReady, setRosterReady] = useState(false)
  const [taxPlanner, setTaxPlanner] = useState('')
  const [recipientEmails, setRecipientEmails] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const active = strategies.filter(s => s.active !== false)
  const strategy = active.find(s => s.key === strategyKey) || null

  // Who funds the strategy decides which half of this form is on screen. On a
  // provider strategy the client never pays through the portal, so there is no
  // offset, no fee and no letter to ask about — only the strategy's own inputs
  // and what they are expected to earn.
  const providerFunded = strategy?.funded_by === 'provider'
  // Billed through this portal exactly like LEOS, and with NONE of LEOS's
  // arithmetic under it: the fee IS the pool, so there is no offset to ask for
  // and no legal opinion letter to waive. It is the model rather than
  // `funded_by` that says so — the client funds both.
  const clientFeePool = strategy?.model === 'client_fee_pool'
  // Billed through this portal like LEOS with ONE hard cost under it: the
  // attorney's percentage of the fee. Same single question on the form as
  // `client_fee_pool` — there is no offset and no letter to waive — and a
  // waterfall of its own below it.
  const feePctWaterfall = strategy?.model === 'fee_pct_waterfall'

  const offset = Number(offsetAmount)
  const fee = Number(totalFee)
  const amountsReady = Number.isFinite(offset) && offset > 0 && Number.isFinite(fee) && fee > 0
  // The one figure this model asks for. A blank field is 0 and a typo is NaN,
  // and neither is greater than zero.
  const feeReady = fee > 0
  const inputsReady = !!strategy && providerInputsReady(strategy, strategyInputs)

  const preview = (strategy && member && !providerFunded && !feePctWaterfall && amountsReady)
    ? computePreview(strategy, member, offset, fee, !legalRequired)
    : null
  const feePoolPreview = (strategy && member && clientFeePool && feeReady)
    ? computeClientFeePoolPreview(strategy, member, fee)
    : null
  const feePctPreview = (strategy && member && feePctWaterfall && feeReady)
    ? computeFeePctWaterfallPreview(strategy, member, fee)
    : null
  const providerPreview = (strategy && member && providerFunded && inputsReady)
    ? computeProviderPreview(strategy, member, {
      tierKey: strategyInputs.tierKey,
      premium: strategyInputs.premium,
      firstYear: strategyInputs.clientStatus === 'first',
      investment: strategyInputs.investment,
      implFeeCharged: strategyInputs.implFeeCharged,
    })
    : null
  const poolNegative = !!preview && preview.pool < 0

  const prompt = providerInputPrompt(strategy)
  const providerBlockReason =
    !inputsReady ? `${prompt.charAt(0).toUpperCase()}${prompt.slice(1)} before submitting.`
    : providerPreview && providerPreview.pool <= 0 ? 'These inputs leave no revenue to share.'
    : ''

  const blockReason =
    !strategyKey ? 'Choose a strategy before submitting.'
    : !client ? 'Choose a client before submitting.'
    : providerFunded ? providerBlockReason
    : clientFeePool || feePctWaterfall ? (feeReady ? '' : 'Enter the fee amount before submitting.')
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
        notes,
        tax_planner_email: taxPlanner,
        // Sent only when the roster loaded, so the form never names people it
        // could not show: the server seeds exactly the list it is given, and
        // nobody at all when none arrives.
        ...(rosterReady ? { recipient_emails: recipientEmails } : {}),
        // A provider strategy sends the strategy's own inputs and no fee at
        // all — nothing is invoiced, so an offset and a total fee would be two
        // numbers nobody quoted. A client_fee_pool or fee_pct_waterfall one
        // sends the fee and NOTHING ELSE: the server refuses to read an offset
        // there, and a waiver flag would claim a letter neither strategy
        // orders — the attorney fee is a percentage the server works out, not
        // a line this form decides.
        ...(providerFunded
          ? providerRowPayload(strategy, strategyInputs)
          : clientFeePool || feePctWaterfall
            ? { total_fee: totalFee }
            : {
              offset_amount: offsetAmount,
              total_fee: totalFee,
              legal_fee_waived: !legalRequired,
            }),
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
      {/* The first question, when there is one: everything below is about a
          client, so nothing else is asked for until one is named. */}
      {clientPicker && (
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Client</label>
          {clientPicker}
        </div>
      )}

      {!fixedStrategyKey && (
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Strategy</label>
          <select value={strategyKey} onChange={e => setStrategyKey(e.target.value)} style={selectStyle}>
            <option value="">-- Select --</option>
            {active.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
        </div>
      )}

      {/* The strategy decides every number below it, so nothing else is asked
          for until one is chosen. */}
      {strategy && (
        <>
          <div style={innerBoxStyle}>
            {providerFunded ? (
              <>
                <div style={sectionEyebrowStyle}>Revenue details</div>
                <StrategyInputs strategy={strategy} value={strategyInputs}
                  onChange={patch => setStrategyInputs(v => ({ ...v, ...patch }))} />
                {providerPreview && <ProviderRevenuePreview preview={providerPreview} />}
              </>
            ) : clientFeePool ? (
              <>
                <div style={sectionEyebrowStyle}>Fee details</div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <label style={labelStyle}>Fee amount</label>
                    <MoneyInput value={totalFee} onChange={setTotalFee} />
                  </div>
                </div>

                {feePoolPreview && <ClientFeePoolPreview preview={feePoolPreview} />}
              </>
            ) : feePctWaterfall ? (
              <>
                <div style={sectionEyebrowStyle}>Fee details</div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <label style={labelStyle}>Fee amount</label>
                    <MoneyInput value={totalFee} onChange={setTotalFee} />
                  </div>
                </div>

                {feePctPreview && <FeePctWaterfallPreview preview={feePctPreview} />}
              </>
            ) : (
              <>
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

                {/* Sits with the amounts because it IS one: unticking it takes
                    the flat legal fee out of the preview below, and the fee the
                    client is invoiced is quoted on the strength of the answer. */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: 'var(--wig-ink)', cursor: 'pointer', marginTop: '12px' }}>
                  <input type="checkbox" checked={legalRequired} onChange={e => setLegalRequired(e.target.checked)}
                    style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
                  Legal opinion letter required
                </label>

                {preview && <RevenuePreview preview={preview} />}
              </>
            )}
            {/* Still true where the client never pays through the portal: the
                mode decides which Stripe moves the COI's share. Nothing to say
                until there is a client to say it about. */}
            {client && member && <ModeLine member={member} />}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Optional, for reference"
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <NotificationPickers
              taxPlanner={taxPlanner}
              onTaxPlanner={setTaxPlanner}
              recipientEmails={recipientEmails}
              onRecipients={setRecipientEmails}
              onRosterReady={setRosterReady}
            />
          </div>
        </>
      )}

      {blockReason && !submitting && (
        <div style={{ fontSize: '12px', color: '#EE6A33', fontWeight: 600, marginBottom: '8px' }}>{blockReason}</div>
      )}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
        <button onClick={handleSubmit} disabled={blockSubmit}
          style={{ flex: 1, padding: '12px', borderRadius: '8px', background: blockSubmit ? '#93b4e8' : 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: blockSubmit ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
          {submitting
            ? (providerFunded ? 'Saving...' : 'Sending...')
            : (providerFunded ? 'Create revenue record' : 'Send Payment Request')}
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

/**
 * Which Stripe this request will run on, said out loud BEFORE the admin presses
 * send. The rule is the backend's (utils/stripe-mode.ts): the COI's sandbox
 * toggle, which every one of their clients inherits.
 * The live line is orange because "real money" is the sentence that should stop
 * somebody who did not mean it.
 */
function ModeLine({ member }) {
  const sandbox = isSandboxCoi(member)
  return (
    <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 600, color: sandbox ? 'var(--wig-muted)' : '#EE6A33' }}>
      {sandbox
        ? 'Sandbox payment — this COI is in sandbox mode; no real money moves.'
        : 'Live payment — real money.'}
    </div>
  )
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

// The Implementation Fee's preview: the LEOS shell above with the hard-cost
// lines GONE rather than shown as zeros — this strategy carries no
// administration fee, no legal opinion letter and no ERT processing fee, and
// three $0.00 rows would read as three costs that happened to come to nothing.
// The fee and the pool are the same figure, said twice on purpose: the second
// line is the one the COI's share is a percentage of.
function ClientFeePoolPreview({ preview }) {
  return (
    <div style={{ marginTop: '14px', padding: '10px 12px', background: 'var(--wig-card)', borderRadius: '8px', border: '1px solid var(--wig-border-chip)' }}>
      <div style={{ fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Revenue share preview</div>
      {/* Said above the figures because it is what makes the fee the WHOLE
          pool: a card fee is added to the client's charge rather than taken out
          of what Wealth IG receives, so nothing below it moves either way. */}
      <div style={{ fontSize: '12px', color: 'var(--wig-muted)', marginBottom: '8px', lineHeight: 1.6 }}>
        The client may pay by ACH (no fee) or by card (2.9% + $0.30 added to their charge). Wealth IG receives the full fee either way.
      </div>
      <div style={rowStyle(false)}><span>Client fee</span><span>${fmtMoney(preview.fee)}</span></div>
      <div style={{ ...rowStyle(true), borderTop: '1px solid var(--wig-border-chip)', paddingTop: '6px', marginTop: '6px' }}>
        <span>Available Revenue Pool</span><span>${fmtMoney(preview.pool)}</span>
      </div>
      <div style={{ marginTop: '8px' }}>
        {/* Drawn even at 0%: an excluded mothership earns nothing, and a line
            that says so is the difference between a rule and an omission. */}
        <div style={rowStyle(false)}><span>{preview.coiLabel}</span><span>${fmtMoney(preview.coiShare)}</span></div>
        <div style={{ ...rowStyle(true), borderTop: '1px solid var(--wig-border-chip)', paddingTop: '6px', marginTop: '6px' }}>
          <span>Net Profit Pool (Wealth IG)</span><span>${fmtMoney(preview.net)}</span>
        </div>
      </div>
    </div>
  )
}

// The Nevada Bank Dynasty Trust's preview: the LEOS shell with ONE hard-cost
// line instead of three — the attorney fee — and no card sentence above it,
// because this strategy is paid by ACH only and there is no second way for the
// client to pay that would need explaining.
function FeePctWaterfallPreview({ preview }) {
  return (
    <div style={{ marginTop: '14px', padding: '10px 12px', background: 'var(--wig-card)', borderRadius: '8px', border: '1px solid var(--wig-border-chip)' }}>
      <div style={{ fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Revenue share preview</div>
      <div style={rowStyle(false)}><span>Client fee</span><span>${fmtMoney(preview.fee)}</span></div>
      <div style={rowStyle(false)}><span>{preview.attorneyLabel}</span><span>${fmtMoney(preview.attorneyFee)}</span></div>
      <div style={{ ...rowStyle(true), borderTop: '1px solid var(--wig-border-chip)', paddingTop: '6px', marginTop: '6px' }}>
        <span>Available Revenue Pool</span><span>${fmtMoney(preview.pool)}</span>
      </div>
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
    </div>
  )
}

// The provider strategies' preview: one pool the provider owes rather than a
// fee taken apart, so the waterfall above it collapses to a single line and its
// source. Below that line it is the LEOS preview exactly — same split, same ERT
// note, same net.
function ProviderRevenuePreview({ preview }) {
  return (
    <div style={{ marginTop: '14px', padding: '10px 12px', background: 'var(--wig-card)', borderRadius: '8px', border: '1px solid var(--wig-border-chip)' }}>
      <div style={{ fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Revenue share preview</div>
      <div style={rowStyle(true)}><span>{preview.poolLabel}</span><span>${fmtMoney(preview.pool)}</span></div>
      <div style={{ fontSize: '12px', color: 'var(--wig-muted)', marginBottom: '4px' }}>{preview.implNote}</div>
      {preview.pool <= 0
        ? <div style={{ fontSize: '12px', color: '#d93025', marginTop: '8px' }}>These inputs leave no revenue to share</div>
        : (
          <div style={{ marginTop: '8px', borderTop: '1px solid var(--wig-border-chip)', paddingTop: '6px' }}>
            <div style={rowStyle(false)}><span>{preview.coiLabel}</span><span>${fmtMoney(preview.coiShare)}</span></div>
            {/* The figure is real and it is the COI's — it just does not travel
                through the portal, and the admin should know that before the
                record is created. */}
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
