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

// Is this COI's mothership one the strategy pays NOTHING? Read on the
// Implementation Fee and on every provider model — Film Deduction, R&D Credits
// and Oil & Gas list ERT, because ERT pays those COIs directly; Cost
// Segregation's empty rules exclude nobody. The same numeric
// comparison the backend's `isExcludedMothership` makes, and for the same
// reason: the list is edited through a form, so "1" and 1 both have to mean
// mothership 1. A COI with no mothership on file matches nothing — an absent
// mothership is not an excluded one.
function isExcludedMothership(rules, mothershipNumber) {
  if (mothershipNumber == null) return false
  const excluded = (rules || {}).excluded_motherships
  if (!Array.isArray(excluded)) return false
  return excluded.some(m => Number(m) === mothershipNumber)
}

// DISPLAY ONLY: nothing computed here is sent. The `client_fee_pool` half of
// `computeWaterfall`, mirrored line for line — the fee IS the pool, so there is
// no offset, no administration fee, no legal opinion letter and no ERT
// processing fee to take off it first, and a card's processing fee is the
// CLIENT'S cost and never enters this arithmetic at all.
//
// There is no Path A on this model: an ERT-affiliated COI is not paid outside
// the portal, they are not paid AT ALL, which is what an excluded mothership
// means. That is a 0% share rather than a missing one, so the line is still
// drawn and still says whose rule it is.
export function computeClientFeePoolPreview(strategy, member, fee) {
  const pool = round2(fee)
  const excluded = isExcludedMothership(strategy.rules, member.mothership_number)
  // Snapshotted the same way the backend snapshots it: a fact about the COI at
  // the moment of payment, read by a human, even where it does not decide the
  // money.
  const level = String(member.coi_level ?? '')
  const coiPct = excluded ? 0 : (Number((strategy.level_percentages || {})[level]) || 0)
  // A pool of nothing has nothing to share; a negative one would read as the
  // COI owing money back.
  const coiShare = pool > 0 ? round2(pool * coiPct / 100) : 0
  const mothershipLabel = member.mothership_number === 1 ? 'ERT' : `mothership ${member.mothership_number}`

  return {
    fee,
    pool,
    excluded,
    coiLabel: excluded
      ? `COI share — not paid on this strategy (${mothershipLabel})`
      : `COI share (Level ${level || '—'}, ${pctText(coiPct)})`,
    coiShare,
    net: round2(pool - coiShare),
  }
}

// DISPLAY ONLY: nothing computed here is sent. The `fee_pct_waterfall` half of
// `computeWaterfall`, mirrored line for line — ONE hard cost comes off the
// client fee, the attorney's percentage of it, and what is left is the pool.
// There is no offset to measure anything against, no administration fee, no
// flat legal letter to waive and no ERT processing fee.
//
// Path A survives here where it does not on `client_fee_pool`: an
// ERT-affiliated COI takes a flat cut of the pool and ERT pays them outside the
// portal, so the level ladder does not decide their money and their level is
// not named on the line.
export function computeFeePctWaterfallPreview(strategy, member, fee) {
  const attorneyPct = Number((strategy.rules || {}).attorney_fee_pct) || 0
  const attorneyFee = round2(fee * attorneyPct / 100)
  const pool = round2(fee - attorneyFee)

  const affiliated = member.mothership_number === 1 && strategy.affiliated_via_ert === true
  const level = String(member.coi_level ?? '')
  const affiliatedPct = Number(strategy.affiliated_share_pct) || 0
  const coiPct = affiliated ? affiliatedPct : (Number((strategy.level_percentages || {})[level]) || 0)
  // A pool of nothing has nothing to share; a negative one would read as the
  // COI owing money back.
  const coiShare = pool > 0 ? round2(pool * coiPct / 100) : 0

  return {
    fee,
    attorneyFee,
    attorneyLabel: `Attorney fee (${pctText(attorneyPct)} of client fee)`,
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
// so this must mirror those rules rather than replace them — the backend's
// `computeProviderWaterfall`, line for line, exclusion first.
export function computeProviderPreview(strategy, member, inputs) {
  const rules = strategy.rules || {}
  const model = strategy.model
  // Only DCD has a fee to waive; on the others the fee stands whatever else is
  // on the form, and the pass-through, hourly and per-event models carry none
  // at all.
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
  } else if (model === 'pass_through') {
    // The amount typed against this client IS the pool: there is nothing to
    // derive it from, no source to name, and nothing billed alongside it.
    pool = round2(Number(inputs.amount) || 0)
    source = ''
    implFee = 0
  } else if (model === 'hourly_rate') {
    // A count times the strategy's rate: the rate is the rule, the hours are
    // the only fact about this client.
    const hours = Number(inputs.hours) || 0
    const rate = Number(rules.hourly_rate) || 0
    pool = round2(hours * rate)
    source = `${hours} hours at $${fmtMoney(rate)}`
    implFee = 0
  } else if (model === 'event_pct') {
    // An event key that matches nothing earns nothing, exactly as the server
    // prices it — a real answer rather than a missing one.
    const event = (rules.events || []).find(e => e.key === inputs.eventKey) || null
    const base = Number(inputs.base) || 0
    pool = event ? round2(base * (Number(event.pct) || 0) / 100) : 0
    source = event ? `${pctText(event.pct)} of ${String(event.base_label || 'amount').toLowerCase()}` : ''
    implFee = 0
  } else {
    const investment = Number(inputs.investment) || 0
    const poolPct = Number(rules.pool_pct) || 0
    pool = round2(investment * poolPct / 100)
    source = `${pctText(poolPct)} of investment`
    implFee = waived
      ? 0
      : Math.min(round2(investment * (Number(rules.implementation_fee_pct) || 0) / 100), Number(rules.implementation_fee_cap) || 0)
  }

  // An excluded mothership comes FIRST and wins outright: its COIs earn 0% on
  // this strategy, which the server lands on "Not Due" — not Path A, not the
  // ladder. Film Deduction, R&D Credits and Oil & Gas exclude ERT this way;
  // Cost Segregation's empty rules exclude nobody.
  const excluded = isExcludedMothership(rules, member.mothership_number)
  // Path A only where the strategy actually runs the COI's share through ERT:
  // 831(b) and Cost Segregation pay every COI on the ladder, ERT-affiliated or
  // not, so the mothership alone does not decide this.
  const affiliated = !excluded && member.mothership_number === 1 && strategy.affiliated_via_ert === true
  const level = String(member.coi_level ?? '')
  const affiliatedPct = Number(waived ? rules.affiliated_share_pct_fee_waived : strategy.affiliated_share_pct) || 0
  const coiPct = excluded ? 0 : affiliated ? affiliatedPct : (Number((strategy.level_percentages || {})[level]) || 0)
  const mothershipLabel = member.mothership_number === 1 ? 'ERT' : `mothership ${member.mothership_number}`
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
    excluded,
    coiLabel: excluded
      ? `COI share — not paid on this strategy (${mothershipLabel})`
      : affiliated
        ? `ERT affiliated share (${pctText(affiliatedPct)})`
        : `COI share (Level ${level || '—'}, ${pctText(coiPct)})`,
    viaErt: affiliated,
    net: round2(pool - coiShare),
  }
}
