import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { callApi, getSession, clearSession } from '../lib/api'
import { usePortalTheme } from '../lib/theme'
import WigLogo from '../components/shared/WigLogo'
import NotificationBell from '../components/NotificationBell'
import AdminSettings from '../components/AdminSettings'
import AdminEditor from '../components/AdminEditor'
import CoiSearch from '../components/CoiSearch'
import CoiKpis from '../components/CoiKpis'
import AddCoi from '../components/AddCoi'

const TAB_KEY = 'wigActiveTab'
const COI_SECTION_KEY = 'wigCoiSection'
const SELECTED_COI_KEY = 'wigSelectedCoi'
const COI_FEATURE_TAB_KEY = 'wigCoiFeatureTab'

const COI_DROPDOWN_ITEMS = [
  {
    key: 'coi',
    options: [
      { key: 'coi_search', label: 'COI Search' },
      { key: 'coi_kpis', label: 'COI KPIs' },
      { key: 'add_coi', label: 'Add COI' },
    ],
  },
]

function NavDropdown({ label, items, onSelect, isActive }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef(null)

  function handleMouseEnter() {
    clearTimeout(closeTimer.current)
    setOpen(true)
  }

  function handleMouseLeave() {
    setOpen(false)
  }

  const btnStyle = {
    padding: '15px 20px', background: 'transparent', border: 'none',
    borderBottom: isActive ? '2px solid #1D64A8' : '2px solid transparent',
    color: isActive ? '#1D64A8' : 'var(--wig-ink)', fontSize: '14.5px',
    fontWeight: isActive ? '700' : '600', cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
    display: 'flex', alignItems: 'center', gap: '6px'
  }

  return (
    <div style={{ position: 'relative' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button style={btnStyle}>
        {label}
        <span style={{ fontSize: '10px', opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--wig-card)', border: '1px solid var(--wig-border)', borderRadius: '12px', minWidth: '180px', zIndex: 200, paddingTop: '4px', paddingBottom: '4px', boxShadow: '0 14px 36px rgba(20,45,95,0.16)' }}>
          {items.map(item => (
            <div key={item.key}>
              {item.options.map(opt => (
                <button key={opt.key} onClick={() => { onSelect(opt.key); setOpen(false) }}
                  style={{ display: 'block', width: '100%', padding: '8px 20px', background: 'transparent', border: 'none', color: 'var(--wig-ink)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--wig-tint)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {opt.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Portal() {
  const navigate = useNavigate()
  const session = getSession()
  usePortalTheme()

  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem(TAB_KEY) || null)
  const [coiSection, setCoiSection] = useState(() => sessionStorage.getItem(COI_SECTION_KEY) || 'coi_search')
  // Bumped on every nav click so the COI panels remount and pick the (now
  // cleared) selection key back up — a same-section click must land on the list.
  const [navClickCount, setNavClickCount] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // One loader shared by the mount effect and the post-write reload. `isLive`
  // lets the mount call drop a response that lands after unmount.
  async function loadMembers(isLive = () => true) {
    try {
      const data = await callApi('load_members')
      if (!isLive()) return
      setMembers(data.members || [])
      setLoadError(null)
    } catch (err) {
      if (!isLive()) return
      setLoadError(err.message || 'Something went wrong')
    } finally {
      if (isLive()) setLoading(false)
    }
  }

  // Re-read the directory after a write (Add COI, COI edit/delete) so the change
  // shows up.
  function reload() { return loadMembers() }

  useEffect(() => {
    if (!session) { navigate('/', { replace: true }); return }
    let cancelled = false
    loadMembers(() => !cancelled)
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function signOut() { clearSession(); navigate('/') }

  function backToWelcome() {
    setShowSettings(false)
    setShowEditor(false)
    setActiveTab(null)
    sessionStorage.removeItem(TAB_KEY)
    sessionStorage.removeItem(COI_SECTION_KEY)
    sessionStorage.removeItem(SELECTED_COI_KEY)
    sessionStorage.removeItem(COI_FEATURE_TAB_KEY)
  }

  // Navigating to a section always starts on that section's own top-level view,
  // never on whichever COI happened to be open last.
  function selectCoiSection(key) {
    setShowSettings(false)
    setShowEditor(false)
    setActiveTab('coi')
    setCoiSection(key)
    sessionStorage.setItem(TAB_KEY, 'coi')
    sessionStorage.setItem(COI_SECTION_KEY, key)
    sessionStorage.removeItem(SELECTED_COI_KEY)
    sessionStorage.removeItem(COI_FEATURE_TAB_KEY)
    setNavClickCount(n => n + 1)
  }

  if (!session) return null

  const headerStyle = {
    background: 'linear-gradient(90deg, #0F355A 0%, #1D64A8 100%)',
    padding: '0 24px 0 14px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', height: '58px', position: 'sticky', top: 0, zIndex: 100,
    boxShadow: '0 2px 12px rgba(15,53,90,0.25)'
  }

  // Rows do not carry status / coi_type yet — a missing status reads as Active.
  const isActive = m => (m.status || 'Active') !== 'Lost'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--wig-page)', color: 'var(--wig-ink)', fontFamily: 'Inter, sans-serif' }}>
      <div style={headerStyle}>
        <WigLogo light mark height={30} onClick={backToWelcome} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <NotificationBell />
          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.88)', fontWeight: 500, whiteSpace: 'nowrap', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.name}</span>
          {session.is_superadmin && (
            <button onClick={() => { setShowEditor(true); setShowSettings(false); setActiveTab(null) }}
              style={{ padding: '6px 16px', borderRadius: '99px', border: '1px solid rgba(255,205,150,0.5)', background: 'transparent', color: '#ffd9a0', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
              Admin Editor
            </button>
          )}
          <button onClick={() => { setShowSettings(true); setShowEditor(false); setActiveTab(null) }}
            style={{ padding: '6px 16px', borderRadius: '99px', border: '1px solid rgba(255,255,255,0.32)', background: 'transparent', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
            Settings
          </button>
          <button onClick={signOut}
            style={{ padding: '6px 16px', borderRadius: '99px', border: '1px solid rgba(255,255,255,0.32)', background: 'transparent', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>

      {showSettings && <AdminSettings session={session} />}
      {showEditor && <AdminEditor />}

      {!showSettings && !showEditor && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--wig-border)', padding: '0 24px', background: 'var(--wig-card)', boxShadow: '0 2px 8px rgba(20,45,95,0.04)' }}>
            <NavDropdown
              label="COI"
              items={COI_DROPDOWN_ITEMS}
              onSelect={selectCoiSection}
              isActive={activeTab === 'coi'}
            />
          </div>

          <div style={{ flex: 1 }}>
            {loadError && (
              <div style={{ maxWidth: '980px', margin: '20px auto 0', padding: '0 24px' }}>
                <div style={{ background: 'rgba(217,48,37,0.10)', border: '1px solid rgba(217,48,37,0.32)', borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#d93025', marginBottom: '6px' }}>We couldn't load your portal</div>
                  <div style={{ fontSize: '13px', color: 'var(--wig-ink)', wordBreak: 'break-word' }}>{loadError}</div>
                  <div style={{ fontSize: '13px', color: 'var(--wig-muted)', marginTop: '6px' }}>Please refresh the page — if this keeps happening, contact your Wealth IG team.</div>
                </div>
              </div>
            )}

            {!activeTab && (
              <div style={{ textAlign: 'center', padding: '60px 24px 0' }}>
                <p style={{ fontSize: '12px', color: '#EE6A33', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: '10px' }}>Welcome back</p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, letterSpacing: '-0.02em', fontSize: '38px', color: 'var(--wig-heading)', margin: 0 }}>{session.name}</p>
                <div style={{ width: '46px', height: '4px', borderRadius: '99px', background: '#EE6A33', margin: '18px auto 0' }} />
                {!loading && (() => {
                  const cards = [
                    { label: 'Active COIs', value: members.filter(isActive).length },
                    { label: 'Active Advisors', value: members.filter(m => m.coi_type === 'Advisor' && isActive(m)).length },
                    { label: 'Active Accountants', value: members.filter(m => m.coi_type === 'Accountant' && isActive(m)).length },
                  ]
                  return (
                    <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '40px' }}>
                      {cards.map(c => (
                        <button key={c.label} onClick={() => selectCoiSection('coi_search')} style={{ width: '170px', padding: '20px 14px 16px', background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                          <div style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--wig-heading)', lineHeight: 1 }}>{c.value}</div>
                          <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.9px', color: 'var(--wig-muted)', textTransform: 'uppercase', marginTop: '9px' }}>{c.label}</div>
                        </button>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}

            {activeTab === 'coi' && (
              // The KPI page runs wider than the list + form so its breakdown
              // and donut sit side by side.
              <div style={{ maxWidth: coiSection === 'coi_kpis' ? '1180px' : '900px', margin: '0 auto', padding: '24px' }}>
                {loading ? (
                  <div style={{ textAlign: 'center', fontSize: '13.5px', color: 'var(--wig-muted)', padding: '40px 0' }}>Loading...</div>
                ) : (
                  <>
                    {coiSection === 'coi_search' && <CoiSearch key={`coi_search-${navClickCount}`} members={members} onDataChange={reload} />}
                    {coiSection === 'coi_kpis' && <CoiKpis members={members} />}
                    {coiSection === 'add_coi' && <AddCoi onDataChange={reload} />}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
