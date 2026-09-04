import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { TrackHero } from './shared/TrackKit'
import { ProfileTabSkeleton } from './shared/Skeleton'

// Notification Editor — the notifications sibling of Email Templates. Every
// in-portal bell notification is a row in notification_rules; this panel edits
// WHO hears it and whether it fires at all.
//
// The audience is named by GENERAL TITLE, not by person. "Tax planner" and
// "Payment recipients" resolve per payment, "All admins" and "Superadmins"
// against today's roster — a role survives somebody joining or leaving, a list
// of individuals does not. A single address stays available as an escape hatch
// for the one-off case. A rule whose recipients are null is on the system
// default; anything else REPLACES that default, and Reset to default puts the
// null back.

// The four groups a payment travels through, in that order. Any area the
// backend adds later still renders, sorted, after these.
const AREA_ORDER = ['Payment request', 'Payment', 'Paperwork', 'Revenue share']

// Mirrors constants/notification-tokens.ts on the backend, which is the one
// authority for what may be stored and resolved. A token in one and not the
// other is a bug, so they change together.
const AUDIENCES = [
  { value: 'TAX_PLANNER', label: 'Tax planner', hint: 'the admin who earns on that payment' },
  { value: 'PAYMENT_RECIPIENTS', label: 'Payment recipients', hint: 'everyone named on that payment' },
  { value: 'ALL_ADMINS', label: 'All admins', hint: 'the whole roster' },
  { value: 'SUPERADMINS', label: 'Superadmins', hint: 'every superadmin' },
]
const TOKEN_LABELS = Object.fromEntries(AUDIENCES.map(a => [a.value, a.label]))

/** Matches the backend's check and the email templates panel's. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const cardStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '12px', marginBottom: '10px', overflow: 'hidden' }
const groupStyle = { marginBottom: '12px', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', overflow: 'hidden', background: 'var(--wig-card)', boxShadow: 'var(--wig-shadow-card)' }
const emptyBodyStyle = { fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0, lineHeight: 1.6 }
const controlStyle = { padding: '7px 11px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '12.5px', fontFamily: 'Inter, sans-serif' }
const saveButtonStyle = { padding: '7px 18px', borderRadius: '8px', border: 'none', background: '#1D64A8', color: '#fff', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const resetButtonStyle = { padding: '7px 18px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const countBadgeStyle = { fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', color: 'var(--wig-muted)' }

/** An audience shows as its title; an address shows as the person, then the address. */
function recipientLabel(value, adminsByEmail) {
  if (TOKEN_LABELS[value]) return TOKEN_LABELS[value]
  const admin = adminsByEmail[String(value).toLowerCase()]
  return admin ? `${admin.name} (${value})` : String(value)
}

/** null / [] both mean "unedited"; anything else is an override. */
const overrideOf = rule => (Array.isArray(rule.recipients) && rule.recipients.length > 0 ? rule.recipients.map(String) : null)
const defaultsOf = rule => (Array.isArray(rule.default_recipients) ? rule.default_recipients.map(String) : [])

/**
 * One rule's card: collapsed it is a line — what the event is, who hears it,
 * whether it has been edited; expanded it is the audience editor.
 *
 * The card holds its OWN draft and its own Save, rather than the panel holding
 * one big form: these twelve switches are unrelated to each other, and a single
 * Save would make an admin who flipped one toggle responsible for eleven others
 * they never looked at.
 */
