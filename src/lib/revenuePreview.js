// The revenue-share previews, lifted out of `ClientPaymentForm` so the receipt
// form can put the same figure under each of its client lines. Pure functions
// only — nothing here reads or writes anything.

export const fmtMoney = (n) => (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Percentages arrive from Postgres `numeric` as strings; a trailing ".00" is
// dropped so 1.5% reads as 1.5%.
export const pctText = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? `${Number(n.toFixed(2))}%` : '—'
}

export const round2 = (n) => Math.round(n * 100) / 100

// DISPLAY ONLY: nothing computed here is sent. The waterfall is derived
// server-side from the strategy rules when the payment clears, so this must
// mirror those rules rather than replace them.
export function computePreview(strategy, member, offset, fee, legalWaived) {
  const affiliated = member.mothership_number === 1
  const processingPct = Number(affiliated ? strategy.processing_pct_affiliated : strategy.processing_pct_unaffiliated) || 0
  const adminPct = Number(strategy.admin_fee_pct) || 0
  // Waived means this payment's legal line is zero; the strategy's flat fee is
  // untouched and the next payment asks again.
  const legal = legalWaived ? 0 : round2(Number(strategy.legal_fee_flat) || 0)

  const adminFee = round2(offset * adminPct / 100)
  // ERT's percentage is taken AFTER the two hard costs come off, not from the
  // whole client fee ("Understanding Revenue Share for the LEOS Strategy",
  // Step 2: "After the administrative fee and legal opinion letter have been
  // deducted, ERT receives either 10% or 5%").
  const afterHardCosts = round2(fee - adminFee - legal)
  // ERT cannot take a percentage of a shortfall: once the hard costs have eaten
  // the fee there is nothing to process, and a negative ERT line would read as
  // ERT owing money.
  const processing = afterHardCosts > 0 ? round2(afterHardCosts * processingPct / 100) : 0
  const pool = round2(afterHardCosts - processing)

  // Path A: an ERT-affiliated COI takes a flat cut of the pool and the level
  // ladder does not apply to them, so their level is not named here either — it
  // is still recorded on the payment, it just does not decide the money.
  const level = String(member.coi_level ?? '')
  const affiliatedPct = Number(strategy.affiliated_share_pct) || 0
  const coiPct = affiliated ? affiliatedPct : (Number((strategy.level_percentages || {})[level]) || 0)
  const coiShare = round2(pool * coiPct / 100)

  return {
    fee,
    adminFee,
    adminLabel: `Administration fee (${pctText(adminPct)} of offset)`,
    legal,
    legalLabel: legalWaived ? 'Legal opinion letter (waived)' : 'Legal opinion letter',
    processing,
    processingLabel: `ERT processing fee (${pctText(processingPct)} after hard costs, ${affiliated ? 'affiliated' : 'unaffiliated'})`,
    pool,
    coiShare,
    coiLabel: affiliated
      ? `ERT affiliated share (${pctText(affiliatedPct)})`
      : `COI share (Level ${level || '—'}, ${pctText(coiPct)})`,
    viaErt: affiliated,
    net: round2(pool - coiShare),
  }
}

// The retention tier a premium falls in: the LAST tier whose floor it reaches,
// with an equal premium taking that tier rather than the one below it. A
// premium under the first floor earns nothing, which is a real answer and not a
// missing one.
export function retentionPctOf(tiers, premium) {
  const sorted = [...(tiers || [])].sort((a, b) => (Number(a.min) || 0) - (Number(b.min) || 0))
  let pct = 0
  for (const t of sorted) {
    if (premium >= (Number(t.min) || 0)) pct = Number(t.pct) || 0
  }
  return pct
}

// DISPLAY ONLY: nothing computed here is sent. The provider strategies' pools
// are derived server-side from the strategy rules when the record is created,
// so this must mirror those rules rather than replace them.
export function computeProviderPreview(strategy, member, inputs) {
  const rules = strategy.rules || {}
  const model = strategy.model
  // Only DCD has a fee to waive; on the other two the flat fee stands whatever
  // else is on the form.
  const waived = model === 'contribution_pct' && !inputs.implFeeCharged

  let pool = 0
  let source = ''
  let implFee = 0

  if (model === 'fixed_commission') {
    const tier = (rules.tiers || []).find(t => t.key === inputs.tierKey) || null
    pool = round2(Number(tier?.commission) || 0)
    source = tier ? `${tier.label} commission` : ''
    implFee = round2(Number(rules.implementation_fee_flat) || 0)
  } else if (model === 'retention_share') {
    const premium = Number(inputs.premium) || 0
    const retentionPct = retentionPctOf(rules.retention_tiers, premium)
    const iagPct = Number(inputs.firstYear ? rules.iag_pct_first_year : rules.iag_pct_returning) || 0
    // Rounded at BOTH stages, the retention fee and then our share of it, so a
    // half-cent in the middle cannot drift the two figures apart.
    pool = round2(round2(premium * retentionPct / 100) * iagPct / 100)
    source = `${pctText(iagPct)} of SRA's ${pctText(retentionPct)} retention fee, ${inputs.firstYear ? 'first-year' : 'returning'}`
    implFee = round2(Number(rules.implementation_fee_flat) || 0)
  } else {
    const investment = Number(inputs.investment) || 0
    const poolPct = Number(rules.pool_pct) || 0
    pool = round2(investment * poolPct / 100)
    source = `${pctText(poolPct)} of investment`
    implFee = waived
      ? 0
      : Math.min(round2(investment * (Number(rules.implementation_fee_pct) || 0) / 100), Number(rules.implementation_fee_cap) || 0)
  }

  // Path A only where the strategy actually runs the COI's share through ERT:
  // 831(b) pays every COI on the ladder, ERT-affiliated or not, so the
  // mothership alone does not decide this.
  const affiliated = member.mothership_number === 1 && strategy.affiliated_via_ert === true
  const level = String(member.coi_level ?? '')
  const affiliatedPct = Number(waived ? rules.affiliated_share_pct_fee_waived : strategy.affiliated_share_pct) || 0
  const coiPct = affiliated ? affiliatedPct : (Number((strategy.level_percentages || {})[level]) || 0)
  // A pool of nothing has nothing to share; a negative one would read as the
  // COI owing money back.
  const coiShare = pool > 0 ? round2(pool * coiPct / 100) : 0

  return {
    pool,
    poolLabel: `Expected revenue from provider${source ? ` (${source})` : ''}`,
    // Informational: it is billed by somebody else and never comes off the
    // pool, so it is a note under the figure rather than a line in the split.
    implNote: implFee > 0
      ? `Implementation fee $${fmtMoney(implFee)} — billed separately, not part of this split`
      : waived
        ? 'Implementation fee waived — not part of this split'
        : 'No implementation fee on this strategy',
    coiShare,
    coiLabel: affiliated
      ? `ERT affiliated share (${pctText(affiliatedPct)})`
      : `COI share (Level ${level || '—'}, ${pctText(coiPct)})`,
    viaErt: affiliated,
    net: round2(pool - coiShare),
  }
}
