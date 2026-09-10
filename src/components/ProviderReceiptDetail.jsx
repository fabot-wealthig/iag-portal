import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { REV_NOT_DUE, REV_VIA_ERT } from '../lib/revShareText'
import { sandboxChipStyle } from '../lib/stripeMode'
import { BackLink, Field, NameLink, TrackHero } from './shared/TrackKit'
import { PaymentDetailSkeleton } from './shared/Skeleton'

// One lump sum a provider paid, and the client records it paid for. The split as
// it SETTLED — every figure here is stamped, so there is nothing to edit and no
// action control in a row: a share that needs finishing is finished on that
// payment's own detail screen, one click away through the client's name.

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

// What the split is measured from, read the way PaymentsGrid reads it: Boxhouse
// from the box the client chose, which is a name rather than an amount; the
// other two from what the client put in.
function basisText(row) {
  const label = (row.strategy_inputs || {}).tier_label
  if (label) return label
  return row.contribution_amount == null ? '—' : `$${moneyText(row.contribution_amount)}`
}

// The states are the backend's `rev_paid` values, and the colours are the ones
// the payments list already gives them: green for settled, the portal's amber
// for a share still owed, red for a refusal, quiet tint for the rest.
function shareStatus(row) {
  if (row.rev_paid === 'succeeded') {
    return { label: 'Paid', color: GREEN, background: 'rgba(27,146,84,0.15)', border: '1px solid rgba(27,146,84,0.3)' }
  }
  if (row.rev_paid === REV_VIA_ERT) {
    return {
      label: row.ert_share_done ? 'Via ERT (ticked)' : 'Via ERT',
      color: 'var(--wig-ink)', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)',
    }
  }
  if (row.rev_paid === 'Failed') {
    return { label: 'Failed', color: '#d93025', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)' }
  }
  if (row.rev_paid === 'Awaiting Payout Account') {
    return { label: 'Awaiting payout account', color: ORANGE, background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)' }
  }
  if (row.rev_paid === REV_NOT_DUE) {
    return { label: 'Not due', color: 'var(--wig-muted)', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)' }
  }
  if (row.rev_paid === 'processing') {
    return { label: 'Processing', color: 'var(--wig-ink)', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)' }
  }
  return { label: 'Pending', color: 'var(--wig-muted)', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)' }
}

export default function ProviderReceiptDetail({ receiptId, onBack, onOpenCoi, onOpenClient, flash }) {
  const [receipt, setReceipt] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    callApi('load_provider_receipt', { receipt_id: receiptId })
      .then(data => { if (alive) { setReceipt(data.receipt || null); setRows(data.rows || []); setLoadError('') } })
      .catch(err => { if (alive) setLoadError(err.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [receiptId])

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
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--wig-faint)', fontSize: '13px' }}>No client records on this receipt.</td>
                </tr>
              )}

              {rows.map(r => {
                const status = shareStatus(r)
                return (
                  <tr key={r.payment_id}>
                    {/* A shortcut straight into this row's own payment, which is
                        where a share that needs finishing is finished. */}
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      <span style={{ display: 'block' }}>
                        {r.client_name
                          ? <NameLink title="Open payment"
                              onClick={() => onOpenClient && onOpenClient(r.coi_member_number, r.client_id, {
                                clientTab: 'client_payments',
                                paymentId: r.payment_id,
                                returnTo: 'tax_strategies',
                              })}>{r.client_name}</NameLink>
                          : <span style={{ color: 'var(--wig-faint)' }}>—</span>}
                      </span>
                      <span style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', fontWeight: 400, color: 'var(--wig-muted)' }}>{r.client_number || '—'}</span>
                    </td>
                    <td style={tdStyle}>
                      {r.coi_name
                        ? <NameLink title="Open COI profile"
                            onClick={() => onOpenCoi && onOpenCoi(r.coi_member_number, { returnTo: 'tax_strategies' })}>{r.coi_name}</NameLink>
                        : <span style={{ color: 'var(--wig-faint)' }}>—</span>}
                    </td>
                    <td style={cellMutedStyle}>{basisText(r)}</td>
                    <td style={cellMutedStyle}>{r.revenue_expected == null ? '—' : `$${moneyText(r.revenue_expected)}`}</td>
                    <td style={tdStyle}>{r.revenue_received == null ? '—' : `$${moneyText(r.revenue_received)}`}</td>
                    <td style={cellMutedStyle}>{r.coi_share_amount == null ? '—' : `$${moneyText(r.coi_share_amount)}`}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: status.color, background: status.background, border: status.border, borderRadius: '999px', padding: '4px 12px', whiteSpace: 'nowrap' }}>{status.label}</span>
                        {r.sandbox === true && <span style={sandboxChipStyle}>Sandbox</span>}
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
      </div>
    </div>
  )
}
