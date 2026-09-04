import { useEffect, useRef, useState } from 'react'
import { callApi } from '../lib/api'
import { Skeleton } from './shared/Skeleton'

// How often the bell asks the server for new notifications. The VFO portal's
// interval, kept: fast enough that an admin watching a payment clear sees it
// without refreshing, slow enough to be one small indexed read per tab.
const POLL_MS = 30000

// Any screen that does something a notification was about can dispatch this on
// window to refresh the bell at once rather than leaving it up to thirty
// seconds stale.
export const NOTIFICATIONS_CHANGED = 'wig:notifications-changed'

// "3m ago" up to a day, then days, then the date itself. A bell is read at a
// glance, and "2h ago" answers "is this new?" in a way a timestamp does not.
function relativeTime(iso) {
  if (!iso) return ''
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const mins = Math.floor((Date.now() - then.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * The header bell: the signed-in admin's unread notifications, polled.
 *
 * `onOpenPayment` receives the whole notification row and is expected to
 * navigate to the payment it names. Every row carries member_number, client_id
 * and payment_id, stamped when it was raised, so the click writes the portal's
 * navigation keys and needs no lookup of its own.
 */
export default function NotificationBell({ onOpenPayment }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  // First load only. A poll that lands while the list is on screen replaces it
  // in place — redrawing skeletons twice a minute would be a flicker, not
  // feedback.
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    load()
    const interval = setInterval(load, POLL_MS)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    function onChanged() { load() }
    window.addEventListener(NOTIFICATIONS_CHANGED, onChanged)
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, onChanged)
  }, [])

  async function load() {
    try {
      const data = await callApi('load_notifications')
      setNotifications(data.notifications || [])
      setUnreadCount(data.unread_count || 0)
    } catch (err) {
      // A failed poll is not worth a message in the header — the next one is
      // thirty seconds away, and the badge simply keeps what it had.
      console.error('Notification load error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Drop one row from the list locally. The server has already been told (or is
  // about to be) — this is what stops the row from sitting there while the
  // write is in flight.
  function removeLocally(id) {
    setNotifications(prev => prev.filter(n => n.id !== id))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  async function markRead(id) {
    removeLocally(id)
    try {
      await callApi('mark_notification_read', { notification_id: id })
    } catch (err) {
      // Put it back: an unread row that vanished without being cleared is worse
      // than one that reappears.
      console.error('mark read error:', err)
      load()
    }
  }

  // A click IS the acknowledgement, so the row is marked read first — and the
  // write must COMPLETE before navigating, or the poll on the far side can land
  // before it and resurrect the row.
  async function handleClick(n) {
    setOpen(false)
    removeLocally(n.id)
    try {
      await callApi('mark_notification_read', { notification_id: n.id })
    } catch (err) {
      console.error('mark read error:', err)
    }
    if (onOpenPayment && n.member_number && n.client_id) onOpenPayment(n)
  }

  async function markAllRead() {
    setBusy(true)
    try {
      await callApi('mark_all_notifications_read')
      setNotifications([])
      setUnreadCount(0)
    } catch (err) {
      console.error('mark all read error:', err)
      load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        title="Notifications"
        style={{
          position: 'relative', background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.55)',
          borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif'
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-5px', right: '-5px',
            background: '#EE6A33', color: '#fff', fontSize: '10px', fontWeight: '700',
            borderRadius: '50%', minWidth: '17px', height: '17px', padding: '0 3px', boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(20,45,95,0.35)'
          }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '8px',
          background: 'var(--wig-card)', border: '1px solid var(--wig-border-strong)',
          borderRadius: '10px', width: '480px', maxWidth: 'calc(100vw - 32px)', maxHeight: '420px', overflowY: 'auto',
          zIndex: 300, boxShadow: '0 8px 32px rgba(20,45,95,0.25)'
        }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--wig-tint-deep)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--wig-ink)' }}>
              Notifications
              {unreadCount > notifications.length && (
                <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 500, color: 'var(--wig-muted)' }}>
                  showing {notifications.length} of {unreadCount}
                </span>
              )}
            </span>
            {notifications.length > 0 && (
              <button onClick={markAllRead} disabled={busy}
                style={{ background: 'transparent', border: 'none', color: '#1D64A8', fontWeight: 600, fontSize: '11px', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Mark all read
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '12px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ marginBottom: '14px' }}>
                  <Skeleton width="70%" height={13} style={{ marginBottom: '7px' }} />
                  <Skeleton width="45%" height={11} />
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--wig-muted)', fontSize: '13px' }}>
              No new notifications
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  padding: '9px 12px', borderBottom: '1px solid var(--wig-tint)',
                  cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'flex-start'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--wig-tint)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12.5px', color: 'var(--wig-ink)', fontWeight: 600, marginBottom: '3px', lineHeight: '1.35' }}>
                    {n.title}
                  </div>
                  {n.message && (
                    <div style={{ fontSize: '11.5px', color: 'var(--wig-muted)', lineHeight: '1.45', marginBottom: '5px', overflowWrap: 'anywhere' }}>
                      {n.message}
                    </div>
                  )}
                  <span style={{ fontSize: '10px', color: 'var(--wig-faint)' }}>{relativeTime(n.created_at)}</span>
                </div>
                {/* Clearing a row without going to the payment. stopPropagation
                    keeps it from also navigating. */}
                <button
                  onClick={e => { e.stopPropagation(); markRead(n.id) }}
                  style={{
                    padding: '3px 9px', borderRadius: '4px', fontSize: '10.5px',
                    border: '1px solid rgba(27,146,84,0.4)', background: 'rgba(27,146,84,0.12)',
                    color: '#1b9254', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                    fontFamily: 'Inter, sans-serif'
                  }}
                >Done</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
