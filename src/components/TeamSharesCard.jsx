import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { SkeletonRow } from './shared/Skeleton'

// The internal team's shares of one payment (Phase B2), as snapshotted when it
// cleared: who, which role, the rate and the amount, off the payment's Net Profit
// Pool, with what is left for IAG. Superadmins only (what each staff member earns —
// Jake); PaymentDetail does not mount it for anyone else, and the server refuses.

const ROLE_LABELS = {
  advisor: 'Advisor',
  advisor_lead: 'Advisor Lead',
  is: 'Implementation Specialist',
  is_team_lead: 'Implementation Specialist Team Lead',
  coi_manager: 'COI Manager',
  coi_curator: 'COI Curator',
  staff_coi: 'Staff COI',
}

// A share's payout status, in the Payout pill's words.
function statusText(s) {
  if (s.status === 'void') return { text: `Void${s.void_reason ? ` (${s.void_reason})` : ''}`, color: '#EE6A33' }
  if (s.status === 'paid') return { text: `Paid ${s.paid_at ? new Date(s.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}`.trim(), color: '#1b9254' }
  if (s.status === 'processing') return { text: 'In progress', color: 'var(--wig-ink)' }
  if (s.status === 'held') return { text: 'No payout account', color: '#EE6A33' }
  if (s.status === 'failed') return { text: `Failed${s.failure_reason ? `: ${s.failure_reason}` : ''}`, color: '#d93025' }
  return { text: 'Owed', color: 'var(--wig-ink)' }
}

const money = (n) => Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const thStyle = { textAlign: 'left', padding: '8px 12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-muted)', borderBottom: '1px solid var(--wig-border-soft)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '9px 12px', fontSize: '13px', color: 'var(--wig-ink)', borderBottom: '1px solid var(--wig-border-soft)', whiteSpace: 'nowrap' }
const totalStyle = { ...tdStyle, fontWeight: 700, borderBottom: 'none' }

// `refreshKey` changes when the payment clears or is refunded, which is when the
// shares change.
export default function TeamSharesCard({ paymentId, refreshKey }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    setError('')
    callApi('load_payment_team_shares', { payment_id: paymentId })
      .then(d => { if (live) setData(d) })
      .catch(err => { if (live) setError(err.message) })
    return () => { live = false }
  }, [paymentId, refreshKey])

  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>Team shares</div>
      {error ? (
        <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{error}</p>
      ) : !data ? (
        <><SkeletonRow /><SkeletonRow /></>
      ) : !data.calculated ? (
        <p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0 }}>Calculated when the payment clears, from its Net Profit Pool (what is left after the COI's share).</p>
      ) : (
        <>
          <p style={{ fontSize: '13px', color: 'var(--wig-muted)', margin: '0 0 12px' }}>
            Off a Net Profit Pool of <strong style={{ color: 'var(--wig-ink)' }}>${money(data.net_profit_pool)}</strong> (what was left after the COI's share), at the rates in force when it cleared.
          </p>
          {data.shares.length === 0 ? (
            <p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0 }}>No team shares on this payment.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Person</th>
                    <th style={thStyle}>Role</th>
                    <th style={thStyle}>Rate</th>
                    <th style={thStyle}>Amount</th>
                    <th style={thStyle}>Paid by</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.shares.map(s => {
                    const voided = s.status === 'void'
                    const cell = voided ? { ...tdStyle, color: 'var(--wig-faint)', textDecoration: 'line-through' } : tdStyle
                    return (
                      <tr key={s.id}>
                        <td style={{ ...cell, fontWeight: 600 }}>{s.member_name}</td>
                        <td style={cell}>{ROLE_LABELS[s.role] || s.role}{s.level != null ? ` (L${s.level})` : ''}{s.role === 'staff_coi' && <div style={{ fontSize: '11px', color: 'var(--wig-muted)' }}>The COI's share, off the pool</div>}</td>
                        <td style={cell}>{s.rate_pct}%</td>
                        <td style={cell}>${money(s.amount)}</td>
                        <td style={cell}>{s.pay_method === 'stripe' ? 'Stripe' : 'Payroll'}</td>
                        <td style={{ ...tdStyle, color: statusText(s).color, fontWeight: 600, whiteSpace: 'normal' }}>
                          {statusText(s).text}
                        </td>
                      </tr>
                    )
                  })}
                  <tr>
                    <td style={totalStyle} colSpan={3}>Team total</td>
                    <td style={totalStyle} colSpan={3}>${money(data.team_total)}</td>
                  </tr>
                  <tr>
                    <td style={{ ...totalStyle, color: 'var(--wig-muted)', fontWeight: 600 }} colSpan={3}>IAG keeps</td>
                    <td style={{ ...totalStyle, color: 'var(--wig-muted)', fontWeight: 600 }} colSpan={3}>${money(data.iag_remainder)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
