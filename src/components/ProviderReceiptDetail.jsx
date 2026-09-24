import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { REV_VIA_ERT } from '../lib/revShareText'
import PayoutPill from './shared/PayoutPill'
import { sandboxTagStyle } from '../lib/stripeMode'
import { BackLink, Field, NameLink, TrackHero } from './shared/TrackKit'
import { PaymentDetailSkeleton } from './shared/Skeleton'
import { discountAmountText } from './shared/DiscountFields'
import CoiName from './shared/CoiName'

// One lump sum a provider paid, and the client records it paid for. The split as
// it SETTLED — every figure here is stamped, so there is nothing to edit and no
// action control in a row: a share that needs finishing is finished on that
// payment's own detail screen, one click away through the client's name. The ONE
// deliberate exception is the "Paid by ERT" tick below, because a Via ERT row
// otherwise reads as finished when ERT has not paid the COI yet.

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }

// The overview panels' table, column for column: auto layout so the browser
// shares the leftover width out, every column left-aligned, money included.
const tableStyle = { width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', fontFamily: 'Inter, sans-serif' }
const thStyle = { textAlign: 'left', padding: '12px 18px', background: 'var(--wig-input)', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-muted)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '12px 18px', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '13px', color: 'var(--wig-ink)', verticalAlign: 'middle', whiteSpace: 'nowrap' }
const cellMutedStyle = { ...tdStyle, fontSize: '12px', color: 'var(--wig-muted)' }
const totalCellStyle = { padding: '12px 18px', fontSize: '13px', fontWeight: 700, color: 'var(--wig-ink)', background: 'var(--wig-tint)', whiteSpace: 'nowrap' }

const GREEN = '#1b9254'
const ORANGE = '#EE6A33'

