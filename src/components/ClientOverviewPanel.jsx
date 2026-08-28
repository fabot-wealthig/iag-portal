import { TrackHero } from './shared/TrackKit'

const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const emptyTitleStyle = { fontSize: '14px', fontWeight: 700, color: 'var(--wig-heading)', marginBottom: '8px' }
const emptyBodyStyle = { fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0, lineHeight: 1.6 }

export default function ClientOverviewPanel() {
  return (
    <div>
      <TrackHero eyebrow="Overview" title="Client Overview" />
      <div style={sectionStyle}>
        <div style={emptyTitleStyle}>Coming soon</div>
        <p style={emptyBodyStyle}>
          This is where every client across every COI will be listed together, with their strategy, payment stage and outstanding actions.
        </p>
      </div>
    </div>
  )
}
