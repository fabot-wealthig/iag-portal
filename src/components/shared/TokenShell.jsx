import WigLogo from './WigLogo'

// Branded shell for public token pages (pay / setup links): navy gradient
// header with the logo, page background, and a centered white card with the
// gradient accent strip. Presentation only — children carry all content and
// behavior.
export default function TokenShell({ children, maxWidth = 560 }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--wig-page)', fontFamily: 'Inter, sans-serif', color: 'var(--wig-ink)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'linear-gradient(90deg, #0F355A 0%, #1D64A8 100%)', height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(15,53,90,0.25)', flexShrink: 0 }}>
        <WigLogo light height={26} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: `${maxWidth}px`, background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', overflow: 'hidden' }}>
          <div style={{ height: '4px', background: 'linear-gradient(90deg, #0F355A 0%, #1D64A8 55%, #2E86C7 100%)' }} />
          <div style={{ padding: '36px 32px' }}>{children}</div>
        </div>
      </div>
    </div>
  )
}
