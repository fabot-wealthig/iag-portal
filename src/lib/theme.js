// Light/dark theme preference. The choice is persisted in localStorage
// (survives browser restarts, unlike the sessionStorage session) and applied as
// a data-theme attribute on <html>, which styles.css uses to swap the --wig-*
// palette.
//
// Dark mode is a SIGNED-IN experience only: the landing page, login page and the
// public set-password link always render light. The portal opts in via
// usePortalTheme(); everything else stays light.
import { useEffect } from 'react'

const KEY = 'wig_theme'

export function getTheme() {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme) } catch { /* private mode — apply without persisting */ }
  applyTheme(theme)
}

export function applyTheme(theme = getTheme()) {
  document.documentElement.dataset.theme = theme
}

// Mounted by the portal shell. Applies the saved preference while the portal is
// on screen and resets to light when it unmounts (sign-out / navigation back to
// a public page).
export function usePortalTheme() {
  useEffect(() => {
    applyTheme()
    return () => applyTheme('light')
  }, [])
}

// Called once at boot so a hard reload straight into the portal doesn't flash
// light first.
export function applyThemeForCurrentRoute() {
  const isPortal = window.location.pathname.startsWith('/portal')
  applyTheme(isPortal ? getTheme() : 'light')
}
