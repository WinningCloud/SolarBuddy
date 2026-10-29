// Repair / Reuse / Recycle economics. Deterministic; inputs come from Settings and the twin.
// Every default is an Assumption unless data/assumptions.json marks it sourced.

import assumptions from '@data/assumptions.json';
import type {
  AppSettings,
  AssumptionOverrides,
  DamageFlag,
  DecisionKind,
  DecisionOption,
  DecisionRecord,
  Material,
  PanelPassport,
  Range,
  Reason,
  RepairId,
  RepairOption,
} from '../types';
import { MATERIALS } from '../types';
import { powerAfterRepairs, repairApplicable, type TwinInputs } from './twin';

export const REPAIR_IDS: RepairId[] = [
  'replace_junction_box',
  'bypass_dead_substring',
  'resolder_busbar',
  'clean_glass',
];

export function defaultSettings(): AppSettings {
  const a = assumptions;
  return {
    siteName: a.site.name,
    latitudeDeg: a.site.latitudeDeg,
    longitudeDeg: a.site.longitudeDeg,
    assumptions: {
      tariffInrPerKwh: a.energy.tariffInrPerKwh.value,
      peakSunHoursPerDay: a.energy.peakSunHoursPerDay.value,
      remainingLifeYears: a.energy.remainingLifeYears.value,
      annualDegradation: a.energy.annualDegradation.value,
      repairCostScale: 1,
      resalePriceScale: 1,
      recoveryRateScale: 1,
    },
    repairCostsInr: Object.fromEntries(
      REPAIR_IDS.map((id) => [
        id,
        { low: a.repairCostsInr[id].low, high: a.repairCostsInr[id].high },
      ]),
    ) as AppSettings['repairCostsInr'],
    materialPricesInrPerKg: Object.fromEntries(
      MATERIALS.map((m) => [m, a.materialPricesInrPerKg[m].value]),
    ) as AppSettings['materialPricesInrPerKg'],
    recoveryRate: Object.fromEntries(
      MATERIALS.map((m) => [m, { ...a.recoveryRate[m] }]),
    ) as AppSettings['recoveryRate'],
    converterEfficiency: 0.97,
    relayRdsOnOhm: 0.05,
    optimiserCostInrPerPanel: 2200,
    relayCostInrPerPanel: 450,
  };
}

export const defaultsTable = assumptions;

const range = (v: number): Range => ({ low: v, expected: v, high: v });
const mix = (low: number, high: number): Range => ({ low, expected: (low + high) / 2, high });

/** Lifetime energy factor: sum over years of (1 - degradation)^year, times 365 sun days. */
function lifetimeFactor(a: AssumptionOverrides): number {
  let sum = 0;
  for (let y = 0; y < a.remainingLifeYears; y++) sum += Math.pow(1 - a.annualDegradation, y);
  return sum;
}

export function energyKwh(powerW: number, a: AssumptionOverrides): number {
  return (
    (powerW *
      a.peakSunHoursPerDay *
      365 *
      assumptions.reuse.performanceRatio.value *
      lifetimeFactor(a)) /
    1000
  );
}

function panelMassKg(): number {
  return assumptions.panelMassKgPer60Cell;
}

function materialsFor(s: AppSettings, a: AssumptionOverrides): Record<Material, Range> {
  return Object.fromEntries(
    MATERIALS.map((m) => {
      const base = panelMassKg() * assumptions.panelCompositionFraction[m];
      const r = s.recoveryRate[m];
      const lo = Math.min(1, r.low * a.recoveryRateScale);
      const hi = Math.min(1, r.high * a.recoveryRateScale);
      return [m, { low: base * lo, expected: (base * (lo + hi)) / 2, high: base * hi }];
    }),
  ) as Record<Material, Range>;
}

function materialsValue(mats: Record<Material, Range>, s: AppSettings): Range {
  const sum = (pick: 'low' | 'expected' | 'high') =>
    MATERIALS.reduce((t, m) => t + mats[m][pick] * s.materialPricesInrPerKg[m], 0);
  return { low: sum('low'), expected: sum('expected'), high: sum('high') };
}

export function twinInputsOf(p: PanelPassport): TwinInputs {
  return {
    nameplate: p.nameplate,
    inspection: p.inspection,
    outputBand: p.assessment.answers.find((a) => a.questionId === 'output_band')?.answer ?? null,
  };
}

