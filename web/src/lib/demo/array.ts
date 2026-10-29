// Array solver and composer for the demo adapter: series strings at common current, parallel
// groups at common voltage (reverse current included), groups in series. Deterministic.

import type { ConfigKind, ConfigResult, CurvePoint, DayFrame, DayResult } from '../types';
import {
  buildCurve,
  currentAt,
  operatingPoint,
  voltageAt,
  type Conditions,
  type IvCurve,
  type PanelModel,
} from './diode';

export const INVERTER_WINDOW = { vMinV: 30, vMaxV: 600 }; // Assumption: wide-window DC input
const REVERSE_THRESHOLD_A = 0.1;

export interface ArrayPanel {
  id: string;
  model: PanelModel;
}

export interface Settings {
  converterEfficiency: number;
  optimiserCostInrPerPanel: number;
  relayCostInrPerPanel: number;
}

export interface LayoutSlot {
  panelId: string;
  col: number;
  row: number;
}

function seriesCurve(curves: IvCurve[]): IvCurve {
  const n = 160;
  const iMin = -2.5;
  const iMax = Math.max(...curves.map((c) => c.iA[c.iA.length - 1]!));
  const iA = new Float64Array(n);
  const vV = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    iA[k] = iMin + ((iMax - iMin) * k) / (n - 1);
    let v = 0;
    for (const c of curves) v += voltageAt(c, iA[k]!);
    vV[k] = v;
  }
  return { iA, vV };
}

function parallelCurve(curves: IvCurve[]): IvCurve {
  if (curves.length === 1) return curves[0]!;
  const n = 220;
  const vHigh = Math.max(...curves.map((c) => c.vV[0]!));
  const vLow = Math.min(...curves.map((c) => c.vV[c.vV.length - 1]!));
  const iA = new Float64Array(n);
  const vV = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const v = vHigh - ((vHigh - vLow) * k) / (n - 1);
    let i = 0;
    for (const c of curves) i += currentAt(c, v);
    vV[k] = v;
    iA[k] = i;
  }
  return { iA, vV };
}

export interface ArrayEval {
  curve: IvCurve;
  pmaxW: number;
  vmppV: number;
  imppA: number;
  localMaxima: number;
  reverseEvents: number;
  violations: string[];
}

function countPeaks(curve: IvCurve, pmax: number): number {
  const pts: { v: number; p: number }[] = [];
  for (let k = 0; k < curve.iA.length; k++) {
    if (curve.iA[k]! >= 0 && curve.vV[k]! >= 0)
      pts.push({ v: curve.vV[k]!, p: curve.vV[k]! * curve.iA[k]! });
  }
  pts.sort((a, b) => a.v - b.v);
  let peaks = 0;
  let lastValley = pts[0]?.p ?? 0;
  let rising = true;
  let top = lastValley;
  for (const { p } of pts) {
    if (rising) {
      if (p > top) top = p;
      else if (top - p > 0.03 * pmax) {
        if (top - lastValley > 0.03 * pmax || peaks === 0) peaks++;
        rising = false;
        lastValley = p;
      }
    } else if (p < lastValley) lastValley = p;
    else if (p - lastValley > 0.03 * pmax) {
      rising = true;
      top = p;
    }
  }
  if (rising && top > 0.03 * pmax) peaks++;
  return Math.max(1, peaks);
}

/** grouping: groups in series; each group is parallel strings; each string is series panels. */
export function evaluateGrouping(curves: Map<string, IvCurve>, grouping: string[][][]): ArrayEval {
  const groupCurves: IvCurve[] = [];
  const stringCurves: IvCurve[][] = [];
  for (const group of grouping) {
    const strs = group.map((s) => seriesCurve(s.map((id) => curves.get(id)!)));
    stringCurves.push(strs);
    groupCurves.push(parallelCurve(strs));
  }
  const curve = groupCurves.length === 1 ? groupCurves[0]! : seriesCurve(groupCurves);
  let best = { p: 0, v: 0, i: 0 };
  for (let k = 0; k < curve.iA.length; k++) {
    const v = curve.vV[k]!;
    const i = curve.iA[k]!;
    if (v >= 0 && i >= 0 && v * i > best.p) best = { p: v * i, v, i };
  }
  let reverseEvents = 0;
  grouping.forEach((group, g) => {
    if (group.length < 2) return;
    const vGroup = voltageAt(groupCurves[g]!, best.i);
    for (const s of stringCurves[g]!)
      if (currentAt(s, vGroup) < -REVERSE_THRESHOLD_A) reverseEvents++;
  });
  const violations: string[] = [];
  if (best.p > 0 && best.v < INVERTER_WINDOW.vMinV) violations.push('below_inverter_window');
  if (best.v > INVERTER_WINDOW.vMaxV) violations.push('above_inverter_window');
  return {
    curve,
    pmaxW: best.p,
    vmppV: best.v,
    imppA: best.i,
    localMaxima: countPeaks(curve, best.p),
    reverseEvents,
    violations,
  };
}

