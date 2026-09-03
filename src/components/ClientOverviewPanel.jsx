import { useEffect, useMemo, useState } from 'react'
import { callApi } from '../lib/api'
import { StatusPill, statusOfPayment, ownerChipStyle } from './PaymentDetail'
import ListFilterButton, { matchesFilter, SortSelect, useHeaderSort, sortByColumn, SortHeader } from './ListFilterKit'
import { NameLink, TrackHero } from './shared/TrackKit'

// Client Overview — every client in the portal on one screen, whoever their COI
// is, with where their most recent payment has got to and who owes the next
// step. The WIG port of VFO's Client Overview, with two deliberate departures:
// ONE ROW PER CLIENT (Jake's decision — show all clients, not one row per
// track), and no program sub-tabs, because IAG has a single strategy today. A
// Strategy filter group stands in for the tabs, so the day there is a second one
// the screen already sorts them out.

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }

// Client · Client # · COI · Status · Strategy · Payments · Stage · Next action · Owner
const GRID = '1.3fr 100px 1.3fr 88px 1.1fr 84px 128px 1.6fr 110px'

const COI_TYPES = ['Advisor', 'Accountant', 'Other']
// The one label that stands for "there is nothing to be at a stage of yet". It
// is an option in both derived groups so a client with no payment is filterable
// rather than only ever reachable by clearing the filter.
const NO_PAYMENT = 'No payment'

const CLIENT_SORT_OPTIONS = [
  { value: 'number_asc', label: 'Client #: A to Z' },
  { value: 'number_desc', label: 'Client #: Z to A' },
  { value: 'az', label: 'Name: A to Z' },
  { value: 'za', label: 'Name: Z to A' },
]

const fullName = (row) => `${row.first_name || ''} ${row.last_name || ''}`.trim()
// A missing status reads as Active — the source rows leave it null by default.
const statusOf = (row) => row.status || 'Active'
const strategyOf = (c) => c.latest_payment?.strategy_name || c.latest_payment?.strategy_key || ''
const stageOf = (c) => (c.latest_payment ? statusOfPayment(c.latest_payment).label : NO_PAYMENT)

function statusColors(status) {
  if (status === 'Active') return { background: 'rgba(27,146,84,0.13)', color: '#1b9254' }
  if (status === 'Lost') return { background: 'rgba(231,76,60,0.13)', color: '#e74c3c' }
  return { background: 'var(--wig-tint)', color: 'var(--wig-muted)' }
}

function StatusChip({ status }) {
  const c = statusColors(status)
  return <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '999px', fontWeight: 600, ...c }}>{status}</span>
}

// The same count pill the COI Overview uses for a COI's clients.
function CountPill({ value }) {
  return (
    <span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', color: value ? '#1D64A8' : 'var(--wig-faint)', background: value ? 'rgba(29,100,168,0.1)' : 'var(--wig-border-soft)' }}>{value}</span>
  )
}

function sortClients(arr, sortBy) {
  const list = [...arr]
  const numOf = c => String(c.client_number || '')
  const nameOf = c => fullName(c).toLowerCase()
  switch (sortBy) {
    case 'number_desc': return list.sort((a, b) => numOf(b).localeCompare(numOf(a)))
    case 'az': return list.sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
    case 'za': return list.sort((a, b) => nameOf(b).localeCompare(nameOf(a)))
    case 'number_asc':
    default: return list.sort((a, b) => numOf(a).localeCompare(numOf(b)))
  }
}

