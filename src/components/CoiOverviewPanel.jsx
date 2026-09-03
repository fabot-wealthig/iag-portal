import { useEffect, useMemo, useState } from 'react'
import { callApi } from '../lib/api'
import { StatusPill } from './PaymentDetail'
import ListFilterButton, { matchesFilter, sortMembers, SortSelect, COI_SORT_OPTIONS, useHeaderSort, sortByColumn, SortHeader } from './ListFilterKit'
import { NameLink, TrackHero } from './shared/TrackKit'

// COI Overview — every COI on one screen with their firm, their level, their
// clients and the money that has actually reached them, each row expanding into
// its own client list. The WIG port of VFO's Member Overview: same navy/blue
// grid card, same expand toggle, same click-to-sort headers.
//
// Nothing here says anything about the payout ACCOUNT. Having a Stripe account
// id is not proof a COI finished onboarding — only a live status call is (the
// Stripe Connect card on their profile) — so this panel stays silent rather than
// implying one.

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }

// Toggle · Member # · Name · Type · Mothership · Level · Joined · Status ·
// Clients · Paid · Rev share
const GRID = '30px 84px 1.5fr 100px 1.1fr 80px 96px 88px 76px 84px 118px'
// Client # · Name · Joined · Status · Payments · Latest payment · Next action
const CLIENT_GRID = '120px 1.4fr 96px 96px 92px 1.6fr 1.4fr'

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

// The count pill VFO uses for a member's clients: primary-tinted while there is
// something to count, a quiet grey zero when there is not.
function CountPill({ value, children }) {
  return (
    <span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', color: value ? '#1D64A8' : 'var(--wig-faint)', background: value ? 'rgba(29,100,168,0.1)' : 'var(--wig-border-soft)' }}>
      {children ?? value}
    </span>
  )
}