export function toChartPoints(curve: IvCurve, max = 90): CurvePoint[] {
  const out: CurvePoint[] = [];
  for (let k = 0; k < curve.iA.length; k++) {
    if (curve.iA[k]! >= 0 && curve.vV[k]! >= 0)
      out.push({ vV: curve.vV[k]!, iA: curve.iA[k]!, pW: curve.vV[k]! * curve.iA[k]! });
  }
  out.sort((a, b) => a.vV - b.vV);
  const step = Math.max(1, Math.floor(out.length / max));
  return out.filter((_, k) => k % step === 0);
}

// ---------- Optimiser ----------

function chunk<T>(list: T[], parts: number): T[][] {
  const out: T[][] = [];
  const size = Math.ceil(list.length / parts);
  for (let k = 0; k < list.length; k += size) out.push(list.slice(k, k + size));
  return out;
}

export interface OptimiseResult {
  grouping: string[][][];
  excluded: { panelId: string; deltaOutputW: number }[];
}

/**
 * Current-matched grouping: sort by Impp, split into S strings of similar current, try each S and
 * each exclusion count, and keep the candidate with the highest exactly-evaluated power.
 */
export function optimise(
  panels: ArrayPanel[],
  curves: Map<string, IvCurve>,
  conditions: Conditions,
): OptimiseResult {
  const impp = new Map(panels.map((p) => [p.id, operatingPoint(curves.get(p.id)!).imppA]));
  const sorted = [...panels].map((p) => p.id).sort((a, b) => impp.get(b)! - impp.get(a)!);
  const byWeakest = [...sorted].reverse();
  void conditions;

  let best: { grouping: string[][][]; power: number; excluded: string[] } | null = null;
  const maxExcluded = Math.min(2, Math.max(0, sorted.length - 2));
  for (let drop = 0; drop <= maxExcluded; drop++) {
    const dropped = byWeakest.slice(0, drop);
    const kept = sorted.filter((id) => !dropped.includes(id));
    for (let s = 1; s <= Math.min(4, kept.length); s++) {
      const strings = chunk(kept, s);
      const power = evaluateGrouping(curves, [strings]).pmaxW;
      if (!best || power > best.power + 1e-6)
        best = { grouping: [strings], power, excluded: dropped };
    }
  }
  const chosen = best ?? { grouping: [[sorted]], power: 0, excluded: [] as string[] };
  const excluded = chosen.excluded.map((id) => {
    const strings = chosen.grouping[0]!.map((s) => [...s]);
    const shortest = strings.reduce((a, b) => (b.length < a.length ? b : a));
    shortest.push(id);
    const withIt = evaluateGrouping(curves, [strings]).pmaxW;
    return { panelId: id, deltaOutputW: withIt - chosen.power };
  });
  return { grouping: chosen.grouping, excluded };
}

// ---------- Day simulation ----------

export interface ScenarioDef {
  id: string;
  nameKey: string;
  descriptionKey: string;
  shadow: { fromMinute: number; toMinute: number; widthPanels: number } | null;
  deadSubstringPanels: number;
  agingYears: number;
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'mixed_no_shade',
    nameKey: 'composer.scenarios.mixed_no_shade.name',
    descriptionKey: 'composer.scenarios.mixed_no_shade.description',
    shadow: null,
    deadSubstringPanels: 0,
    agingYears: 0,
  },
  {
    id: 'passing_shadow',
    nameKey: 'composer.scenarios.passing_shadow.name',
    descriptionKey: 'composer.scenarios.passing_shadow.description',
    shadow: { fromMinute: 9 * 60, toMinute: 16 * 60, widthPanels: 1.7 },
    deadSubstringPanels: 0,
    agingYears: 0,
  },
  {
    id: 'dead_substring',
    nameKey: 'composer.scenarios.dead_substring.name',
    descriptionKey: 'composer.scenarios.dead_substring.description',
    shadow: null,
    deadSubstringPanels: 2,
    agingYears: 0,
  },
  {
    id: 'aging_5y',
    nameKey: 'composer.scenarios.aging_5y.name',
    descriptionKey: 'composer.scenarios.aging_5y.description',
    shadow: null,
    deadSubstringPanels: 0,
    agingYears: 5,
  },
];

