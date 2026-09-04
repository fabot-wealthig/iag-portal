import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { TrackHero } from './shared/TrackKit'
import { ProfileTabSkeleton } from './shared/Skeleton'
import { ownerChipStyle } from './PaymentDetail'

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const emptyTitleStyle = { fontSize: '14px', fontWeight: 700, color: 'var(--wig-heading)', marginBottom: '8px' }
const emptyBodyStyle = { fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0, lineHeight: 1.6 }
// The same dropdown the payment detail's "Add admin…" uses, so the two
// recipient controls read as one idea in two places.
const selectStyle = { padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-muted)', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', maxWidth: '280px' }
const labelStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)', marginBottom: '6px' }
const saveButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#1D64A8', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const resetButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }

const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

/**
 * One rule's card: the switch, what it means, and who hears it on top of the
 * people the payment already names.
 *
 * The card holds its OWN draft state and its own Save, rather than the panel
 * holding one big form: these twelve switches are unrelated to each other, and
 * a single Save would make an admin who flipped one toggle responsible for
 * eleven others they never looked at.
 */
function RuleCard({ rule, admins, onSaved }) {
  const [enabled, setEnabled] = useState(rule.enabled !== false)
  const [recipients, setRecipients] = useState(() =>
    Array.isArray(rule.extra_recipients) ? rule.extra_recipients.map(String) : [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const savedRecipients = Array.isArray(rule.extra_recipients) ? rule.extra_recipients.map(String) : []
  const dirty = enabled !== (rule.enabled !== false) || !sameList(recipients, savedRecipients)

  const chosen = new Set(recipients.map(e => e.toLowerCase()))
  const available = admins.filter(a => !chosen.has(String(a.email).toLowerCase()))
  const nameOf = email => admins.find(a => String(a.email).toLowerCase() === String(email).toLowerCase())?.name || email

  function change(fn) {
    setSaved(false)
    setError('')
    fn()
  }

  async function save() {
    setSaving(true); setError(''); setSaved(false)
    try {
      const data = await callApi('save_notification_rule', {
        key: rule.key,
        enabled,
        extra_recipients: recipients,
      })
      // The server answers with the stored row — including the roster's spelling
      // of each address — so both the card and the panel are re-seeded from what
      // was saved rather than from what was typed. Without this the card would
      // still read as dirty whenever the server normalised an address.
      if (data.rule) {
        onSaved(data.rule)
        setEnabled(data.rule.enabled !== false)
        setRecipients(Array.isArray(data.rule.extra_recipients) ? data.rule.extra_recipients.map(String) : [])
      }
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    change(() => {
      setEnabled(rule.enabled !== false)
      setRecipients(savedRecipients)
    })
  }

  return (
    <div style={sectionStyle}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '8px' }}>
        <input type="checkbox" checked={enabled} disabled={saving}
          onChange={() => change(() => setEnabled(v => !v))}
          style={{ accentColor: '#1D64A8', cursor: 'pointer' }} />
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--wig-heading)' }}>{rule.label}</span>
        {!enabled && (
          <span style={{ ...ownerChipStyle, color: '#EE6A33', borderColor: 'rgba(238,106,51,0.35)' }}>Off</span>
        )}
      </label>
      {rule.description && (
        <p style={{ ...emptyBodyStyle, marginBottom: '18px' }}>{rule.description}</p>
      )}

      <div style={labelStyle}>Also notify</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        {recipients.length === 0 && (
          <span style={{ fontSize: '13px', color: 'var(--wig-muted)' }}>
            Nobody extra — the payment&rsquo;s tax planner and its recipients always hear this.
          </span>
        )}
        {recipients.map(email => (
          <span key={email} style={{ ...ownerChipStyle, fontSize: '12px', padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {nameOf(email)}
            <button type="button" disabled={saving} aria-label={`Remove ${nameOf(email)}`}
              onClick={() => change(() => setRecipients(list => list.filter(e => e !== email)))}
              style={{ border: 'none', background: 'transparent', color: 'var(--wig-muted)', fontSize: '14px', lineHeight: 1, padding: 0, cursor: saving ? 'not-allowed' : 'pointer' }}>×</button>
          </span>
        ))}
      </div>
      {/* Always value="" — the select is an ADD button wearing a dropdown, so it
          never holds a selection of its own. */}
      <select
        value=""
        disabled={saving || available.length === 0}
        onChange={e => { const v = e.target.value; if (v) change(() => setRecipients(list => [...list, v])) }}
        style={{ ...selectStyle, cursor: (saving || available.length === 0) ? 'not-allowed' : 'pointer' }}>
        <option value="">{available.length === 0 ? 'All admins added' : 'Add admin…'}</option>
        {available.map(a => <option key={a.email} value={a.email}>{a.name}</option>)}
      </select>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '18px' }}>
        <button onClick={save} disabled={saving || !dirty}
          style={{ ...saveButtonStyle, opacity: (saving || !dirty) ? 0.5 : 1, cursor: (saving || !dirty) ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        {dirty && !saving && (
          <button onClick={reset} style={resetButtonStyle}>Reset</button>
        )}
        {saved && <span style={{ fontSize: '13px', color: '#1b9254', fontWeight: 600 }}>Saved.</span>}
        {error && <span style={{ fontSize: '13px', color: '#d93025' }}>{error}</span>}
      </div>
    </div>
  )
}

/**
 * Automation & Config → Notification Editor: the twelve in-portal bell events,
 * each switchable and each able to name extra admins.
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

  function applySaved(rule) {
    setRules(list => list.map(r => r.key === rule.key ? { ...r, ...rule } : r))
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

  return (
    <div>
      <TrackHero eyebrow="Automation & Config" title="Notification Editor" />
      <p style={{ fontSize: '13px', color: 'var(--wig-muted)', margin: '0 0 24px', lineHeight: 1.6 }}>
        Each of these is an in-portal bell notification — nothing here sends email. A payment&rsquo;s <strong>tax
        planner</strong> and its <strong>notification recipients</strong> always hear about it; the <em>Also notify</em> list
        adds admins who should hear that event on <strong>every</strong> payment. Untick an event to switch it off entirely.
      </p>

      {error && <div style={{ color: '#d93025', fontWeight: 500, fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

      {rules.length === 0 && !error ? (
        <div style={sectionStyle}>
          <div style={emptyTitleStyle}>No notification rules</div>
          <p style={emptyBodyStyle}>Nothing is wired to the bell yet.</p>
        </div>
      ) : (
        // Keyed by the rule key alone: a save must NOT remount the card, or the
        // "Saved." it just earned would be thrown away with its state.
        rules.map(rule => (
          <RuleCard key={rule.key} rule={rule} admins={admins} onSaved={applySaved} />
        ))
      )}
    </div>
  )
}
