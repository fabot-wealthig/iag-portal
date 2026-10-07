import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'
import { SkeletonText } from './Skeleton'

// The profile look every IAG profile shares (COI, client, payee, team member),
// modelled on the VFO portal's member profile (Jake, 2026-10-02): one card per
// category under a bold underlined title, fields as a small grey label over a
// larger value, cards side by side where they fit. The read-only Profile and
// the Edit Profile form use the same cards, so the two read alike.

export const profileCardStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px', boxSizing: 'border-box' }
export const cardTitleStyle = { fontSize: '15px', color: 'var(--wig-heading)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '18px', paddingBottom: '11px', borderBottom: '2px solid var(--wig-heading)' }
const dangerTitleStyle = { ...cardTitleStyle, color: '#e74c3c', borderBottom: '2px solid rgba(231,76,60,0.6)' }
const fieldLabelStyle = { fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.8px', color: 'var(--wig-faint)', textTransform: 'uppercase' }
const fieldValueStyle = { fontSize: '15px', color: 'var(--wig-ink)', fontWeight: 600, marginTop: '5px', wordBreak: 'break-word' }
export const formLabelStyle = { fontSize: '11px', color: 'var(--wig-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }
const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const gradientButtonStyle = { padding: '9px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }

export function ProfileCard({ title, danger = false, children, style }) {
  return (
    <div style={{ ...profileCardStyle, ...(danger ? { border: '1px solid rgba(231,76,60,0.3)' } : null), ...style }}>
      {title && <div style={danger ? dangerTitleStyle : cardTitleStyle}>{title}</div>}
      {children}
    </div>
  )
}

// Cards side by side where the panel is wide enough, stacked where it is not.
// Each child is one column; `basis` is the width it would like.
export function CardRow({ children }) {
  return <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch', flexWrap: 'wrap' }}>{children}</div>
}

export function CardCol({ basis = '320px', min = '260px', children }) {
  return (
    <div style={{ flex: `1 1 ${basis}`, minWidth: min, display: 'flex' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  )
}

// A card that fills its CardCol's height, so side-by-side cards line up.
export function FillCard(props) {
  return <ProfileCard {...props} style={{ flex: 1, ...props.style }} />
}

export function InfoGrid({ children, min = '170px' }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}, 1fr))`, gap: '18px 24px' }}>{children}</div>
}

export function InfoField({ label, children }) {
  const empty = children == null || children === '' || children === false
  return (
    <div>
      <div style={fieldLabelStyle}>{label}</div>
      <div style={fieldValueStyle}>{empty ? '—' : children}</div>
    </div>
  )
}

const cancelButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '13px', cursor: 'pointer' }
const linkButtonStyle = { background: 'none', border: 'none', padding: 0, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }

function noteDate(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// The notes log on every read-only Profile (Jake, 2026-10-07; never on Edit
// Profile): always shown, "+ Add Note" opens a box, each note a dated entry
// signed by its author, newest first. The server says who may add (team notes:
// superadmin) and which notes this admin may delete (their own; a superadmin any).
export function NotesCard({ kind, id }) {
  const [notes, setNotes] = useState(null)
  const [canAdd, setCanAdd] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    setNotes(null); setLoadError(''); setAdding(false); setText(''); setConfirmId(null); setError('')
    callApi('load_profile_notes', { kind, id })
      .then(data => { if (live) { setNotes(data.notes || []); setCanAdd(!!data.can_add) } })
      .catch(err => { if (live) setLoadError(err.message) })
    return () => { live = false }
  }, [kind, id])

  async function save() {
    if (!text.trim()) return
    setSaving(true); setError('')
    try {
      const data = await callApi('add_profile_note', { kind, id, note: text })
      setNotes(list => [data.note, ...(list || [])])
      setText(''); setAdding(false)
    } catch (err) {
      setError(err.message)
    } finally { setSaving(false) }
  }

  async function remove(noteId) {
    setDeletingId(noteId); setError('')
    try {
      await callApi('delete_profile_note', { note_id: noteId })
      setNotes(list => (list || []).filter(n => n.id !== noteId))
      setConfirmId(null)
    } catch (err) {
      setError(err.message)
    } finally { setDeletingId(null) }
  }

  return (
    <ProfileCard>
      <div style={{ ...cardTitleStyle, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span>Notes</span>
        {notes && notes.length > 0 && (
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: 0, padding: '2px 9px', borderRadius: '999px', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-soft)', color: 'var(--wig-muted)' }}>{notes.length}</span>
        )}
        {canAdd && !adding && notes && (
          <button onClick={() => { setAdding(true); setError('') }}
            style={{ ...gradientButtonStyle, marginLeft: 'auto', padding: '6px 14px', fontSize: '12px', textTransform: 'none', letterSpacing: 0 }}>
            + Add Note
          </button>
        )}
      </div>

      {adding && (
        <div style={{ marginBottom: '16px' }}>
          <textarea value={text} onChange={e => setText(e.target.value)} maxLength={2000} autoFocus placeholder="Add a note..."
            style={{ ...inputStyle, minHeight: '90px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button onClick={save} disabled={saving || !text.trim()} style={{ ...gradientButtonStyle, opacity: saving || !text.trim() ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Save Note'}
            </button>
            {!saving && <button onClick={() => { setAdding(false); setText(''); setError('') }} style={cancelButtonStyle}>Cancel</button>}
          </div>
        </div>
      )}

      {loadError ? (
        <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>Could not load notes: {loadError}</p>
      ) : notes === null ? (
        <SkeletonText lines={2} />
      ) : notes.length === 0 ? (
        <div style={{ fontSize: '14px', color: 'var(--wig-faint)' }}>No notes yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {notes.map(n => (
            <div key={n.id} style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-soft)', background: 'var(--wig-tint)' }}>
              <div style={{ fontSize: '14px', color: 'var(--wig-ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{n.note_text}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '12px', color: 'var(--wig-muted)' }}>
                <span>{n.created_by_name || n.created_by_email}</span>
                <span>·</span>
                <span>{noteDate(n.created_at)}</span>
                {n.can_delete && (
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
                    {confirmId === n.id ? (
                      <>
                        <button onClick={() => remove(n.id)} disabled={deletingId === n.id} style={{ ...linkButtonStyle, color: '#d93025', fontWeight: 600 }}>
                          {deletingId === n.id ? 'Deleting...' : 'Confirm delete'}
                        </button>
                        {deletingId !== n.id && <button onClick={() => setConfirmId(null)} style={{ ...linkButtonStyle, color: 'var(--wig-muted)' }}>Cancel</button>}
                      </>
                    ) : (
                      <button onClick={() => { setConfirmId(n.id); setError('') }} style={{ ...linkButtonStyle, color: 'var(--wig-muted)' }}>Delete</button>
                    )}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p style={{ color: '#d93025', fontSize: '13px', margin: '10px 0 0' }}>{error}</p>}
    </ProfileCard>
  )
}