export function buildRepairOptions(p: PanelPassport, s: AppSettings): RepairOption[] {
  const inputs = twinInputsOf(p);
  const now = p.twin?.now.pmaxRangeW;
  const rated = p.nameplate.pmaxW ?? 1;
  const flags = p.inspection.damageFlags;
  const options: RepairOption[] = REPAIR_IDS.map((id) => {
    const applicable = repairApplicable(id, flags);
    const after = applicable ? powerAfterRepairs(inputs, [id]) : null;
    const gain: Range =
      after && now
        ? {
            low: Math.max(0, after.low - now.low),
            expected: Math.max(0, after.expected - now.expected),
            high: Math.max(0, after.high - now.high),
          }
        : range(0);
    const cost = s.repairCostsInr[id];
    return {
      id,
      applicable,
      powerRecoveredW: gain,
      powerRecoveredPercentOfRated: {
        low: gain.low / rated,
        expected: gain.expected / rated,
        high: gain.high / rated,
      },
      costInrLow: cost.low * s.assumptions.repairCostScale,
      costInrHigh: cost.high * s.assumptions.repairCostScale,
      recommended: false,
    };
  });
  // Recommend a repair when its expected energy value over remaining life beats its cost.
  for (const o of options) {
    const value =
      energyKwh(o.powerRecoveredW.expected, s.assumptions) * s.assumptions.tariffInrPerKwh;
    o.recommended =
      o.applicable && o.powerRecoveredW.expected >= 1 && value > (o.costInrLow + o.costInrHigh) / 2;
  }
  return options;
}

function hasFlag(flags: DamageFlag[], type: DamageFlag['type'], minSev = 1) {
  return flags.some((f) => f.type === type && f.severity >= minSev);
}

