import { useEffect, useMemo, useState, Fragment } from 'react'
import { callApi } from '../lib/api'
import { StatusPill } from './PaymentDetail'
import ListFilterButton, { matchesFilter, sortMembers, SortSelect, COI_SORT_OPTIONS, useHeaderSort, sortByColumn, SortHeader } from './ListFilterKit'
import { NameLink, TrackHero } from './shared/TrackKit'
import { CoiOverviewSkeleton } from './shared/Skeleton'

// COI Overview — every COI on one screen with their firm, their level, their
// clients and the money that has actually reached them, each row expanding into
// its own client list. The WIG port of VFO's Member Overview: same navy/blue
// table card, same expand toggle, same click-to-sort headers.
//
// Nothing here says anything about the payout ACCOUNT. Having a Stripe account
// id is not proof a COI finished onboarding — only a live status call is (the
// Stripe Connect card on their profile) — so this panel stays silent rather than
// implying one.

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }

// A real table on `auto` layout: the browser measures every column against its
// own content and shares the leftover width out across all of them, so no single
// stretchy column can hoard the slack and open a gap beside a short value — and
// the header always sits over the cells it names.
const tableStyle = { width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', fontFamily: 'Inter, sans-serif' }
const thStyle = { textAlign: 'left', padding: '12px 18px', background: 'var(--wig-input)', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-muted)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '11px 18px', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '13px', color: 'var(--wig-ink)', verticalAlign: 'middle', whiteSpace: 'nowrap' }
const clientThStyle = { ...thStyle, padding: '8px 14px' }
const clientTdStyle = { ...tdStyle, padding: '9px 14px', fontSize: '12.5px', borderBottom: 'none', borderTop: '1px solid var(--wig-border-soft)', background: 'var(--wig-card)' }

const COI_TYPES = ['Advisor', 'Accountant', 'Other']
const LEVELS = [0, 1, 2, 3, 4].map(n => `Level ${n}`)
// The same three-colour family VFO's CAT_COLORS uses, in the WIG palette: the
// pill is the colour at full strength on a 12% tint of itself.
const TYPE_COLORS = { Advisor: '#1D64A8', Accountant: '#7b52d6', Other: '#e0771a' }

const fullName = (row) => `${row.first_name || ''} ${row.last_name || ''}`.trim()
// A missing status reads as Active — the source rows leave it null by default.
const statusOf = (row) => row.status || 'Active'
const levelLabel = (row) => (row.coi_level == null ? '' : `Level ${row.coi_level}`)
const mothershipLabel = (row) => row.mothership_name || (row.mothership_number == null ? '' : String(row.mothership_number))

function statusColors(status) {
  if (status === 'Active') return { background: 'rgba(27,146,84,0.13)', color: '#1b9254' }
  if (status === 'Lost') return { background: 'rgba(231,76,60,0.13)', color: '#e74c3c' }
  return { background: 'var(--wig-tint)', color: 'var(--wig-muted)' }
}

function StatusChip({ status }) {
  const c = statusColors(status)
  return <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '999px', fontWeight: 600, ...c }}>{status}</span>
}

// The count pill VFO uses for a row's children: primary-tinted while there is
// something to count, a quiet grey zero when there is not. The Clients toggle
// borrows the same colours so the two read as one family.
function CountPill({ value, children }) {
  return (
    <span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', color: value ? '#1D64A8' : 'var(--wig-faint)', background: value ? 'rgba(29,100,168,0.1)' : 'var(--wig-border-soft)' }}>
      {children ?? value}
    </span>
  )
}

function moneyText(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'
}