/** Clear-sky global horizontal irradiance (Haurwitz). Used as plane-of-array: an Assumption. */
export function clearSkyIrradiance(
  minuteOfDay: number,
  latitudeDeg: number,
  dayOfYear = 300,
): number {
  const rad = Math.PI / 180;
  const decl = 23.45 * Math.sin(((2 * Math.PI) / 365) * (284 + dayOfYear)) * rad;
  const hour = (minuteOfDay / 60 - 12) * 15 * rad;
  const lat = latitudeDeg * rad;
  const cosz = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hour);
  if (cosz <= 0.02) return 0;
  return 1098 * cosz * Math.exp(-0.059 / cosz);
}

export function defaultLayout(ids: string[]): LayoutSlot[] {
  const cols = Math.ceil(ids.length / 2);
  return ids.map((panelId, k) => ({ panelId, col: k % cols, row: Math.floor(k / cols) }));
}

function applyScenarioToModel(model: PanelModel, index: number, sc: ScenarioDef): PanelModel {
  const m: PanelModel = { subs: model.subs.map((s) => ({ ...s })) };
  if (index < sc.deadSubstringPanels) {
    m.subs[0]!.ilA *= 0.01;
    m.subs[0]!.rshOhm = 0.5; // shunted, so it contributes almost no open-circuit voltage
  }
  if (sc.agingYears > 0) {
    const rate = 0.004 + ((index * 7) % 11) * 0.001; // 0.4 to 1.4 percent per year, Assumption
    for (const s of m.subs) s.ilA *= Math.pow(1 - rate, sc.agingYears);
  }
  return m;
}

function shadeFactors(
  col: number,
  shadowStart: number,
  shadowEnd: number,
): [number, number, number] {
  const out: [number, number, number] = [1, 1, 1];
  for (let k = 0; k < 3; k++) {
    const a = col + k / 3;
    const b = col + (k + 1) / 3;
    const overlap = Math.max(0, Math.min(b, shadowEnd) - Math.max(a, shadowStart));
    out[k] = 1 - 0.85 * Math.min(1, overlap / (1 / 3));
  }
  return out;
}

