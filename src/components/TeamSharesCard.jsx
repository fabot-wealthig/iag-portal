import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { SkeletonRow } from './shared/Skeleton'
import { BareMoneyInput } from './shared/MoneyInput'
import { buttonStyle, primaryButtonStyle, withBusy, labelStyle, inputStyle, textareaStyle, buttonRowStyle, errorTextStyle, okTextStyle } from './shared/actionStyles'

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
  if (s.status === 'void' && s.void_reason === 'edited') return { text: 'Edited to $0', color: 'var(--wig-muted)' }
  if (s.status === 'void') return { text: `Void${s.void_reason ? ` (${s.void_reason})` : ''}`, color: '#EE6A33' }
  if (s.status === 'paid') return { text: `Paid ${s.paid_at ? new Date(s.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}`.trim(), color: '#1b9254' }
  if (s.status === 'reported') return { text: `On payroll report ${s.reported_at ? new Date(s.reported_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}`.trim(), color: '#1b9254' }
  if (s.status === 'processing') return { text: 'In progress', color: 'var(--wig-ink)' }
  if (s.status === 'held') return { text: 'No payout account', color: '#EE6A33' }
  if (s.status === 'failed') return { text: `Failed${s.failure_reason ? `: ${s.failure_reason}` : ''}`, color: '#d93025' }
  return { text: 'Owed', color: 'var(--wig-ink)' }
}

const money = (n) => Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const round2 = (n) => Math.round(n * 100) / 100

// Void ONLY because the payment is sandbox: test money, never paid (Jake,
// 2026-10-06), but the figures are what a live payment would pay — so the row
// is not struck through and the totals count it (Jake, 2026-10-12). A refund
// void still leaves the totals, because then nothing is owed at all.
const sandboxVoid = (s) => s.status === 'void' && s.void_reason === 'sandbox payment'
// A superadmin may edit a share (IAG 2026-11-19, `edit_team_share`) until it has
// gone out; never a staff COI's, which is the COI's own share.
const editable = (s) => s.role !== 'staff_coi' &&
  (['owed', 'held', 'failed'].includes(s.status) || (s.status === 'void' && ['edited', 'sandbox payment'].includes(s.void_reason)))
const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '')

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const thStyle = { textAlign: 'left', padding: '8px 12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-muted)', borderBottom: '1px solid var(--wig-border-soft)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '9px 12px', fontSize: '13px', color: 'var(--wig-ink)', borderBottom: '1px solid var(--wig-border-soft)', whiteSpace: 'nowrap' }
const totalStyle = { ...tdStyle, fontWeight: 700, borderBottom: 'none' }
// The Payout card's own sub-heading ("What will be paid", "Payout history").
const subheadStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)', marginBottom: '8px' }

