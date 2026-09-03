import { useEffect, useMemo, useState } from 'react'
import { callApi } from '../lib/api'
import PaymentDetail, { statusOfPayment } from './PaymentDetail'
import PaymentsGrid from './PaymentsGrid'
import ListFilterButton, { matchesFilter } from './ListFilterKit'
import { TrackHero } from './shared/TrackKit'
import { PaymentsListSkeleton } from './shared/Skeleton'

// Accounting → Payments — every payment in the portal in one list, newest first,
// unscoped by client or COI. The same `PaymentsGrid` the client's own Payments
// tab renders, with the Client column switched on, and the same `PaymentDetail`
// behind every row.

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
// Payments is the only accounting pill today, so it renders permanently
// selected rather than as a one-item tab strip that does nothing.
const pillStyle = { padding: '7px 16px', background: '#1D64A8', border: 'none', borderRadius: '999px', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#ffffff', fontSize: '12.5px', fontWeight: 600, cursor: 'default', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }

const stageOf = (p) => statusOfPayment(p).label

export default function AccountingPaymentsPanel({ onOpenCoi, onOpenClient }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [listFilter, setListFilter] = useState({})
  // The open payment takes over the whole area, exactly as it does on a client's
  // own Payments tab: its hero is the topmost thing on screen, so this panel's
  // hero and pill stand down until "Back to payments" closes it.
  const [selectedPaymentId, setSelectedPaymentId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const data = await callApi('load_all_payments')
      setPayments(data.payments || [])
      setLoadError('')
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Only the states actually present: a status nothing is in would be a filter
  // that can only ever empty the list. No default selection — accounting starts
  // from everything.
  const statusOptions = useMemo(() => [...new Set(payments.map(stageOf))].sort(), [payments])
  const filterGroups = statusOptions.length
    ? [{ key: 'status', label: 'Status', options: statusOptions, get: stageOf }]
    : []

  const q = search.trim().toLowerCase()
  const searched = q
    ? payments.filter(p => (p.client_name || '').toLowerCase().includes(q)
      || (p.client_number || '').toLowerCase().includes(q)
      || (p.coi_name || '').toLowerCase().includes(q)
      || (p.strategy_name || p.strategy_key || '').toLowerCase().includes(q))
    : payments
  const filtered = searched.filter(p => matchesFilter(p, filterGroups, listFilter))

  function openPayment(id) {
    setSelectedPaymentId(id)
    window.scrollTo(0, 0)
  }

  if (selectedPaymentId) {
    // Coming back re-reads the list, because a step ticked in the detail changes
    // the row it came from.
    return (
      <PaymentDetail
        paymentId={selectedPaymentId}
        onBack={() => { setSelectedPaymentId(null); load() }}
      />
    )
  }

  return (
    <div>
      <TrackHero eyebrow="Accounting" title="Accounting" />
      <div style={{ display: 'flex', borderBottom: '1px solid var(--wig-border)', marginBottom: '24px', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button style={pillStyle}>Payments</button>
      </div>

      {/* The hero and the Payments pill above are already known — only the
          toolbar and the list wait on the fetch. */}
      {loading ? (
        <PaymentsListSkeleton withClient />
      ) : loadError ? (
        <div style={sectionStyle}>
          <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{loadError}</p>
        </div>
      ) : payments.length === 0 ? (
        <div style={sectionStyle}>
          <p style={{ fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0 }}>No payments recorded yet.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="search" name="search" autoComplete="off" placeholder="Search by client, number, COI, or strategy..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: '220px' }} />
            {filterGroups.length > 0 && <ListFilterButton groups={filterGroups} value={listFilter} onChange={setListFilter} />}
          </div>
          <PaymentsGrid
            payments={filtered}
            showClient
            onOpen={p => openPayment(p.id)}
            onOpenClient={p => onOpenClient && onOpenClient(p.coi_member_number, p.client_id, { returnTo: 'accounting' })}
            onOpenCoi={p => onOpenCoi && onOpenCoi(p.coi_member_number, { returnTo: 'accounting' })}
          />
        </>
      )}
    </div>
  )
}
