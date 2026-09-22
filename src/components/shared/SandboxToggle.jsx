const toggleNoteStyle = { fontSize: '12.5px', color: 'var(--wig-faint)', margin: '6px 0 0 21px' }

// An entity's Stripe mode toggle (members.sandbox, payees.sandbox). `locked` is
// for one that already has a Connect account: it exists in one Stripe mode only,
// and update_coi / save_payee refuse to move the toggle out from under it. The
// notes default to the COI wording; the Payees panel passes its own.
//
// A LOCKED box is drawn by hand. The browser greys a disabled native checkbox
// so far that a ticked one reads as empty (Jake, 2026-09-22); this one stays a
// solid blue square with a white tick when on, an empty bordered square when off.
function LockedBox({ checked }) {
  return (
    <span role="checkbox" aria-checked={checked} aria-disabled="true"
      style={{ width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', background: checked ? '#1D64A8' : 'var(--wig-input)', border: checked ? '1px solid #1D64A8' : '1px solid var(--wig-border-strong)' }}>
      {checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <polyline points="1.8,5.2 4,7.4 8.4,2.6" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

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
        {locked
          ? <LockedBox checked={!!checked} />
          : <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
              style={{ margin: 0, width: '14px', height: '14px', accentColor: '#1D64A8', cursor: 'pointer' }} />}
        Sandbox
      </label>
      <p style={toggleNoteStyle}>{note}</p>
      {locked && <p style={toggleNoteStyle}>{lockedNote}</p>}
    </div>
  )
}
