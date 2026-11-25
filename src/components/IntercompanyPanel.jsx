import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { clearIntercompanyLink, INTERCOMPANY_SELECTED_KEY } from '../lib/intercompanyLink'
import { AccountingPills } from './AccountingPaymentsPanel'
import { NOTIFICATIONS_CHANGED } from './NotificationBell'
import { BackLink, Field, TrackHero } from './shared/TrackKit'
import { TableSkeleton } from './shared/Skeleton'
import {
  bodyStyle, buttonRowStyle, buttonStyle, dangerButtonStyle, dateText, errorTextStyle, eyebrowStyle, labelStyle, money,
  okTextStyle, primaryButtonStyle, sectionStyle, textareaStyle, warnTextStyle, withBusy,
} from './shared/actionStyles'
import { sandboxTagStyle } from '../lib/stripeMode'
import { PAYOUT_GREEN, PAYOUT_ORANGE, PAYOUT_RED, whenText } from '../lib/payoutText'

// Accounting → VFOS IAG Inter-Company Transfer (Jake, 2026-11-25). VFO Services' requests
// for money owed to it and its people, raised from the VFO portal. Accept and transfer
// moves the amount from IAG's Stripe balance to VFO Services; Deny sends the reason back.
// Waiting requests first, every answered one below. A row opens the request; its buttons
// are there, never in the list (standing rule 4). Superadmins only, like Accounting.

const TITLE = 'VFOS IAG Inter-Company Transfer'

