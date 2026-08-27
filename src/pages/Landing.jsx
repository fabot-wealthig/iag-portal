import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession } from '../lib/api'
import WigLogo from '../components/shared/WigLogo'
import ChevronMotif from '../components/shared/ChevronMotif'

export default function Landing() {
  const navigate = useNavigate()

  useEffect(() => {
    if (getSession()) navigate('/portal', { replace: true })
  }, [navigate])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', background: 'linear-gradient(160deg, #0F355A 0%, #16497D 55%, #1D64A8 100%)', padding: '24px', position: 'relative', overflow: 'hidden' }}>
      <ChevronMotif size={520} style={{ position: 'absolute', top: '-160px', right: '-160px', opacity: 0.08 }} />
      <ChevronMotif size={420} style={{ position: 'absolute', bottom: '-140px', left: '-140px', opacity: 0.07 }} />

      <div style={{ position: 'relative' }}>
        <WigLogo light height={44} />
      </div>
      <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, letterSpacing: '-0.02em', fontSize: '32px', color: '#ffffff', margin: '20px 0 0', textAlign: 'center', position: 'relative' }}>Welcome to the Wealth IG Portal</h1>
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.8)', maxWidth: '560px', textAlign: 'center', margin: '14px 0 0', position: 'relative' }}>
        The Wealth Innovation Group portal for managing our centers of influence.
      </p>
      <div style={{ position: 'relative', marginTop: '22px' }}>
        <button
          onClick={() => navigate('/login')}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 16px 40px rgba(4,20,40,0.4)'; e.currentTarget.style.transform = 'translateY(-3px)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(4,20,40,0.25)'; e.currentTarget.style.transform = 'none' }}
          style={{
            width: '280px', padding: '20px 22px', borderRadius: '16px', border: 'none',
            background: 'var(--wig-card)', textAlign: 'left', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', boxShadow: '0 8px 24px rgba(4,20,40,0.25)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            display: 'flex', alignItems: 'center', gap: '14px',
          }}
        >
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '16px', fontWeight: 700, color: 'var(--wig-heading)', marginBottom: '3px' }}>Admin</span>
            <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--wig-muted)' }}>Team access</span>
          </span>
        </button>
      </div>

      <footer style={{ fontFamily: 'Inter, sans-serif', fontSize: '12.5px', lineHeight: 1.8, color: 'rgba(255,255,255,0.65)', textAlign: 'center', maxWidth: '620px', margin: '34px 0 0', position: 'relative' }}>
        <div>&copy; 2026 Wealth Innovation Group</div>
      </footer>
    </div>
  )
}
