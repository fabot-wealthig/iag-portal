import { useEffect, useMemo, useState } from 'react'
import { callApi } from '../lib/api'
import { StatusPill, ownerChipStyle } from './PaymentDetail'
import ListFilterButton, { matchesFilter, SortSelect, useHeaderSort, sortByColumn, SortHeader } from './ListFilterKit'
import { NameLink, TrackHero } from './shared/TrackKit'
import { ClientOverviewSkeleton } from './shared/Skeleton'

// Client Overview — every payment in the portal on one screen, whoever the
// client and whoever their COI is, with the stage it has reached and who owes
// the next step. The WIG port of VFO's Client Overview, with two deliberate
// departures: ONE ROW PER PAYMENT (Jake's call on 2026-09-04, reversing the
// one-row-per-client shape — a client with three payments was hiding two of
// them behind whichever was newest), and no program sub-tabs, because IAG has a
// single strategy today. A Strategy filter group stands in for the tabs, so the
// day there is a second one the screen already sorts them out.
//
// A client with no payment yet still gets exactly one row, its payment fields
// em dashes: a client nobody has billed is a row worth noticing, not one to
// drop.

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }

// A real table on `auto` layout, the same treatment the COI Overview uses: the
// browser measures every column against its own content and shares the leftover
// width out across all of them, so no single stretchy column can hoard the slack
// and open a gap beside a short value — and the header always sits over the
// cells it names.
const tableStyle = { width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', fontFamily: 'Inter, sans-serif' }
const thStyle = { textAlign: 'left', padding: '12px 18px', background: 'var(--wig-input)', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-muted)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '11px 18px', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '13px', color: 'var(--wig-ink)', verticalAlign: 'middle', whiteSpace: 'nowrap' }

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
// Strategy and stage come from the server: the stage is the one the step machine
// agrees with, and a second reading of it here is exactly what would let the
// Stage filter and the pill beside it describe different things.
const strategyOf = (row) => row.strategy || ''
const stageOf = (row) => row.stage || NO_PAYMENT

// Copied verbatim from PaymentsGrid, which does not export it: the fee in this
// column and the fee on the payment it links to must read identically.
function moneyText(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

function statusColors(status) {
  if (status === 'Active') return { background: 'rgba(27,146,84,0.13)', color: '#1b9254' }
  if (status === 'Lost') return { background: 'rgba(231,76,60,0.13)', color: '#e74c3c' }
  return { background: 'var(--wig-tint)', color: 'var(--wig-muted)' }
}

function StatusChip({ status }) {
  const c = statusColors(status)
  return <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '999px', fontWeight: 600, ...c }}>{status}</span>
}

