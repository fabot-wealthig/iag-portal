// Split-screen auth layout: navy brand panel + white form panel. Presentation only.
import WigLogo from './WigLogo'
import ChevronMotif from './ChevronMotif'

export default function AuthShell({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexWrap: 'wrap', background: 'var(--wig-card)', fontFamily: 'Inter, sans-serif' }}>
      <div style={{
        flex: '1 1 380px', minHeight: '38vh', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, #0F355A 0%, #16497D 55%, #1D64A8 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '56px',
      }}>
        <ChevronMotif size={560} style={{ position: 'absolute', bottom: '-200px', right: '-200px', opacity: 0.08 }} />
        <div style={{ position: 'relative' }}>
          <WigLogo light height={34} />
        </div>
        <h1 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: '34px', color: '#ffffff', margin: '28px 0 14px', lineHeight: 1.15, maxWidth: '420px', position: 'relative' }}>
          Wealth Innovation Group
        </h1>
        <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.72)', margin: 0, lineHeight: 1.6, maxWidth: '400px', position: 'relative' }}>
          Secure access to the Wealth IG team portal.
        </p>
        <div style={{ width: '46px', height: '4px', borderRadius: '99px', background: '#EE6A33', marginTop: '26px', position: 'relative' }} />
      </div>
      <div style={{ flex: '1.2 1 420px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