export function simulateDay(
  panels: ArrayPanel[],
  layout: LayoutSlot[],
  scenario: ScenarioDef,
  settings: Settings,
  latitudeDeg: number,
  hardware: { relayCost: number; optimiserCost: number },
): DayResult {
  const models = panels.map((p, k) => ({
    id: p.id,
    model: applyScenarioToModel(p.model, k, scenario),
  }));
  const colOf = new Map(layout.map((s) => [s.panelId, s.col]));
  const cols = Math.max(1, ...layout.map((s) => s.col + 1));

  // Static groupings are chosen from the unshaded noon state of today's panels.
  const noonCond: Conditions = { irradiance: [1000, 1000, 1000], cellTempC: 45 };
  const noonCurves = new Map(models.map((m) => [m.id, buildCurve(m.model, noonCond, 140)]));
  const ids = models.map((m) => m.id);
  const opt = optimise(models, noonCurves, noonCond);
  const groupings: Record<Exclude<ConfigKind, 'dc_optimiser'>, string[][][]> = {
    naive_series: [[ids]],
    naive_parallel: [ids.map((id) => [id])],
    optimised_grouping: opt.grouping,
  };

  const frames: DayFrame[] = [];
  const energy: Record<ConfigKind, number> = {
    naive_series: 0,
    naive_parallel: 0,
    optimised_grouping: 0,
    dc_optimiser: 0,
  };
  const reverse: Record<ConfigKind, number> = {
    naive_series: 0,
    naive_parallel: 0,
    optimised_grouping: 0,
    dc_optimiser: 0,
  };
  let individualEnergyWh = 0;
  let noonEval: Record<string, ArrayEval> = {};
  let noonMinute = 0;
  let noonIrr = -1;
  const stepMin = 15;

  for (let minute = 6 * 60; minute <= 18 * 60; minute += stepMin) {
    const g = clearSkyIrradiance(minute, latitudeDeg);
    const cellTempC = 30 + 0.025 * g;
    let shadowStart = -10;
    let shadowEnd = -10;
    if (scenario.shadow) {
      const { fromMinute, toMinute, widthPanels } = scenario.shadow;
      const t = Math.min(1, Math.max(0, (minute - fromMinute) / (toMinute - fromMinute)));
      shadowStart = -widthPanels + t * (cols + widthPanels);
      shadowEnd = shadowStart + widthPanels;
    }
    const curves = new Map<string, IvCurve>();
    const panelShade: Record<string, number> = {};
    const mpp: number[] = [];
    for (const m of models) {
      const f = scenario.shadow
        ? shadeFactors(colOf.get(m.id) ?? 0, shadowStart, shadowEnd)
        : ([1, 1, 1] as [number, number, number]);
      panelShade[m.id] = (f[0] + f[1] + f[2]) / 3;
      const cond: Conditions = { irradiance: [g * f[0], g * f[1], g * f[2]], cellTempC };
      const curve =
        g > 5
          ? buildCurve(m.model, cond, 110)
          : buildCurve(m.model, { ...cond, irradiance: [5, 5, 5] }, 40);
      curves.set(m.id, curve);
      mpp.push(g > 5 ? operatingPoint(curve).pmaxW : 0);
    }
    const powerW = {
      naive_series: 0,
      naive_parallel: 0,
      optimised_grouping: 0,
      dc_optimiser: 0,
    } as Record<ConfigKind, number>;
    const evals: Record<string, ArrayEval> = {};
    if (g > 5) {
      for (const kind of Object.keys(groupings) as (keyof typeof groupings)[]) {
        const ev = evaluateGrouping(curves, groupings[kind]);
        evals[kind] = ev;
        powerW[kind] = ev.pmaxW;
        reverse[kind] += ev.reverseEvents > 0 ? 1 : 0;
      }
      powerW.dc_optimiser = mpp.reduce(
        (t, p) => t + (p > 3 ? p * settings.converterEfficiency : 0),
        0,
      );
      if (g > noonIrr) {
        noonIrr = g;
        noonEval = evals;
        noonMinute = minute;
      }
    }
    const hours = stepMin / 60;
    for (const kind of Object.keys(energy) as ConfigKind[]) energy[kind] += powerW[kind] * hours;
    individualEnergyWh += mpp.reduce((t, p) => t + p, 0) * hours;
    frames.push({
      minuteOfDay: minute,
      irradianceWm2: g,
      shadowStart,
      shadowEnd,
      powerW,
      panelShade,
    });
  }
  void noonMinute;

  const mismatch = (kind: ConfigKind) =>
    individualEnergyWh > 0 ? Math.max(0, 1 - energy[kind] / individualEnergyWh) * 100 : 0;
  const n = models.length;
  const make = (kind: ConfigKind): ConfigResult => {
    const ev = noonEval[kind];
    return {
      kind,
      grouping: kind === 'dc_optimiser' ? [ids.map((id) => [id])] : groupings[kind],
      excluded: kind === 'optimised_grouping' ? opt.excluded : [],
      maxPowerW: Math.max(...frames.map((f) => f.powerW[kind])),
      vmppV: ev?.vmppV ?? 0,
      imppA: ev?.imppA ?? 0,
      dailyKwh: energy[kind] / 1000,
      mismatchLossPercent: mismatch(kind),
      reverseCurrentEvents: reverse[kind],
      localMaxima: ev?.localMaxima ?? 1,
      hardwareCostInr:
        kind === 'optimised_grouping'
          ? hardware.relayCost * n
          : kind === 'dc_optimiser'
            ? hardware.optimiserCost * n
            : 0,
      curve: ev ? toChartPoints(ev.curve) : [],
      violations: ev?.violations ?? [],
    };
  };
  const configs = (
    ['naive_series', 'naive_parallel', 'optimised_grouping', 'dc_optimiser'] as ConfigKind[]
  ).map(make);
  const winner = configs.reduce((a, b) => (b.dailyKwh > a.dailyKwh ? b : a)).kind;
  return { scenarioId: scenario.id, frames, configs, winnerByEnergy: winner };
}
