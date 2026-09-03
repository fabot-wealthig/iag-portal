import { useState } from 'react'
import { StatusPill, methodText } from './PaymentDetail'
import { NameLink } from './shared/TrackKit'

// The payments list, shared by the client's own Payments tab and the
// Accounting panel's every-payment list. Extracted from CoiClients so the two
// cannot drift: a column added here shows up in both, and the status lines
// under a pill are read the same way whichever list you are looking at.
//
// One track for every column the header names, so the header and every row line
// up whatever is in them. Sized to sit inside the portal's 980px content column
// once its side padding and the row's own padding come off. Money is
// right-aligned in both the header and the cells.
const BASE_COLUMNS = '84px minmax(110px, 1fr) 96px 96px 104px 128px 84px'
// The Accounting list is unscoped, so its rows have to name their own client;
// the client's own tab already knows whose payments it is showing.
const CLIENT_COLUMN = 'minmax(150px, 1.3fr)'

const paymentGridStyle = {
  display: 'grid',
  gridTemplateColumns: BASE_COLUMNS,
  alignItems: 'center',
  gap: '10px',
}
const colHeadStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)' }
const cellMutedStyle = { fontSize: '12px', color: 'var(--wig-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
// The amber the portal uses for "still owed": loud enough to be read as a
// to-do under the pill, quiet enough not to read as an error.
const notSentLineStyle = { fontSize: '11px', color: '#EE6A33', fontWeight: 600 }

/**
 * `payments` newest-first as delivered; `onOpen(payment)` opens one. With
 * `showClient` the list gains a leading Client column whose two names are
 * shortcuts up to the client and the COI — the row itself still opens the
 * payment, which is why they have to be links rather than plain text.
 */
export default function PaymentsGrid({ payments = [], onOpen, showClient = false, onOpenClient, onOpenCoi }) {
  const grid = showClient
    ? { ...paymentGridStyle, gridTemplateColumns: `${CLIENT_COLUMN} ${BASE_COLUMNS}` }
    : paymentGridStyle

  return (
    <div>
      <div style={{ ...grid, padding: '0 16px 8px' }}>
        {showClient && <span style={colHeadStyle}>Client</span>}
        <span style={colHeadStyle}>Date</span>
        <span style={colHeadStyle}>Strategy</span>
        <span style={{ ...colHeadStyle, textAlign: 'right' }}>Offset</span>
        <span style={{ ...colHeadStyle, textAlign: 'right' }}>Fee</span>
        <span style={colHeadStyle}>Method</span>
        <span style={colHeadStyle}>Status</span>
        <span />
      </div>
      {payments.map(p => (
        <PaymentRow
          key={p.id}
          payment={p}
          grid={grid}
          showClient={showClient}
          onOpen={() => onOpen(p)}
          onOpenClient={onOpenClient ? () => onOpenClient(p) : null}
          onOpenCoi={onOpenCoi ? () => onOpenCoi(p) : null}
        />
      ))}
    </div>
  )
}

function PaymentRow({ payment, grid, showClient, onOpen, onOpenClient, onOpenCoi }) {
  const [copied, setCopied] = useState(false)

  function copyLink(e) {
    // The row itself opens the payment; the one action inside it must not.
    e.stopPropagation()
    navigator.clipboard.writeText(payment.pay_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // The date the money moved once it has, the date the request was raised
  // before that — the row's date should always be its most recent fact.
  const rowDate = payment.payment_date || payment.created_at
  const method = methodText(payment)

  return (
    <div onClick={onOpen}
      style={{ ...grid, padding: '12px 16px', marginBottom: '6px', background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(20,45,95,0.04)', cursor: 'pointer' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(61,155,224,0.4)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--wig-border-soft)'}>
      {showClient && (
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {payment.client_name
              ? <NameLink onClick={onOpenClient} title="Open client profile">{payment.client_name}</NameLink>
              : <span style={{ color: 'var(--wig-faint)' }}>—</span>}
          </span>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--wig-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {payment.coi_name
              ? <NameLink onClick={onOpenCoi} title="Open COI profile">{payment.coi_name}</NameLink>
              : '—'}
          </span>
        </span>
      )}
      <span style={{ ...cellMutedStyle, fontFamily: 'monospace' }}>{dateText(rowDate)}</span>
      {/* Plain text, not a link: the whole row already opens this payment. */}
      <span style={{ fontSize: '14px', color: 'var(--wig-ink)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payment.strategy_name || payment.strategy_key}</span>
      <span style={{ ...cellMutedStyle, textAlign: 'right' }}>${moneyText(payment.offset_amount)}</span>
      <span style={{ ...cellMutedStyle, textAlign: 'right', color: 'var(--wig-ink)' }}>${moneyText(payment.total_fee)}</span>
      <span style={cellMutedStyle}>{method}</span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px', minWidth: 0 }}>
        <StatusPill payment={payment} />
        {/* Only worth a line while it is outstanding — anything already sent is
            implied by the status above it. A cleared payment can owe both. */}
        {payment.confirmation_status === 'Confirmation Needed' && (
          <span style={notSentLineStyle}>Confirmation not sent</span>
        )}
        {payment.payment_status === 'succeeded' && !payment.invoice_email_sent && (
          <span style={notSentLineStyle}>Invoice not sent</span>
        )}
        {/* A share the COI is still owed. Both states are non-terminal — the
            detail screen's Retry revenue share button finishes either — so they
            belong beside the paperwork lines rather than reading as an error. */}
        {payment.rev_paid === 'Awaiting Payout Account' && (
          <span style={notSentLineStyle}>Revenue share held</span>
        )}
        {payment.rev_paid === 'Failed' && (
          <span style={notSentLineStyle}>Revenue share failed</span>
        )}
      </span>
      <span style={{ textAlign: 'right' }}>
        {payment.pay_url && (
          <button type="button" onClick={copyLink}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--wig-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            {copied ? 'Copied' : 'Copy pay link'}
          </button>
        )}
      </span>
    </div>
  )
}

function dateText(v) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

function moneyText(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}