const tableWrapStyle = { overflowX: 'auto', border: '1px solid var(--wig-border-soft)', borderRadius: '14px', background: 'var(--wig-card)', boxShadow: 'var(--wig-shadow-card)', marginBottom: '22px' }
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }
const thStyle = { textAlign: 'left', padding: '12px 18px', background: 'var(--wig-input)', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-muted)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '12px 18px', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '13px', color: 'var(--wig-ink)', verticalAlign: 'middle' }
const chipStyle = (color) => ({ fontSize: '11px', fontWeight: 600, color, background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '999px', padding: '2px 9px', whiteSpace: 'nowrap' })
const groupTitleStyle = { display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', margin: '0 4px 10px' }

// Every request is one, so it is said on the list, on the request and at the final confirm (Jake, 2026-11-25).
function FeeSplitNotice() {
  return (
    <div style={{ ...sectionStyle, padding: '14px 18px' }}>
      <p style={{ ...bodyStyle, margin: 0 }}><strong>These transfers are for the Specialist's implementation fee split.</strong> They are not part of the revenue share, which is paid completely separately.</p>
    </div>
  )
}

function statusOf(r) {
  if (r.reversed_at) return { label: 'Reversed', color: PAYOUT_RED }
  if (r.status === 'pending') return { label: 'Needs your answer', color: PAYOUT_ORANGE }
  if (r.status === 'processing') return { label: 'Transfer not confirmed', color: PAYOUT_ORANGE }
  if (r.status === 'transferred') return { label: 'Transferred', color: PAYOUT_GREEN }
  if (r.status === 'denied') return { label: 'Denied', color: PAYOUT_RED }
  return { label: 'Cancelled by VFO', color: 'var(--wig-muted)' }
}

const isOpen = (r) => r.status === 'pending' || r.status === 'processing'

function coversText(r) {
  const names = (r.lines || []).map(l => l.recipient).filter(Boolean)
  if (names.length === 0) return '—'
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} and ${names.length - 2} more` : names.join(', ')
}

export default function IntercompanyPanel({ onSelectSection }) {
  const [requests, setRequests] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [selectedId, setSelectedId] = useState(() => sessionStorage.getItem(INTERCOMPANY_SELECTED_KEY) || null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const data = await callApi('load_intercompany_requests')
      setRequests(data.requests || [])
      setLoadError('')
      clearIntercompanyLink()
    } catch (err) {
      setLoadError(err.message)
    }
  }

  function open(id) {
    setSelectedId(id)
    if (id) sessionStorage.setItem(INTERCOMPANY_SELECTED_KEY, id)
    else sessionStorage.removeItem(INTERCOMPANY_SELECTED_KEY)
    window.scrollTo(0, 0)
  }

  function apply(updated) {
    if (updated) setRequests(list => (list || []).map(r => (r.id === updated.id ? updated : r)))
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))
  }

  const selected = selectedId && requests ? requests.find(r => r.id === selectedId) : null
  if (selected) {
    return <RequestDetail key={selected.id} request={selected} onBack={() => { open(null); load() }} onApply={apply} onReload={load} />
  }

  const waiting = (requests || []).filter(isOpen)
  const history = (requests || []).filter(r => !isOpen(r))

  return (
    <div>
      <TrackHero eyebrow="Accounting" title="Accounting" />
      <AccountingPills active="intercompany" onSelect={onSelectSection} />
      <FeeSplitNotice />

      {loadError ? (
        <div style={sectionStyle}><p style={{ ...errorTextStyle, margin: 0 }}>{loadError}</p></div>
      ) : requests === null ? (
        <TableSkeleton cols={6} rows={4} />
      ) : (
        <>
          {selectedId && (
            <div style={{ ...sectionStyle, padding: '14px 18px' }}>
              <p style={{ ...warnTextStyle, margin: 0 }}>That request is no longer here. VFO may have cancelled it before it was answered.</p>
            </div>
          )}
          <div style={groupTitleStyle}>
            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--wig-heading)', letterSpacing: '-0.01em' }}>Requests</span>
            <span style={{ fontSize: '12.5px', color: 'var(--wig-muted)' }}>Open one to accept and transfer, or deny it.</span>
          </div>
          {waiting.length === 0 ? (
            <div style={sectionStyle}><p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0 }}>No requests are waiting for an answer.</p></div>
          ) : (
            <RequestsTable rows={waiting} onOpen={open} />
          )}

          <div style={groupTitleStyle}>
            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--wig-heading)', letterSpacing: '-0.01em' }}>History</span>
            <span style={{ fontSize: '12.5px', color: 'var(--wig-muted)' }}>Every request answered or cancelled.</span>
          </div>
          {history.length === 0 ? (
            <div style={sectionStyle}><p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0 }}>Nothing here yet.</p></div>
          ) : (
            <RequestsTable rows={history} onOpen={open} answered />
          )}
        </>
      )}
    </div>
  )
}

function RequestsTable({ rows, onOpen, answered = false }) {
  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Requested</th>
            <th style={thStyle}>For</th>
            <th style={thStyle}>Deals</th>
            <th style={thStyle}>Amount</th>
            <th style={thStyle}>Status</th>
            {answered && <th style={thStyle}>Answered</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const s = statusOf(r)
            return (
              <tr key={r.id} onClick={() => onOpen(r.id)} style={{ cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--wig-tint)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{dateText(r.requested_at)}{r.sandbox && <span style={{ ...sandboxTagStyle, marginLeft: '8px' }}>Sandbox</span>}</td>
                <td style={tdStyle}>{coversText(r)}</td>
                <td style={tdStyle}>{r.total_deals || 0}</td>
                <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>${money(r.amount)}</td>
                <td style={tdStyle}><span style={chipStyle(s.color)}>{s.label}</span></td>
                {answered && (
                  <td style={{ ...tdStyle, color: 'var(--wig-muted)' }}>
                    {r.status === 'withdrawn' ? '—' : `${dateText(r.answered_at)}${r.answered_by ? ` by ${r.answered_by}` : ''}`}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RequestDetail({ request, onBack, onApply, onReload }) {
  const [mode, setMode] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const s = statusOf(request)
  const amount = `$${money(request.amount)}`

  // A write, so never retried (lib/api.js). After an error the request is read again:
  // it may have been answered, cancelled, or left for Check transfer.
  async function submit(action, payload) {
    setBusy(true); setError('')
    try {
      const res = await callApi(action, { request_id: request.id, ...payload }, { timeoutMs: 90000 })
      setMode(null); setReason('')
      onApply(res?.request)
    } catch (err) {
      setError(err.message)
      setMode(null)
      onReload()
    } finally {
      setBusy(false)
    }
  }

  function deny() {
    if (!reason.trim()) { setError('Give a reason for denying the request.'); return }
    submit('deny_intercompany_request', { reason: reason.trim() })
  }

  return (
    <div>
      <TrackHero eyebrow={TITLE} title={amount}
        meta={<>
          <span>Requested by VFO Services on {dateText(request.requested_at)}</span>
          <span style={chipStyle(s.color)}>{s.label}</span>
          {request.sandbox && <span style={sandboxTagStyle}>Sandbox</span>}
        </>} />
      <BackLink label="← Back to requests" onClick={onBack} />
      <FeeSplitNotice />

      <div style={sectionStyle}>
        <div style={eyebrowStyle}>Request</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '18px' }}>
          <Field label="Amount" value={amount} />
          <Field label="Deals" value={String(request.total_deals || 0)} />
          <Field label="Requested" value={whenText(request.requested_at)} />
        </div>
      </div>

      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Recipient</th>
              <th style={thStyle}>Transaction details</th>
              <th style={thStyle}>Deals</th>
              <th style={thStyle}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(request.lines || []).map((l, i) => (
              <tr key={i}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{l.recipient || '—'}</td>
                <td style={{ ...tdStyle, overflowWrap: 'anywhere' }}>{l.details || '—'}</td>
                <td style={tdStyle}>{l.deals || 0}</td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>${money((Number(l.amount_cents) || 0) / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={sectionStyle}>
        <div style={eyebrowStyle}>{isOpen(request) ? 'Your answer' : 'Answer'}</div>

        {request.status === 'pending' && !mode && (
          <>
            <p style={bodyStyle}>Accepting transfers {amount} from IAG's Stripe balance to VFO Services for the Specialist's implementation fee split.</p>
            <div style={buttonRowStyle}>
              <button type="button" onClick={() => { setMode('accept'); setError('') }} style={primaryButtonStyle}>Accept and transfer</button>
              <button type="button" onClick={() => { setMode('deny'); setError('') }} style={buttonStyle}>Deny</button>
            </div>
          </>
        )}
        {request.status === 'pending' && mode === 'accept' && (
          <>
            <p style={bodyStyle}>Transfer <strong>{amount}</strong> from IAG's Stripe balance to VFO Services now for the Specialist's implementation fee split? It is not part of the revenue share. This cannot be undone here.</p>
            <div style={buttonRowStyle}>
              <button type="button" disabled={busy} onClick={() => submit('accept_intercompany_request', {})} style={withBusy(primaryButtonStyle, busy)}>{busy ? 'Transferring...' : `Transfer ${amount}`}</button>
              <button type="button" disabled={busy} onClick={() => setMode(null)} style={withBusy(buttonStyle, busy)}>Cancel</button>
            </div>
          </>
        )}
        {request.status === 'pending' && mode === 'deny' && (
          <>
            <label style={labelStyle}>Reason (VFO Services will see it)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} disabled={busy} style={{ ...textareaStyle, marginBottom: '12px' }} />
            <div style={buttonRowStyle}>
              <button type="button" disabled={busy} onClick={deny} style={withBusy(dangerButtonStyle, busy)}>{busy ? 'Working...' : 'Deny request'}</button>
              <button type="button" disabled={busy} onClick={() => { setMode(null); setReason(''); setError('') }} style={withBusy(buttonStyle, busy)}>Cancel</button>
            </div>
          </>
        )}

        {request.status === 'processing' && (
          <>
            <p style={bodyStyle}>The transfer was started{request.answered_by ? ` by ${request.answered_by}` : ''} {whenText(request.claimed_at)} and Stripe has not confirmed it. Checking asks Stripe first, so it will not send twice.</p>
            <div style={buttonRowStyle}>
              <button type="button" disabled={busy} onClick={() => submit('accept_intercompany_request', {})} style={withBusy(primaryButtonStyle, busy)}>{busy ? 'Checking...' : 'Check transfer'}</button>
            </div>
          </>
        )}

        {request.status === 'transferred' && (
          <>
            <p style={bodyStyle}>{amount} was transferred to VFO Services {whenText(request.answered_at)}{request.answered_by ? ` by ${request.answered_by}` : ''}. Stripe transfer {request.transfer_id}.</p>
            {request.vfo_notified_at
              ? <p style={{ ...okTextStyle, margin: 0 }}>VFO Services has confirmed it.</p>
              : <p style={{ ...warnTextStyle, margin: 0 }}>VFO Services has not confirmed it yet. It is tried again automatically.</p>}
          </>
        )}
        {request.status === 'denied' && (
          <p style={{ ...bodyStyle, margin: 0 }}>Denied {whenText(request.answered_at)}{request.answered_by ? ` by ${request.answered_by}` : ''}. Reason: {request.deny_reason}</p>
        )}
        {request.status === 'withdrawn' && (
          <p style={{ ...bodyStyle, margin: 0 }}>VFO Services cancelled this request. Nothing was transferred.</p>
        )}
        {request.reversed_at && (
          <p style={warnTextStyle}>${money(request.reversed_amount)} of it was reversed in Stripe {whenText(request.reversed_at)}.</p>
        )}

        {request.status === 'pending' && request.last_error && !error && <p style={warnTextStyle}>Last attempt: {request.last_error}</p>}
        {error && <p style={errorTextStyle}>{error}</p>}
      </div>
    </div>
  )
}