function dateText(v) {
  return v ? String(v).slice(0, 10) : '—'
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
    joined: { type: 'date', get: c => (c.join_date ? String(c.join_date).slice(0, 10) : null) },
    status: { type: 'text', get: statusOf },
    clients: { type: 'number', get: c => c.clients_count },
    paid: { type: 'number', get: c => c.paid_payments_count },
    rev: { type: 'number', get: c => Number(c.rev_share_to_date) || 0 },
  }
  const rows = sortByColumn(sortMembers(filtered, listSort), colSort, sortColumns)

  if (loading) {
    return (
      <div>
        <TrackHero eyebrow="Overview" title="COI Overview" />
        <div style={{ textAlign: 'center', fontSize: '13.5px', color: 'var(--wig-muted)', padding: '40px 0' }}>Loading...</div>
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
        <div style={{ minWidth: '1180px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '10px', padding: '12px 18px', background: 'var(--wig-input)', borderBottom: '1px solid var(--wig-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-muted)' }}>
            <span />
            <SortHeader label="Member #" sortKey="number" sort={colSort} onSort={onSort} />
            <SortHeader label="Name" sortKey="name" sort={colSort} onSort={onSort} />
            <SortHeader label="Type" sortKey="type" sort={colSort} onSort={onSort} />
            <SortHeader label="Mothership" sortKey="mothership" sort={colSort} onSort={onSort} />
            <SortHeader label="Level" sortKey="level" sort={colSort} onSort={onSort} />
            <SortHeader label="Joined" sortKey="joined" sort={colSort} onSort={onSort} />
            <SortHeader label="Status" sortKey="status" sort={colSort} onSort={onSort} />
            <SortHeader label="Clients" sortKey="clients" sort={colSort} onSort={onSort} />
            <SortHeader label="Paid" sortKey="paid" sort={colSort} onSort={onSort} />
            <SortHeader label="Rev share to date" sortKey="rev" sort={colSort} onSort={onSort} style={{ justifyContent: 'flex-end', width: '100%' }} />
          </div>

          {rows.length === 0 && (
            <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--wig-faint)', fontSize: '13px' }}>No COIs match the current filters.</div>
          )}

          {rows.map(coi => {
            const mn = coi.member_number
            const isOpen = !!expanded[mn]
            const clients = coi.clients || []
            const typeColor = TYPE_COLORS[coi.coi_type] || 'var(--wig-muted)'
            const rev = Number(coi.rev_share_to_date) || 0
            return (
              <div key={mn}>
                <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '10px', padding: '11px 18px', borderBottom: '1px solid var(--wig-border-soft)', alignItems: 'center', fontSize: '13px', color: 'var(--wig-ink)' }}>
                  <button
                    onClick={() => setExpanded(e => ({ ...e, [mn]: !e[mn] }))}
                    title={isOpen ? 'Hide clients' : `Show clients (${clients.length})`}
                    style={{ width: '24px', height: '24px', border: '1px solid var(--wig-border-strong)', background: isOpen ? 'var(--wig-tint)' : 'var(--wig-card)', borderRadius: '6px', cursor: 'pointer', color: 'var(--wig-muted)', fontSize: '11px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isOpen ? '▾' : '▸'}
                  </button>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--wig-muted)' }}>{mn}</span>
                  {/* A shortcut, not the row's own destination — the row itself
                      only expands, so the name has to carry the link. */}
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <NameLink onClick={() => onOpenCoi && onOpenCoi(mn, { returnTo: 'coi_overview' })} title="Open COI profile">{fullName(coi) || '—'}</NameLink>
                  </span>
                  <span>
                    {coi.coi_type
                      ? <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', color: typeColor, background: `${typeColor}1f` }}>{coi.coi_type}</span>
                      : <span style={{ color: 'var(--wig-faint)' }}>—</span>}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--wig-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mothershipLabel(coi) || '—'}</span>
                  <span style={{ fontSize: '12px', color: 'var(--wig-muted)' }}>{levelLabel(coi) || '—'}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--wig-muted)' }}>{dateText(coi.join_date)}</span>
                  <span><StatusChip status={statusOf(coi)} /></span>
                  <span><CountPill value={coi.clients_count} /></span>
                  <span style={{ fontSize: '12px', color: 'var(--wig-muted)' }}>{coi.paid_payments_count} / {coi.payments_count}</span>
                  <span style={{ textAlign: 'right', fontWeight: 600, color: rev ? 'var(--wig-ink)' : 'var(--wig-faint)' }}>${moneyText(rev)}</span>
                </div>

                {isOpen && (
                  <div style={{ padding: '4px 18px 14px 52px', borderBottom: '1px solid var(--wig-border-soft)', background: 'var(--wig-input)' }}>
                    {clients.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--wig-faint)', padding: '8px 0' }}>No clients attached.</div>
                    ) : (
                      <div style={{ border: '1px solid var(--wig-border-soft)', borderRadius: '10px', overflow: 'hidden', minWidth: '900px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: CLIENT_GRID, gap: '10px', padding: '8px 14px', background: 'var(--wig-input)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--wig-muted)' }}>
                          <span>Client #</span>
                          <span>Name</span>
                          <span>Joined</span>
                          <span>Status</span>
                          <span>Payments</span>
                          <span>Latest payment</span>
                          <span>Next action</span>
                        </div>
                        {clients.map(client => {
                          const latest = client.latest_payment
                          return (
                            <div key={client.id}
                              style={{ display: 'grid', gridTemplateColumns: CLIENT_GRID, gap: '10px', padding: '9px 14px', borderTop: '1px solid var(--wig-border-soft)', alignItems: 'center', fontSize: '12.5px', color: 'var(--wig-ink)', background: 'var(--wig-card)' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--wig-muted)' }}>{client.client_number || '—'}</span>
                              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <NameLink onClick={() => onOpenClient && onOpenClient(mn, client.id, { returnTo: 'coi_overview' })} title="Open client profile">{fullName(client) || '—'}</NameLink>
                              </span>
                              <span style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--wig-muted)' }}>{dateText(client.created_at)}</span>
                              <span><StatusChip status={statusOf(client)} /></span>
                              <span>
                                {/* The count is the shortcut when there is
                                    something to open; a zero is just a zero. */}
                                {client.payments_count > 0
                                  ? <NameLink onClick={() => onOpenClient && onOpenClient(mn, client.id, { clientTab: 'client_payments', returnTo: 'coi_overview' })} title="Open payments">
                                      <CountPill value={client.payments_count} />
                                    </NameLink>
                                  : <CountPill value={0} />}
                              </span>
                              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px', minWidth: 0 }}>
                                {latest ? (
                                  <>
                                    <span style={{ fontSize: '12px', color: 'var(--wig-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{latest.strategy_name || latest.strategy_key}</span>
                                    <StatusPill payment={latest} />
                                  </>
                                ) : <span style={{ fontSize: '12px', color: 'var(--wig-faint)' }}>No payment yet</span>}
                              </span>
                              <span style={{ fontSize: '12px', color: latest?.next_action ? 'var(--wig-ink)' : 'var(--wig-faint)' }}>{latest?.next_action || '—'}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
