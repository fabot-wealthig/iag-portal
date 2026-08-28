import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { TrackHero } from './shared/TrackKit'

const LEVELS = ['0', '1', '2', '3', '4']

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const labelStyle = { fontSize: '12px', color: 'var(--wig-muted)', display: 'block', marginBottom: '6px' }
const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const gradientButtonStyle = { padding: '10px 28px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }
const emptyTitleStyle = { fontSize: '14px', fontWeight: 700, color: 'var(--wig-heading)', marginBottom: '8px' }
const emptyBodyStyle = { fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0, lineHeight: 1.6 }

export default function TaxStrategiesPanel() {
  const [strategies, setStrategies] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const data = await callApi('load_strategies')
      setStrategies(data.strategies || [])
      setLoadError('')
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // A save returns the saved row, so the explainer above the form re-renders
  // with the new numbers without a second round trip.
  function applySaved(saved) {
    setStrategies(prev => prev.map(s => s.key === saved.key ? saved : s))
  }

  if (loading) {
    return (
      <div>
        <TrackHero eyebrow="Tax Strategies" title="Tax Strategies" />
        <div style={{ textAlign: 'center', fontSize: '13.5px', color: 'var(--wig-muted)', padding: '40px 0' }}>Loading...</div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div>
        <TrackHero eyebrow="Tax Strategies" title="Tax Strategies" />
        <div style={sectionStyle}>
          <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{loadError}</p>
        </div>
      </div>
    )
  }

  if (strategies.length === 0) {
    return (
      <div>
        <TrackHero eyebrow="Tax Strategies" title="Tax Strategies" />
        <div style={sectionStyle}>
          <div style={emptyTitleStyle}>No strategies yet</div>
          <p style={emptyBodyStyle}>Strategies and their revenue-share rules will appear here once they are set up.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {strategies.map(s => (
        <div key={s.key} style={{ marginBottom: '36px' }}>
          <TrackHero
            eyebrow="Tax Strategies"
            title={s.name}
            meta={<span style={{ fontFamily: 'monospace' }}>{s.key}</span>}
          />
          <Waterfall strategy={s} />
          <EditRules strategy={s} onSaved={applySaved} />
        </div>
      ))}
    </div>
  )
}

// The rules as a numbered walk-through, with whatever is configured today
// substituted in. This is the version people read; the stored explainer text
// sits underneath as the long-form write-up.
function Waterfall({ strategy }) {
  const levels = strategy.level_percentages || {}
  const steps = [
    {
      title: 'Client Fee',
      body: 'The client is invoiced a single fee for the strategy. Everything below comes out of it, in order.',
    },
    {
      title: 'Hard costs come off first',
      body: `Administration fee of ${pctText(strategy.admin_fee_pct)} of the client's offset amount, plus a flat ${moneyText(strategy.legal_fee_flat)} for the legal opinion letter.`,
    },
    {
      title: 'ERT processing fee',
      body: `${pctText(strategy.processing_pct_affiliated)} if the COI's mothership is ERT (affiliated), ${pctText(strategy.processing_pct_unaffiliated)} if they belong to any other mothership (unaffiliated).`,
    },
    {
      title: 'Available Revenue Pool',
      body: 'Whatever is left after the hard costs and the ERT processing fee. This is the pool that gets shared.',
    },
    {
      title: 'COI share',
      body: 'The COI earns a percentage of the Available Revenue Pool, set by their level at the time of payment.',
      levels: true,
    },
    {
      title: 'Net Profit Pool',
      body: 'The remainder of the Available Revenue Pool is retained by Wealth IG.',
    },
  ]

  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>How the money splits</div>
      {steps.map((step, i) => (
        <div key={step.title} style={{ display: 'flex', gap: '14px', marginBottom: i === steps.length - 1 ? 0 : '18px' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', color: '#fff', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--wig-heading)', marginBottom: '4px' }}>{step.title}</div>
            <div style={{ fontSize: '13.5px', color: 'var(--wig-muted)', lineHeight: 1.6 }}>{step.body}</div>
            {step.levels && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                {LEVELS.map(l => (
                  <div key={l} style={{ padding: '8px 14px', borderRadius: '10px', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', minWidth: '78px' }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.8px', color: 'var(--wig-faint)', textTransform: 'uppercase' }}>Level {l}</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--wig-heading)', marginTop: '2px' }}>{pctText(levels[l])}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {strategy.explainer && (
        <>
          <div style={{ height: '1px', background: 'var(--wig-border-soft)', margin: '22px 0 16px' }} />
          <div style={{ ...eyebrowStyle, marginBottom: '10px' }}>Full write-up</div>
          <div style={{ fontSize: '13.5px', color: 'var(--wig-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{strategy.explainer}</div>
        </>
      )}
    </div>
  )
}

function EditRules({ strategy, onSaved }) {
  const [adminFee, setAdminFee] = useState(String(strategy.admin_fee_pct ?? ''))
  const [legalFee, setLegalFee] = useState(String(strategy.legal_fee_flat ?? ''))
  const [affiliated, setAffiliated] = useState(String(strategy.processing_pct_affiliated ?? ''))
  const [unaffiliated, setUnaffiliated] = useState(String(strategy.processing_pct_unaffiliated ?? ''))
  const [levels, setLevels] = useState(() => {
    const src = strategy.level_percentages || {}
    return Object.fromEntries(LEVELS.map(l => [l, String(src[l] ?? '')]))
  })
  const [explainer, setExplainer] = useState(strategy.explainer || '')
  const [statusMsg, setStatusMsg] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [loading, setLoading] = useState(false)

  async function submit() {
    setLoading(true)
    try {
      const res = await callApi('save_strategy', {
        key: strategy.key,
        admin_fee_pct: adminFee,
        legal_fee_flat: legalFee,
        processing_pct_affiliated: affiliated,
        processing_pct_unaffiliated: unaffiliated,
        level_percentages: levels,
        explainer,
      })
      if (res.strategy) onSaved(res.strategy)
      setStatusType('success'); setStatusMsg('Rules saved.')
    } catch (err) {
      // save_strategy is a write — the server's wording is the wording the
      // admin sees, including which number it refused.
      setStatusType('error'); setStatusMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={sectionStyle}>
      <div style={eyebrowStyle}>Edit rules</div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label style={labelStyle}>Admin Fee (% of offset)</label>
          <input value={adminFee} onChange={e => setAdminFee(e.target.value)} type="number" step="0.01" style={inputStyle} />
        </div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label style={labelStyle}>Legal Fee (flat $)</label>
          <input value={legalFee} onChange={e => setLegalFee(e.target.value)} type="number" step="0.01" style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label style={labelStyle}>ERT Processing % (affiliated)</label>
          <input value={affiliated} onChange={e => setAffiliated(e.target.value)} type="number" step="0.01" style={inputStyle} />
        </div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label style={labelStyle}>ERT Processing % (unaffiliated)</label>
          <input value={unaffiliated} onChange={e => setUnaffiliated(e.target.value)} type="number" step="0.01" style={inputStyle} />
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>COI share by level (% of Available Revenue Pool)</label>
        <div style={{ border: '1px solid var(--wig-border-soft)', borderRadius: '10px', overflow: 'hidden' }}>
          {LEVELS.map((l, i) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderTop: i === 0 ? 'none' : '1px solid var(--wig-border-soft)' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--wig-ink)', width: '80px', flexShrink: 0 }}>Level {l}</span>
              <input value={levels[l]} onChange={e => setLevels({ ...levels, [l]: e.target.value })} type="number" step="0.01" style={{ ...inputStyle, maxWidth: '140px' }} />
              <span style={{ fontSize: '13px', color: 'var(--wig-muted)' }}>%</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Explainer</label>
        <textarea value={explainer} onChange={e => setExplainer(e.target.value)} style={{ ...inputStyle, minHeight: '180px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
      </div>

      <button onClick={submit} disabled={loading} style={gradientButtonStyle}>
        {loading ? 'Saving...' : 'Save Rules'}
      </button>
      {statusMsg && <p style={{ color: statusType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{statusMsg}</p>}
    </div>
  )
}

// Percentages arrive from Postgres `numeric` as strings, so they are parsed
// before formatting — and a trailing ".00" is dropped so 1.5% reads as 1.5%.
function pctText(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${Number(n.toFixed(2))}%`
}

function moneyText(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
