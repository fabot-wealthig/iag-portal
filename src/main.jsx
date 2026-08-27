import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { applyThemeForCurrentRoute } from './lib/theme'
import './styles.css'

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
    <BrowserRouter basename="/">
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