export default function CoiOverviewPanel({ onOpenCoi, onOpenClient }) {
  const [cois, setCois] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [expanded, setExpanded] = useState({})   // member_number -> bool
  const [search, setSearch] = useState('')
  const [listFilter, setListFilter] = useState({ status: ['Active'] })
  const [listSort, setListSort] = useState('number_asc')
  const { sort: colSort, onSort, reset: resetColSort } = useHeaderSort()

  useEffect(() => {
    let alive = true
    callApi('load_coi_overview')
      .then(data => { if (alive) { setCois(data.cois || []); setLoadError('') } })
      .catch(err => { if (alive) setLoadError(err.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // Only the firms actually present — a mothership with no COIs is not a filter
  // anyone can use.
  const mothershipOptions = useMemo(
    () => [...new Set(cois.map(mothershipLabel).filter(Boolean))].sort(),
    [cois],
  )

  const filterGroups = [
    { key: 'status', label: 'Status', options: ['Active', 'Lost'], get: statusOf },
    { key: 'coi_type', label: 'COI Type', options: COI_TYPES, get: c => c.coi_type || '' },
    { key: 'level', label: 'Level', options: LEVELS, get: levelLabel },
    ...(mothershipOptions.length ? [{ key: 'mothership', label: 'Mothership', options: mothershipOptions, get: mothershipLabel }] : []),
  ]

  const q = search.trim().toLowerCase()
  const searched = q
    ? cois.filter(c => fullName(c).toLowerCase().includes(q) || (c.member_number || '').toLowerCase().includes(q))
    : cois
  const filtered = searched.filter(c => matchesFilter(c, filterGroups, listFilter))

  // Baseline = the dropdown ordering; a clicked column header overrides it.
  const sortColumns = {
    number: { type: 'number', get: c => { const n = parseInt(String(c.member_number ?? ''), 10); return Number.isNaN(n) ? null : n } },
    name: { type: 'text', get: fullName },
    type: { type: 'text', get: c => c.coi_type },
    mothership: { type: 'text', get: mothershipLabel },
    level: { type: 'number', get: c => c.coi_level },
    status: { type: 'text', get: statusOf },
    clients: { type: 'number', get: c => c.clients_count },
    paid: { type: 'number', get: c => c.paid_payments_count },
    rev: { type: 'number', get: c => Number(c.rev_share_to_date) || 0 },
  }
  const rows = sortByColumn(sortMembers(filtered, listSort), colSort, sortColumns)

  if (loading) {
    return (
      <div>
        {/* The hero is already known — only the toolbar and the table wait on
            the fetch, so only they are drawn as a skeleton. */}
        <TrackHero eyebrow="Overview" title="COI Overview" />
        <CoiOverviewSkeleton />
      </div>
    )
  }

  if (loadError) {
    return (
      <div>
        <TrackHero eyebrow="Overview" title="COI Overview" />
        <div style={sectionStyle}>
          <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{loadError}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <TrackHero eyebrow="Overview" title="COI Overview" />

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="search" name="search" autoComplete="off" placeholder="Search by name or number..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: '220px' }} />
        <ListFilterButton groups={filterGroups} value={listFilter} onChange={setListFilter} />
        <SortSelect value={listSort} onChange={v => { setListSort(v); resetColSort() }} options={COI_SORT_OPTIONS} />
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--wig-border-soft)', borderRadius: '14px', background: 'var(--wig-card)', boxShadow: 'var(--wig-shadow-card)' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}><SortHeader label="Clients" sortKey="clients" sort={colSort} onSort={onSort} /></th>
              <th style={thStyle}><SortHeader label="Member #" sortKey="number" sort={colSort} onSort={onSort} /></th>
              <th style={thStyle}><SortHeader label="Name" sortKey="name" sort={colSort} onSort={onSort} /></th>
              <th style={thStyle}><SortHeader label="Status" sortKey="status" sort={colSort} onSort={onSort} /></th>
              <th style={thStyle}><SortHeader label="Type" sortKey="type" sort={colSort} onSort={onSort} /></th>
              <th style={thStyle}><SortHeader label="Mothership" sortKey="mothership" sort={colSort} onSort={onSort} /></th>
              <th style={thStyle}><SortHeader label="Level" sortKey="level" sort={colSort} onSort={onSort} /></th>
              <th style={thStyle}><SortHeader label="Paid" sortKey="paid" sort={colSort} onSort={onSort} /></th>
              <th style={thStyle}><SortHeader label="Rev share to date" sortKey="rev" sort={colSort} onSort={onSort} /></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--wig-faint)', fontSize: '13px' }}>No COIs match the current filters.</td>
              </tr>
            )}

            {rows.map(coi => {
              const mn = coi.member_number
              const isOpen = !!expanded[mn]
              const clients = coi.clients || []
              const typeColor = TYPE_COLORS[coi.coi_type] || 'var(--wig-muted)'
              const rev = Number(coi.rev_share_to_date) || 0
              return (
                <Fragment key={mn}>
                  <tr>
                    {/* One control, not two: the count IS the toggle, so nothing on
                        the row looks clickable without being it. */}
                    <td style={tdStyle}>
                      <button
                        onClick={() => setExpanded(e => ({ ...e, [mn]: !e[mn] }))}
                        title={isOpen ? 'Hide clients' : 'Show clients'}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', color: coi.clients_count ? '#1D64A8' : 'var(--wig-faint)', background: coi.clients_count ? 'rgba(29,100,168,0.1)' : 'var(--wig-border-soft)' }}>
                        {coi.clients_count}
                        <span style={{ fontSize: '9px', opacity: 0.6 }}>{isOpen ? '▾' : '▸'}</span>
                      </button>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px', color: 'var(--wig-muted)' }}>{mn}</td>
                    {/* A shortcut, not the row's own destination — the row itself
                        only expands, so the name has to carry the link. */}
                    <td style={{ ...tdStyle, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <NameLink onClick={() => onOpenCoi && onOpenCoi(mn, { returnTo: 'coi_overview' })} title="Open COI profile">{fullName(coi) || '—'}</NameLink>
                    </td>
                    <td style={tdStyle}><StatusChip status={statusOf(coi)} /></td>
                    <td style={tdStyle}>
                      {coi.coi_type
                        ? <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', color: typeColor, background: `${typeColor}1f` }}>{coi.coi_type}</span>
                        : <span style={{ color: 'var(--wig-faint)' }}>—</span>}
                    </td>
                    <td style={{ ...tdStyle, fontSize: '12px', color: 'var(--wig-muted)' }}>{mothershipLabel(coi) || '—'}</td>
                    <td style={{ ...tdStyle, fontSize: '12px', color: 'var(--wig-muted)' }}>{levelLabel(coi) || '—'}</td>
                    <td style={{ ...tdStyle, fontSize: '12px', color: 'var(--wig-muted)' }}>{coi.paid_payments_count} / {coi.payments_count}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: rev ? 'var(--wig-ink)' : 'var(--wig-faint)' }}>${moneyText(rev)}</td>
                  </tr>

                  {isOpen && (
                    <tr>
                      <td colSpan={9} style={{ padding: '4px 18px 14px 52px', borderBottom: '1px solid var(--wig-border-soft)', background: 'var(--wig-input)' }}>
                        {clients.length === 0 ? (
                          <div style={{ fontSize: '12px', color: 'var(--wig-faint)', padding: '8px 0' }}>No clients attached.</div>
                        ) : (
                          <div style={{ border: '1px solid var(--wig-border-soft)', borderRadius: '10px', overflow: 'hidden' }}>
                            <table style={tableStyle}>
                              <thead>
                                <tr>
                                  <th style={clientThStyle}>Client #</th>
                                  <th style={clientThStyle}>Name</th>
                                  <th style={clientThStyle}>Status</th>
                                  <th style={clientThStyle}>Payments</th>
                                  <th style={clientThStyle}>Latest payment</th>
                                  <th style={clientThStyle}>Payment status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {clients.map(client => {
                                  const latest = client.latest_payment
                                  return (
                                    <tr key={client.id}>
                                      <td style={{ ...clientTdStyle, fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--wig-muted)' }}>{client.client_number || '—'}</td>
                                      <td style={{ ...clientTdStyle, fontWeight: 600 }}>
                                        <NameLink onClick={() => onOpenClient && onOpenClient(mn, client.id, { returnTo: 'coi_overview' })} title="Open client profile">{fullName(client) || '—'}</NameLink>
                                      </td>
                                      <td style={clientTdStyle}><StatusChip status={statusOf(client)} /></td>
                                      <td style={clientTdStyle}>
                                        {/* The count is the shortcut when there is
                                            something to open; a zero is just a zero. */}
                                        {client.payments_count > 0
                                          ? <NameLink onClick={() => onOpenClient && onOpenClient(mn, client.id, { clientTab: 'client_payments', returnTo: 'coi_overview' })} title="Open payments">
                                              <CountPill value={client.payments_count} />
                                            </NameLink>
                                          : <CountPill value={0} />}
                                      </td>
                                      <td style={{ ...clientTdStyle, fontSize: '12px', color: latest ? 'var(--wig-ink)' : 'var(--wig-faint)' }}>
                                        {latest ? (latest.strategy_name || latest.strategy_key) : 'No payment yet'}
                                      </td>
                                      <td style={clientTdStyle}>
                                        {latest ? <StatusPill payment={latest} /> : <span style={{ fontSize: '12px', color: 'var(--wig-faint)' }}>—</span>}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