// Sorts on the CLIENT half of the row. Array.prototype.sort is stable, so rows
// sharing a client number keep the order the server sent them in — that client's
// newest payment first.
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
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [listFilter, setListFilter] = useState({ status: ['Active'] })
  const [listSort, setListSort] = useState('number_asc')
  const { sort: colSort, onSort, reset: resetColSort } = useHeaderSort()

  useEffect(() => {
    let alive = true
    callApi('load_client_overview')
      .then(data => { if (alive) { setRows(data.clients || []); setLoadError('') } })
      .catch(err => { if (alive) setLoadError(err.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // Both derived from what is actually on screen: offering a strategy or a stage
  // no row is in would be a filter that can only ever empty the list.
  const strategyOptions = useMemo(
    () => [...new Set(rows.map(strategyOf).filter(Boolean))].sort().concat(NO_PAYMENT),
    [rows],
  )
  const stageOptions = useMemo(
    () => [...new Set(rows.map(stageOf).filter(s => s !== NO_PAYMENT))].sort().concat(NO_PAYMENT),
    [rows],
  )

  const filterGroups = [
    { key: 'status', label: 'Status', options: ['Active', 'Lost'], get: statusOf },
    { key: 'coi_type', label: 'COI Type', options: COI_TYPES, get: r => r.coi_type || '' },
    { key: 'strategy', label: 'Strategy', options: strategyOptions, get: r => strategyOf(r) || NO_PAYMENT },
    { key: 'stage', label: 'Stage', options: stageOptions, get: stageOf },
  ]

  const q = search.trim().toLowerCase()
  const searched = q
    ? rows.filter(r => fullName(r).toLowerCase().includes(q)
      || (r.client_number || '').toLowerCase().includes(q)
      || (r.coi_name || '').toLowerCase().includes(q)
      || strategyOf(r).toLowerCase().includes(q))
    : rows
  const filtered = searched.filter(r => matchesFilter(r, filterGroups, listFilter))

  // Baseline = the dropdown ordering; a clicked column header overrides it.
  const sortColumns = {
    name: { type: 'text', get: fullName },
    coi: { type: 'text', get: r => r.coi_name },
    status: { type: 'text', get: statusOf },
    strategy: { type: 'text', get: strategyOf },
    // Explicitly null on a row with no payment: Number(null) is 0, which would
    // sort an unbilled client in among the cheap ones instead of last.
    fee: { type: 'number', get: r => (r.total_fee == null ? null : Number(r.total_fee)) },
    stage: { type: 'text', get: stageOf },
  }
  const visible = sortByColumn(sortClients(filtered, listSort), colSort, sortColumns)

  if (loading) {
    return (
      <div>
        {/* The hero is already known — only the toolbar and the table wait on
            the fetch, so only they are drawn as a skeleton. */}
        <TrackHero eyebrow="Overview" title="Client Overview" />
        <ClientOverviewSkeleton />
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
        <input type="search" name="search" autoComplete="off" placeholder="Search by client, number, COI, or strategy..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: '220px' }} />
        <ListFilterButton groups={filterGroups} value={listFilter} onChange={setListFilter} />
        <SortSelect value={listSort} onChange={v => { setListSort(v); resetColSort() }} options={CLIENT_SORT_OPTIONS} />
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--wig-border-soft)', borderRadius: '14px', background: 'var(--wig-card)', boxShadow: 'var(--wig-shadow-card)' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Client #</th>
              <th style={thStyle}><SortHeader label="Name" sortKey="name" sort={colSort} onSort={onSort} /></th>
              <th style={thStyle}><SortHeader label="Status" sortKey="status" sort={colSort} onSort={onSort} /></th>
              <th style={thStyle}><SortHeader label="COI" sortKey="coi" sort={colSort} onSort={onSort} /></th>
              <th style={thStyle}><SortHeader label="Strategy" sortKey="strategy" sort={colSort} onSort={onSort} /></th>
              <th style={thStyle}><SortHeader label="Fee" sortKey="fee" sort={colSort} onSort={onSort} /></th>
              <th style={thStyle}><SortHeader label="Stage" sortKey="stage" sort={colSort} onSort={onSort} /></th>
              <th style={thStyle}>Next action</th>
              <th style={thStyle}>Owner</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--wig-faint)', fontSize: '13px' }}>Nothing matches the current filters.</td>
              </tr>
            )}

            {visible.map(r => (
              <tr key={r.payment_id || r.client_id}>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px', color: 'var(--wig-muted)' }}>{r.client_number || '—'}</td>
                {/* The row does not navigate — every destination on it is a
                    named shortcut, so both names are links. The client's name
                    opens THIS payment, because the row IS the payment; on a
                    client with none it opens the profile, as before. */}
                <td style={{ ...tdStyle, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <NameLink
                    onClick={() => onOpenClient && onOpenClient(r.coi_member_number, r.client_id, {
                      clientTab: r.payment_id ? 'client_payments' : 'client_profile',
                      returnTo: 'client_overview',
                      paymentId: r.payment_id || undefined,
                    })}
                    title={r.payment_id ? 'Open payment' : 'Open client profile'}>{fullName(r) || '—'}</NameLink>
                </td>
                <td style={tdStyle}><StatusChip status={statusOf(r)} /></td>
                <td style={tdStyle}>
                  <span style={{ display: 'block', fontSize: '12.5px' }}>
                    {r.coi_name
                      ? <NameLink onClick={() => onOpenCoi && onOpenCoi(r.coi_member_number, { returnTo: 'client_overview' })} title="Open COI profile">{r.coi_name}</NameLink>
                      : <span style={{ color: 'var(--wig-faint)' }}>—</span>}
                  </span>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--wig-muted)' }}>{r.coi_type || '—'}</span>
                </td>
                <td style={{ ...tdStyle, fontSize: '12px', color: strategyOf(r) ? 'var(--wig-ink)' : 'var(--wig-faint)' }}>{strategyOf(r) || '—'}</td>
                {/* Guarded rather than left to moneyText: Number(null) is 0, and
                    a client with no payment must not read as a $0.00 one. */}
                <td style={{ ...tdStyle, color: r.total_fee == null ? 'var(--wig-faint)' : 'var(--wig-ink)' }}>{r.total_fee == null ? '—' : `$${moneyText(r.total_fee)}`}</td>
                <td style={tdStyle}>
                  {r.payment_id
                    ? <StatusPill payment={r} />
                    : <span style={{ fontSize: '12px', color: 'var(--wig-faint)' }}>—</span>}
                </td>
                {/* next_action already names the step that is outstanding, so
                    there is no separate "held" / "failed" line to add here. */}
                <td style={{ ...tdStyle, color: r.next_action ? 'var(--wig-ink)' : 'var(--wig-faint)' }}>{r.next_action || '—'}</td>
                <td style={tdStyle}>
                  {r.next_owner
                    ? <span style={ownerChipStyle}>{r.next_owner}</span>
                    : <span style={{ fontSize: '12px', color: 'var(--wig-faint)' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