export function decide(p: PanelPassport, s: AppSettings): DecisionRecord | null {
  if (!p.twin) return null;
  const a = s.assumptions;
  const flags = p.inspection.damageFlags;
  const rated = p.nameplate.pmaxW ?? 1;
  const reuseCfg = assumptions.reuse;
  const now = p.twin.now.pmaxRangeW;
  const crackBelief = p.assessment.beliefs.cell_cracking;
  const risk = {
    low: reuseCfg.earlyFailureRiskIfCracked.low * crackBelief,
    high: reuseCfg.earlyFailureRiskIfCracked.high * crackBelief,
  };
  // Energy multiplier range: worst case takes the high risk.
  const survival = {
    low: 1 - risk.high,
    expected: 1 - (risk.low + risk.high) / 2,
    high: 1 - risk.low,
  };
  const install = mix(reuseCfg.installAndBosCostInr.low, reuseCfg.installAndBosCostInr.high);
  const noMaterials = Object.fromEntries(MATERIALS.map((m) => [m, range(0)])) as Record<
    Material,
    Range
  >;

  const repairs = p.repairOptions.filter((r) => r.recommended);
  const repairedPower = repairs.length
    ? powerAfterRepairs(
        twinInputsOf(p),
        repairs.map((r) => r.id),
      )
    : null;
  const repairPower = repairedPower
    ? {
        low: Math.max(now.low, repairedPower.low),
        expected: Math.max(now.expected, repairedPower.expected),
        high: Math.max(now.high, repairedPower.high),
      }
    : now;
  const repairCost = {
    low: repairs.reduce((t, r) => t + r.costInrLow, 0),
    high: repairs.reduce((t, r) => t + r.costInrHigh, 0),
  };

  const build = (kind: 'repair' | 'reuse', power: Range, extra: Range): DecisionOption => {
    const kwh: Range = {
      low: energyKwh(power.low, a) * survival.low,
      expected: energyKwh(power.expected, a) * survival.expected,
      high: energyKwh(power.high, a) * survival.high,
    };
    const cost: Range = {
      low: extra.low + install.low,
      expected: extra.expected + install.expected,
      high: extra.high + install.high,
    };
    const value = (k: number, c: number) => k * a.tariffInrPerKwh - c;
    let viable = true;
    let blockedReasonCode: string | undefined;
    if (hasFlag(flags, 'cracked_glass', 3)) {
      viable = false;
      blockedReasonCode = 'safety_block';
    } else if (kind === 'reuse' && hasFlag(flags, 'junction_box', 3)) {
      viable = false;
      blockedReasonCode = 'safety_block';
    } else if (power.expected / rated < reuseCfg.minimumFractionOfRated.value) {
      viable = false;
      blockedReasonCode = 'low_output';
    }
    return {
      kind,
      netValueInr: {
        low: value(kwh.low, cost.high),
        expected: value(kwh.expected, cost.expected),
        high: value(kwh.high, cost.low),
      },
      powerAfterW: power,
      energyKwh: kwh,
      materialsKg: noMaterials,
      costInr: cost,
      viable,
      blockedReasonCode,
    };
  };

  const repairOpt = build('repair', repairPower, mix(repairCost.low, repairCost.high));
  const reuseOpt = build('reuse', now, range(0));
  const mats = materialsFor(s, a);
  const matValue = materialsValue(mats, s);
  const handling = mix(
    assumptions.recycleHandlingCostInr.low,
    assumptions.recycleHandlingCostInr.high,
  );
  const recycleOpt: DecisionOption = {
    kind: 'recycle',
    netValueInr: {
      low: matValue.low - handling.high,
      expected: matValue.expected - handling.expected,
      high: matValue.high - handling.low,
    },
    powerAfterW: range(0),
    energyKwh: range(0),
    materialsKg: mats,
    costInr: handling,
    viable: true,
  };

  const options: Record<DecisionKind, DecisionOption> = {
    repair: repairOpt,
    reuse: reuseOpt,
    recycle: recycleOpt,
  };
  const ranked = (Object.values(options) as DecisionOption[])
    .filter((o) => o.viable)
    .sort((x, y) => y.netValueInr.expected - x.netValueInr.expected);
  // Reuse and Repair can tie when no repair helps; prefer the simpler action.
  let recommended: DecisionKind = ranked[0]?.kind ?? 'recycle';
  if (recommended === 'repair' && repairs.length === 0)
    recommended = reuseOpt.viable ? 'reuse' : 'recycle';

  const second = ranked.find((o) => o.kind !== recommended);
  const best = options[recommended].netValueInr.expected;
  const margin = second
    ? (best - second.netValueInr.expected) /
      (Math.abs(best) + Math.abs(second.netValueInr.expected) + 1)
    : 1;
  const answered = p.assessment.answers.length;
  const evidence = Math.min(1, answered / 6);
  const expected = Math.min(
    0.95,
    Math.max(0.35, 0.45 + 0.35 * Math.min(1, margin * 2) + 0.15 * evidence),
  );
  const spread = Math.max(0.05, 0.18 - 0.02 * answered);
  const confidence: Range = {
    low: Math.max(0.05, expected - spread),
    expected,
    high: Math.min(0.99, expected + spread),
  };

  const reasons: Reason[] = [];
  if (recommended === 'recycle') {
    const code = repairOpt.blockedReasonCode ?? reuseOpt.blockedReasonCode;
    reasons.push(
      code === 'safety_block'
        ? { code: 'safety_block', values: {} }
        : {
            code: 'low_output',
            values: { fractionPercent: Math.round((now.expected / rated) * 100) },
          },
    );
  } else if (recommended === 'repair') {
    reasons.push({
      code: 'repair_gain',
      values: {
        gainW: Math.round(repairPower.expected - now.expected),
        costInr: Math.round(repairCost.low),
        costHighInr: Math.round(repairCost.high),
      },
    });
  } else {
    reasons.push({
      code: 'no_repair_gain',
      values: { fractionPercent: Math.round((now.expected / rated) * 100) },
    });
  }
  if (crackBelief >= 0.3)
    reasons.push({ code: 'cracking_risk', values: { percent: Math.round(crackBelief * 100) } });
  if (second) {
    reasons.push({
      code: 'value_margin',
      values: { marginInr: Math.round(best - second.netValueInr.expected) },
    });
  }

  return {
    options,
    recommended,
    confidence,
    reasons,
    chosen: p.decision?.chosen ?? null,
    reasonIfOverridden: p.decision?.reasonIfOverridden ?? null,
    decidedBy: p.decision?.decidedBy ?? null,
    decidedAt: p.decision?.decidedAt ?? null,
    assumptionsUsed: { ...a },
  };
}
