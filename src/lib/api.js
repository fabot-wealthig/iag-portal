// The single place that knows where the backend lives and how to talk to it.
// No environment variables: the Supabase project URL and the anon key are both
// public values (the anon key is a signed JWT that grants nothing on its own —
// every table is deny-all RLS and the edge function is the security boundary),
// so shipping them in the bundle is deliberate and keeps the build config empty.

const SUPABASE_URL = 'https://gqznnyccridnpipjipeq.supabase.co'
const FUNCTION_NAME = 'iag-admin-api'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxem5ueWNjcmlkbnBpcGppcGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMjUwMjUsImV4cCI6MjEwMjkwMTAyNX0.b2HGV98NGmThzJhYSBChO4PMa4bs9mo3QlIbWFvbSEM'

const EDGE_URL = `${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`

const SESSION_KEY = 'iag_session'
const REQUEST_TIMEOUT_MS = 20000
const RETRY_DELAY_MS = 1000

// An action is an idempotent READ if it matches one of the load-style naming
// conventions (load_*, *_load_*, *_load). Reads are safe to re-run, so they get
// exactly one automatic retry when the request never produced a response — a
// cold-starting function is the common cause. Writes NEVER retry: the server may
// already have processed the first attempt, and a retry would double-write.
function isReadAction(action) {
  return !!action && /^load_|_load(_|$)/.test(action)
}

// A 401 on a login action means "wrong credentials", not "expired session" — it
// must render inline on the login form instead of bouncing the browser.
const LOGIN_ACTIONS = ['admin_login']

/**
 * POSTs { action, token, ...payload } to the edge function.
 *
 * Throws an Error on any failure. The parsed response body, when there was one,
 * is attached as `err.data` so a caller can read a `state` field (e.g. the
 * /set-password page's `passcode_invalid`) without re-parsing the message.
 */
export async function callApi(action, payload = {}) {
  const maxAttempts = isReadAction(action) ? 2 : 1

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const session = getSession()
    let reachedServer = false
    let timedOut = false
    const controller = new AbortController()
    const timeoutId = setTimeout(() => { timedOut = true; controller.abort() }, REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ action, token: session?.token, ...payload }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      reachedServer = true

      const data = await res.json().catch(() => ({}))

      if (res.status === 401) {
        if (LOGIN_ACTIONS.includes(action)) throw apiError(data.error || 'Invalid credentials', data)
        // Anything else with a 401 is a dead session: drop it and go back to the
        // login page with a full page load, so no stale React state survives.
        clearSession()
        window.location.href = window.location.origin + '/'
        throw apiError('Session expired — please log in again.', data)
      }

      if (!res.ok) throw apiError(data.error || 'Request failed', data)
      return data
    } catch (err) {
      clearTimeout(timeoutId)

      // The request produced a response — the server has seen it. Never retry,
      // whatever went wrong afterwards.
      if (reachedServer) throw err

      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
        continue
      }
      if (timedOut) {
        throw apiError(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Please try again.`)
      }
      throw apiError('Could not reach the server. Please check your connection and try again.')
    }
  }
}

function apiError(message, data) {
  const err = new Error(message)
  if (data) err.data = data
  return err
}

// ─── Session ───────────────────────────────────────────────────────────
// sessionStorage, not localStorage: the session dies with the browser tab.

export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

/**
 * Stores the session. The stored object is an explicit WHITELIST, not a copy of
 * the login response — a new server-side field is invisible to the app until it
 * is named here, and nothing unexpected ends up in browser storage.
 */
export function setSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    token: session.token,
    name: session.name,
    email: session.email,
    is_superadmin: session.is_superadmin === true,
    // Which secondary portal tabs this admin was granted. Always an array so
    // the nav gate never has to guard against a missing field; a superadmin
    // bypasses it entirely.
    allowed_tabs: Array.isArray(session.allowed_tabs) ? session.allowed_tabs : [],
  }))
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}