function RuleCard({ rule, admins, adminsByEmail, onSaved }) {
  const [expanded, setExpanded] = useState(false)
  const override = overrideOf(rule)
  const defaults = defaultsOf(rule)
  const [recipients, setRecipients] = useState(override ?? defaults)
  const [enabled, setEnabled] = useState(rule.enabled !== false)
  const [customEmail, setCustomEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedMsg, setSavedMsg] = useState('')

  const effective = override ?? defaults
  const disabled = rule.enabled === false

  function addRecipient(value) {
    const v = String(value || '').trim()
    if (!v || recipients.includes(v)) return
    setError('')
    setSavedMsg('')
    setRecipients([...recipients, v])
  }

  function addCustom() {
    const email = customEmail.trim().toLowerCase()
    if (!email) return
    if (!EMAIL_RE.test(email)) { setError('Enter a valid email'); return }
    addRecipient(email)
    setCustomEmail('')
  }

  async function save(resetToDefault) {
    setSaving(true); setError(''); setSavedMsg('')
    try {
      const data = await callApi('save_notification_rule', {
        key: rule.key,
        enabled,
        recipients: resetToDefault ? null : recipients,
      })
      // The server answers with the stored row — including the roster's
      // spelling of each address and a NULL where the override was reset — so
      // the card re-seeds from what was saved rather than from what was typed.
      if (data.rule) {
        onSaved(data.rule)
        setEnabled(data.rule.enabled !== false)
        setRecipients(overrideOf(data.rule) ?? defaultsOf(data.rule))
      }
      setSavedMsg(resetToDefault ? 'Reset to default' : 'Saved')
      setTimeout(() => setSavedMsg(''), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ ...cardStyle, opacity: disabled ? 0.6 : 1 }}>
      <div onClick={() => setExpanded(v => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 16px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '10px', color: 'var(--wig-faint)', flexShrink: 0, display: 'inline-block', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▼</span>
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--wig-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rule.label}</span>
          {disabled && <span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.5px', color: '#d93025', flexShrink: 0 }}>OFF</span>}
        </div>
        <div style={{ fontSize: '11.5px', color: 'var(--wig-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '46%' }}>
          {effective.map(r => recipientLabel(r, adminsByEmail)).join(', ') || 'nobody'}
          {override && <span style={{ color: '#EE6A33', fontWeight: 700 }}> · edited</span>}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--wig-border-soft)' }}>
          {rule.description && <p style={{ ...emptyBodyStyle, margin: '12px 0 14px' }}>{rule.description}</p>}

          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)', marginBottom: '8px' }}>
            Recipients {override ? '(custom)' : '(system default)'}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {recipients.length === 0 && (
              <span style={{ fontSize: '12.5px', color: 'var(--wig-muted)', fontStyle: 'italic' }}>
                None — saving like this restores the system default
              </span>
            )}
            {recipients.map(r => {
              const isToken = Boolean(TOKEN_LABELS[r])
              return (
                <span key={r} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600,
                  padding: '3px 10px', borderRadius: '999px', whiteSpace: 'nowrap',
                  background: isToken ? 'var(--wig-tint)' : 'transparent',
                  border: `1px solid ${isToken ? 'var(--wig-border-chip)' : 'var(--wig-border-mid)'}`,
                  color: isToken ? 'var(--wig-primary)' : 'var(--wig-muted)',
                }}>
                  {recipientLabel(r, adminsByEmail)}
                  <button type="button" title="Remove" aria-label={`Remove ${recipientLabel(r, adminsByEmail)}`} disabled={saving}
                    onClick={() => { setSavedMsg(''); setRecipients(list => list.filter(x => x !== r)) }}
                    style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px', lineHeight: 1, padding: 0, opacity: 0.8 }}>×</button>
                </span>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Always value="" — the select is an ADD button wearing a dropdown,
                so it never holds a selection of its own. */}
            <select value="" disabled={saving}
              onChange={e => { if (e.target.value) addRecipient(e.target.value) }}
              style={{ ...controlStyle, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              <option value="">Add recipient…</option>
              <optgroup label="Audiences">
                {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label} — {a.hint}</option>)}
              </optgroup>
              <optgroup label="Admins">
                {admins.map(a => <option key={a.email} value={a.email}>{a.name} ({a.email})</option>)}
              </optgroup>
            </select>
            <input value={customEmail} placeholder="or any email…" disabled={saving}
              onChange={e => { setCustomEmail(e.target.value); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
              style={{ ...controlStyle, width: '200px' }} />
            <button type="button" onClick={addCustom} disabled={saving}
              style={{ ...resetButtonStyle, padding: '7px 14px', color: 'var(--wig-primary)', borderColor: 'var(--wig-border-mid)', cursor: saving ? 'not-allowed' : 'pointer' }}>Add</button>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--wig-faint)', marginTop: '8px' }}>
            Default: {defaults.map(r => recipientLabel(r, adminsByEmail)).join(', ') || 'nobody'}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--wig-ink)', cursor: 'pointer', margin: '16px 0 14px' }}>
            <input type="checkbox" checked={enabled} disabled={saving}
              onChange={e => { setSavedMsg(''); setEnabled(e.target.checked) }}
              style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
            Enabled
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={() => save(false)} disabled={saving}
              style={{ ...saveButtonStyle, opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => save(true)} disabled={saving}
              style={{ ...resetButtonStyle, opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
              Reset to default
            </button>
            {savedMsg && <span style={{ fontSize: '12.5px', color: '#1b9254', fontWeight: 600 }}>{savedMsg}</span>}
            {error && <span style={{ fontSize: '12.5px', color: '#d93025', fontWeight: 600 }}>{error}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Automation & Config → Notification Editor: the twelve in-portal bell events,
 * grouped by the stage of the payment they belong to.
 *
 * The rules are seeded by migration and never created here — a rule the backend
 * does not fire would be a switch that does nothing — so this panel edits, and
 * only edits.
 */
export default function NotificationEditorPanel() {
  const [rules, setRules] = useState([])
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openAreas, setOpenAreas] = useState(() => new Set())

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const data = await callApi('load_notification_rules')
      setRules(data.rules || [])
      setAdmins(data.admins || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleArea(area) {
    setOpenAreas(prev => {
      const next = new Set(prev)
      if (next.has(area)) next.delete(area); else next.add(area)
      return next
    })
  }

  function applySaved(rule) {
    setRules(list => list.map(r => (r.key === rule.key ? { ...r, ...rule } : r)))
  }

  if (loading) {
    return (
      <div>
        {/* The hero is already known — only the cards wait on the fetch. */}
        <TrackHero eyebrow="Automation & Config" title="Notification Editor" />
        <ProfileTabSkeleton />
      </div>
    )
  }

  const adminsByEmail = Object.fromEntries(admins.map(a => [String(a.email).toLowerCase(), a]))
  const byArea = {}
  rules.forEach(r => { const a = r.area || 'Other'; (byArea[a] = byArea[a] || []).push(r) })
  const areas = [
    ...AREA_ORDER.filter(a => byArea[a]),
    ...Object.keys(byArea).filter(a => !AREA_ORDER.includes(a)).sort(),
  ]

  return (
    <div>
      <TrackHero eyebrow="Automation & Config" title="Notification Editor" />
      <p style={{ fontSize: '13px', color: 'var(--wig-muted)', margin: '0 0 24px', lineHeight: 1.6 }}>
        Every in-portal bell notification, grouped by the stage of the payment it belongs to — nothing here sends
        email. Expand one to change who hears it or to switch it off. Recipients are named by <strong>title</strong>,
        not by person: <em>Tax planner</em> and <em>Payment recipients</em> resolve per payment, <em>All admins</em> and{' '}
        <em>Superadmins</em> against the current roster, and a single address can be added for the one-off case. A
        custom list <strong>replaces</strong> the default rather than adding to it; edited rules carry an orange marker,
        and <em>Reset to default</em> restores the built-in routing.
      </p>

      {error && <div style={{ color: '#d93025', fontWeight: 500, fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

      {areas.length === 0 && !error && (
        <div style={{ ...groupStyle, padding: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--wig-heading)', marginBottom: '8px' }}>No notification rules</div>
          <p style={emptyBodyStyle}>Nothing is wired to the bell yet.</p>
        </div>
      )}

      {areas.map(area => {
        const rows = byArea[area]
        const open = openAreas.has(area)
        const editedCount = rows.filter(r => overrideOf(r) || r.enabled === false).length
        return (
          <div key={area} style={groupStyle}>
            <div onClick={() => toggleArea(area)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', background: open ? 'var(--wig-tint)' : 'var(--wig-input)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '10px', color: 'var(--wig-primary)', display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--wig-heading)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{area}</span>
                {editedCount > 0 && <span style={{ fontSize: '10px', fontWeight: 700, color: '#EE6A33' }}>{editedCount} edited</span>}
              </div>
              <span style={countBadgeStyle}>{rows.length}</span>
            </div>
            {open && (
              <div style={{ padding: '14px 18px 6px' }}>
                {/* Keyed by the rule key alone: a save must NOT remount the
                    card, or the "Saved" it just earned would be thrown away. */}
                {rows.map(rule => (
                  <RuleCard key={rule.key} rule={rule} admins={admins} adminsByEmail={adminsByEmail} onSaved={applySaved} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
