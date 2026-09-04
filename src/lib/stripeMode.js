// A tiny frontend copy of the Stripe-mode rule so a screen can SAY which mode
// something is in. The authority is the backend's
// `supabase/functions/iag-admin-api/utils/stripe-mode.ts` — that file decides
// which key moves the money, and this one only decides which chip is drawn. If
// the two ever disagree, the backend is right.
//
// Jake's rule (2026-09-04): anyone with "Test" in their name is sandbox,
// everyone else is live.

/** True when any part, lowercased, contains "test". */
export function isTestName(...parts) {
  return parts.some(p => String(p ?? '').toLowerCase().includes('test'))
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
