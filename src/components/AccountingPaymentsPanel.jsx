import { TrackHero } from './shared/TrackKit'

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const emptyTitleStyle = { fontSize: '14px', fontWeight: 700, color: 'var(--wig-heading)', marginBottom: '8px' }
const emptyBodyStyle = { fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0, lineHeight: 1.6 }
// Payments is the only accounting pill today, so it renders permanently
// selected rather than as a one-item tab strip that does nothing.
const pillStyle = { padding: '7px 16px', background: '#1D64A8', border: 'none', borderRadius: '999px', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#ffffff', fontSize: '12.5px', fontWeight: 600, cursor: 'default', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }

export default function AccountingPaymentsPanel() {
  return (
    <div>
      <TrackHero eyebrow="Accounting" title="Accounting" />
      <div style={{ display: 'flex', borderBottom: '1px solid var(--wig-border)', marginBottom: '24px', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button style={pillStyle}>Payments</button>
      </div>
      <div style={sectionStyle}>
        <div style={emptyTitleStyle}>Coming soon</div>
        <p style={emptyBodyStyle}>
          This is where every client payment will be reconciled — hard costs, the ERT processing fee, the COI revenue share and the net profit pool, stage by stage.
        </p>
      </div>
    </div>
  )
}
