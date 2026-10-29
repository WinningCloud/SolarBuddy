// Digital twin for one panel: defect mapping, calibration to measurements, repair what-ifs.
// Every mapping coefficient below is an Assumption (to be verified against field data) and is
// listed in docs/METHODOLOGY.md. Severity is 1 (minor) to 3 (severe).

import type {
  CellInfo,
  CellRef,
  DamageFlag,
  Inspection,
  Nameplate,
  Range,
  RepairId,
  Twin,
} from '../types';
import {
  buildCurve,
  chartPoints,
  cloneModel,
  fitPanel,
  operatingPoint,
  STC,
  SUBSTRINGS,
  totalSeriesResistance,
  type Conditions,
  type PanelModel,
} from './diode';

export const GRID_ROWS = 6;
export const GRID_COLS = 10;

const CONDITION_IRRADIANCE = { bright_sun: 900, hazy: 600, overcast: 300 } as const;
const OUTPUT_BANDS: Record<string, [number, number]> = {
  above90: [0.9, 1.0],
  '70to90': [0.7, 0.9],
  '40to70': [0.4, 0.7],
  below40: [0.1, 0.4],
};
/** Defect severity multipliers used to express modelling uncertainty as a range. */
const STRENGTHS = { low: 1.5, expected: 1, high: 0.5 } as const;

export const substringOfRow = (row: number) => Math.min(SUBSTRINGS - 1, Math.floor(row / 2));

function affectedSubstrings(cells: CellRef[], fallback: number[]): number[] {
  if (cells.length === 0) return fallback;
  return [...new Set(cells.map((c) => substringOfRow(c.row)))];
}

/** Apply defect flags to a healthy model. `strength` scales how much each defect costs. */
export function applyDefects(base: PanelModel, flags: DamageFlag[], strength = 1): PanelModel {
  const m = cloneModel(base);
  const all = [0, 1, 2];
  for (const flag of flags) {
    const sev = flag.severity * strength;
    switch (flag.type) {
      case 'cracked_cell':
        for (const k of affectedSubstrings(flag.cells, [1])) {
          const count = flag.cells.filter((c) => substringOfRow(c.row) === k).length || 1;
          m.subs[k]!.ilA *= Math.max(0.2, 1 - 0.1 * sev * Math.sqrt(Math.min(count, 4)));
          m.subs[k]!.rshOhm /= 1 + 0.4 * sev;
        }
        break;
      case 'cracked_glass':
        for (const k of all) m.subs[k]!.ilA *= Math.max(0.5, 1 - 0.02 * sev);
        break;
      case 'browning':
        for (const k of all) m.subs[k]!.ilA *= Math.max(0.4, 1 - 0.05 * sev);
        break;
      case 'soiling':
        for (const k of all) m.subs[k]!.ilA *= Math.max(0.6, 1 - 0.04 * sev);
        break;
      case 'delamination':
        for (const k of affectedSubstrings(flag.cells, all)) {
          m.subs[k]!.ilA *= Math.max(0.4, 1 - 0.04 * sev);
          m.subs[k]!.rsOhm *= 1 + 0.12 * sev;
        }
        break;
      case 'hot_spot':
        for (const k of affectedSubstrings(flag.cells, [1])) {
          if (flag.severity >= 3) {
            // Burnt through: the substring no longer generates and its bypass diode conducts.
            m.subs[k]!.ilA *= 0.01;
            m.subs[k]!.rshOhm = 0.5; // shunted, so it contributes almost no open-circuit voltage
          } else {
            m.subs[k]!.rsOhm *= 1 + 0.5 * sev;
            m.subs[k]!.rshOhm /= 1 + 0.5 * sev;
          }
        }
        break;
      case 'junction_box':
        // Added contact resistance spread over the three substrings.
        for (const k of all) m.subs[k]!.rsOhm += 0.04 * sev;
        break;
      case 'snail_trails':
        for (const k of all) m.subs[k]!.ilA *= Math.max(0.9, 1 - 0.005 * sev);
        break;
      case 'frame_damage':
        break; // Mechanical only; no electrical effect modelled.
    }
  }
  return m;
}

function scaleIl(m: PanelModel, g: number): PanelModel {
  const out = cloneModel(m);
  for (const s of out.subs) s.ilA *= g;
  return out;
}