export default function ClientOverviewPanel({ onOpenCoi, onOpenClient }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [listFilter, setListFilter] = useState({ status: ['Active'] })
  const [listSort, setListSort] = useState('number_asc')
  const { sort: colSort, onSort, reset: resetColSort } = useHeaderSort()

  useEffect(() => {
    let alive = true
    callApi('load_client_overview')
      .then(data => { if (alive) { setClients(data.clients || []); setLoadError('') } })
      .catch(err => { if (alive) setLoadError(err.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // Both derived from what is actually on screen: offering a strategy or a stage
  // no client is in would be a filter that can only ever empty the list.
  const strategyOptions = useMemo(
    () => [...new Set(clients.map(strategyOf).filter(Boolean))].sort().concat(NO_PAYMENT),
    [clients],
  )
  const stageOptions = useMemo(
    () => [...new Set(clients.map(stageOf).filter(s => s !== NO_PAYMENT))].sort().concat(NO_PAYMENT),
    [clients],
  )

  const filterGroups = [
    { key: 'status', label: 'Status', options: ['Active', 'Lost'], get: statusOf },
    { key: 'coi_type', label: 'COI Type', options: COI_TYPES, get: c => c.coi_type || '' },
    { key: 'strategy', label: 'Strategy', options: strategyOptions, get: c => strategyOf(c) || NO_PAYMENT },
    { key: 'stage', label: 'Stage', options: stageOptions, get: stageOf },
  ]

  const q = search.trim().toLowerCase()
  const searched = q
    ? clients.filter(c => fullName(c).toLowerCase().includes(q)
      || (c.client_number || '').toLowerCase().includes(q)
      || (c.coi_name || '').toLowerCase().includes(q))
    : clients
  const filtered = searched.filter(c => matchesFilter(c, filterGroups, listFilter))

  // Baseline = the dropdown ordering; a clicked column header overrides it.
  const sortColumns = {
    name: { type: 'text', get: fullName },
    coi: { type: 'text', get: c => c.coi_name },
    status: { type: 'text', get: statusOf },
    strategy: { type: 'text', get: strategyOf },
    stage: { type: 'text', get: stageOf },
  }
  const rows = sortByColumn(sortClients(filtered, listSort), colSort, sortColumns)

  if (loading) {
    return (
      <div>
        <TrackHero eyebrow="Overview" title="Client Overview" />
        <div style={{ textAlign: 'center', fontSize: '13.5px', color: 'var(--wig-muted)', padding: '40px 0' }}>Loading...</div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div>
        <TrackHero eyebrow="Overview" title="Client Overview" />
        <div style={sectionStyle}>
          <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{loadError}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <TrackHero eyebrow="Overview" title="Client Overview" />

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="search" name="search" autoComplete="off" placeholder="Search by client, number, or COI..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: '220px' }} />
        <ListFilterButton groups={filterGroups} value={listFilter} onChange={setListFilter} />
        <SortSelect value={listSort} onChange={v => { setListSort(v); resetColSort() }} options={CLIENT_SORT_OPTIONS} />
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--wig-border-soft)', borderRadius: '14px', background: 'var(--wig-card)', boxShadow: 'var(--wig-shadow-card)' }}>
        <div style={{ minWidth: '1100px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '10px', padding: '12px 18px', background: 'var(--wig-input)', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-muted)' }}>
            <SortHeader label="Client" sortKey="name" sort={colSort} onSort={onSort} />
            <span>Client #</span>
            <SortHeader label="COI" sortKey="coi" sort={colSort} onSort={onSort} />
            <SortHeader label="Status" sortKey="status" sort={colSort} onSort={onSort} />
            <SortHeader label="Strategy" sortKey="strategy" sort={colSort} onSort={onSort} />
            <span>Payments</span>
            <SortHeader label="Stage" sortKey="stage" sort={colSort} onSort={onSort} />
            <span>Next action</span>
            <span>Owner</span>
          </div>

          {rows.length === 0 && (
            <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--wig-faint)', fontSize: '13px' }}>No clients match the current filters.</div>
          )}

          {rows.map(c => {
            const latest = c.latest_payment
            return (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: GRID, gap: '10px', padding: '11px 18px', borderBottom: '1px solid var(--wig-border-soft)', alignItems: 'center', fontSize: '13px', color: 'var(--wig-ink)' }}>
                {/* The row does not navigate — every destination on it is a
                    named shortcut, so both names are links. */}
                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <NameLink onClick={() => onOpenClient && onOpenClient(c.coi_member_number, c.id, { returnTo: 'client_overview' })} title="Open client profile">{fullName(c) || '—'}</NameLink>
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--wig-muted)' }}>{c.client_number || '—'}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.coi_name
                      ? <NameLink onClick={() => onOpenCoi && onOpenCoi(c.coi_member_number, { returnTo: 'client_overview' })} title="Open COI profile">{c.coi_name}</NameLink>
                      : <span style={{ color: 'var(--wig-faint)' }}>—</span>}
                  </span>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--wig-muted)' }}>{c.coi_type || '—'}</span>
                </span>
                <span><StatusChip status={statusOf(c)} /></span>
                <span style={{ fontSize: '12px', color: strategyOf(c) ? 'var(--wig-ink)' : 'var(--wig-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{strategyOf(c) || '—'}</span>
                <span>
                  {/* The count is the shortcut when there is something to open;
                      a zero is just a zero. */}
                  {c.payments_count > 0
                    ? <NameLink onClick={() => onOpenClient && onOpenClient(c.coi_member_number, c.id, { clientTab: 'client_payments', returnTo: 'client_overview' })} title="Open payments">
                        <CountPill value={c.payments_count} />
                      </NameLink>
                    : <CountPill value={0} />}
                </span>
                <span>
                  {latest
                    ? <StatusPill payment={latest} />
                    : <span style={{ fontSize: '12px', color: 'var(--wig-faint)' }}>No payment yet</span>}
                </span>
                {/* next_action already names the step that is outstanding, so
                    there is no separate "held" / "failed" line to add here. */}
                <span style={{ fontSize: '13px', color: latest?.next_action ? 'var(--wig-ink)' : 'var(--wig-faint)' }}>{latest?.next_action || '—'}</span>
                <span>
                  {latest?.next_owner
                    ? <span style={ownerChipStyle}>{latest.next_owner}</span>
                    : <span style={{ fontSize: '12px', color: 'var(--wig-faint)' }}>—</span>}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