// Copied from PaymentsGrid, which does not export it: an amount in this table
// and the same amount on the payment it links to must read identically.
function moneyText(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

function dateText(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

// What the split is measured from, read the way PaymentsGrid reads it: a fixed
// commission from the box the client chose, which is a name rather than an
// amount; the contribution models from what the client put in; Oil & Gas from
// the chargeable hours; Closehaul from the event and the amount its percentage
// was taken of; a pass-through
// from nothing at all, because the amount on the row IS the figure.
function basisText(row) {
  const inputs = row.strategy_inputs || {}
  if (inputs.tier_label) return inputs.tier_label
  if (inputs.chargeable_hours != null) return `${inputs.chargeable_hours} hrs`
  if (inputs.event_label) return `${inputs.event_label} $${moneyText(row.contribution_amount)}`
  return row.contribution_amount == null ? '—' : `$${moneyText(row.contribution_amount)}`
}

export default function ProviderReceiptDetail({ receiptId, onBack, onOpenCoi, onOpenClient, flash }) {
  const [receipt, setReceipt] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  // Which row is mid-write, if any. Every row checkbox reads it: two overlapping
  // writes against the same receipt would race the reload that follows them.
  const [busyRow, setBusyRow] = useState(null)
  const [rowError, setRowError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    callApi('load_provider_receipt', { receipt_id: receiptId })
      .then(data => { if (alive) { setReceipt(data.receipt || null); setRows(data.rows || []); setLoadError('') } })
      .catch(err => { if (alive) setLoadError(err.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [receiptId])

  // The same manual tick the payment detail carries, written the same way: the
  // server recomputes the waterfall from this one flag, so the receipt is read
  // back afterwards and the row re-renders from server truth rather than being
  // patched here. Only a tick is sent from here: unticking stays on the
  // payment detail, where the whole progress list is.
  async function toggleErtPaid(row, done) {
    setBusyRow(row.payment_id); setRowError('')
    try {
      await callApi('update_payment_step', { payment_id: row.payment_id, step: 'ert_share', done })
      const data = await callApi('load_provider_receipt', { receipt_id: receiptId })
      setReceipt(data.receipt || null)
      setRows(data.rows || [])
    } catch (err) {
      // update_payment_step is a write — never retried, and the server's
      // wording is the wording the admin sees.
      setRowError(err.message)
    } finally {
      setBusyRow(null)
    }
  }

  // Nothing on this screen is known before the fetch — not even the title — so
  // the whole of it, hero included, is drawn as a skeleton.
  if (loading) return <PaymentDetailSkeleton />

  if (loadError || !receipt) {
    return (
      <div>
        <div style={sectionStyle}>
          <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{loadError || 'Receipt not found.'}</p>
        </div>
        <BackLink label="← Back to Tax Strategies" onClick={onBack} />
      </div>
    )
  }

  // The sum of what is on screen, not the receipt's own figure: the server
  // refuses a split that does not add up, so if these two ever disagree that is
  // exactly what the admin should see.
  const rowsTotal = rows.reduce((sum, r) => sum + (Number(r.revenue_received) || 0), 0)

  return (
    <div>
      <TrackHero
        eyebrow={`${receipt.strategy_name} receipt`}
        title={`$${moneyText(receipt.amount_received)}`}
        meta={
          <>
            <span>{dateText(receipt.received_at)}</span>
            {receipt.reference && (
              <>
                <span style={{ color: 'var(--wig-border-mid)' }}>·</span>
                <span>{receipt.reference}</span>
              </>
            )}
            <span style={{ color: 'var(--wig-border-mid)' }}>·</span>
            <span>{`Recorded by ${receipt.recorded_by || '—'}`}</span>
          </>
        }
      />
      <BackLink label="← Back to Tax Strategies" onClick={onBack} />

      {flash && <p style={{ color: GREEN, fontSize: '13px', margin: '0 0 16px' }}>{flash}</p>}

      <div style={sectionStyle}>
        <div style={eyebrowStyle}>Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
          <Field label="Strategy" value={receipt.strategy_name} />
          <Field label="Amount received" value={`$${moneyText(receipt.amount_received)}`} />
          <Field label="Reference" value={receipt.reference} />
          <Field label="Received" value={dateText(receipt.received_at)} />
          <Field label="Recorded by" value={receipt.recorded_by} />
        </div>
        <div style={{ marginTop: '14px' }}>
          <Field label="Notes" value={receipt.notes} preWrap />
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={eyebrowStyle}>Clients</div>
        <div style={{ overflowX: 'auto', border: '1px solid var(--wig-border-soft)', borderRadius: '14px' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>COI</th>
                <th style={thStyle}>Basis</th>
                <th style={thStyle}>Expected</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>COI share</th>
                <th style={thStyle}>Payout</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--wig-faint)', fontSize: '13px' }}>No client records on this receipt.</td>
                </tr>
              )}

              {rows.map(r => {
                // The ROW opens this client's payment (Jake, 2026-09-24: click
                // anywhere, like every other list); the client's NAME is a
                // shortcut past it to their profile, the COI's to the COI.
                const openPayment = () => onOpenClient && onOpenClient(r.coi_member_number, r.client_id, {
                  clientTab: 'client_payments',
                  paymentId: r.payment_id,
                  returnTo: 'tax_strategies',
                })
                return (
                  <tr key={r.payment_id} onClick={openPayment} style={{ cursor: onOpenClient ? 'pointer' : 'default' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--wig-tint)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      <span style={{ display: 'block' }}>
                        {r.client_name
                          ? <NameLink title="Open client profile"
                              onClick={onOpenClient ? () => onOpenClient(r.coi_member_number, r.client_id, { returnTo: 'tax_strategies' }) : undefined}>{r.client_name}</NameLink>
                          : <span style={{ color: 'var(--wig-faint)' }}>—</span>}
                      </span>
                      <span style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', fontWeight: 400, color: 'var(--wig-muted)' }}>{r.client_number || '—'}</span>
                      {/* With the client, as on every grid (Jake, 2026-09-24). */}
                      {r.sandbox === true && <span style={sandboxTagStyle}>Sandbox</span>}
                    </td>
                    <td style={tdStyle}>
                      <CoiName firm={r.coi_company} person={r.coi_name}
                        onClick={onOpenCoi ? () => onOpenCoi(r.coi_member_number, { returnTo: 'tax_strategies' }) : undefined} />
                    </td>
                    <td style={cellMutedStyle}>{basisText(r)}</td>
                    <td style={cellMutedStyle}>{r.revenue_expected == null ? '—' : `$${moneyText(r.revenue_expected)}`}</td>
                    <td style={tdStyle}>
                      {r.revenue_received == null ? '—' : `$${moneyText(r.revenue_received)}`}
                      {/* Record only: the amount above is what arrived, and the
                          total below sums that, never the discount. */}
                      {discountAmountText(r) && (
                        <span title={r.discount_reason || undefined}
                          style={{ display: 'block', fontSize: '11px', color: 'var(--wig-muted)', fontWeight: 600 }}>
                          {`Discount ${discountAmountText(r)}`}
                        </span>
                      )}
                    </td>
                    <td style={cellMutedStyle}>{r.coi_share_amount == null ? '—' : `$${moneyText(r.coi_share_amount)}`}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {/* The one action control allowed in a row on this
                            screen: ERT paying the COI happens outside the
                            portal, so nothing but an admin can move this row on
                            and making them open the payment to do it is what
                            leaves the receipt reading finished when it is not.
                            The payment detail's manual step, in the row: the
                            checkbox IS the status until it is ticked, and the
                            chip replaces it once it is. */}
                        {r.rev_paid === REV_VIA_ERT && !r.ert_share_done ? (
                          <label onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: busyRow ? 'not-allowed' : 'pointer' }}>
                            <input type="checkbox" checked={false} disabled={busyRow !== null}
                              onChange={() => toggleErtPaid(r, true)}
                              style={{ margin: 0, width: '14px', height: '14px', flexShrink: 0, accentColor: '#1D64A8', cursor: busyRow ? 'not-allowed' : 'pointer' }} />
                            <span style={{ fontSize: '12px', fontWeight: 600, color: ORANGE, whiteSpace: 'nowrap' }}>Paid by ERT</span>
                          </label>
                        ) : (
                          <PayoutPill row={{ ...r, cleared: true }} />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {rows.length > 0 && (
                <tr>
                  <td style={totalCellStyle}>Total</td>
                  <td style={totalCellStyle} />
                  <td style={totalCellStyle} />
                  <td style={totalCellStyle} />
                  <td style={totalCellStyle}>{`$${moneyText(rowsTotal)}`}</td>
                  <td style={totalCellStyle} />
                  <td style={{ ...totalCellStyle, fontWeight: 400, fontSize: '12px', color: 'var(--wig-muted)' }}>{`of $${moneyText(receipt.amount_received)} received`}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rowError && <p style={{ color: '#d93025', fontSize: '13px', marginTop: '12px', marginBottom: 0 }}>{rowError}</p>}
      </div>
    </div>
  )
}