function pmaxAt(m: PanelModel, irradiance: number): number {
  const c: Conditions = { irradiance: [irradiance, irradiance, irradiance], cellTempC: 25 };
  return operatingPoint(buildCurve(m, c, 120)).pmaxW;
}

/** Find a global photocurrent factor so Pmax at `irradiance` hits `targetW`. */
function calibrate(m: PanelModel, irradiance: number, targetW: number): number {
  let lo = 0.05;
  let hi = 1.3;
  for (let k = 0; k < 20; k++) {
    const mid = (lo + hi) / 2;
    if (pmaxAt(scaleIl(m, mid), irradiance) < targetW) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface TwinInputs {
  nameplate: Nameplate;
  inspection: Inspection;
  /** Answer to the measured-output question, if given. */
  outputBand: string | null;
}

interface Solved {
  model: PanelModel;
  pmaxW: number;
  g: number;
  calibratedTo: Twin['calibratedTo'];
}

export function healthyModel(np: Nameplate): PanelModel | null {
  if (!np.pmaxW || !np.vocV || !np.iscA) return null;
  return fitPanel({ pmaxW: np.pmaxW, vocV: np.vocV, iscA: np.iscA });
}

function solve(
  healthy: PanelModel,
  flags: DamageFlag[],
  strength: number,
  inputs: TwinInputs,
  bandEdge: 'low' | 'mid' | 'high',
  fixedG?: number,
): Solved {
  const withDefects = applyDefects(healthy, flags, strength);
  const rated = inputs.nameplate.pmaxW ?? 0;
  const { measured } = inputs.inspection;
  let g = 1;
  let calibratedTo: Twin['calibratedTo'] = 'defects_only';
  if (fixedG !== undefined) {
    g = fixedG;
  } else if (measured.pmaxW && measured.conditions) {
    g = calibrate(withDefects, CONDITION_IRRADIANCE[measured.conditions], measured.pmaxW);
    calibratedTo = 'measured';
  } else if (inputs.outputBand && OUTPUT_BANDS[inputs.outputBand]) {
    const [lo, hi] = OUTPUT_BANDS[inputs.outputBand]!;
    const frac = bandEdge === 'low' ? lo : bandEdge === 'high' ? hi : (lo + hi) / 2;
    g = calibrate(withDefects, 1000, frac * rated);
    calibratedTo = 'output_band';
  }
  const model = scaleIl(withDefects, g);
  return { model, pmaxW: pmaxAt(model, 1000), g, calibratedTo };
}

/** The panel as it is today (defects plus calibration), for array simulation. */
export function nowModel(inputs: TwinInputs): PanelModel | null {
  const healthy = healthyModel(inputs.nameplate);
  if (!healthy) return null;
  return solve(healthy, inputs.inspection.damageFlags, STRENGTHS.expected, inputs, 'mid').model;
}

function cellInfos(flags: DamageFlag[]): CellInfo[] {
  const cells: CellInfo[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      let fraction = 1;
      const notes: string[] = [];
      for (const f of flags) {
        const listed = f.cells.some((c) => c.row === row && c.col === col);
        const global = f.cells.length === 0;
        if (!listed && !(global && f.type !== 'cracked_cell' && f.type !== 'hot_spot')) continue;
        const loss =
          f.type === 'cracked_cell' || f.type === 'hot_spot'
            ? 0.1 * f.severity
            : f.type === 'browning'
              ? 0.05 * f.severity
              : f.type === 'delamination'
                ? 0.04 * f.severity
                : f.type === 'soiling'
                  ? 0.04 * f.severity
                  : 0;
        fraction *= 1 - loss;
        notes.push(f.type);
      }
      cells.push({
        row,
        col,
        substring: substringOfRow(row),
        effectiveIrradianceFraction: fraction,
        notes,
      });
    }
  }
  return cells;
}

const clampRange = (r: Range): Range => ({
  low: Math.min(r.low, r.expected, r.high),
  expected: r.expected,
  high: Math.max(r.low, r.expected, r.high),
});

export function estimateTwin(inputs: TwinInputs): Twin | null {
  const healthy = healthyModel(inputs.nameplate);
  const rated = inputs.nameplate.pmaxW;
  if (!healthy || !rated) return null;
  const flags = inputs.inspection.damageFlags;

  const mid = solve(healthy, flags, STRENGTHS.expected, inputs, 'mid');
  let pmaxRangeW: Range;
  if (mid.calibratedTo === 'measured') {
    // Meter accuracy of about 5 percent is an Assumption.
    pmaxRangeW = { low: mid.pmaxW * 0.95, expected: mid.pmaxW, high: mid.pmaxW * 1.05 };
  } else if (mid.calibratedTo === 'output_band') {
    pmaxRangeW = clampRange({
      low: solve(healthy, flags, 1, inputs, 'low').pmaxW,
      expected: mid.pmaxW,
      high: solve(healthy, flags, 1, inputs, 'high').pmaxW,
    });
  } else {
    pmaxRangeW = clampRange({
      low: solve(healthy, flags, STRENGTHS.low, inputs, 'mid').pmaxW,
      expected: mid.pmaxW,
      high: solve(healthy, flags, STRENGTHS.high, inputs, 'mid').pmaxW,
    });
  }

  const ratedCurve = buildCurve(healthy, STC, 200);
  const nowCurve = buildCurve(mid.model, STC, 200);
  return {
    rated: { curve: chartPoints(ratedCurve), point: operatingPoint(ratedCurve) },
    now: {
      curve: chartPoints(nowCurve),
      point: operatingPoint(nowCurve),
      pmaxRangeW,
      seriesResistanceOhm: totalSeriesResistance(mid.model),
      fractionOfRated: {
        low: pmaxRangeW.low / rated,
        expected: pmaxRangeW.expected / rated,
        high: pmaxRangeW.high / rated,
      },
    },
    calibratedTo: mid.calibratedTo,
    cells: cellInfos(flags),
    generatedAt: new Date().toISOString(),
  };
}

// ---------- Repairs ----------

export function repairTransform(id: RepairId, flags: DamageFlag[]): DamageFlag[] {
  switch (id) {
    case 'replace_junction_box':
      return flags.filter((f) => f.type !== 'junction_box');
    case 'resolder_busbar':
      return flags.filter((f) => !(f.type === 'hot_spot' && f.severity < 3));
    case 'bypass_dead_substring':
      // Isolate a burnt substring so it cannot carry current or heat up.
      return flags.map((f) =>
        f.type === 'hot_spot' && f.severity < 3 ? { ...f, severity: 3 } : f,
      );
    case 'clean_glass':
      return flags.filter((f) => f.type !== 'soiling');
  }
}

export function repairApplicable(id: RepairId, flags: DamageFlag[]): boolean {
  const has = (type: DamageFlag['type'], minSev = 1) =>
    flags.some((f) => f.type === type && f.severity >= minSev);
  switch (id) {
    case 'replace_junction_box':
      return has('junction_box');
    case 'resolder_busbar':
      return flags.some((f) => f.type === 'hot_spot' && f.severity < 3);
    case 'bypass_dead_substring':
      return flags.some((f) => f.type === 'hot_spot');
    case 'clean_glass':
      return has('soiling');
  }
}

/** Power after applying a set of repairs, as a range (same uncertainty handling as the twin). */
export function powerAfterRepairs(inputs: TwinInputs, ids: RepairId[]): Range | null {
  const healthy = healthyModel(inputs.nameplate);
  if (!healthy) return null;
  let flags = inputs.inspection.damageFlags;
  for (const id of ids) flags = repairTransform(id, flags);

  const run = (strength: number, edge: 'low' | 'mid' | 'high'): number => {
    // The calibration factor g comes from the damaged state, then is reused after repair.
    const before = solve(healthy, inputs.inspection.damageFlags, strength, inputs, edge);
    return solve(healthy, flags, strength, inputs, edge, before.g).pmaxW;
  };
  const measured = inputs.inspection.measured.pmaxW && inputs.inspection.measured.conditions;
  const banded = !measured && inputs.outputBand && OUTPUT_BANDS[inputs.outputBand];
  const values = banded
    ? [run(1, 'low'), run(1, 'mid'), run(1, 'high')]
    : [run(STRENGTHS.low, 'mid'), run(1, 'mid'), run(STRENGTHS.high, 'mid')];
  return clampRange({ low: values[0]!, expected: values[1]!, high: values[2]! });
}
