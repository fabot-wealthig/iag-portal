import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { applyThemeForCurrentRoute } from './lib/theme'
import './styles.css'

// paste the project DSN here — public ingest address, safe in code (VFO does
// the same); empty keeps Sentry off
const SENTRY_DSN = ''

// Error monitoring only. No Session Replay (it would record the DOM and inputs,
// which on this portal means client PII) and no performance tracing.
// enabled: PROD only — a `npm run dev` session would otherwise report every
// hot-reload error of half-written code, tagged environment=production. Vite
// sets PROD in `vite build`, which is what `npm run deploy` ships.
// ignoreErrors: browser-extension fetch noise surfaced through Sentry's own
// breadcrumb wrapper, misattributed to the app bundle.
Sentry.init({
  dsn: SENTRY_DSN,
  environment: 'production',
  enabled: import.meta.env.PROD && SENTRY_DSN !== '',
  ignoreErrors: [/non ISO-8859-1 code point/],
})

// SPA deep-link restore. public/404.html stashed the originally requested path
// here before bouncing to "/"; put it back into the address bar BEFORE the
// router mounts, so the router reads the real route on its first render.
const redirect = sessionStorage.getItem('iag_redirect')
if (redirect) {
  sessionStorage.removeItem('iag_redirect')
  window.history.replaceState(null, '', '/' + redirect)
}

// After the restore above, so a deep link straight into /portal reads the real
// path and doesn't flash light before the portal shell mounts.
applyThemeForCurrentRoute()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename="/">
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
