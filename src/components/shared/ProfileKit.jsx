import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'

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

// Notes, edited in place on the read-only Profile (Jake: not on Edit Profile).
// `kind` + `id` pick the profile for save_notes; a viewer who may not edit sees
// the text only. Save appears once the text differs from what is stored.
export function NotesCard({ kind, id, notes, canEdit = true, onSaved }) {
  const stored = notes || ''
  const [text, setText] = useState(stored)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  // A reload that brings different stored notes (another admin's save) resets
  // the box, unless this admin is mid-edit.
  const [lastStored, setLastStored] = useState(stored)
  useEffect(() => {
    if (stored !== lastStored) {
      setText(t => (t === lastStored ? stored : t))
      setLastStored(stored)
    }
  }, [stored, lastStored])

  const dirty = text.trim() !== stored.trim()

  async function save() {
    setSaving(true); setMsg('')
    try {
      await callApi('save_notes', { kind, id, notes: text })
      if (onSaved) await onSaved()
      setMsgType('success'); setMsg('Notes saved.')
      setTimeout(() => setMsg(''), 3000)
    } catch (err) {
      setMsgType('error'); setMsg(err.message)
    } finally { setSaving(false) }
  }

  return (
    <ProfileCard title="Notes">
      {canEdit ? (
        <>
          <textarea value={text} onChange={e => setText(e.target.value)} maxLength={2000} placeholder="Add a note..."
            style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
          {(dirty || saving) && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button onClick={save} disabled={saving} style={{ ...gradientButtonStyle, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving...' : 'Save Notes'}
              </button>
              {!saving && (
                <button onClick={() => setText(stored)}
                  style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '13px', cursor: 'pointer' }}>
                  Cancel
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: '14px', color: stored ? 'var(--wig-ink)' : 'var(--wig-faint)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{stored || 'No notes.'}</div>
      )}
      {msg && <p style={{ color: msgType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', margin: '10px 0 0' }}>{msg}</p>}
    </ProfileCard>
  )
}
