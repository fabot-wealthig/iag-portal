// The emailed "Review Request" link (/inter-company-transfers?request=<id>), carried
// through sign-in to Accounting → VFOS IAG Inter-Company Transfer. An email opens a new
// tab, which has no session (sessionStorage), so the person usually signs in on the way:
// the link is kept until the request has actually loaded, so an expired session on the
// way there sends them back through sign-in and still lands on it.

const PENDING_KEY = 'iag_pending_intercompany'
export const INTERCOMPANY_SELECTED_KEY = 'wigIntercompanySelected'

export function saveIntercompanyLink(requestId) {
  sessionStorage.setItem(PENDING_KEY, String(requestId || ''))
}

export function clearIntercompanyLink() {
  sessionStorage.removeItem(PENDING_KEY)
}

/** Points the portal's navigation keys at the linked request. Does nothing with no link. */
export function applyIntercompanyLink() {
  const id = sessionStorage.getItem(PENDING_KEY)
  if (id === null) return false
  sessionStorage.setItem('wigActiveTab', 'accounting')
  sessionStorage.setItem('wigAccountingSection', 'intercompany')
  if (id) sessionStorage.setItem(INTERCOMPANY_SELECTED_KEY, id)
  return true
}
