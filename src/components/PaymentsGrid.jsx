import { StatusPill, methodText } from './PaymentDetail'
import { NameLink } from './shared/TrackKit'
import { discountAmountText } from './shared/DiscountFields'
import { sandboxChipStyle } from '../lib/stripeMode'

// The payments list, shared by the client's own Payments tab and the
// Accounting panel's every-payment list. Extracted from CoiClients so the two
// cannot drift: a column added here shows up in both, and the status lines
// under a pill are read the same way whichever list you are looking at.
//
// A real table on `auto` layout inside one card, the same treatment the two
// overview panels use (and the same shape VFO's PaymentsTable has inside
// ClientPaymentsTab's card): the browser measures every column against its own
// content and shares the leftover width out across all of them, so no single
// stretchy column can hoard the slack and open a gap beside a short value — and
// the header always sits over the cells it names. Every column is left-aligned,
// money included: a lone right-aligned pair in a left-aligned table reads as a
// misprint rather than as arithmetic.
//
// There is no copy-link column. The pay link lives on the payment's own detail
// screen, one click away through the row — a list is for scanning, not for
// firing off actions from.

const tableStyle = { width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', fontFamily: 'Inter, sans-serif' }
const thStyle = { textAlign: 'left', padding: '12px 18px', background: 'var(--wig-input)', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-muted)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '12px 18px', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '13px', color: 'var(--wig-ink)', verticalAlign: 'middle', whiteSpace: 'nowrap' }
const cellMutedStyle = { ...tdStyle, fontSize: '12px', color: 'var(--wig-muted)' }
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
  const colCount = showClient ? 7 : 6

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--wig-border-soft)', borderRadius: '14px', background: 'var(--wig-card)', boxShadow: 'var(--wig-shadow-card)' }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {showClient && <th style={thStyle}>Client</th>}
            <th style={thStyle}>Date</th>
            <th style={thStyle}>Strategy</th>
            {/* Named for what the two columns mean rather than for what LEOS
                calls them: a provider row has no offset and no client fee, but
                it has the figure the split is measured from and the figure that
                is owed. */}
            <th style={thStyle}>Basis</th>
            <th style={thStyle}>Amount</th>
            <th style={thStyle}>Method</th>
            <th style={thStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 && (
            <tr>
              <td colSpan={colCount} style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--wig-faint)', fontSize: '13px' }}>No payments to show.</td>
            </tr>
          )}

          {payments.map(p => (
            <PaymentRow
              key={p.id}
              payment={p}
              showClient={showClient}
              onOpen={() => onOpen(p)}
              onOpenClient={onOpenClient ? () => onOpenClient(p) : null}
              onOpenCoi={onOpenCoi ? () => onOpenCoi(p) : null}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PaymentRow({ payment, showClient, onOpen, onOpenClient, onOpenCoi }) {
  // The date the money moved once it has, the date the request was raised
  // before that — the row's date should always be its most recent fact.
  const rowDate = payment.payment_date || payment.created_at
  const method = methodText(payment)

  return (
    <tr onClick={onOpen}
      style={{ cursor: 'pointer' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--wig-tint)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      {showClient && (
        <td style={tdStyle}>
          <span style={{ display: 'block', fontWeight: 600 }}>
            {payment.client_name
              ? <NameLink onClick={onOpenClient} title="Open client profile">{payment.client_name}</NameLink>
              : <span style={{ color: 'var(--wig-faint)' }}>—</span>}
          </span>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--wig-muted)' }}>
            {payment.coi_name
              ? <NameLink onClick={onOpenCoi} title="Open COI profile">{payment.coi_name}</NameLink>
              : '—'}
          </span>
        </td>
      )}
      <td style={{ ...cellMutedStyle, fontFamily: 'monospace' }}>{dateText(rowDate)}</td>
      {/* Plain text, not a link: the whole row already opens this payment. */}
      <td style={{ ...tdStyle, fontWeight: 600 }}>{payment.strategy_name || payment.strategy_key}</td>
      <td style={cellMutedStyle}>{basisText(payment)}</td>
      <td style={{ ...cellMutedStyle, color: 'var(--wig-ink)' }}>
        {!providerRow(payment)
          ? `$${moneyText(payment.total_fee)}`
          : payment.revenue_received != null
            ? `$${moneyText(payment.revenue_received)}`
            : (
              <>
                {`$${moneyText(payment.revenue_expected)}`}
                {/* Nothing has arrived yet, so the figure is a forecast and has
                    to say so beside the received ones it is listed among. */}
                <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--wig-muted)' }}>expected</span>
              </>
            )}
        {/* Record only: the figure above is still what was charged or received. */}
        {discountAmountText(payment) && (
          <span title={payment.discount_reason || undefined}
            style={{ display: 'block', fontSize: '11px', color: 'var(--wig-muted)' }}>
            {`discount ${discountAmountText(payment)}`}
          </span>
        )}
      </td>
      <td style={cellMutedStyle}>{method}</td>
      <td style={tdStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <StatusPill payment={payment} />
            {/* The mode stamped on the row when the payment was raised — a test
                name at the time, so no real money was ever going to move. */}
            {payment.sandbox === true && <span style={sandboxChipStyle}>Sandbox</span>}
          </div>
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
        </div>
      </td>
    </tr>
  )
}

const providerRow = (payment) => payment.funded_by === 'provider'

// What the split is measured from, where there IS such a thing. LEOS measures
// it from the offset; a fixed commission from the box the client chose, which
// is a name rather than an amount; the contribution models from what the client
// put in; Oil & Gas from the chargeable hours, and Closehaul from the event and
// the amount its percentage was taken of. The other two measure it from nothing
// at all — the Implementation Fee and Cost Segregation are both their own
// figure — so the column reads as an em dash rather than "$—", which would
// claim a missing amount where there was never one to miss.
function basisText(payment) {
  if (!providerRow(payment)) {
    return payment.offset_amount == null ? '—' : `$${moneyText(payment.offset_amount)}`
  }
  const inputs = payment.strategy_inputs || {}
  if (inputs.tier_label) return inputs.tier_label
  if (inputs.chargeable_hours != null) return `${inputs.chargeable_hours} hrs`
  if (inputs.event_label) return `${inputs.event_label} $${moneyText(payment.contribution_amount)}`
  return payment.contribution_amount == null ? '—' : `$${moneyText(payment.contribution_amount)}`
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
