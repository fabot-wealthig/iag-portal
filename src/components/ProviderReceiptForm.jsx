import { useState } from 'react'
import { callApi } from '../lib/api'
import { computeProviderPreview, fmtMoney, round2 } from '../lib/revenuePreview'
import { isTestName, sandboxChipStyle } from '../lib/stripeMode'
import { AddClientForm } from './CoiClients'
import ClientPicker from './shared/ClientPicker'
import { MoneyInput } from './shared/MoneyInput'
import NotificationPickers from './shared/NotificationPickers'
import StrategyInputs, { EMPTY_STRATEGY_INPUTS, providerInputPrompt, providerInputsReady, providerRowPayload } from './StrategyInputs'

// One lump sum a provider paid, split across the clients it covered. The total
// is typed FIRST because it is the fact the admin is holding — a bank line, a
// remittance — and the client lines are what has to add up to it, to the cent:
// each line's share is computed off ITS amount, so a split that does not add up
// is a typo the COIs would eat.
//
// Mechanics are the VFO Specialist Payment Input's: one `grid` string drives the
// header, every row and the totals so the columns cannot drift, lines carry
// stable ids from a module counter rather than their index, and the submit
// button says the figure it is about to record.

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const labelStyle = { fontSize: '11px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }
const colLabelStyle = { fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--wig-faint)' }
const outlineButtonStyle = { padding: '10px 24px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const mutedLineStyle = { fontSize: '12px', color: 'var(--wig-muted)', marginTop: '4px' }

// The one column definition. Header, rows and totals all read it, which is what
// keeps a totals figure under the amounts it totals.
const grid = '1.5fr 1.6fr 140px 36px'

// Half a cent, the same tolerance the server allows: both sides are money
// rounded to cents, and an exact float comparison would refuse a split that is
// right.
const SUM_TOLERANCE = 0.005

// The transfers run one client at a time behind this press, so the clock is the
// batch's rather than a request's.
const RECEIPT_TIMEOUT_MS = 90000

let lineSeq = 1

export default function ProviderReceiptForm({ strategy, clients = [], members = [], onClientsChange, onSaved, onCancel }) {
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState([])
  const [taxPlanner, setTaxPlanner] = useState('')
  const [recipientEmails, setRecipientEmails] = useState([])
  const [rosterReady, setRosterReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Which line the server refused, when it named one. Zero-based; null when the
  // refusal was about the receipt as a whole.
  const [errorRow, setErrorRow] = useState(null)

  function addRow() {
    setRows(rs => [...rs, { id: lineSeq++, clientId: '', inputs: EMPTY_STRATEGY_INPUTS, amount: '', adding: false }])
  }
  function removeRow(id) { setRows(rs => rs.filter(r => r.id !== id)) }
  function updateRow(id, patch) { setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r)) }

  // The list the picker reads is the parent's, so it is refreshed BEFORE the new
  // client is selected: selecting an id the list does not hold yet would leave
  // the trigger showing its placeholder over a client that exists.
  async function handleClientAdded(rowId, res) {
    if (onClientsChange) await onClientsChange()
    updateRow(rowId, { clientId: res?.client?.id || '', adding: false })
  }

  const clientById = new Map(clients.map(c => [c.client_id, c]))
  const memberByNumber = new Map(members.map(m => [m.member_number, m]))

  const total = round2(Number(amount) || 0)
  const allocated = round2(rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0))
  const remaining = round2(total - allocated)
  const sumOk = Math.abs(remaining) < SUM_TOLERANCE

  const rowReady = (r) => !!r.clientId && providerInputsReady(strategy, r.inputs) && Number(r.amount) > 0
  const firstBadRow = rows.findIndex(r => !rowReady(r))

  const blockReason =
    total <= 0 ? 'Enter the payment received.'
    : rows.length === 0 ? 'Add at least one client.'
    : firstBadRow >= 0 ? rowBlockReason(strategy, rows[firstBadRow], firstBadRow + 1)
    : !sumOk ? 'Client amounts must add up to the payment received.'
    : ''
  const blockSubmit = submitting || !!blockReason

  async function handleSubmit() {
    if (blockSubmit) return
    setSubmitting(true); setError(''); setErrorRow(null)
    try {
      const res = await callApi('create_provider_receipt', {
        strategy_key: strategy.key,
        amount_received: amount,
        reference,
        notes,
        tax_planner_email: taxPlanner,
        // Sent only when the roster loaded, so the form never names people it
        // could not show.
        ...(rosterReady ? { recipient_emails: recipientEmails } : {}),
        rows: rows.map(r => ({
          client_id: r.clientId,
          ...providerRowPayload(strategy, r.inputs),
          amount: r.amount,
        })),
      }, { timeoutMs: RECEIPT_TIMEOUT_MS })
      onSaved(res)
    } catch (err) {
      // create_provider_receipt is a write — never retried, and the server's
      // wording is the wording the admin sees, including which line it refused.
      setError(err.message)
      setErrorRow(rowIndexOfError(err.message))
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div style={sectionStyle}>
        <div style={eyebrowStyle}>Payment received</div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={labelStyle}>Amount received</label>
            <MoneyInput value={amount} onChange={setAmount} />
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={labelStyle}>Reference (optional)</label>
            <input value={reference} onChange={e => setReference(e.target.value)}
              placeholder="e.g. remittance or batch reference" style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Optional, for reference"
            style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={eyebrowStyle}>Clients</div>

        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '12px', alignItems: 'end', paddingBottom: '10px', borderBottom: '1px solid var(--wig-border-soft)' }}>
          <div style={colLabelStyle}>Client</div>
          <div style={colLabelStyle}>Strategy details</div>
          <div style={colLabelStyle}>Amount</div>
          <div />
        </div>

        {rows.length === 0 && (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--wig-faint)', fontSize: '13px' }}>No clients yet — click "+ Add Client" to start.</div>
        )}

        {rows.map((r, i) => {
          const client = r.clientId ? clientById.get(r.clientId) || null : null
          const member = client ? memberByNumber.get(client.coi_member_number) || null : null
          const preview = (client && member && providerInputsReady(strategy, r.inputs))
            ? computeProviderPreview(strategy, member, {
              tierKey: r.inputs.tierKey,
              premium: r.inputs.premium,
              firstYear: r.inputs.clientStatus === 'first',
              investment: r.inputs.investment,
              implFeeCharged: r.inputs.implFeeCharged,
            })
            : null
          const sandbox = !!client && isTestName(client.first_name, client.last_name, member?.first_name, member?.last_name)
          return (
            <div key={r.id}>
              <div style={{
                display: 'grid', gridTemplateColumns: grid, gap: '12px', alignItems: 'start',
                padding: '14px 8px', borderBottom: '1px solid var(--wig-border-soft)',
                ...(errorRow === i ? { border: '1px solid #d93025', borderRadius: '10px' } : {}),
              }}>
                <div>
                  <ClientPicker
                    clients={clients}
                    valueId={r.clientId}
                    onChange={id => updateRow(r.id, { clientId: id })}
                    onAddClient={() => updateRow(r.id, { adding: true })}
                  />
                  {client && (
                    <div style={{ ...mutedLineStyle, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span>{client.coi_name || '—'}</span>
                      {sandbox && <span style={sandboxChipStyle}>Sandbox</span>}
                    </div>
                  )}
                </div>
                <div>
                  <StrategyInputs strategy={strategy} value={r.inputs} compact
                    onChange={patch => updateRow(r.id, { inputs: { ...r.inputs, ...patch } })} />
                  {/* What the strategy says this line is worth, so a typed
                      amount can be checked against the rules rather than
                      against memory. */}
                  {preview && <div style={mutedLineStyle}>{`Expected $${fmtMoney(preview.pool)}`}</div>}
                </div>
                <MoneyInput value={r.amount} onChange={v => updateRow(r.id, { amount: v })} />
                <button type="button" onClick={() => removeRow(r.id)} title="Remove"
                  style={{ width: '36px', height: '40px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, fontFamily: 'Inter, sans-serif' }}>×</button>
              </div>
              {/* Under the line that needs them: the provider paid for somebody
                  the portal has never billed, and sending the admin off to the
                  COI's own screen would lose the receipt they are halfway
                  through typing. */}
              {r.adding && (
                <AddClientForm
                  members={members}
                  onAdded={res => handleClientAdded(r.id, res)}
                  onCancel={() => updateRow(r.id, { adding: false })}
                />
              )}
            </div>
          )
        })}

        {rows.length > 0 && (
          <div style={{ paddingTop: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '12px', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--wig-heading)' }}>Allocated</div>
              <div />
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--wig-ink)' }}>{`$${fmtMoney(allocated)}`}</div>
              <div />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '12px', alignItems: 'center', marginTop: '6px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--wig-heading)' }}>Remaining</div>
              <div />
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--wig-ink)' }}>{`$${fmtMoney(remaining)}`}</div>
              <div />
            </div>
            {total > 0 && (
              <div style={{ marginTop: '12px', fontSize: '13px', fontWeight: 600, color: sumOk ? '#1b9254' : '#d93025' }}>
                {sumOk
                  ? 'Client amounts add up to the payment received.'
                  : `Client amounts ($${fmtMoney(allocated)}) must equal the payment received ($${fmtMoney(total)}).`}
              </div>
            )}
          </div>
        )}

        <button type="button" onClick={addRow}
          style={{ marginTop: '14px', padding: '9px 16px', borderRadius: '8px', border: '1px solid #1D64A8', background: 'transparent', color: '#1D64A8', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          + Add Client
        </button>
      </div>

      <div style={sectionStyle}>
        <div style={eyebrowStyle}>Notifications</div>
        <NotificationPickers
          taxPlanner={taxPlanner}
          onTaxPlanner={setTaxPlanner}
          recipientEmails={recipientEmails}
          onRecipients={setRecipientEmails}
          onRosterReady={setRosterReady}
        />
      </div>

      <div style={sectionStyle}>
        {blockReason && !submitting && (
          <div style={{ fontSize: '12px', color: '#EE6A33', fontWeight: 600, marginBottom: '10px' }}>{blockReason}</div>
        )}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleSubmit} disabled={blockSubmit}
            style={{ flex: 1, minWidth: '240px', padding: '12px', borderRadius: '8px', background: blockSubmit ? '#93b4e8' : 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: blockSubmit ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
            {submitting ? 'Recording…' : `Record payment — $${fmtMoney(total)}`}
          </button>
          <button type="button" onClick={onCancel} disabled={submitting}
            style={{ ...outlineButtonStyle, cursor: submitting ? 'not-allowed' : 'pointer' }}>
            Cancel
          </button>
        </div>
        {error && <p style={{ color: '#d93025', fontSize: '13px', marginTop: '12px', marginBottom: 0 }}>{error}</p>}
      </div>
    </div>
  )
}

// The first thing this line is missing, named the way the request form names
// it — same prompt, prefixed with the row an admin can point at.
function rowBlockReason(strategy, row, number) {
  if (!row.clientId) return `Row ${number}: choose a client.`
  if (!providerInputsReady(strategy, row.inputs)) return `Row ${number}: ${providerInputPrompt(strategy)}.`
  return `Row ${number}: enter the amount.`
}

// The server prefixes a line's refusal with "Row N: ", so the line it is about
// can be outlined rather than left to be counted by hand.
function rowIndexOfError(message) {
  const match = /^Row (\d+):/.exec(String(message || ''))
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) && n > 0 ? n - 1 : null
}
