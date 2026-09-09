import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { ListHeader } from './shared/TrackKit'
import { ProfileTabSkeleton } from './shared/Skeleton'
import { sandboxChipStyle } from '../lib/stripeMode'

const LEVELS = ['0', '1', '2', '3', '4']

const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--wig-border-strong)', background: 'var(--wig-input)', color: 'var(--wig-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const labelStyle = { fontSize: '12px', color: 'var(--wig-muted)', display: 'block', marginBottom: '6px' }
const sectionStyle = { background: 'var(--wig-card)', border: '1px solid var(--wig-border-soft)', borderRadius: '16px', boxShadow: 'var(--wig-shadow-card)', padding: '24px', marginBottom: '20px' }
const eyebrowStyle = { fontSize: '13px', color: 'var(--wig-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }
const gradientButtonStyle = { padding: '10px 28px', borderRadius: '8px', background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', border: 'none', boxShadow: '0 2px 8px rgba(29,100,168,0.28)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }
const outlineButtonStyle = { padding: '10px 24px', borderRadius: '8px', border: '1px solid var(--wig-border-mid)', background: 'transparent', color: 'var(--wig-muted)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const emptyTitleStyle = { fontSize: '14px', fontWeight: 700, color: 'var(--wig-heading)', marginBottom: '8px' }
const emptyBodyStyle = { fontSize: '13.5px', color: 'var(--wig-muted)', margin: 0, lineHeight: 1.6 }
// The Sandbox chip's shape, on the orange tint: "not yet offered" is an
// exception to how the rest of the list behaves, and orange marks the
// exceptions in this portal.
const inactiveChipStyle = { ...sandboxChipStyle, background: 'rgba(238,106,51,0.12)', border: '1px solid rgba(238,106,51,0.28)' }

export default function TaxStrategiesPanel() {
  const [strategies, setStrategies] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  // Accordion: at most one strategy is open at a time, keyed by strategy key.
  const [expandedKey, setExpandedKey] = useState(null)

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

  // A save returns the saved row, so the waterfall above the form re-renders
  // with the new numbers without a second round trip.
  function applySaved(saved) {
    setStrategies(prev => prev.map(s => s.key === saved.key ? saved : s))
  }

  if (loading) {
    return (
      <div>
        {/* The header is already known — only the strategy cards wait on the
            fetch. */}
        <ListHeader title="Tax Strategies" />
        <ProfileTabSkeleton />
      </div>
    )
  }

  if (loadError) {
    return (
      <div>
        <ListHeader title="Tax Strategies" />
        <div style={sectionStyle}>
          <p style={{ color: '#d93025', fontSize: '13px', margin: 0 }}>{loadError}</p>
        </div>
      </div>
    )
  }

  if (strategies.length === 0) {
    return (
      <div>
        <ListHeader title="Tax Strategies" count={0} />
        <div style={sectionStyle}>
          <div style={emptyTitleStyle}>No strategies yet</div>
          <p style={emptyBodyStyle}>Strategies and their revenue-share rules will appear here once they are set up.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* The count is every strategy the portal knows, offered or not — the
          chip on the row is what says which are not live yet. */}
      <ListHeader title="Tax Strategies" count={strategies.length} />
      {strategies.map(s => {
        const open = expandedKey === s.key
        return (
          <div key={s.key} style={{ marginBottom: '10px', border: '1px solid var(--wig-border-soft)', borderRadius: '12px', overflow: 'hidden', background: 'var(--wig-card)', boxShadow: '0 2px 8px rgba(20,45,95,0.04)' }}>
            <div onClick={() => setExpandedKey(open ? null : s.key)}
              style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px', cursor: 'pointer' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '14px', color: 'var(--wig-ink)', fontWeight: 600 }}>{s.name}</span>
                {s.active === false && <span style={inactiveChipStyle}>Not yet offered</span>}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--wig-muted)', transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s', flexShrink: 0 }}>▼</span>
            </div>
            {open && (
              <div style={{ padding: '4px 16px 16px', borderTop: '1px solid var(--wig-border-soft)' }}>
                <StrategyDetail strategy={s} onSaved={applySaved} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// The read view, plus the edit card once it has been asked for. Keyed on the
// strategy in the caller's accordion, so collapsing and reopening a strategy
// always comes back to the read view.
function StrategyDetail({ strategy, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  function handleSaved(saved) {
    onSaved(saved)
    setEditing(false)
    setSavedMsg('Rules saved.')
    setTimeout(() => setSavedMsg(''), 4000)
  }

  return (
    <div>
      {strategy.active === false && (
        <p style={{ fontSize: '13px', color: 'var(--wig-muted)', margin: '12px 0 0', lineHeight: 1.6 }}>
          Not yet offered on the payment request form.
        </p>
      )}
      <Waterfall strategy={strategy} />
      {editing
        ? <EditRules key={strategy.updated_at} strategy={strategy} onSaved={handleSaved} onCancel={() => setEditing(false)} />
        : (
          <div>
            <button onClick={() => setEditing(true)} style={outlineButtonStyle}>Edit Strategy</button>
            {savedMsg && <p style={{ color: '#1b9254', fontSize: '13px', marginTop: '12px', marginBottom: 0 }}>{savedMsg}</p>}
          </div>
        )}
    </div>
  )
}

/* ---------------------------------------------------------------- read view */

// The rules as a numbered walk-through, with whatever is configured today
// substituted in. Every model is rendered by this one component; only the list
// of steps differs, so the numbering, spacing and chips stay identical across
// strategies an admin flips between.
function Waterfall({ strategy }) {
  const steps = buildSteps(strategy)
  const levels = strategy.level_percentages || {}

  return (
    <div style={{ ...sectionStyle, boxShadow: 'none', background: 'transparent', border: 'none', padding: '18px 0 4px' }}>
      <div style={eyebrowStyle}>How the money splits</div>
      {steps.map((step, i) => (
        <div key={step.title} style={{ display: 'flex', gap: '14px', marginBottom: i === steps.length - 1 ? 0 : '18px' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #1D64A8 0%, #2E86C7 100%)', color: '#fff', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--wig-heading)', marginBottom: '4px' }}>{step.title}</div>
            <div style={{ fontSize: '13.5px', color: 'var(--wig-muted)', lineHeight: 1.6 }}>{step.body}</div>
            {step.chips && <ChipRow chips={step.chips} />}
            {step.tiers && <RetentionTable tiers={step.tiers} />}
            {step.levels && <ChipRow chips={LEVELS.map(l => ({ label: `Level ${l}`, value: pctText(levels[l]) }))} />}
            {step.note && (
              <div style={{ fontSize: '12.5px', color: 'var(--wig-faint)', lineHeight: 1.6, marginTop: '8px' }}>{step.note}</div>
            )}
            {step.callout && <ErtCallout viaErt={strategy.affiliated_via_ert !== false} />}
          </div>
        </div>
      ))}
    </div>
  )
}

// Label above, figure below — the shape the level ladder has always had, reused
// for the box commissions so the two read as the same kind of fact.
function ChipRow({ chips }) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
      {chips.map(c => (
        <div key={c.label} style={{ padding: '8px 14px', borderRadius: '10px', background: 'var(--wig-tint)', border: '1px solid var(--wig-border-chip)', minWidth: '78px' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.8px', color: 'var(--wig-faint)', textTransform: 'uppercase' }}>{c.label}</div>
          <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--wig-heading)', marginTop: '2px' }}>{c.value}</div>
        </div>
      ))}
    </div>
  )
}

// Seven thresholds is too many for chips, so the retention ladder is a table.
// Capped in width and left-aligned in both columns: it has to sit inside the
// panel without a horizontal scrollbar.
function RetentionTable({ tiers }) {
  return (
    <div style={{ marginTop: '10px', border: '1px solid var(--wig-border-chip)', borderRadius: '10px', overflow: 'hidden', maxWidth: '340px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            <th style={{ ...tableCellStyle, background: 'var(--wig-tint)', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.8px', color: 'var(--wig-faint)', textTransform: 'uppercase' }}>Premium from</th>
            <th style={{ ...tableCellStyle, background: 'var(--wig-tint)', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.8px', color: 'var(--wig-faint)', textTransform: 'uppercase' }}>SRA keeps</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t, i) => (
            <tr key={String(t.min)}>
              <td style={{ ...tableCellStyle, borderTop: i === 0 ? 'none' : '1px solid var(--wig-border-soft)', color: 'var(--wig-muted)' }}>{moneyText(t.min)}</td>
              <td style={{ ...tableCellStyle, borderTop: i === 0 ? 'none' : '1px solid var(--wig-border-soft)', color: 'var(--wig-heading)', fontWeight: 700 }}>{pctText(t.pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const tableCellStyle = { textAlign: 'left', padding: '8px 12px', whiteSpace: 'nowrap' }

// Jake's ask: every strategy says out loud who actually pays an ERT-affiliated
// COI. Same line and the same plain container on every card — the keyword alone
// carries the difference, NOT in red or ARE in green, so nothing about the box
// implies one strategy is a permanent exception.
function ErtCallout({ viaErt }) {
  const keyword = viaErt
    ? <span style={{ color: '#d93025', fontWeight: 700 }}>NOT</span>
    : <span style={{ color: '#1b9254', fontWeight: 700 }}>ARE</span>
  return (
    <div style={{
      marginTop: '10px',
      padding: '8px 12px',
      borderRadius: '8px',
      border: '1px solid var(--wig-border-chip)',
      background: 'transparent',
      color: 'var(--wig-muted)',
      fontWeight: 400,
      fontSize: '12.5px',
      lineHeight: 1.6,
    }}>
      {viaErt ? (
        <>ERT-affiliated COIs are {keyword} paid by this portal. Their share goes to ERT outside the portal, an admin ticks it off, and ERT pays the COI.</>
      ) : (
        <>ERT-affiliated COIs {keyword} paid by this portal, by Stripe transfer on the level ladder, exactly like every other COI.</>
      )}
    </div>
  )
}

function buildSteps(strategy) {
  const rules = strategy.rules || {}
  switch (strategy.model) {
    case 'fixed_commission': return commissionSteps(strategy, rules)
    case 'retention_share': return retentionSteps(strategy, rules)
    case 'contribution_pct': return contributionSteps(strategy, rules)
    default: return waterfallSteps(strategy)
  }
}

function waterfallSteps(strategy) {
  return [
    {
      title: 'Client Fee',
      body: 'The client is invoiced a single fee for the strategy. Everything below comes out of it, in order.',
    },
    {
      title: 'Hard costs come off first',
      body: `Administration fee of ${pctText(strategy.admin_fee_pct)} of the client's offset amount, plus a flat ${moneyText(strategy.legal_fee_flat)} for the legal opinion letter. The letter can be waived on an individual payment — a repeat client running the same strategy may not need a new one — which is decided on the payment request form and drops that line to $0.00 for that payment only.`,
    },
    {
      title: 'ERT processing fee',
      body: `The percentage is taken from what remains after the hard costs, not from the whole client fee: ${pctText(strategy.processing_pct_affiliated)} if the COI's mothership is ERT (affiliated), ${pctText(strategy.processing_pct_unaffiliated)} if they belong to any other mothership (unaffiliated).`,
    },
    {
      title: 'Available Revenue Pool',
      body: 'Whatever is left after the hard costs and the ERT processing fee. This is the pool that gets shared.',
    },
    {
      title: 'COI share',
      body: `How the COI is paid depends on their mothership. ERT-affiliated COIs take a flat ${pctText(strategy.affiliated_share_pct)} of the Available Revenue Pool — levels do not apply to them — and that share is paid to ERT outside the portal, which then pays the COI; the portal records it and an admin ticks it off. Every other COI earns the percentage set by their level at the time of payment, transferred to their payout account.`,
      levels: true,
      callout: true,
    },
    {
      title: 'Net Profit Pool',
      body: 'The remainder of the Available Revenue Pool is retained by Wealth IG.',
    },
  ]
}

function commissionSteps(strategy, rules) {
  const tiers = rules.tiers || []
  return [
    {
      title: 'Client contribution',
      body: "The client's contribution goes into the strategy. Its size is set by the box they choose, and the box is what decides every figure below.",
    },
    {
      title: 'Available Revenue Pool',
      body: "Wealth IG's commission is a fixed figure by box size, not a percentage of the contribution. That commission is the pool that gets shared.",
      chips: tiers.map(t => ({ label: t.label, value: moneyText(t.commission) })),
      note: `A ${moneyText(rules.implementation_fee_flat)} implementation fee is billed separately and is not part of this split.`,
    },
    {
      title: 'COI share',
      body: `How the COI is paid depends on their mothership. ERT-affiliated COIs take a flat ${pctText(strategy.affiliated_share_pct)} of the Available Revenue Pool — levels do not apply to them. Every other COI earns the percentage set by their level at the time of payment, transferred to their payout account.`,
      levels: true,
      callout: true,
    },
    {
      title: 'Net Profit Pool',
      body: 'The remainder of the Available Revenue Pool is retained by Wealth IG.',
    },
  ]
}

function retentionSteps(strategy, rules) {
  return [
    {
      title: 'Client premium',
      body: 'The client pays a premium to SRA. The split below starts from what SRA keeps of it.',
    },
    {
      title: 'SRA retention fee',
      body: 'SRA keeps a retention fee out of the premium, tiered by how large the premium is.',
      tiers: rules.retention_tiers || [],
    },
    {
      title: 'Available Revenue Pool',
      body: `Wealth IG receives ${pctText(rules.iag_pct_first_year)} of SRA's retention fee for a first-year client and ${pctText(rules.iag_pct_returning)} for a returning client. That is the pool that gets shared.`,
      note: `A ${moneyText(rules.implementation_fee_flat)} implementation fee is billed separately and is not part of this split.`,
    },
    {
      title: 'COI share',
      body: 'Every COI earns the percentage set by their level at the time of payment, transferred to their payout account. The ladder applies to every COI, ERT-affiliated ones included.',
      levels: true,
      callout: true,
    },
    {
      title: 'Net Profit Pool',
      body: 'The remainder of the Available Revenue Pool is retained by Wealth IG.',
    },
  ]
}

function contributionSteps(strategy, rules) {
  return [
    {
      title: 'Client investment',
      body: 'The client makes an investment into the strategy. Everything below is measured against that amount.',
    },
    {
      title: 'Available Revenue Pool',
      body: `Wealth IG receives ${pctText(rules.pool_pct)} of the investment. That is the pool that gets shared.`,
      note: `The implementation fee is ${pctText(rules.implementation_fee_pct)} of the investment, capped at ${moneyText(rules.implementation_fee_cap)}, billed separately and not part of this split; it can be waived on an individual payment.`,
    },
    {
      title: 'COI share',
      body: `How the COI is paid depends on their mothership. For ERT-affiliated COIs, ERT takes ${pctText(strategy.affiliated_share_pct)} of the Available Revenue Pool when the implementation fee is charged and ${pctText(rules.affiliated_share_pct_fee_waived)} when it is waived, paid outside the portal. Every other COI earns the percentage set by their level at the time of payment, transferred to their payout account.`,
      levels: true,
      callout: true,
    },
    {
      title: 'Net Profit Pool',
      body: 'The remainder of the Available Revenue Pool is retained by Wealth IG.',
    },
  ]
}

/* ---------------------------------------------------------------- edit view */

function EditRules({ strategy, onSaved, onCancel }) {
  const props = { strategy, onSaved, onCancel }
  switch (strategy.model) {
    case 'fixed_commission': return <EditFixedCommission {...props} />
    case 'retention_share': return <EditRetentionShare {...props} />
    case 'contribution_pct': return <EditContributionPct {...props} />
    default: return <EditFeeWaterfall {...props} />
  }
}

// The level ladder, the save call and the status line are the same on every
// model; only the fields above the ladder change, so each model's form owns its
// own field state and borrows the rest from here.
function useRulesForm(strategy, onSaved) {
  const [levels, setLevels] = useState(() => {
    const src = strategy.level_percentages || {}
    return Object.fromEntries(LEVELS.map(l => [l, String(src[l] ?? '')]))
  })
  const [statusMsg, setStatusMsg] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [loading, setLoading] = useState(false)

  async function submit(fields) {
    setLoading(true)
    try {
      const res = await callApi('save_strategy', { key: strategy.key, level_percentages: levels, ...fields })
      // The success message is rendered by the read view this collapses back
      // into, so only the failure path leaves anything behind here.
      if (res.strategy) onSaved(res.strategy)
    } catch (err) {
      // save_strategy is a write — the server's wording is the wording the
      // admin sees, including which number it refused.
      setStatusType('error'); setStatusMsg(err.message)
      setLoading(false)
    }
  }

  return { levels, setLevels, statusMsg, statusType, loading, submit }
}

function EditShell({ form, onSubmit, onCancel, children }) {
  return (
    <div style={{ ...sectionStyle, marginBottom: 0 }}>
      <div style={eyebrowStyle}>Edit rules</div>
      {children}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>COI share by level (% of Available Revenue Pool)</label>
        <ListBox>
          {LEVELS.map((l, i) => (
            <RuleRow key={l} first={i === 0} label={`Level ${l}`} suffix="%"
              value={form.levels[l]} onChange={v => form.setLevels({ ...form.levels, [l]: v })} />
          ))}
        </ListBox>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={onSubmit} disabled={form.loading} style={gradientButtonStyle}>
          {form.loading ? 'Saving...' : 'Save Rules'}
        </button>
        <button onClick={onCancel} style={outlineButtonStyle}>Cancel</button>
      </div>
      {form.statusMsg && <p style={{ color: form.statusType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{form.statusMsg}</p>}
    </div>
  )
}

function FieldRow({ children }) {
  return <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>{children}</div>
}

function NumField({ label, value, onChange }) {
  return (
    <div style={{ flex: 1, minWidth: '160px' }}>
      <label style={labelStyle}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} type="number" step="0.01" style={inputStyle} />
    </div>
  )
}

function ListBox({ children }) {
  return <div style={{ border: '1px solid var(--wig-border-soft)', borderRadius: '10px', overflow: 'hidden' }}>{children}</div>
}

// One editable number against a fixed label — the label is the thing this phase
// does not let an admin change (a level, a box name, a premium threshold).
function RuleRow({ label, prefix, suffix, value, onChange, first }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderTop: first ? 'none' : '1px solid var(--wig-border-soft)' }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--wig-ink)', width: '110px', flexShrink: 0 }}>{label}</span>
      {prefix && <span style={{ fontSize: '13px', color: 'var(--wig-muted)' }}>{prefix}</span>}
      <input value={value} onChange={e => onChange(e.target.value)} type="number" step="0.01" style={{ ...inputStyle, maxWidth: '140px' }} />
      {suffix && <span style={{ fontSize: '13px', color: 'var(--wig-muted)' }}>{suffix}</span>}
    </div>
  )
}

function EditFeeWaterfall({ strategy, onSaved, onCancel }) {
  const form = useRulesForm(strategy, onSaved)
  const [adminFee, setAdminFee] = useState(String(strategy.admin_fee_pct ?? ''))
  const [legalFee, setLegalFee] = useState(String(strategy.legal_fee_flat ?? ''))
  const [affiliated, setAffiliated] = useState(String(strategy.processing_pct_affiliated ?? ''))
  const [unaffiliated, setUnaffiliated] = useState(String(strategy.processing_pct_unaffiliated ?? ''))
  const [affiliatedShare, setAffiliatedShare] = useState(String(strategy.affiliated_share_pct ?? ''))

  return (
    <EditShell form={form} onCancel={onCancel} onSubmit={() => form.submit({
      admin_fee_pct: adminFee,
      legal_fee_flat: legalFee,
      processing_pct_affiliated: affiliated,
      processing_pct_unaffiliated: unaffiliated,
      affiliated_share_pct: affiliatedShare,
    })}>
      <FieldRow>
        <NumField label="Admin Fee (% of offset)" value={adminFee} onChange={setAdminFee} />
        <NumField label="Legal Fee (flat $)" value={legalFee} onChange={setLegalFee} />
      </FieldRow>
      <FieldRow>
        <NumField label="ERT Processing % (affiliated)" value={affiliated} onChange={setAffiliated} />
        <NumField label="ERT Processing % (unaffiliated)" value={unaffiliated} onChange={setUnaffiliated} />
      </FieldRow>
      {/* Above the ladder because it REPLACES the ladder for the COIs it
          applies to, rather than sitting alongside it as one more level. */}
      <FieldRow>
        <NumField label="ERT-affiliated COI share (% of Available Revenue Pool)" value={affiliatedShare} onChange={setAffiliatedShare} />
      </FieldRow>
    </EditShell>
  )
}

function EditFixedCommission({ strategy, onSaved, onCancel }) {
  const form = useRulesForm(strategy, onSaved)
  const rules = strategy.rules || {}
  // Keys and labels ride along unchanged: this phase edits the money on a box,
  // never which boxes exist.
  const [tiers, setTiers] = useState(() => (rules.tiers || []).map(t => ({ key: t.key, label: t.label, commission: String(t.commission ?? '') })))
  const [implFee, setImplFee] = useState(String(rules.implementation_fee_flat ?? ''))
  const [affiliatedShare, setAffiliatedShare] = useState(String(strategy.affiliated_share_pct ?? ''))

  function setCommission(key, v) {
    setTiers(prev => prev.map(t => t.key === key ? { ...t, commission: v } : t))
  }

  return (
    <EditShell form={form} onCancel={onCancel} onSubmit={() => form.submit({
      affiliated_share_pct: affiliatedShare,
      rules: {
        tiers: tiers.map(t => ({ key: t.key, label: t.label, commission: t.commission })),
        implementation_fee_flat: implFee,
      },
    })}>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Wealth IG commission by box (flat $)</label>
        <ListBox>
          {tiers.map((t, i) => (
            <RuleRow key={t.key} first={i === 0} label={t.label} prefix="$"
              value={t.commission} onChange={v => setCommission(t.key, v)} />
          ))}
        </ListBox>
      </div>
      <FieldRow>
        <NumField label="Implementation fee (flat $, informational)" value={implFee} onChange={setImplFee} />
      </FieldRow>
      <FieldRow>
        <NumField label="ERT-affiliated COI share (% of Available Revenue Pool)" value={affiliatedShare} onChange={setAffiliatedShare} />
      </FieldRow>
    </EditShell>
  )
}

function EditRetentionShare({ strategy, onSaved, onCancel }) {
  const form = useRulesForm(strategy, onSaved)
  const rules = strategy.rules || {}
  // Thresholds are read-only in this phase — only the percentage SRA keeps
  // at each one is editable.
  const [tiers, setTiers] = useState(() => (rules.retention_tiers || []).map(t => ({ min: t.min, pct: String(t.pct ?? '') })))
  const [firstYear, setFirstYear] = useState(String(rules.iag_pct_first_year ?? ''))
  const [returning, setReturning] = useState(String(rules.iag_pct_returning ?? ''))
  const [implFee, setImplFee] = useState(String(rules.implementation_fee_flat ?? ''))

  function setPct(min, v) {
    setTiers(prev => prev.map(t => t.min === min ? { ...t, pct: v } : t))
  }

  return (
    <EditShell form={form} onCancel={onCancel} onSubmit={() => form.submit({
      rules: {
        retention_tiers: tiers.map(t => ({ min: t.min, pct: t.pct })),
        iag_pct_first_year: firstYear,
        iag_pct_returning: returning,
        implementation_fee_flat: implFee,
      },
    })}>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>SRA retention fee by premium (%)</label>
        <ListBox>
          {tiers.map((t, i) => (
            <RuleRow key={String(t.min)} first={i === 0} label={moneyText(t.min)} suffix="%"
              value={t.pct} onChange={v => setPct(t.min, v)} />
          ))}
        </ListBox>
      </div>
      <FieldRow>
        <NumField label="Wealth IG share of SRA fee, first-year client (%)" value={firstYear} onChange={setFirstYear} />
        <NumField label="Wealth IG share of SRA fee, returning client (%)" value={returning} onChange={setReturning} />
      </FieldRow>
      {/* No affiliated-share field: on this strategy the ladder pays every COI,
          so there is no flat cut to set. */}
      <FieldRow>
        <NumField label="Implementation fee (flat $, informational)" value={implFee} onChange={setImplFee} />
      </FieldRow>
    </EditShell>
  )
}

function EditContributionPct({ strategy, onSaved, onCancel }) {
  const form = useRulesForm(strategy, onSaved)
  const rules = strategy.rules || {}
  const [poolPct, setPoolPct] = useState(String(rules.pool_pct ?? ''))
  const [implPct, setImplPct] = useState(String(rules.implementation_fee_pct ?? ''))
  const [implCap, setImplCap] = useState(String(rules.implementation_fee_cap ?? ''))
  const [shareCharged, setShareCharged] = useState(String(strategy.affiliated_share_pct ?? ''))
  const [shareWaived, setShareWaived] = useState(String(rules.affiliated_share_pct_fee_waived ?? ''))

  return (
    <EditShell form={form} onCancel={onCancel} onSubmit={() => form.submit({
      affiliated_share_pct: shareCharged,
      rules: {
        pool_pct: poolPct,
        implementation_fee_pct: implPct,
        implementation_fee_cap: implCap,
        affiliated_share_pct_fee_waived: shareWaived,
      },
    })}>
      <FieldRow>
        <NumField label="Wealth IG share of investment (%)" value={poolPct} onChange={setPoolPct} />
      </FieldRow>
      <FieldRow>
        <NumField label="Implementation fee (% of investment, informational)" value={implPct} onChange={setImplPct} />
        <NumField label="Implementation fee cap ($)" value={implCap} onChange={setImplCap} />
      </FieldRow>
      {/* Two figures for one COI because the waiver moves the split, not just
          the fee: what ERT takes depends on whether the fee was charged. */}
      <FieldRow>
        <NumField label="ERT-affiliated COI share, fee charged (%)" value={shareCharged} onChange={setShareCharged} />
        <NumField label="ERT-affiliated COI share, fee waived (%)" value={shareWaived} onChange={setShareWaived} />
      </FieldRow>
    </EditShell>
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
