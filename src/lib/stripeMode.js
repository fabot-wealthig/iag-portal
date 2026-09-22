// A tiny frontend copy of the Stripe-mode rule so a screen can SAY which mode
// something is in. The authority is the backend's
// `supabase/functions/iag-admin-api/utils/stripe-mode.ts` — that file decides
// which key moves the money, and this one only decides which chip is drawn. If
// the two ever disagree, the backend is right.
//
// Jake's rule (2026-09-22): each COI has a `sandbox` toggle on their profile
// (members.sandbox, default off). A sandbox COI's Connect account and every
// payment and receipt for their clients are sandbox; a client inherits their
// COI's mode. Names no longer matter.

/** True only for a literal `true`, the same discipline as the backend's modeForCoi. */
export function isSandboxCoi(member) {
  return member?.sandbox === true
}

// The Sandbox chip: orange on the portal's tint, the shape of `ownerChipStyle`
// in PaymentDetail.jsx so it sits alongside the portal's other chips.
export const sandboxChipStyle = {
  fontSize: '10px',
  padding: '2px 8px',
  borderRadius: '999px',
  background: 'var(--wig-tint)',
  border: '1px solid var(--wig-border-chip)',
  color: '#EE6A33',
  fontWeight: 600,
  whiteSpace: 'nowrap',
}
