import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { TrackHero } from './shared/TrackKit'

// One named section today. Anything that arrives under a pipeline this list
// does not know about is gathered into an "Other" section rather than being
// silently dropped — a template nobody can see is a template nobody can fix.
const SECTIONS = [
  { key: 'wig_payments', label: 'WIG Payments', pipeline: 'WIG' },
]

// Recipient placeholders that resolve to a real address when the email fires.
// Must match the backend's ROLE_TOKENS in actions/email-templates/save.ts.
const ROLE_LABELS = {
  RECIPIENT: 'Recipient',
  COI: 'COI',
  CLIENT: 'Client',
}
const ROLE_TOKENS = Object.keys(ROLE_LABELS)
const isRoleToken = v => ROLE_TOKENS.includes(v)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Commit an email that is still typed in the box (not yet "Add"-ed) into the
// list, so a half-finished edit is not lost on Save.
function withPending(emails, pending) {
  const e = (pending || '').trim().toLowerCase()
  if (e && EMAIL_RE.test(e) && !emails.includes(e)) return [...emails, e]
  return emails
}

const inputStyle = { padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '13px', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box' }
const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const emptyTitleStyle = { fontSize: '14px', fontWeight: 700, color: 'var(--wig-heading)', marginBottom: '8px' }
const emptyBodyStyle = { fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0, lineHeight: 1.6 }

export default function EmailTemplatesPanel() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openSections, setOpenSections] = useState(() => new Set())
  const [bulkBusy, setBulkBusy] = useState('')

  useEffect(() => { loadTemplates() }, [])

  async function loadTemplates() {
    try {
      const data = await callApi('load_email_templates')
      setTemplates(data.templates || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleSection(key) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  // Flip send_mode on a set of ids in local state — the server already did it.
  function applySendMode(ids, mode) {
    const idSet = new Set(ids)
    setTemplates(prev => prev.map(t => idSet.has(t.id) ? { ...t, send_mode: mode } : t))
  }

  async function bulkSetSendMode(section, rows, mode) {
    const ids = rows.map(t => t.id)
    if (ids.length === 0) return
    // Only the Send direction is confirmed: switching a group back to Draft can
    // only ever reduce what goes out on its own.
    if (mode && !window.confirm(`Set all ${ids.length} emails in "${section.label}" to SEND mode?\n\nThey will go out automatically instead of waiting in drafts for review.`)) return
    setBulkBusy(section.key); setError('')
    try {
      await callApi('save_email_template', { ids, send_mode: mode })
      applySendMode(ids, mode)
    } catch (err) {
      setError(err.message)
    } finally {
      setBulkBusy('')
    }
  }

  if (loading) {
    return (
      <div>
        <TrackHero eyebrow="Automation & Config" title="Email Templates" />
        <div style={{ textAlign: 'center', fontSize: '13.5px', color: 'var(--wig-muted)', padding: '40px 0' }}>Loading...</div>
      </div>
    )
  }

  const known = new Set(SECTIONS.map(s => s.pipeline))
  const sections = [
    ...SECTIONS.map(s => ({ ...s, rows: templates.filter(t => t.pipeline === s.pipeline) })),
    ...(templates.some(t => !known.has(t.pipeline))
      ? [{ key: 'other', label: 'Other', rows: templates.filter(t => !known.has(t.pipeline)) }]
      : []),
  ]

  return (
    <div>
      <TrackHero eyebrow="Automation & Config" title="Email Templates" />
      <p style={{ fontSize: '13px', color: 'var(--wig-muted)', margin: '0 0 24px', lineHeight: 1.6 }}>
        Each email has a <strong>Draft / Send</strong> switch: Draft means it waits in the Wealth IG drafts for someone to review and send it; Send means it goes out automatically. Use a section&rsquo;s All draft / All send buttons to set the whole group, then flip individual emails the other way if needed. Expand an email to edit who receives it (TO / CC / BCC — mix role chips with real addresses) plus its subject and body.
      </p>

      {error && <div style={{ color: '#d93025', fontWeight: 500, fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

      {templates.length === 0 && !error && (
        <div style={sectionStyle}>
          <div style={emptyTitleStyle}>No templates yet</div>
          <p style={emptyBodyStyle}>
            The payment emails and their wording arrive with the payment phase. Once they are seeded, each one shows up here for editing.
          </p>
        </div>
      )}

      {sections.map(section => {
        const open = openSections.has(section.key)
        const sendCount = section.rows.filter(t => t.send_mode === true).length
        const busy = bulkBusy === section.key
        if (section.rows.length === 0 && templates.length === 0) return null

        return (
          <div key={section.key} style={{ marginBottom: '10px', border: '1px solid var(--wig-border-soft)', borderRadius: '12px', overflow: 'hidden', background: 'var(--wig-card)', boxShadow: '0 2px 8px rgba(20,45,95,0.04)' }}>
            <div onClick={() => toggleSection(section.key)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', background: open ? 'var(--wig-tint)' : 'var(--wig-input)', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span style={{ fontSize: '10px', color: '#3D9BE0', transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--wig-ink)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{section.label}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', color: 'var(--wig-muted)' }}>{section.rows.length}</span>
                {sendCount > 0 && (
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', background: 'rgba(27,146,84,0.12)', border: '1px solid rgba(27,146,84,0.4)', color: '#1b9254' }}>
                    {sendCount === section.rows.length ? 'all sending' : `${sendCount} sending`}
                  </span>
                )}
              </div>
              <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button disabled={busy} onClick={() => bulkSetSendMode(section, section.rows, false)}
                  style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: busy ? 'default' : 'pointer', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-card)', color: 'var(--wig-muted)', opacity: busy ? 0.6 : 1 }}>
                  All draft
                </button>
                <button disabled={busy} onClick={() => bulkSetSendMode(section, section.rows, true)}
                  style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: busy ? 'default' : 'pointer', border: '1px solid rgba(27,146,84,0.4)', background: 'rgba(27,146,84,0.12)', color: '#1b9254', opacity: busy ? 0.6 : 1 }}>
                  All send
                </button>
              </div>
            </div>
            {open && (
              <div style={{ padding: '14px 18px 8px' }}>
                {section.rows.length === 0
                  ? <div style={{ fontSize: '12px', color: 'var(--wig-muted)', padding: '8px 0' }}>No templates.</div>
                  : section.rows.map(t => (
                      <TemplateCard key={t.id} tmpl={t} onSendModeChange={applySendMode} />
                    ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Chip editor for a recipient list holding role tokens AND raw addresses. Role
// chips render solid with their friendly label; addresses render outlined.
// Unused roles appear as one-click "+ Role" suggestion chips.
function RecipientEditor({ title, accent, entries, onChange, input, setInput }) {
  const [warn, setWarn] = useState('')

  function add() {
    const e = input.trim().toLowerCase()
    if (!e) return
    if (!EMAIL_RE.test(e)) { setWarn('Enter a valid email (roles are added with the + chips)'); return }
    if (entries.includes(e)) { setInput(''); setWarn(''); return }
    onChange([...entries, e]); setInput(''); setWarn('')
  }

  const unusedRoles = ROLE_TOKENS.filter(t => !entries.includes(t))

  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ fontSize: '11px', color: accent, display: 'block', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.4px' }}>{title}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
        {entries.length === 0 && <span style={{ fontSize: '12px', color: 'var(--wig-muted)', fontStyle: 'italic' }}>None</span>}
        {entries.map(e => isRoleToken(e) ? (
          <span key={e} title={e} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: accent, color: '#fff' }}>
            {ROLE_LABELS[e]}
            <button onClick={() => onChange(entries.filter(x => x !== e))} title="Remove"
              style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0, opacity: 0.85 }}>×</button>
          </span>
        ) : (
          <span key={e} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', background: `${accent}1f`, color: accent, border: `1px solid ${accent}66` }}>
            {e}
            <button onClick={() => onChange(entries.filter(x => x !== e))} title="Remove"
              style={{ border: 'none', background: 'transparent', color: accent, cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0, opacity: 0.8 }}>×</button>
          </span>
        ))}
      </div>
      {unusedRoles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '7px' }}>
          {unusedRoles.map(t => (
            <button key={t} onClick={() => onChange([...entries, t])} title={`Add ${ROLE_LABELS[t]}`}
              style={{ fontSize: '11px', fontWeight: 600, padding: '2px 9px', borderRadius: '999px', cursor: 'pointer', background: 'var(--wig-input)', color: 'var(--wig-muted)', border: '1px dashed var(--wig-border-strong)' }}>
              + {ROLE_LABELS[t]}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '6px' }}>
        <input value={input} placeholder="name@wealthig.com"
          onChange={e => { setInput(e.target.value); setWarn('') }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          onBlur={() => { if (input.trim()) add() }}
          style={{ ...inputStyle, maxWidth: '280px' }} />
        <button onClick={add} style={{ padding: '6px 16px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', border: `1px solid ${accent}66`, background: `${accent}1a`, color: accent, whiteSpace: 'nowrap' }}>Add</button>
      </div>
      {warn && <div style={{ fontSize: '11px', color: '#d93025', fontWeight: 600, marginTop: '4px' }}>{warn}</div>}
    </div>
  )
}

// The per-email Draft / Send switch.
function SendToggle({ sendMode, busy, onSet }) {
  const seg = (active, color) => ({
    padding: '3px 10px', fontSize: '11px', fontWeight: 700, cursor: busy ? 'default' : 'pointer',
    border: 'none', letterSpacing: '0.3px',
    background: active ? color : 'transparent',
    color: active ? '#fff' : 'var(--wig-muted)',
    opacity: busy ? 0.55 : 1,
  })
  return (
    <div onClick={e => e.stopPropagation()} title="Draft = waits in drafts for review. Send = goes out automatically."
      style={{ display: 'inline-flex', borderRadius: '999px', overflow: 'hidden', border: '1px solid var(--wig-border-strong)', flexShrink: 0 }}>
      <button disabled={busy} onClick={() => { if (sendMode) onSet(false) }} style={seg(!sendMode, '#64748b')}>Draft</button>
      <button disabled={busy} onClick={() => { if (!sendMode) onSet(true) }} style={seg(sendMode, '#1b9254')}>Send</button>
    </div>
  )
}

function TemplateCard({ tmpl, onSendModeChange }) {
  const [expanded, setExpanded] = useState(false)
  const [subject, setSubject] = useState(tmpl.subject || '')
  const [bodyText, setBodyText] = useState(tmpl.body || '')
  const [to, setTo] = useState(Array.isArray(tmpl.to_list) ? tmpl.to_list : [])
  const [cc, setCc] = useState(Array.isArray(tmpl.cc_list) ? tmpl.cc_list : [])
  const [bcc, setBcc] = useState(Array.isArray(tmpl.bcc_list) ? tmpl.bcc_list : [])
  const [toInput, setToInput] = useState('')
  const [ccInput, setCcInput] = useState('')
  const [bccInput, setBccInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [toggleBusy, setToggleBusy] = useState(false)
  const [err, setErr] = useState('')
  const [savedMsg, setSavedMsg] = useState('')

  async function save() {
    setSaving(true); setErr(''); setSavedMsg('')
    try {
      const finalTo = withPending(to, toInput)
      const finalCc = withPending(cc, ccInput)
      const finalBcc = withPending(bcc, bccInput)
      setTo(finalTo); setCc(finalCc); setBcc(finalBcc); setToInput(''); setCcInput(''); setBccInput('')
      await callApi('save_email_template', { id: tmpl.id, subject, body: bodyText, to_list: finalTo, cc_list: finalCc, bcc_list: finalBcc })
      setSavedMsg('Saved'); setTimeout(() => setSavedMsg(''), 2500)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function setSendMode(next) {
    setToggleBusy(true); setErr('')
    try {
      await callApi('save_email_template', { id: tmpl.id, send_mode: next })
      onSendModeChange([tmpl.id], next)
    } catch (e) {
      setErr(e.message)
    } finally {
      setToggleBusy(false)
    }
  }

  return (
    <div style={{ background: 'var(--wig-card)', border: '1px solid var(--wig-tint-deep)', borderRadius: '10px', marginBottom: '8px', overflow: 'hidden' }}>
      <div onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '10px', color: 'var(--wig-muted)', transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s', flexShrink: 0 }}>▼</span>
          <span style={{ fontSize: '13px', color: 'var(--wig-ink)', fontWeight: 500 }}>{tmpl.template_name}</span>
          {(cc.length > 0 || bcc.length > 0) && (
            <span style={{ fontSize: '10px', color: 'var(--wig-muted)', flexShrink: 0 }}>
              {cc.length > 0 && `${cc.length} cc`}{cc.length > 0 && bcc.length > 0 && ' · '}{bcc.length > 0 && `${bcc.length} bcc`}
            </span>
          )}
        </div>
        <SendToggle sendMode={tmpl.send_mode === true} busy={toggleBusy} onSet={setSendMode} />
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--wig-border-soft)' }}>
          <div style={{ marginTop: '14px' }}>
            <RecipientEditor title="TO — who this email is sent to" accent="#1D64A8" entries={to} onChange={setTo} input={toInput} setInput={setToInput} />
            <RecipientEditor title="CC" accent="#3D9BE0" entries={cc} onChange={setCc} input={ccInput} setInput={setCcInput} />
            <RecipientEditor title="BCC" accent="#9333ea" entries={bcc} onChange={setBcc} input={bccInput} setInput={setBccInput} />
            <div style={{ fontSize: '11px', color: 'var(--wig-muted)', marginBottom: '4px' }}>
              Role chips resolve per email when it fires (COI = that payment&rsquo;s COI, Client = the paying client); roles that don&rsquo;t apply are skipped. Remember to press Save.
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--wig-border-soft)', margin: '4px 0 12px' }} />

          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '11px', color: 'var(--wig-muted)', display: 'block', marginBottom: '4px' }}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--wig-muted)', display: 'block', marginBottom: '4px' }}>Body (HTML)</label>
            <textarea value={bodyText} onChange={e => setBodyText(e.target.value)} rows={10} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--wig-muted)', display: 'block', marginBottom: '4px' }}>Preview</label>
            {/* The body IS HTML, written by an admin and rendered as the mail
                client will render it — a preview that escaped it would be
                showing something other than the email. */}
            <div style={{ padding: '16px', background: '#ffffff', borderRadius: '6px', border: '1px solid var(--wig-border-soft)', color: '#333', fontSize: '14px', fontFamily: 'Arial, sans-serif', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: bodyText }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={save} disabled={saving} style={{ padding: '6px 16px', borderRadius: '6px', fontSize: '12px', cursor: saving ? 'default' : 'pointer', border: '1px solid rgba(27,146,84,0.4)', background: 'rgba(27,146,84,0.12)', color: '#1b9254', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
            {savedMsg && <span style={{ fontSize: '12px', color: '#1b9254', fontWeight: 600 }}>{savedMsg}</span>}
            {err && <span style={{ fontSize: '12px', color: '#d93025', fontWeight: 600 }}>{err}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
