import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { describeRevShare, REV_NOT_DUE, REV_VIA_ERT } from '../lib/revShareText'
import ClientPaymentForm from './ClientPaymentForm'
import { ownerChipStyle } from './PaymentDetail'
import PaymentsGrid from './PaymentsGrid'
import ProviderReceiptDetail from './ProviderReceiptDetail'
import ProviderReceiptForm from './ProviderReceiptForm'
import ClientPicker from './shared/ClientPicker'
import { BackLink, ListHeader, TrackHero } from './shared/TrackKit'
import { PaymentsListSkeleton, ProfileTabSkeleton, TableSkeleton } from './shared/Skeleton'
import { sandboxChipStyle } from '../lib/stripeMode'

// Which screen this tab is on: absent is the strategy list, `form:<key>` is that
// strategy's payment form, `receipt:<id>` is one recorded receipt. One key, so a
// browser refresh lands on exactly the screen the admin was on (standing rule
// 5) — and it is listed BOTH in Portal's SUB_STATE_KEYS and in AdminLogin's
// literal list, which is GOTCHA #21.
const STRATEGY_SCREEN_KEY = 'wigStrategyScreen'

const LEVELS = ['0', '1', '2', '3', '4']

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const labelStyle = { fontSize: '12px', color: 'var(--wig-muted)', display: 'block', marginBottom: '6px' }
const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const gradientButtonStyle = { padding: '10px 28px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }
const outlineButtonStyle = { padding: '10px 24px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const emptyTitleStyle = { fontSize: '14px', fontWeight: 700, color: 'var(--wig-heading)', marginBottom: '8px' }
const emptyBodyStyle = { fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0, lineHeight: 1.6 }
// The Sandbox chip's shape, on the orange tint: "not yet offered" is an
// exception to how the rest of the list behaves, and orange marks the
// exceptions in this portal.
const inactiveChipStyle = { ...sandboxChipStyle, background: 'rgba(238,106,51,0.12)', border: '1px solid rgba(238,106,51,0.28)' }

// The receipts list inside an expanded card: the overview panels' table on auto
// layout, so it fits this tab's panel without a horizontal scrollbar, and every
// column left-aligned, money included.
const receiptTableStyle = { width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', fontFamily: 'Inter, sans-serif' }
const receiptThStyle = { textAlign: 'left', padding: '10px 14px', background: 'var(--wig-input)', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-muted)', whiteSpace: 'nowrap' }
const receiptTdStyle = { padding: '11px 14px', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '13px', color: 'var(--wig-ink)', verticalAlign: 'middle', whiteSpace: 'nowrap' }

const fullName = (m) => `${m.first_name || ''} ${m.last_name || ''}`.trim()

/**
 * Tax Strategies — the rules, and the money raised against them. Three screens
 * behind one tab: the strategy list, one strategy's payment form, and one
 * recorded receipt. `members` is the COI roster Portal already holds, and the
 * two open handlers are the same ones the overview panels are given.
 */
export default function TaxStrategiesPanel({ members = [], onOpenCoi, onOpenClient }) {
  const [strategies, setStrategies] = useState([])
  // The mothership roster, for the one strategy whose rules name motherships:
  // the read view has to say WHICH ones earn nothing by name rather than by
  // number, and the edit form has to offer the rest.
  const [motherships, setMotherships] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  // Accordion: at most one strategy is open at a time, keyed by strategy key.
  const [expandedKey, setExpandedKey] = useState(null)
  // Restored on every mount, reload included; cleared by every back link.
  const [screen, setScreen] = useState(() => sessionStorage.getItem(STRATEGY_SCREEN_KEY) || '')
  // Every client in the portal, for the pickers on the form screen. Loaded when
  // a form is opened rather than with the tab: the list screen never needs it.
  const [clients, setClients] = useState([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [clientsError, setClientsError] = useState('')
  // Two transient lines: what a LEOS request left behind on the list, and what a
  // receipt's shares did, shown on the receipt it just created.
  const [listMsg, setListMsg] = useState('')
  const [flash, setFlash] = useState('')

  const formKey = screen.startsWith('form:') ? screen.slice(5) : ''
  const receiptId = screen.startsWith('receipt:') ? screen.slice(8) : ''

  useEffect(() => { load() }, [])

  // The form screens both need the client list, and both are reachable by a
  // refresh straight onto them, so the fetch hangs off the screen rather than
  // off the click that opened it.
  useEffect(() => {
    if (formKey) loadClients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey])

  // Two reads, one wait. The roster is caught SEPARATELY on purpose: it names
  // the excluded motherships on one strategy's card, and a roster that failed
  // to load must not take the whole strategy list down with it — the numbers
  // fall back to "#1" and everything else on the tab still works.
  async function load() {
    try {
      const [data, roster] = await Promise.all([
        callApi('load_strategies'),
        callApi('load_motherships').catch(() => ({ motherships: [] })),
      ])
      setStrategies(data.strategies || [])
      setMotherships(roster.motherships || [])
      setLoadError('')
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // `load_client_overview` is one row per PAYMENT, so the same client arrives
  // once per payment they have: deduped by id, then ordered by name because that
  // is what the picker is searched by.
  //
  // A SILENT re-read is not a nicety: the receipt form asks for one the moment a
  // client is added mid-form, and flipping the loading flag would replace the
  // form — every row typed so far with it — with a skeleton.
  async function loadClients({ silent = false } = {}) {
    if (!silent) setClientsLoading(true)
    try {
      const data = await callApi('load_client_overview')
      const seen = new Set()
      const list = []
      for (const row of data.clients || []) {
        if (!row.client_id || seen.has(row.client_id)) continue
        seen.add(row.client_id)
        list.push(row)
      }
      list.sort((a, b) => fullName(a).localeCompare(fullName(b)))
      setClients(list)
      setClientsError('')
    } catch (err) {
      setClientsError(err.message)
    } finally {
      if (!silent) setClientsLoading(false)
    }
  }

  function goScreen(value) {
    if (value) sessionStorage.setItem(STRATEGY_SCREEN_KEY, value)
    else sessionStorage.removeItem(STRATEGY_SCREEN_KEY)
    setScreen(value || '')
    window.scrollTo(0, 0)
  }

  // A save returns the saved row, so the waterfall above the form re-renders
  // with the new numbers without a second round trip.
  function applySaved(saved) {
    setStrategies(prev => prev.map(s => s.key === saved.key ? saved : s))
  }

  function handleRequestSent(res) {
    setListMsg(`Payment request drafted to Gmail for ${res.to_email}${res.sandbox ? ' (sandbox)' : ''}`)
    goScreen('')
    setTimeout(() => setListMsg(''), 8000)
  }

  function handleReceiptSaved(res) {
    setFlash(shareSummaryLine(res.rows))
    goScreen(`receipt:${res.receipt.id}`)
  }

  // The receipt screen loads everything it shows, so it is answered before the
  // strategy list has landed: a refresh onto a receipt should not wait on rules
  // it never renders.
  if (receiptId) {
    return (
      <ProviderReceiptDetail
        receiptId={receiptId}
        flash={flash}
        onBack={() => { setFlash(''); goScreen('') }}
        onOpenCoi={onOpenCoi}
        onOpenClient={onOpenClient}
      />
    )
  }

  if (loading) {
    return (
      <div>
        {/* The header is already known — only the strategy cards wait on the
            fetch. */}
        <ListHeader title="Tax Strategies" />
        <ProfileTabSkeleton />
      </div>
    )
  }

  if (loadError) {
    return (
      <div>
        <ListHeader title="Tax Strategies" />
        <div style={sectionStyle}>
          <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{loadError}</p>
        </div>
      </div>
    )
  }

  // A key naming a strategy this portal no longer offers falls through to the
  // list rather than rendering a form with nothing behind it.
  const formStrategy = formKey ? strategies.find(s => s.key === formKey) || null : null
  if (formStrategy) {
    return (
      <div>
        <TrackHero eyebrow="Tax Strategies" title={`${formStrategy.name} payment`} />
        <BackLink label="← Back to Tax Strategies" onClick={() => goScreen('')} />
        {clientsLoading ? (
          <PaymentsListSkeleton />
        ) : clientsError ? (
          <div style={sectionStyle}>
            <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{clientsError}</p>
          </div>
        ) : formStrategy.funded_by === 'provider' ? (
          <ProviderReceiptForm
            strategy={formStrategy}
            clients={clients}
            members={members}
            onClientsChange={() => loadClients({ silent: true })}
            onSaved={handleReceiptSaved}
            onCancel={() => goScreen('')}
          />
        ) : (
          <ClientRequestScreen
            strategy={formStrategy}
            strategies={strategies}
            clients={clients}
            members={members}
            onSubmitted={handleRequestSent}
            onCancel={() => goScreen('')}
          />
        )}
      </div>
    )
  }

  if (strategies.length === 0) {
    return (
      <div>
        <ListHeader title="Tax Strategies" count={0} />
        <div style={sectionStyle}>
          <div style={emptyTitleStyle}>No strategies yet</div>
          <p style={emptyBodyStyle}>Strategies and their revenue-share rules will appear here once they are set up.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* The count is every strategy the portal knows, offered or not — the
          chip on the row is what says which are not live yet. */}
      <ListHeader title="Tax Strategies" count={strategies.length} />
      {listMsg && <p style={{ color: '#1b9254', fontSize: '13px', margin: '0 0 16px' }}>{listMsg}</p>}
      {strategies.map(s => {
        const open = expandedKey === s.key
        return (
          <div key={s.key} style={{ marginBottom: '10px', border: '1px solid var(--wig-border-soft)', borderRadius: '12px', overflow: 'hidden', background: 'var(--wig-card)', boxShadow: '0 2px 8px rgba(20,45,95,0.04)' }}>
            <div onClick={() => setExpandedKey(open ? null : s.key)}
              style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px', cursor: 'pointer' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '14px', color: 'var(--wig-ink)', fontWeight: 600 }}>{s.name}</span>
                {s.active === false && <span style={inactiveChipStyle}>Not yet offered</span>}
              </span>
              {/* The whole row toggles the accordion, so the button has to keep
                  its click to itself — an admin heading for the form must not
                  also open the rules underneath it. */}
              {s.active !== false && (
                <button onClick={e => { e.stopPropagation(); goScreen(`form:${s.key}`) }}
                  style={{ ...gradientButtonStyle, padding: '7px 16px', fontSize: '13px', flexShrink: 0 }}>
                  Start payment
                </button>
              )}
              <span style={{ fontSize: '10px', color: 'var(--wig-muted)', transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s', flexShrink: 0 }}>▼</span>
            </div>
            {open && (
              <div style={{ padding: '4px 16px 16px', borderTop: '1px solid var(--wig-border-soft)' }}>
                <StrategyDetail strategy={s} motherships={motherships} onSaved={applySaved} />
                {/* One list or the other, never both. A provider settles in lump
                    sums, each split across the clients it covered, so the thing
                    to list is the receipt. A client-funded strategy raises one
                    payment per client and there is no lump sum above it, so
                    the thing to list is the payment itself. */}
                {s.funded_by === 'provider' ? (
                  <StrategyReceipts strategyKey={s.key} onOpen={id => goScreen(`receipt:${id}`)} />
                ) : (
                  <StrategyPayments strategyKey={s.key} onOpenCoi={onOpenCoi} onOpenClient={onOpenClient} />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// The LEOS screen: the same request form the portal has always had, asked from
// the strategy's side. The client is the first question because the form was
// reached from a strategy rather than from a client, and the strategy select is
// gone because that answer is already in the hero above.
function ClientRequestScreen({ strategy, strategies, clients, members, onSubmitted, onCancel }) {
  const [clientId, setClientId] = useState('')

  const picked = clients.find(c => c.client_id === clientId) || null
  // The form's `client` is the shape the payment actions use — an `id`, not the
  // overview row's `client_id`.
  const client = picked
    ? { id: picked.client_id, client_number: picked.client_number, first_name: picked.first_name, last_name: picked.last_name, email: picked.email }
    : null
  const member = picked ? members.find(m => m.member_number === picked.coi_member_number) || null : null

  return (
    <ClientPaymentForm
      client={client}
      member={member}
      strategies={strategies}
      fixedStrategyKey={strategy.key}
      clientPicker={<ClientPicker clients={clients} valueId={clientId} onChange={setClientId} />}
      onSubmitted={onSubmitted}
      onCancel={onCancel}
    />
  )
}

// Every lump sum this provider has paid. Loaded when the card is expanded, which
// is when this component mounts.
function StrategyReceipts({ strategyKey, onOpen }) {
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let alive = true
    callApi('load_provider_receipts', { strategy_key: strategyKey })
      .then(data => { if (alive) { setReceipts(data.receipts || []); setLoadError('') } })
      .catch(err => { if (alive) setLoadError(err.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [strategyKey])

  return (
    <div style={{ marginTop: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--wig-heading)' }}>Receipts</span>
        {!loading && !loadError && (
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', color: 'var(--wig-muted)' }}>{receipts.length}</span>
        )}
      </div>

      {loading && <TableSkeleton cols={[1, 1.2, 0.8, 0.6, 1.4, 1.2]} rows={2} card={false} />}

      {!loading && loadError && (
        <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{loadError}</p>
      )}

      {!loading && !loadError && receipts.length === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--wig-muted)', margin: 0 }}>No receipts yet.</p>
      )}

      {!loading && !loadError && receipts.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--wig-border-soft)', borderRadius: '12px' }}>
          <table style={receiptTableStyle}>
            <thead>
              <tr>
                <th style={receiptThStyle}>Received</th>
                <th style={receiptThStyle}>Reference</th>
                <th style={receiptThStyle}>Amount</th>
                <th style={receiptThStyle}>Clients</th>
                <th style={receiptThStyle}>Shares</th>
                <th style={receiptThStyle}>Recorded by</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map(r => (
                <tr key={r.id} onClick={() => onOpen(r.id)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--wig-tint)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ ...receiptTdStyle, fontFamily: 'monospace', fontSize: '12px', color: 'var(--wig-muted)' }}>{receiptDate(r.received_at)}</td>
                  <td style={{ ...receiptTdStyle, fontSize: '12px', color: r.reference ? 'var(--wig-ink)' : 'var(--wig-faint)' }}>{r.reference || '—'}</td>
                  <td style={{ ...receiptTdStyle, fontWeight: 600 }}>{`$${receiptMoney(r.amount_received)}`}</td>
                  <td style={receiptTdStyle}>{r.row_count}</td>
                  <td style={{ ...receiptTdStyle, fontSize: '12px', color: 'var(--wig-muted)' }}>{sharesText(r.share_summary)}</td>
                  <td style={{ ...receiptTdStyle, fontSize: '12px', color: 'var(--wig-muted)' }}>{r.recorded_by || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Every payment raised on a client-funded strategy — the Receipts list's twin
// for LEOS and the Implementation Fee. Loaded when the card is expanded, which
// is when this component mounts. `load_all_payments` is unscoped, so the
// strategy is picked out here; it arrives newest first and stays that way.
//
// The row opens the payment inside its COI, the way a receipt's client rows
// do, with the return trip pointed back at this tab. The strategy list keeps
// no screen key of its own, so the trip back lands on the list — which is
// where the payment was opened from.
function StrategyPayments({ strategyKey, onOpenCoi, onOpenClient }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let alive = true
    callApi('load_all_payments')
      .then(data => {
        if (!alive) return
        setPayments((data.payments || []).filter(p => p.strategy_key === strategyKey))
        setLoadError('')
      })
      .catch(err => { if (alive) setLoadError(err.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [strategyKey])

  return (
    <div style={{ marginTop: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--wig-heading)' }}>Payments</span>
        {!loading && !loadError && (
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', color: 'var(--wig-muted)' }}>{payments.length}</span>
        )}
      </div>

      {/* The grid's seven-column shape with the Client column, as
          PaymentsListSkeleton draws it — but without that skeleton's toolbar
          and card, neither of which this list has inside a strategy card. */}
      {loading && <TableSkeleton cols={[1.4, 0.8, 1, 0.8, 0.8, 0.9, 1.1]} rows={2} card={false} />}

      {!loading && loadError && (
        <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{loadError}</p>
      )}

      {!loading && !loadError && payments.length === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--wig-muted)', margin: 0 }}>No payments yet.</p>
      )}

      {!loading && !loadError && payments.length > 0 && (
        <PaymentsGrid
          payments={payments}
          showClient
          onOpen={p => onOpenClient && onOpenClient(p.coi_member_number, p.client_id, { clientTab: 'client_payments', returnTo: 'tax_strategies', paymentId: p.id })}
          onOpenClient={p => onOpenClient && onOpenClient(p.coi_member_number, p.client_id, { returnTo: 'tax_strategies' })}
          onOpenCoi={p => onOpenCoi && onOpenCoi(p.coi_member_number, { returnTo: 'tax_strategies' })}
        />
      )}
    </div>
  )
}

// How a batch settled, in one line: only the states that actually happened, in
// the order they matter, so a clean receipt reads "4 paid" rather than a row of
// zeros.
function sharesText(summary) {
  const s = summary || {}
  const parts = [
    [s.succeeded, 'paid'],
    // Outstanding until an admin ticks that ERT paid the COI; ticked rows count
    // as paid via ERT.
    [s.via_ert, 'ERT to pay'],
    [s.via_ert_done, 'paid via ERT'],
    [s.processing, 'processing'],
    [s.held, 'held'],
    [s.failed, 'failed'],
    [s.not_due, 'not due'],
    [s.pending, 'pending'],
  ].filter(([n]) => Number(n) > 0).map(([n, label]) => `${n} ${label}`)
  return parts.length ? parts.join(' · ') : '—'
}

// What the shares did, said once on the receipt the press just created. The
// outcome of each row is read through `describeRevShare`, the same helper the
// payment detail reports a retry with, so a state cannot be described two ways.
function shareSummaryLine(rows) {
  const counts = new Map()
  const failures = []
  for (const row of rows || []) {
    const share = row.rev_share || {}
    const outcome = describeRevShare(share)
    if (!outcome.ok) {
      failures.push(share.error || outcome.text)
      continue
    }
    const label = share.rev_paid === 'succeeded' ? 'paid'
      : share.rev_paid === REV_VIA_ERT ? 'ERT to pay'
      : share.rev_paid === 'Awaiting Payout Account' ? 'held'
      : share.rev_paid === REV_NOT_DUE ? 'not due'
      : String(share.rev_paid || 'pending')
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  const parts = [...counts].map(([label, n]) => (label === 'paid' ? `${n} ${n === 1 ? 'share' : 'shares'} paid` : `${n} ${label}`))
  if (failures.length > 0) parts.push(`${failures.length} failed: ${failures.join('; ')}`)
  return `Payment recorded.${parts.length > 0 ? ` ${parts.join(', ')}` : ''}`
}

function receiptDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

function receiptMoney(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

// The read view, plus the edit card once it has been asked for. Keyed on the
// strategy in the caller's accordion, so collapsing and reopening a strategy
// always comes back to the read view.
function StrategyDetail({ strategy, motherships, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  function handleSaved(saved) {
    onSaved(saved)
    setEditing(false)
    setSavedMsg('Rules saved.')
    setTimeout(() => setSavedMsg(''), 4000)
  }

  return (
    <div>
      {strategy.active === false && (
        <p style={{ fontSize: '13px', color: 'var(--wig-muted)', margin: '12px 0 0', lineHeight: 1.6 }}>
          Not yet offered on the payment request form.
        </p>
      )}
      <Waterfall strategy={strategy} motherships={motherships} />
      {editing
        ? <EditRules key={strategy.updated_at} strategy={strategy} motherships={motherships} onSaved={handleSaved} onCancel={() => setEditing(false)} />
        : (
          <div>
            <button onClick={() => setEditing(true)} style={outlineButtonStyle}>Edit Strategy</button>
            {savedMsg && <p style={{ color: '#1b9254', fontSize: '13px', marginTop: '12px', marginBottom: 0 }}>{savedMsg}</p>}
          </div>
        )}
    </div>
  )
}

/* ---------------------------------------------------------------- read view */

// The rules as a numbered walk-through, with whatever is configured today
// substituted in. Every model is rendered by this one component; only the list
// of steps differs, so the numbering, spacing and chips stay identical across
// strategies an admin flips between.
function Waterfall({ strategy, motherships }) {
  const steps = buildSteps(strategy, motherships)
  const levels = strategy.level_percentages || {}
  // Which of the three things this strategy does with an ERT-affiliated COI.
  // `client_fee_pool` is the third and the newest: they are not paid at all,
  // which is neither of the two answers the flag alone can give.
  const calloutMode = strategy.model === 'client_fee_pool'
    ? 'excluded'
    : strategy.affiliated_via_ert !== false ? 'via_ert' : 'ladder'

  return (
    <div style={{ ...sectionStyle, boxShadow: 'none', background: 'transparent', border: 'none', padding: '18px 0 4px' }}>
      <div style={eyebrowStyle}>How the money splits</div>
      {steps.map((step, i) => (
        <div key={step.title} style={{ display: 'flex', gap: '14px', marginBottom: i === steps.length - 1 ? 0 : '18px' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', color: '#fff', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--wig-heading)', marginBottom: '4px' }}>{step.title}</div>
            <div style={{ fontSize: '13.5px', color: 'var(--wig-muted)', lineHeight: 1.6 }}>{step.body}</div>
            {step.tiers && <RetentionTable tiers={step.tiers} />}
            {step.levels && <ChipRow chips={LEVELS.map(l => ({ label: `Level ${l}`, value: pctText(levels[l]) }))} />}
            {/* After the ladder, not before it: on the one step that carries
                both, the excluded motherships are a footnote to the ladder
                rather than a second ladder. */}
            {step.chips && <ChipRow chips={step.chips} />}
            {step.note && (
              <div style={{ fontSize: '12.5px', color: 'var(--wig-faint)', lineHeight: 1.6, marginTop: '8px' }}>{step.note}</div>
            )}
            {step.callout && <ErtCallout mode={calloutMode} />}
          </div>
        </div>
      ))}
    </div>
  )
}

// Label above, figure below — the shape the level ladder has always had, reused
// for the box commissions so the two read as the same kind of fact.
function ChipRow({ chips }) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
      {chips.map(c => (
        <div key={`${c.label}-${c.value}`} style={{ padding: '8px 14px', borderRadius: '10px', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', minWidth: '78px' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.8px', color: 'var(--wig-faint)', textTransform: 'uppercase' }}>{c.label}</div>
          <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--wig-heading)', marginTop: '2px' }}>{c.value}</div>
        </div>
      ))}
    </div>
  )
}

// Seven thresholds is too many for chips, so the retention ladder is a table.
// Capped in width and left-aligned in both columns: it has to sit inside the
// panel without a horizontal scrollbar.
function RetentionTable({ tiers }) {
  return (
    <div style={{ marginTop: '10px', border: '1px solid var(--wig-border-chip)', borderRadius: '10px', overflow: 'hidden', maxWidth: '340px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            <th style={{ ...tableCellStyle, background: 'var(--wig-tint)', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.8px', color: 'var(--wig-faint)', textTransform: 'uppercase' }}>Premium from</th>
            <th style={{ ...tableCellStyle, background: 'var(--wig-tint)', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.8px', color: 'var(--wig-faint)', textTransform: 'uppercase' }}>SRA keeps</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t, i) => (
            <tr key={String(t.min)}>
              <td style={{ ...tableCellStyle, borderTop: i === 0 ? 'none' : '1px solid var(--wig-border-soft)', color: 'var(--wig-muted)' }}>{moneyText(t.min)}</td>
              <td style={{ ...tableCellStyle, borderTop: i === 0 ? 'none' : '1px solid var(--wig-border-soft)', color: 'var(--wig-heading)', fontWeight: 700 }}>{pctText(t.pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const tableCellStyle = { textAlign: 'left', padding: '8px 12px', whiteSpace: 'nowrap' }

// Jake's ask: every strategy says out loud who actually pays an ERT-affiliated
// COI. Same line and the same plain container on every card — the keyword alone
// carries the difference, NOT in red or ARE in green, so nothing about the box
// implies one strategy is a permanent exception.
function ErtCallout({ mode }) {
  const keyword = mode === 'ladder'
    ? <span style={{ color: '#1b9254', fontWeight: 700 }}>ARE</span>
    : <span style={{ color: '#d93025', fontWeight: 700 }}>NOT</span>
  return (
    <div style={{
      marginTop: '10px',
      padding: '8px 12px',
      borderRadius: '8px',
      border: '1px solid var(--wig-border-chip)',
      background: 'transparent',
      color: 'var(--wig-muted)',
      fontWeight: 400,
      fontSize: '12.5px',
      lineHeight: 1.6,
    }}>
      {mode === 'via_ert' ? (
        <>ERT-affiliated COIs are {keyword} paid by this portal. Their share goes to ERT outside the portal, an admin ticks it off, and ERT pays the COI.</>
      ) : mode === 'excluded' ? (
        <>ERT-affiliated COIs are {keyword} paid on this strategy at all, neither by this portal nor through ERT, and nor is any COI under another excluded mothership.</>
      ) : (
        <>ERT-affiliated COIs {keyword} paid by this portal, by Stripe transfer on the level ladder, exactly like every other COI.</>
      )}
    </div>
  )
}

function buildSteps(strategy, motherships) {
  const rules = strategy.rules || {}
  switch (strategy.model) {
    case 'fixed_commission': return commissionSteps(strategy, rules)
    case 'retention_share': return retentionSteps(strategy, rules)
    case 'contribution_pct': return contributionSteps(strategy, rules)
    case 'pass_through': return passThroughSteps()
    case 'client_fee_pool': return clientFeePoolSteps(rules, motherships)
    case 'fee_pct_waterfall': return feePctWaterfallSteps(strategy, rules)
    default: return waterfallSteps(strategy)
  }
}

function waterfallSteps(strategy) {
  return [
    {
      title: 'Client Fee',
      body: 'The client is invoiced a single fee for the strategy. Everything below comes out of it, in order.',
    },
    {
      title: 'Hard costs come off first',
      body: `Administration fee of ${pctText(strategy.admin_fee_pct)} of the client's offset amount, plus a flat ${moneyText(strategy.legal_fee_flat)} for the legal opinion letter. The letter can be waived on an individual payment — a repeat client running the same strategy may not need a new one — which is decided on the payment request form and drops that line to $0.00 for that payment only.`,
    },
    {
      title: 'ERT processing fee',
      body: `The percentage is taken from what remains after the hard costs, not from the whole client fee: ${pctText(strategy.processing_pct_affiliated)} if the COI's mothership is ERT (affiliated), ${pctText(strategy.processing_pct_unaffiliated)} if they belong to any other mothership (unaffiliated).`,
    },
    {
      title: 'Available Revenue Pool',
      body: 'Whatever is left after the hard costs and the ERT processing fee. This is the pool that gets shared.',
    },
    {
      title: 'COI share',
      body: `How the COI is paid depends on their mothership. ERT-affiliated COIs take a flat ${pctText(strategy.affiliated_share_pct)} of the Available Revenue Pool — levels do not apply to them — and that share is paid to ERT outside the portal, which then pays the COI; the portal records it and an admin ticks it off. Every other COI earns the percentage set by their level at the time of payment, transferred to their payout account.`,
      levels: true,
      callout: true,
    },
    {
      title: 'Net Profit Pool',
      body: 'The remainder of the Available Revenue Pool is retained by Wealth IG.',
    },
  ]
}

// Cost Segregation. Nothing here substitutes a rule in, because there is no
// rule to substitute: the amount recorded on the receipt row is the whole
// answer, and the only configured figures on the card are the level ladder.
function passThroughSteps() {
  return [
    {
      title: 'ERT pays per study',
      body: 'The client has a cost segregation study carried out, and ERT pays Wealth IG a fee for each one. The client pays nothing to this portal, so the money arrives as a provider receipt recorded on this tab — one payment from ERT, split across the clients it covered.',
    },
    {
      title: 'Available Revenue Pool',
      body: "The amount recorded against the client on the receipt IS the pool. Nothing comes off it, and there is nothing to work it out from — the fee ERT paid for that client's study is the figure.",
      note: 'No implementation fee on this strategy.',
    },
    {
      title: 'COI share',
      body: 'Every COI earns the percentage set by their level at the time of payment, transferred to their payout account. The ladder applies to every COI, ERT-affiliated ones included.',
      levels: true,
      callout: true,
    },
    {
      title: 'Net Profit Pool',
      body: 'The remainder of the Available Revenue Pool is retained by Wealth IG.',
    },
  ]
}

// The Implementation Fee. Billed through this portal like LEOS and with none of
// LEOS's hard costs, so the first two steps are one figure said twice — and the
// excluded motherships are named by NAME, because "1" is not a thing an admin
// reading this card knows.
function clientFeePoolSteps(rules, motherships) {
  const excluded = Array.isArray(rules.excluded_motherships) ? rules.excluded_motherships : []
  const nameOf = (n) => {
    const found = (motherships || []).find(m => Number(m.number) === Number(n))
    return found ? found.name : `#${n}`
  }
  return [
    {
      title: 'Client fee',
      body: 'The client pays Wealth IG through this portal. A payment request is raised from this tab, the client receives a payment link by email, and they pay it by ACH bank transfer or by card.',
      note: "A card payment adds a 2.9% + $0.30 processing fee to the client's charge, so Wealth IG receives the full fee either way. That fee is the client's cost and is never part of this split.",
    },
    {
      title: 'Available Revenue Pool',
      body: 'The fee the client pays IS the pool. There is no administration fee, no legal opinion letter and no ERT processing fee to take off it first.',
    },
    {
      title: 'COI share',
      body: 'A COI earns the percentage set by their level at the time of payment, transferred to their payout account. COIs under an excluded mothership earn nothing on this strategy.',
      levels: true,
      chips: excluded.map(n => ({ label: 'Excluded', value: nameOf(n) })),
      callout: true,
    },
    {
      title: 'Net Profit Pool',
      body: 'The remainder of the Available Revenue Pool is retained by Wealth IG.',
    },
  ]
}

// The Nevada Bank Dynasty Trust. Billed through this portal like LEOS with ONE
// hard cost under it — the attorney's percentage of the fee — so the step that
// names three costs on LEOS names one here, and says out loud which two are
// absent rather than leaving an admin to notice.
function feePctWaterfallSteps(strategy, rules) {
  return [
    {
      title: 'Client fee',
      body: 'The client pays Wealth IG through this portal. A payment request is raised from this tab, the client receives a payment link by email, and they pay it by ACH bank transfer.',
    },
    {
      title: 'Hard cost comes off first',
      body: `Attorney fee of ${pctText(rules.attorney_fee_pct)} of the client fee, paid to the attorney for the client's opinion letter and other legal fees. There is no administration fee and no ERT processing fee on this strategy.`,
    },
    {
      title: 'Available Revenue Pool',
      body: 'Whatever is left after the attorney fee. This is the pool that gets shared.',
    },
    {
      title: 'COI share',
      body: `How the COI is paid depends on their mothership. ERT-affiliated COIs take a flat ${pctText(strategy.affiliated_share_pct)} of the Available Revenue Pool — levels do not apply to them — and that share is paid to ERT outside the portal, which then pays the COI; the portal records it and an admin ticks it off. Every other COI earns the percentage set by their level at the time of payment, transferred to their payout account.`,
      levels: true,
      callout: true,
    },
    {
      title: 'Net Profit Pool',
      body: 'The remainder of the Available Revenue Pool is retained by Wealth IG.',
    },
  ]
}

function commissionSteps(strategy, rules) {
  const tiers = rules.tiers || []
  return [
    {
      title: 'Client contribution',
      body: "The client's contribution goes into the strategy. Its size is set by the box they choose, and the box is what decides every figure below.",
    },
    {
      title: 'Available Revenue Pool',
      body: "Wealth IG's commission is a fixed figure by box size, not a percentage of the contribution. That commission is the pool that gets shared.",
      chips: tiers.map(t => ({ label: t.label, value: moneyText(t.commission) })),
      note: `A ${moneyText(rules.implementation_fee_flat)} implementation fee is billed separately and is not part of this split.`,
    },
    {
      title: 'COI share',
      body: `How the COI is paid depends on their mothership. ERT-affiliated COIs take a flat ${pctText(strategy.affiliated_share_pct)} of the Available Revenue Pool — levels do not apply to them. Every other COI earns the percentage set by their level at the time of payment, transferred to their payout account.`,
      levels: true,
      callout: true,
    },
    {
      title: 'Net Profit Pool',
      body: 'The remainder of the Available Revenue Pool is retained by Wealth IG.',
    },
  ]
}

function retentionSteps(strategy, rules) {
  return [
    {
      title: 'Client premium',
      body: 'The client pays a premium to SRA. The split below starts from what SRA keeps of it.',
    },
    {
      title: 'SRA retention fee',
      body: 'SRA keeps a retention fee out of the premium, tiered by how large the premium is.',
      tiers: rules.retention_tiers || [],
    },
    {
      title: 'Available Revenue Pool',
      body: `Wealth IG receives ${pctText(rules.iag_pct_first_year)} of SRA's retention fee for a first-year client and ${pctText(rules.iag_pct_returning)} for a returning client. That is the pool that gets shared.`,
      note: `A ${moneyText(rules.implementation_fee_flat)} implementation fee is billed separately and is not part of this split.`,
    },
    {
      title: 'COI share',
      body: 'Every COI earns the percentage set by their level at the time of payment, transferred to their payout account. The ladder applies to every COI, ERT-affiliated ones included.',
      levels: true,
      callout: true,
    },
    {
      title: 'Net Profit Pool',
      body: 'The remainder of the Available Revenue Pool is retained by Wealth IG.',
    },
  ]
}

function contributionSteps(strategy, rules) {
  return [
    {
      title: 'Client investment',
      body: 'The client makes an investment into the strategy. Everything below is measured against that amount.',
    },
    {
      title: 'Available Revenue Pool',
      body: `Wealth IG receives ${pctText(rules.pool_pct)} of the investment. That is the pool that gets shared.`,
      note: `The implementation fee is ${pctText(rules.implementation_fee_pct)} of the investment, capped at ${moneyText(rules.implementation_fee_cap)}, billed separately and not part of this split; it can be waived on an individual payment.`,
    },
    {
      title: 'COI share',
      body: `How the COI is paid depends on their mothership. For ERT-affiliated COIs, ERT takes ${pctText(strategy.affiliated_share_pct)} of the Available Revenue Pool when the implementation fee is charged and ${pctText(rules.affiliated_share_pct_fee_waived)} when it is waived, paid outside the portal. Every other COI earns the percentage set by their level at the time of payment, transferred to their payout account.`,
      levels: true,
      callout: true,
    },
    {
      title: 'Net Profit Pool',
      body: 'The remainder of the Available Revenue Pool is retained by Wealth IG.',
    },
  ]
}

/* ---------------------------------------------------------------- edit view */

function EditRules({ strategy, motherships, onSaved, onCancel }) {
  const props = { strategy, onSaved, onCancel }
  switch (strategy.model) {
    case 'fixed_commission': return <EditFixedCommission {...props} />
    case 'retention_share': return <EditRetentionShare {...props} />
    case 'contribution_pct': return <EditContributionPct {...props} />
    case 'pass_through': return <EditPassThrough {...props} />
    case 'client_fee_pool': return <EditClientFeePool {...props} motherships={motherships} />
    case 'fee_pct_waterfall': return <EditFeePctWaterfall {...props} />
    default: return <EditFeeWaterfall {...props} />
  }
}

// The level ladder, the save call and the status line are the same on every
// model; only the fields above the ladder change, so each model's form owns its
// own field state and borrows the rest from here.
function useRulesForm(strategy, onSaved) {
  const [levels, setLevels] = useState(() => {
    const src = strategy.level_percentages || {}
    return Object.fromEntries(LEVELS.map(l => [l, String(src[l] ?? '')]))
  })
  const [statusMsg, setStatusMsg] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [loading, setLoading] = useState(false)

  async function submit(fields) {
    setLoading(true)
    try {
      const res = await callApi('save_strategy', { key: strategy.key, level_percentages: levels, ...fields })
      // The success message is rendered by the read view this collapses back
      // into, so only the failure path leaves anything behind here.
      if (res.strategy) onSaved(res.strategy)
    } catch (err) {
      // save_strategy is a write — the server's wording is the wording the
      // admin sees, including which number it refused.
      setStatusType('error'); setStatusMsg(err.message)
      setLoading(false)
    }
  }

  return { levels, setLevels, statusMsg, statusType, loading, submit }
}

function EditShell({ form, onSubmit, onCancel, children }) {
  return (
    <div style={{ ...sectionStyle, marginBottom: 0 }}>
      <div style={eyebrowStyle}>Edit rules</div>
      {children}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>COI share by level (% of Available Revenue Pool)</label>
        <ListBox>
          {LEVELS.map((l, i) => (
            <RuleRow key={l} first={i === 0} label={`Level ${l}`} suffix="%"
              value={form.levels[l]} onChange={v => form.setLevels({ ...form.levels, [l]: v })} />
          ))}
        </ListBox>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={onSubmit} disabled={form.loading} style={gradientButtonStyle}>
          {form.loading ? 'Saving...' : 'Save Rules'}
        </button>
        <button onClick={onCancel} style={outlineButtonStyle}>Cancel</button>
      </div>
      {form.statusMsg && <p style={{ color: form.statusType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{form.statusMsg}</p>}
    </div>
  )
}

function FieldRow({ children }) {
  return <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>{children}</div>
}

function NumField({ label, value, onChange }) {
  return (
    <div style={{ flex: 1, minWidth: '160px' }}>
      <label style={labelStyle}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} type="number" step="0.01" style={inputStyle} />
    </div>
  )
}

function ListBox({ children }) {
  return <div style={{ border: '1px solid var(--wig-border-soft)', borderRadius: '10px', overflow: 'hidden' }}>{children}</div>
}

// One editable number against a fixed label — the label is the thing this phase
// does not let an admin change (a level, a box name, a premium threshold).
function RuleRow({ label, prefix, suffix, value, onChange, first }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderTop: first ? 'none' : '1px solid var(--wig-border-soft)' }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--wig-ink)', width: '110px', flexShrink: 0 }}>{label}</span>
      {prefix && <span style={{ fontSize: '13px', color: 'var(--wig-muted)' }}>{prefix}</span>}
      <input value={value} onChange={e => onChange(e.target.value)} type="number" step="0.01" style={{ ...inputStyle, maxWidth: '140px' }} />
      {suffix && <span style={{ fontSize: '13px', color: 'var(--wig-muted)' }}>{suffix}</span>}
    </div>
  )
}

function EditFeeWaterfall({ strategy, onSaved, onCancel }) {
  const form = useRulesForm(strategy, onSaved)
  const [adminFee, setAdminFee] = useState(String(strategy.admin_fee_pct ?? ''))
  const [legalFee, setLegalFee] = useState(String(strategy.legal_fee_flat ?? ''))
  const [affiliated, setAffiliated] = useState(String(strategy.processing_pct_affiliated ?? ''))
  const [unaffiliated, setUnaffiliated] = useState(String(strategy.processing_pct_unaffiliated ?? ''))
  const [affiliatedShare, setAffiliatedShare] = useState(String(strategy.affiliated_share_pct ?? ''))

  return (
    <EditShell form={form} onCancel={onCancel} onSubmit={() => form.submit({
      admin_fee_pct: adminFee,
      legal_fee_flat: legalFee,
      processing_pct_affiliated: affiliated,
      processing_pct_unaffiliated: unaffiliated,
      affiliated_share_pct: affiliatedShare,
    })}>
      <FieldRow>
        <NumField label="Admin Fee (% of offset)" value={adminFee} onChange={setAdminFee} />
        <NumField label="Legal Fee (flat $)" value={legalFee} onChange={setLegalFee} />
      </FieldRow>
      <FieldRow>
        <NumField label="ERT Processing % (affiliated)" value={affiliated} onChange={setAffiliated} />
        <NumField label="ERT Processing % (unaffiliated)" value={unaffiliated} onChange={setUnaffiliated} />
      </FieldRow>
      {/* Above the ladder because it REPLACES the ladder for the COIs it
          applies to, rather than sitting alongside it as one more level. */}
      <FieldRow>
        <NumField label="ERT-affiliated COI share (% of Available Revenue Pool)" value={affiliatedShare} onChange={setAffiliatedShare} />
      </FieldRow>
    </EditShell>
  )
}

// One hard cost to tune rather than LEOS's four, and it is a PERCENTAGE of the
// client fee rather than a flat figure: the attorney bills against the fee, so
// there is nothing to cap and nothing to waive on an individual payment.
function EditFeePctWaterfall({ strategy, onSaved, onCancel }) {
  const form = useRulesForm(strategy, onSaved)
  const rules = strategy.rules || {}
  const [attorneyPct, setAttorneyPct] = useState(String(rules.attorney_fee_pct ?? ''))
  const [affiliatedShare, setAffiliatedShare] = useState(String(strategy.affiliated_share_pct ?? ''))

  return (
    <EditShell form={form} onCancel={onCancel} onSubmit={() => form.submit({
      affiliated_share_pct: affiliatedShare,
      rules: { attorney_fee_pct: attorneyPct },
    })}>
      <FieldRow>
        <NumField label="Attorney fee (% of client fee)" value={attorneyPct} onChange={setAttorneyPct} />
      </FieldRow>
      {/* Above the ladder because it REPLACES the ladder for the COIs it
          applies to, rather than sitting alongside it as one more level. */}
      <FieldRow>
        <NumField label="ERT-affiliated COI share (% of Available Revenue Pool)" value={affiliatedShare} onChange={setAffiliatedShare} />
      </FieldRow>
    </EditShell>
  )
}

function EditFixedCommission({ strategy, onSaved, onCancel }) {
  const form = useRulesForm(strategy, onSaved)
  const rules = strategy.rules || {}
  // Keys and labels ride along unchanged: this phase edits the money on a box,
  // never which boxes exist.
  const [tiers, setTiers] = useState(() => (rules.tiers || []).map(t => ({ key: t.key, label: t.label, commission: String(t.commission ?? '') })))
  const [implFee, setImplFee] = useState(String(rules.implementation_fee_flat ?? ''))
  const [affiliatedShare, setAffiliatedShare] = useState(String(strategy.affiliated_share_pct ?? ''))

  function setCommission(key, v) {
    setTiers(prev => prev.map(t => t.key === key ? { ...t, commission: v } : t))
  }

  return (
    <EditShell form={form} onCancel={onCancel} onSubmit={() => form.submit({
      affiliated_share_pct: affiliatedShare,
      rules: {
        tiers: tiers.map(t => ({ key: t.key, label: t.label, commission: t.commission })),
        implementation_fee_flat: implFee,
      },
    })}>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Wealth IG commission by box (flat $)</label>
        <ListBox>
          {tiers.map((t, i) => (
            <RuleRow key={t.key} first={i === 0} label={t.label} prefix="$"
              value={t.commission} onChange={v => setCommission(t.key, v)} />
          ))}
        </ListBox>
      </div>
      <FieldRow>
        <NumField label="Implementation fee (flat $, informational)" value={implFee} onChange={setImplFee} />
      </FieldRow>
      <FieldRow>
        <NumField label="ERT-affiliated COI share (% of Available Revenue Pool)" value={affiliatedShare} onChange={setAffiliatedShare} />
      </FieldRow>
    </EditShell>
  )
}

function EditRetentionShare({ strategy, onSaved, onCancel }) {
  const form = useRulesForm(strategy, onSaved)
  const rules = strategy.rules || {}
  // Thresholds are read-only in this phase — only the percentage SRA keeps
  // at each one is editable.
  const [tiers, setTiers] = useState(() => (rules.retention_tiers || []).map(t => ({ min: t.min, pct: String(t.pct ?? '') })))
  const [firstYear, setFirstYear] = useState(String(rules.iag_pct_first_year ?? ''))
  const [returning, setReturning] = useState(String(rules.iag_pct_returning ?? ''))
  const [implFee, setImplFee] = useState(String(rules.implementation_fee_flat ?? ''))

  function setPct(min, v) {
    setTiers(prev => prev.map(t => t.min === min ? { ...t, pct: v } : t))
  }

  return (
    <EditShell form={form} onCancel={onCancel} onSubmit={() => form.submit({
      rules: {
        retention_tiers: tiers.map(t => ({ min: t.min, pct: t.pct })),
        iag_pct_first_year: firstYear,
        iag_pct_returning: returning,
        implementation_fee_flat: implFee,
      },
    })}>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>SRA retention fee by premium (%)</label>
        <ListBox>
          {tiers.map((t, i) => (
            <RuleRow key={String(t.min)} first={i === 0} label={moneyText(t.min)} suffix="%"
              value={t.pct} onChange={v => setPct(t.min, v)} />
          ))}
        </ListBox>
      </div>
      <FieldRow>
        <NumField label="Wealth IG share of SRA fee, first-year client (%)" value={firstYear} onChange={setFirstYear} />
        <NumField label="Wealth IG share of SRA fee, returning client (%)" value={returning} onChange={setReturning} />
      </FieldRow>
      {/* No affiliated-share field: on this strategy the ladder pays every COI,
          so there is no flat cut to set. */}
      <FieldRow>
        <NumField label="Implementation fee (flat $, informational)" value={implFee} onChange={setImplFee} />
      </FieldRow>
    </EditShell>
  )
}

function EditContributionPct({ strategy, onSaved, onCancel }) {
  const form = useRulesForm(strategy, onSaved)
  const rules = strategy.rules || {}
  const [poolPct, setPoolPct] = useState(String(rules.pool_pct ?? ''))
  const [implPct, setImplPct] = useState(String(rules.implementation_fee_pct ?? ''))
  const [implCap, setImplCap] = useState(String(rules.implementation_fee_cap ?? ''))
  const [shareCharged, setShareCharged] = useState(String(strategy.affiliated_share_pct ?? ''))
  const [shareWaived, setShareWaived] = useState(String(rules.affiliated_share_pct_fee_waived ?? ''))

  return (
    <EditShell form={form} onCancel={onCancel} onSubmit={() => form.submit({
      affiliated_share_pct: shareCharged,
      rules: {
        pool_pct: poolPct,
        implementation_fee_pct: implPct,
        implementation_fee_cap: implCap,
        affiliated_share_pct_fee_waived: shareWaived,
      },
    })}>
      <FieldRow>
        <NumField label="Wealth IG share of investment (%)" value={poolPct} onChange={setPoolPct} />
      </FieldRow>
      <FieldRow>
        <NumField label="Implementation fee (% of investment, informational)" value={implPct} onChange={setImplPct} />
        <NumField label="Implementation fee cap ($)" value={implCap} onChange={setImplCap} />
      </FieldRow>
      {/* Two figures for one COI because the waiver moves the split, not just
          the fee: what ERT takes depends on whether the fee was charged. */}
      <FieldRow>
        <NumField label="ERT-affiliated COI share, fee charged (%)" value={shareCharged} onChange={setShareCharged} />
        <NumField label="ERT-affiliated COI share, fee waived (%)" value={shareWaived} onChange={setShareWaived} />
      </FieldRow>
    </EditShell>
  )
}

// Cost Segregation has nothing above the ladder to tune, and the line says so
// rather than leaving an admin looking for the fields the other strategies
// have. The empty rule set is still SENT: the server writes {} rather than
// leaving the column alone, so a row that somehow carried numbers is cleaned by
// the next save instead of keeping figures nothing reads.
function EditPassThrough({ strategy, onSaved, onCancel }) {
  const form = useRulesForm(strategy, onSaved)

  return (
    <EditShell form={form} onCancel={onCancel} onSubmit={() => form.submit({ rules: {} })}>
      {/* No affiliated-share field: this strategy pays every COI on the ladder,
          so there is no flat cut to set. */}
      <p style={{ fontSize: '13px', color: 'var(--wig-muted)', margin: '0 0 16px', lineHeight: 1.6 }}>
        Nothing to tune above the ladder: the amount recorded on the receipt row is the pool.
      </p>
    </EditShell>
  )
}

// The Implementation Fee's one rule: which motherships earn nothing. A list
// rather than code because it is a business decision — ERT today, with Tax Hive
// and DDP expected to follow through this very form.
//
// Chips plus an add-select, copied from the payment detail's notification
// recipients: the same question (a short list chosen out of a roster) asked the
// same way, so an admin who has used one already knows this one.
function EditClientFeePool({ strategy, motherships = [], onSaved, onCancel }) {
  const form = useRulesForm(strategy, onSaved)
  const rules = strategy.rules || {}
  // Held as NUMBERS, which is what the server validates them as and what the
  // waterfall compares a COI's mothership against.
  const [excluded, setExcluded] = useState(() =>
    (Array.isArray(rules.excluded_motherships) ? rules.excluded_motherships : []).map(Number))

  const chosen = new Set(excluded)
  const available = motherships.filter(m => !chosen.has(Number(m.number)))
  // A mothership the roster does not hold still has to be removable, so it
  // shows its number rather than vanishing from the chips.
  const nameOf = (n) => {
    const found = motherships.find(m => Number(m.number) === Number(n))
    return found ? found.name : `#${n}`
  }

  return (
    <EditShell form={form} onCancel={onCancel} onSubmit={() => form.submit({ rules: { excluded_motherships: excluded } })}>
      {/* No affiliated-share field: there is no Path A here. An excluded
          mothership's COIs are not paid outside the portal, they are not paid
          at all, which is a 0% share rather than another route. */}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Excluded motherships (COIs under these earn nothing)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          {excluded.length === 0 && (
            <span style={{ fontSize: '13px', color: 'var(--wig-muted)' }}>No motherships excluded.</span>
          )}
          {excluded.map(n => (
            <span key={n} style={{ ...ownerChipStyle, fontSize: '12px', padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {nameOf(n)}
              <button type="button" aria-label={`Remove ${nameOf(n)}`}
                onClick={() => setExcluded(prev => prev.filter(x => x !== n))}
                style={{ border: 'none', background: 'transparent', color: 'var(--wig-muted)', fontSize: '14px', lineHeight: 1, padding: 0, cursor: 'pointer' }}>×</button>
            </span>
          ))}
        </div>
        {/* Always value="" — the select is an ADD button wearing a dropdown, so
            it never holds a selection of its own. */}
        <select
          value=""
          disabled={available.length === 0}
          onChange={e => { if (e.target.value) setExcluded(prev => [...prev, Number(e.target.value)]) }}
          style={{ ...inputStyle, background: 'var(--wig-card)', maxWidth: '280px', cursor: available.length === 0 ? 'not-allowed' : 'pointer' }}>
          <option value="">{available.length === 0 ? 'All motherships added' : 'Add mothership…'}</option>
          {available.map(m => <option key={m.number} value={m.number}>{m.name}</option>)}
        </select>
      </div>
    </EditShell>
  )
}

// Percentages arrive from Postgres `numeric` as strings, so they are parsed
// before formatting — and a trailing ".00" is dropped so 1.5% reads as 1.5%.
function pctText(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${Number(n.toFixed(2))}%`
}

function moneyText(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