// `refreshKey` changes when the payment clears or is refunded, which is when the
// shares change.
// `bare`: drawn inside the Payout card (PaymentDetail.jsx) under a sub-heading,
// rather than as a card of its own.
export default function TeamSharesCard({ paymentId, refreshKey, shareOwner = 'the COI', bare = false }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [shareId, setShareId] = useState('')
  const [by, setBy] = useState('rate')
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    let live = true
    setError('')
    callApi('load_payment_team_shares', { payment_id: paymentId })
      .then(d => { if (live) setData(d) })
      .catch(err => { if (live) setError(err.message) })
    return () => { live = false }
  }, [paymentId, refreshKey])

  // The server's team_total / iag_remainder leave every void out; a sandbox void
  // is put back so the card reads as the live payment would.
  const sandboxShares = data?.shares ? data.shares.filter(sandboxVoid) : []
  // Staff COI rows stay out, as on the server: that is the COI's share, off the pool.
  const extra = round2(sandboxShares.filter(s => s.role !== 'staff_coi').reduce((sum, s) => sum + Number(s.amount || 0), 0))
  const totals = {
    team: round2(Number(data?.team_total || 0) + extra),
    iag: data?.iag_remainder == null ? null : round2(Number(data.iag_remainder) - extra),
    sandbox: sandboxShares.length > 0,
  }

  const editableShares = data?.shares ? data.shares.filter(editable) : []
  const picked = editableShares.find(s => s.id === shareId) || null
  const preview = (() => {
    if (!picked || value === '') return null
    const n = Number(value)
    if (!Number.isFinite(n) || n < 0) return null
    const base = Number(picked.base_amount || 0)
    return by === 'rate'
      ? `New amount: $${money(round2(base * n / 100))}`
      : `New rate: ${base > 0 ? Math.round(n / base * 100000) / 1000 : 0}% of $${money(base)}`
  })()

  const openForm = () => {
    setEditing(true); setShareId(''); setBy('rate'); setValue(''); setReason(''); setFormError(''); setSaved('')
  }
  const pickShare = (id) => {
    setShareId(id)
    const s = editableShares.find(x => x.id === id)
    setValue(s ? String(by === 'rate' ? s.rate_pct : s.amount) : '')
  }
  const pickBy = (next) => {
    setBy(next)
    setValue(picked ? String(next === 'rate' ? picked.rate_pct : picked.amount) : '')
  }
  const save = async () => {
    if (!picked) { setFormError('Pick the share to edit.'); return }
    if (value === '' || !Number.isFinite(Number(value))) { setFormError(by === 'rate' ? 'Enter the new percent.' : 'Enter the new amount.'); return }
    if (!reason.trim()) { setFormError('Give a reason for the change.'); return }
    setBusy(true); setFormError('')
    try {
      const body = { share_id: picked.id, reason: reason.trim() }
      if (by === 'rate') body.rate_pct = Number(value)
      else body.amount = Number(value)
      const d = await callApi('edit_team_share', body)
      setData(d)
      setEditing(false)
      setSaved(`${picked.member_name}'s ${ROLE_LABELS[picked.role] || picked.role} share was changed.`)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={bare ? undefined : sectionStyle}>
      <div style={bare ? subheadStyle : eyebrowStyle}>Team shares</div>
      {error ? (
        <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{error}</p>
      ) : !data ? (
        <><SkeletonRow /><SkeletonRow /></>
      ) : !data.calculated ? (
        <p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0 }}>Calculated when the payment clears, from its Net Profit Pool (what is left after {shareOwner}'s share).</p>
      ) : (
        <>
          <p style={{ fontSize: '13px', color: 'var(--wig-muted)', margin: '0 0 12px' }}>
            Off a Net Profit Pool of <strong style={{ color: 'var(--wig-ink)' }}>${money(data.net_profit_pool)}</strong> (what was left after {shareOwner}'s share), at the rates in force when it cleared.
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
                    const voided = s.status === 'void' && !sandboxVoid(s) && s.void_reason !== 'edited'
                    const cell = voided ? { ...tdStyle, color: 'var(--wig-faint)', textDecoration: 'line-through' } : tdStyle
                    return (
                      <tr key={s.id}>
                        <td style={{ ...cell, fontWeight: 600 }}>
                          {s.member_name}
                          {s.edited_at && (
                            <div style={{ fontSize: '11px', fontWeight: 400, color: 'var(--wig-muted)', whiteSpace: 'normal', maxWidth: '260px' }}>
                              Edited by {s.edited_by} {shortDate(s.edited_at)}{s.original_amount != null ? ` (was ${s.original_rate_pct}% · $${money(s.original_amount)})` : ''}: {s.edit_reason}
                            </div>
                          )}
                        </td>
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
                    <td style={totalStyle} colSpan={3}>${money(totals.team)}</td>
                  </tr>
                  <tr>
                    <td style={{ ...totalStyle, color: 'var(--wig-muted)', fontWeight: 600 }} colSpan={3}>IAG keeps</td>
                    <td style={{ ...totalStyle, color: 'var(--wig-muted)', fontWeight: 600 }} colSpan={3}>${money(totals.iag)}</td>
                  </tr>
                </tbody>
              </table>
              {totals.sandbox && (
                <p style={{ fontSize: '12.5px', color: 'var(--wig-muted)', margin: '10px 0 0' }}>
                  Sandbox payment: these are the amounts a live payment would pay. Nothing is paid to anyone.
                </p>
              )}
            </div>
          )}
          {saved && !editing && <p style={okTextStyle}>{saved}</p>}
          {editableShares.length > 0 && !editing && (
            <div style={{ marginTop: '14px' }}>
              <button type="button" style={buttonStyle} onClick={openForm}>Edit a share</button>
            </div>
          )}
          {editing && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--wig-border-soft)', display: 'grid', gap: '14px', maxWidth: '520px' }}>
              <p style={{ fontSize: '13px', color: 'var(--wig-muted)', margin: 0 }}>
                For a one-off case on this payment only. A share can be changed until it is paid by Stripe or put on a payroll report. Setting it to 0 means nothing is paid; what is taken off stays with IAG.
              </p>
              <div>
                <label style={labelStyle}>Share</label>
                <select style={inputStyle} value={shareId} onChange={e => pickShare(e.target.value)}>
                  <option value="">Pick a share…</option>
                  {editableShares.map(s => (
                    <option key={s.id} value={s.id}>{s.member_name} · {ROLE_LABELS[s.role] || s.role} · {s.rate_pct}% · ${money(s.amount)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Change by</label>
                <div style={{ display: 'flex', gap: '18px', fontSize: '13.5px', color: 'var(--wig-ink)', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="radio" checked={by === 'rate'} onChange={() => pickBy('rate')} /> Percent of the Net Profit Pool
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="radio" checked={by === 'amount'} onChange={() => pickBy('amount')} /> Dollar amount
                  </label>
                </div>
              </div>
              <div>
                <label style={labelStyle}>{by === 'rate' ? 'New percent' : 'New amount'}</label>
                {by === 'rate' ? (
                  <input style={inputStyle} inputMode="decimal" value={value} placeholder="0" onChange={e => setValue(e.target.value.replace(/[^0-9.]/g, ''))} />
                ) : (
                  <BareMoneyInput value={value} onChange={setValue} />
                )}
                {preview && <div style={{ fontSize: '12.5px', color: 'var(--wig-muted)', marginTop: '6px' }}>{preview}</div>}
              </div>
              <div>
                <label style={labelStyle}>Reason</label>
                <textarea style={textareaStyle} value={reason} maxLength={500} placeholder="e.g. No implementation specialist on this client" onChange={e => setReason(e.target.value)} />
              </div>
              <div style={buttonRowStyle}>
                <button type="button" style={withBusy(primaryButtonStyle, busy)} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save share'}</button>
                <button type="button" style={buttonStyle} disabled={busy} onClick={() => { setEditing(false); setFormError('') }}>Cancel</button>
              </div>
              {formError && <p style={{ ...errorTextStyle, marginTop: 0 }}>{formError}</p>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
