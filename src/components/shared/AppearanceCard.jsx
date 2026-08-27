import { useState } from 'react'
import { getTheme, setTheme } from '../../lib/theme'

// Light/dark mode picker shown in the portal's Settings area. The choice is
// per-device (localStorage) — no backend involved.
export default function AppearanceCard() {
  const [theme, setThemeState] = useState(getTheme())

  function pick(next) {
    setTheme(next)
    setThemeState(next)
  }

  const optionStyle = (active) => ({
    flex: 1,
    padding: '14px 16px',
    borderRadius: '12px',
    border: active ? '2px solid var(--wig-sky)' : '1px solid var(--wig-border-strong)',
    background: active ? 'rgba(61,155,224,0.10)' : 'var(--wig-input)',
    color: 'var(--wig-ink)',
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  })

  const swatchStyle = (dark) => ({
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    flexShrink: 0,
    border: '1px solid var(--wig-border-strong)',
    background: dark
      ? 'linear-gradient(135deg, #081F38 0%, #0F355A 100%)'
      : 'linear-gradient(135deg, #ffffff 0%, #f4f7fb 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  })

  return (
    <div style={{ background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }}>
      <div style={{ fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Appearance</div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button onClick={() => pick('light')} style={optionStyle(theme === 'light')}>
          <span style={swatchStyle(false)}><span style={{ fontSize: '15px' }}>☀️</span></span>
          <span>
            <span style={{ display: 'block', fontSize: '14px', fontWeight: 600 }}>Light</span>
            <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--wig-muted)', marginTop: '2px' }}>The classic look</span>
          </span>
        </button>
        <button onClick={() => pick('dark')} style={optionStyle(theme === 'dark')}>
          <span style={swatchStyle(true)}><span style={{ fontSize: '15px' }}>🌙</span></span>
          <span>
            <span style={{ display: 'block', fontSize: '14px', fontWeight: 600 }}>Dark</span>
            <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--wig-muted)', marginTop: '2px' }}>Wealth IG navy</span>
          </span>
        </button>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--wig-muted)', marginTop: '14px', marginBottom: 0 }}>Saved on this device — the portal will remember your choice next time you sign in.</p>
    </div>
  )
}
