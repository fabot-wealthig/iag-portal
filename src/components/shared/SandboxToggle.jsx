const toggleNoteStyle = { fontSize: '12.5px', color: 'var(--wig-faint)', margin: '6px 0 0 21px' }

// An entity's Stripe mode toggle (members.sandbox, payees.sandbox). `locked` is
// for one that already has a Connect account: it exists in one Stripe mode only,
// and update_coi / save_payee refuse to move the toggle out from under it. The
// notes default to the COI wording; the Payees panel passes its own.
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
      <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: 'var(--wig-ink)', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.6 : 1 }}>
        <input type="checkbox" checked={checked} disabled={locked} onChange={e => onChange(e.target.checked)}
          style={{ accentColor: '#1D64A8', cursor: locked ? 'not-allowed' : 'pointer' }} />
        Sandbox
      </label>
      <p style={toggleNoteStyle}>{note}</p>
      {locked && <p style={toggleNoteStyle}>{lockedNote}</p>}
    </div>
  )
}
