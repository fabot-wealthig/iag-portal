import React from 'react'
import * as Sentry from '@sentry/react'

// App-wide error boundary. Catches any uncaught render/runtime error in the
// React tree and shows a plain card instead of a blank white screen.
// Styles are inline on purpose — the boundary must render even if the app's CSS
// never loaded, which is one of the ways it gets here. For the same reason the
// palette is literal hex rather than the `--wig-*` variables: those live in the
// stylesheet this fallback cannot assume.
//
// componentDidCatch is where Sentry hears about it. React swallows render
// crashes into the nearest boundary, so they never reach the global handler
// Sentry.init installs — without this call they would go unreported.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info?.componentStack)
    Sentry.captureException(error, { extra: { componentStack: info?.componentStack } })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={S.wrap}>
        <div style={S.card}>
          <div style={S.brand}>Wealth IG<span style={S.brandAccent}> Portal</span></div>
          <h1 style={S.title}>Something went wrong</h1>
          <p style={S.msg}>
            An unexpected error stopped this page from loading. Nothing you were looking at
            has been changed. Reload to try again — if it keeps happening, sign in afresh.
          </p>
          <button style={S.primary} onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    )
  }
}

const S = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6fb', padding: '24px', fontFamily: 'Inter, Arial, Helvetica, sans-serif' },
  card: { background: '#ffffff', border: '1px solid #dfe5f2', borderRadius: '16px', maxWidth: '440px', width: '100%', padding: '36px 32px', textAlign: 'center', boxShadow: '0 18px 44px rgba(22,38,74,0.12)' },
  brand: { fontSize: '15px', fontWeight: 700, color: '#16264a', letterSpacing: '0.4px', marginBottom: '20px' },
  brandAccent: { color: '#EE6A33' },
  title: { fontSize: '21px', color: '#16264a', margin: '0 0 12px', fontWeight: 700 },
  msg: { fontSize: '14px', color: '#4e6087', lineHeight: 1.6, margin: '0 0 26px' },
  primary: { background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 26px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, Arial, Helvetica, sans-serif' },
}

export default ErrorBoundary
