const toggleNoteStyle = { fontSize: '12.5px', color: 'var(--wig-faint)', margin: '6px 0 0 21px' }
const lockedValueStyle = { fontSize: '11px', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--wig-border-chip)', background: 'var(--wig-tint)' }

// An entity's Stripe mode toggle (members.sandbox, payees.sandbox). `locked` is
// for one that already has a Connect account: it exists in one Stripe mode only,
// and update_coi / save_payee refuse to move the toggle out from under it. The
// notes default to the COI wording; the Payees panel passes its own.
//
// A locked value is SAID IN WORDS beside the box: a disabled checkbox is drawn
// so faintly that a ticked one reads as empty (Jake, 2026-09-22).
export default function SandboxToggle({
  checked,
  onChange,
  locked = false,
  style,
  note = "Stripe test mode for this COI and every one of their clients' payments. No real money moves.",
  lockedNote = 'Locked: a Stripe payout account already exists for this COI.',
}) {
  return (
    <div style={style}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: 'var(--wig-ink)', cursor: locked ? 'not-allowed' : 'pointer' }}>
        <input type="checkbox" checked={checked} disabled={locked} onChange={e => onChange(e.target.checked)}
          style={{ accentColor: '#1D64A8', cursor: locked ? 'not-allowed' : 'pointer' }} />
        Sandbox
        {locked && (
          <span style={{ ...lockedValueStyle, color: checked ? '#EE6A33' : 'var(--wig-muted)' }}>
            {checked ? 'On' : 'Off'} · locked
          </span>
        )}
      </label>
      <p style={toggleNoteStyle}>{note}</p>
      {locked && <p style={toggleNoteStyle}>{lockedNote}</p>}
    </div>
  )
}
