import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import PaymentDetail from './PaymentDetail'
import { AccountingPills } from './AccountingPaymentsPanel'
import { TrackHero } from './shared/TrackKit'
import { TableSkeleton } from './shared/Skeleton'
import { PAYOUT_ORANGE, PAYOUT_RED } from '../lib/payoutText'

// Accounting → Needs Attention (Jake, 2026-10-07: errors must not go hidden; VFO's
// Outstanding Payment Links, widened): everything failed, waiting or stuck right
// now, oldest first, with how long it has been so and what to do. WHO is whoever
// is owed the money or must act (the COI, payee or team member on a payout, the
// client on their own payment); PAYMENT is the client it hangs off. A row opens
// where the fix is — the payment (Retry, Pay now, Refund, Record check, Resend),
// Team Payroll, or the team member's profile. Superadmins only, like Accounting.

// The same key Accounting → Payments writes: only one Accounting screen mounts at
// a time, so an open payment survives a refresh here too (standing rule 5).
const SELECTED_PAYMENT_KEY = 'wigSelectedPayment'

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const tableWrapStyle = { border: '1px solid var(--wig-border-soft)', borderRadius: '14px', background: 'var(--wig-card)', boxShadow: 'var(--wig-shadow-card)', marginBottom: '22px', overflow: 'hidden' }
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }
const thStyle = { textAlign: 'left', padding: '12px 16px', background: 'var(--wig-input)', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-muted)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '11px 16px', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '13px', color: 'var(--wig-ink)', verticalAlign: 'top' }
const sandboxTagStyle = { fontSize: '10px', fontWeight: 700, color: PAYOUT_ORANGE, border: `1px solid ${PAYOUT_ORANGE}`, borderRadius: '999px', padding: '1px 7px', marginLeft: '6px', whiteSpace: 'nowrap' }

const KINDS = {
  claim_unconfirmed: { label: 'Transfer unconfirmed', color: PAYOUT_RED },
  transfer_failed: { label: 'Payout failing', color: PAYOUT_RED },
  refund_stuck: { label: 'Refund stuck', color: PAYOUT_RED },
  payment_failed: { label: 'Payment failed', color: PAYOUT_RED },
  payroll_failed: { label: 'Payroll report', color: PAYOUT_RED },
  awaiting_account: { label: 'No payout account', color: PAYOUT_ORANGE },
  processing_stuck: { label: 'Stuck processing', color: PAYOUT_ORANGE },
  unpaid_overdue: { label: 'Unpaid', color: PAYOUT_ORANGE },
  check_due: { label: 'Check due', color: PAYOUT_ORANGE },
  team_no_email: { label: 'No email', color: PAYOUT_ORANGE },
}

function sinceText(iso) {
  if (!iso) return '—'
  const d = new Date(String(iso).length === 10 ? `${iso}T12:00:00Z` : iso)
  if (Number.isNaN(d.getTime())) return '—'
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000))
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${date} · ${days === 0 ? 'today' : days === 1 ? '1 day' : `${days} days`}`
}

export default function NeedsAttentionPanel({ onSelectSection, onOpenTeamMember }) {
  const [items, setItems] = useState(null)
  const [warning, setWarning] = useState('')
  const [loadError, setLoadError] = useState('')
  const [selectedPaymentId, setSelectedPaymentId] = useState(() => sessionStorage.getItem(SELECTED_PAYMENT_KEY) || null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const data = await callApi('load_attention_items')
      setItems(data.items || [])
      setWarning(data.warning || '')
      setLoadError('')
    } catch (err) {
      setLoadError(err.message)
    }
  }

  function openPayment(id) {
    setSelectedPaymentId(id)
    if (id == null) sessionStorage.removeItem(SELECTED_PAYMENT_KEY)
    else sessionStorage.setItem(SELECTED_PAYMENT_KEY, String(id))
    window.scrollTo(0, 0)
  }

  function openItem(item) {
    if (item.payment_id) openPayment(item.payment_id)
    else if (item.kind === 'payroll_failed') onSelectSection && onSelectSection('team_payroll')
    else if (item.team_member_id && onOpenTeamMember) onOpenTeamMember(item.team_member_id)
  }

  if (selectedPaymentId) {
    // Coming back re-reads the list: a Retry or Pay now in the detail may have
    // fixed the row it came from.
    return <PaymentDetail paymentId={selectedPaymentId} onBack={() => { openPayment(null); load() }} />
  }

  return (
    <div>
      <TrackHero eyebrow="Accounting" title="Accounting" />
      <AccountingPills active="needs_attention" onSelect={onSelectSection} />

      {loadError ? (
        <div style={sectionStyle}><p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{loadError}</p></div>
      ) : items === null ? (
        <TableSkeleton cols={6} rows={4} />
      ) : (
        <>
          {warning && (
            <div style={{ ...sectionStyle, padding: '14px 18px', borderColor: PAYOUT_ORANGE }}>
              <p style={{ color: PAYOUT_ORANGE, fontSize: '13px', margin: 0 }}>Part of this list could not be read, so it may be incomplete: {warning}</p>
            </div>
          )}
          {items.length === 0 ? (
            <div style={sectionStyle}>
              <p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0 }}>Nothing needs attention: no failed, waiting or stuck payments, payouts or reports.</p>
            </div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead><tr>
                  <th style={thStyle}>Problem</th>
                  <th style={thStyle}>Who</th>
                  <th style={thStyle}>Payment</th>
                  <th style={thStyle}>What is wrong</th>
                  <th style={thStyle}>Since</th>
                  <th style={thStyle}>What to do</th>
                </tr></thead>
                <tbody>
                  {items.map((it, i) => {
                    const k = KINDS[it.kind] || { label: it.kind, color: PAYOUT_ORANGE }
                    return (
                      <tr key={`${it.kind}-${it.payment_id || it.team_member_id || it.who}-${i}`} onClick={() => openItem(it)} style={{ cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--wig-tint)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: k.color, border: '1px solid var(--wig-border-chip)', background: 'var(--wig-tint)', borderRadius: '999px', padding: '3px 10px' }}>{k.label}</span>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{it.who}</td>
                        <td style={tdStyle}>{it.client || '—'}{it.sandbox && <span style={sandboxTagStyle}>Sandbox</span>}</td>
                        <td style={tdStyle}>{it.detail}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--wig-muted)' }}>{sinceText(it.since)}</td>
                        <td style={{ ...tdStyle, color: 'var(--wig-muted)', fontSize: '12.5px' }}>{it.fix}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
