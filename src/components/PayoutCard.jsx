import { useState } from 'react'
import { callApi } from '../lib/api'
import PayoutPill from './shared/PayoutPill'
import {
  describePayoutEvent, moneyText, payDateLong, payDateShort, relativeDay,
  PAYOUT_BLUE, PAYOUT_GREEN, PAYOUT_ORANGE, PAYOUT_RED, TRANSFER_KIND_LABEL, whenText,
} from '../lib/payoutText'

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const labelStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--wig-faint)', marginBottom: '8px' }
const primaryButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: 'none', background: PAYOUT_BLUE, color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const outlineButtonStyle = { padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const textareaStyle = { width: '100%', boxSizing: 'border-box', minHeight: '64px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '13px', fontFamily: 'Inter, sans-serif', resize: 'vertical' }
const chipStyle = (color) => ({ fontSize: '11px', fontWeight: 600, color, background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', borderRadius: '999px', padding: '2px 9px', whiteSpace: 'nowrap' })

const STATE_CHIP = {
  'Awaiting Payout Account': { label: 'No payout account', color: PAYOUT_ORANGE },
  Failed: { label: 'Failed', color: PAYOUT_RED },
}

// The server's own words for the three transfers, and where each one's amount,
// state and recipient live on the payment row.
function transferLine(payment, kind) {
  if (kind === 'rev_share') {
    return { kind, amount: payment.coi_share_amount, state: payment.rev_paid, to: 'the COI' }
  }
  return {
    kind,
    amount: payment[`${kind}_amount`],
    state: payment[`${kind}_paid`],
    to: payment[`${kind}_payee_name`] || (kind === 'legal_fee' ? 'the legal firm' : 'the admin-fee payee'),
  }
}

// What already went out, for a payment the schedule has nothing left to send.
function paidLines(payment) {
  const out = []
  if (payment.rev_paid === 'succeeded') out.push({ kind: 'rev_share', amount: payment.coi_share_amount, at: payment.rev_completed_at, to: 'the COI' })
  for (const kind of ['legal_fee', 'admin_fee']) {
    if (payment[`${kind}_paid`] === 'succeeded') {
      out.push({ kind, amount: payment[`${kind}_amount`], at: payment[`${kind}_paid_at`], to: payment[`${kind}_payee_name`] || 'the payee' })
    }
  }
  return out
}

/**
 * The Payout card on a payment: WHEN its money goes out, what goes, whether
 * anything changed that date, and the two manual controls — Pay now and Hold /
 * Release. Every write answers the whole payment detail, handed to `onApply`,
 * so the card and the steps above it re-render from one payload.
 *
 * Writes are never retried (lib/api.js), and each asks for a confirmation
 * first: these are the controls that move or stop money.
 */
export default function PayoutCard({ payment, admins = [], onApply }) {
  const payout = payment.payout || {}
  const history = payout.history || []
  const [mode, setMode] = useState(null) // 'pay_now' | 'hold' | 'release'
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const nameByEmail = new Map(admins.map(a => [String(a.email).toLowerCase(), a.name]))
  const nameOf = (email) => nameByEmail.get(String(email || '').toLowerCase()) || email || 'an admin'

  const status = payout.status || null
  const pending = (payout.pending || []).map(k => transferLine(payment, k))
  const pendingTotal = pending.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const firstScheduled = history.find(e => e.event === 'scheduled')
  const moved = status && firstScheduled && payout.due_on && String(firstScheduled.to_date) !== String(payout.due_on).slice(0, 10)
  const today = payout.today || new Date().toISOString().slice(0, 10)

  function openMode(m) { setMode(m); setNote(''); setError(''); setMessage('') }

  async function submit() {
    setBusy(true); setError(''); setMessage('')
    try {
      let res
      if (mode === 'pay_now') {
        // override_hold only when this screen SHOWED the hold: a hold another
        // admin placed since the load is a 409 from the server, never wiped.
        res = await callApi('pay_payout_now', { payment_id: payment.id, reason: note.trim() || undefined, override_hold: status === 'on_hold' }, { timeoutMs: 60000 })
        const o = res.pay_now || {}
        const problems = []
        if (o.rev_share?.error) problems.push(`COI share: ${o.rev_share.error}`)
        for (const [k, v] of Object.entries(o.hard_costs || {})) if (v?.error) problems.push(`${TRANSFER_KIND_LABEL[k]}: ${v.error}`)
        if (problems.length) setError(`Pay now ran, but not everything went through. ${problems.join(' ')}`)
        else setMessage('Paid now. The transfers were sent and are listed below.')
      } else if (mode === 'hold') {
        if (!note.trim()) { setError('Please give a reason for the hold.'); setBusy(false); return }
        res = await callApi('set_payout_hold', { payment_id: payment.id, hold: true, reason: note.trim() })
        setMessage('On hold. Nothing on this payment will be paid until the hold is released.')
      } else if (mode === 'release') {
        res = await callApi('set_payout_hold', { payment_id: payment.id, hold: false, reason: note.trim() || undefined })
        setMessage(`Hold released. This payment now pays ${payDateLong(res?.payment?.payout?.due_on)}.`)
      }
      if (res) onApply(res)
      setMode(null); setNote('')
    } catch (err) {
      // A write — never retried, and the server's wording is what shows.
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={sectionStyle}>
      <div style={{ ...eyebrowStyle, display: 'flex', alignItems: 'center', gap: '10px' }}>
        Payout
        {/* The same pill every grid shows for this payment. */}
        {payout.due_on && (
          <PayoutPill row={{
            ...payment,
            cleared: true,
            share_payout: status === 'scheduled' || status === 'on_hold' ? status : null,
            payout_due_on: payout.due_on,
          }} />
        )}
      </div>

      {/* ─── The headline: when ─────────────────────────────────────────── */}
      {!payout.due_on ? (
        <p style={{ fontSize: '14px', color: 'var(--wig-muted)', margin: 0 }}>
          No pay date yet. It is set automatically the moment this payment clears, from the payout schedule.
        </p>
      ) : status === 'on_hold' ? (
        <div style={{ background: 'rgba(238,106,51,0.08)', border: `1px solid rgba(238,106,51,0.35)`, borderRadius: '12px', padding: '14px 16px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: PAYOUT_ORANGE }}>On hold. Nothing will be paid until the hold is released.</div>
          <div style={{ fontSize: '13px', color: 'var(--wig-ink)', marginTop: '6px' }}>
            Held by {nameOf(payout.hold_by)} on {whenText(payout.hold_at)}{payout.hold_reason ? <>: <em>"{payout.hold_reason}"</em></> : null}
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--wig-muted)', marginTop: '6px' }}>
            Its pay date was {payDateLong(payout.due_on)}. On release it keeps that date if it is still ahead; otherwise it moves to the next pay date.
          </div>
        </div>
      ) : status === 'scheduled' ? (
        <div>
          <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--wig-heading)' }}>
            Pays {payDateLong(payout.due_on)}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--wig-muted)', marginTop: '4px' }}>
            {relativeDay(payout.due_on, today)}, automatically, in the 6:00 AM Eastern run.
            {payout.cleared_on && <> Cleared {payDateShort(payout.cleared_on)}.</>}
          </div>
        </div>
      ) : status === 'due' ? (
        <div>
          <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: PAYOUT_GREEN }}>
            Due now
          </div>
          <div style={{ fontSize: '13px', color: 'var(--wig-muted)', marginTop: '4px' }}>
            Its pay date was {payDateLong(payout.due_on)}. It goes out in the next 6:00 AM Eastern run, or use Pay now to send it immediately.
          </div>
        </div>
      ) : (
        <PaidSummary payment={payment} payout={payout} nameOf={nameOf} />
      )}

      {/* ─── A date that moved, said out loud ───────────────────────────── */}
      {moved && (
        <div style={{ marginTop: '12px', fontSize: '13px', color: PAYOUT_ORANGE, fontWeight: 600 }}>
          Date changed: originally scheduled for {payDateLong(firstScheduled.to_date)}. The history below shows who changed it and why.
        </div>
      )}

      {/* ─── What goes out ──────────────────────────────────────────────── */}
      {status && pending.length > 0 && (
        <div style={{ marginTop: '18px' }}>
          <div style={labelStyle}>What will be paid</div>
          {pending.map(l => (
            <div key={l.kind} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--wig-border-soft)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: 'var(--wig-ink)', flex: 1, minWidth: '160px' }}>
                {TRANSFER_KIND_LABEL[l.kind]} to {l.to}
              </span>
              {STATE_CHIP[l.state] && <span style={chipStyle(STATE_CHIP[l.state].color)}>{STATE_CHIP[l.state].label}</span>}
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--wig-ink)' }}>{l.amount == null ? '—' : `$${moneyText(l.amount)}`}</span>
            </div>
          ))}
        </div>
      )}

      {/* ─── The two controls ───────────────────────────────────────────── */}
      {status && pending.length > 0 && mode === null && (
        <div style={{ display: 'flex', gap: '10px', marginTop: '18px', flexWrap: 'wrap' }}>
          <button type="button" style={primaryButtonStyle} onClick={() => openMode('pay_now')}>Pay now</button>
          {status === 'on_hold'
            ? <button type="button" style={outlineButtonStyle} onClick={() => openMode('release')}>Release hold</button>
            : <button type="button" style={outlineButtonStyle} onClick={() => openMode('hold')}>Put on hold</button>}
        </div>
      )}

      {mode && (
        <div style={{ marginTop: '18px', padding: '16px', borderRadius: '12px', border: '1px solid var(--wig-border-mid)', background: 'var(--wig-tint)' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--wig-heading)', marginBottom: '6px' }}>
            {mode === 'pay_now' && `Send $${moneyText(pendingTotal)} now?`}
            {mode === 'hold' && 'Put this payout on hold?'}
            {mode === 'release' && 'Release the hold?'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--wig-ink)', marginBottom: '10px' }}>
            {mode === 'pay_now' && <>This sends {pending.map(l => `${TRANSFER_KIND_LABEL[l.kind].toLowerCase()} to ${l.to}`).join(', ')} immediately{status === 'scheduled' ? `, instead of on ${payDateLong(payout.due_on)}` : ''}{status === 'on_hold' ? ' and lifts the hold' : ''}. It cannot be undone.</>}
            {mode === 'hold' && <>Nothing on this payment will be paid, on {payDateShort(payout.due_on)} or any later run, until someone releases the hold. A reason is required.</>}
            {mode === 'release' && <>It will pay on {payDateLong(payout.due_on)} if that date is still ahead; if it has passed, on the next pay date after today.</>}
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500}
            placeholder={mode === 'hold' ? 'Reason for the hold (required)' : 'Note (optional)'}
            style={textareaStyle} />
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="button" disabled={busy} onClick={submit}
              style={{ ...primaryButtonStyle, background: mode === 'hold' ? PAYOUT_ORANGE : PAYOUT_BLUE, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
              {busy ? 'Working...' : mode === 'pay_now' ? 'Yes, pay now' : mode === 'hold' ? 'Place hold' : 'Release hold'}
            </button>
            <button type="button" disabled={busy} onClick={() => setMode(null)} style={outlineButtonStyle}>Cancel</button>
          </div>
        </div>
      )}

      {message && <p style={{ color: PAYOUT_GREEN, fontSize: '13px', marginTop: '12px', marginBottom: 0 }}>{message}</p>}
      {error && <p style={{ color: PAYOUT_RED, fontSize: '13px', marginTop: '12px', marginBottom: 0 }}>{error}</p>}

      {/* ─── Every date it was given, and every change ──────────────────── */}
      {history.length > 0 && (
        <div style={{ marginTop: '22px' }}>
          <div style={labelStyle}>Payout history</div>
          {history.map(e => (
            <div key={e.id} style={{ display: 'flex', gap: '14px', padding: '7px 0', borderBottom: '1px solid var(--wig-border-soft)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--wig-muted)', width: '150px', flexShrink: 0 }}>{whenText(e.created_at)}</span>
              <span style={{ fontSize: '13px', color: e.event === 'held' ? PAYOUT_ORANGE : 'var(--wig-ink)', flex: 1, minWidth: '220px' }}>
                {describePayoutEvent(e, nameOf)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// The headline once the schedule has nothing left to send: what went out and
// when, or why nothing ever needed to.
function PaidSummary({ payment, payout, nameOf }) {
  const lines = paidLines(payment)
  if (lines.length === 0) {
    const why = payment.coi_paid_via_ert
      ? 'The COI share is paid by ERT outside the portal, so the payout schedule does not apply to it.'
      : payment.rev_paid === 'Not Due'
        ? 'Nothing to pay out: no share was due on this payment.'
        : payment.rev_paid === 'processing'
          ? 'A transfer is in progress right now.'
          : 'Nothing left to pay out on this payment.'
    return <p style={{ fontSize: '14px', color: 'var(--wig-muted)', margin: 0 }}>{why}</p>
  }
  return (
    <div>
      <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: PAYOUT_GREEN }}>Paid</div>
      {payout.early_at && (
        <div style={{ fontSize: '13px', color: PAYOUT_ORANGE, fontWeight: 600, marginTop: '4px' }}>
          Paid early by {nameOf(payout.early_by)} on {whenText(payout.early_at)}.
        </div>
      )}
      <div style={{ marginTop: '10px' }}>
        {lines.map(l => (
          <div key={l.kind} style={{ display: 'flex', gap: '10px', padding: '6px 0', borderBottom: '1px solid var(--wig-border-soft)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: 'var(--wig-ink)', flex: 1, minWidth: '160px' }}>{TRANSFER_KIND_LABEL[l.kind]} to {l.to}</span>
            <span style={{ fontSize: '12.5px', color: 'var(--wig-muted)' }}>sent {whenText(l.at)}</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--wig-ink)' }}>${moneyText(l.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
