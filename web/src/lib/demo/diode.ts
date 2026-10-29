// Single-diode panel model used by the demo adapter. Deterministic, no network, no models.
// A panel is three substrings in series, each with a bypass diode. This file is the TypeScript
// twin of what sim/ will serve; the screens only see the results through the API client.

import type { CurvePoint, OperatingPoint } from '../types';

const VT = 0.025852; // thermal voltage at 25 C, volts
const DIODE_FACTOR_START = 1.2;
const CELLS_PER_SUBSTRING = 20;
export const SUBSTRINGS = 3;
export const BYPASS_VF_V = 0.5; // Assumption: Schottky bypass diode forward drop
export const TEMP_COEFF_VOC_PER_K = -0.0029; // Assumption: typical c-Si
export const TEMP_COEFF_ISC_PER_K = 0.0005; // Assumption: typical c-Si

export interface Substring {
  /** Photocurrent at 1000 W/m2, amps. */
  ilA: number;
  i0A: number;
  aV: number;
  rsOhm: number;
  rshOhm: number;
}

export interface PanelModel {
  subs: Substring[];
}

export interface Conditions {
  /** Irradiance on each substring, W/m2. */
  irradiance: [number, number, number];
  cellTempC: number;
}

export const STC: Conditions = { irradiance: [1000, 1000, 1000], cellTempC: 25 };

export interface IvCurve {
  iA: Float64Array;
  vV: Float64Array;
}

function substringVoltage(s: Substring, iA: number, g: number, tempC: number): number {
  const il = s.ilA * g * (1 + TEMP_COEFF_ISC_PER_K * (tempC - 25));
  const a = s.aV;
  const f = (v: number) =>
    il - s.i0A * (Math.exp((v + iA * s.rsOhm) / a) - 1) - (v + iA * s.rsOhm) / s.rshOhm - iA;
  let lo = -2 * BYPASS_VF_V - 5;
  let hi = 40;
  for (let k = 0; k < 44; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  // The bypass diode clamps a substring that would go below -Vf.
  return Math.max((lo + hi) / 2, -BYPASS_VF_V);
}

export function panelVoltage(model: PanelModel, iA: number, c: Conditions): number {
  let v = 0;
  for (let k = 0; k < SUBSTRINGS; k++) {
    const s = model.subs[k]!;
    v += substringVoltage(s, iA, c.irradiance[k]! / 1000, c.cellTempC);
  }
  // Temperature enters through the datasheet-style voltage coefficient (Assumption).
  return v * (1 + TEMP_COEFF_VOC_PER_K * (c.cellTempC - 25));
}

/** Sample V(I) on a uniform current grid from reverse injection up past the weakest limit. */
export function buildCurve(model: PanelModel, c: Conditions, points = 160): IvCurve {
  const maxIl = Math.max(...model.subs.map((s, k) => s.ilA * (c.irradiance[k]! / 1000)));
  const iMax = Math.max(maxIl * 1.15, 0.5);
  const iMin = -2.5;
  const iA = new Float64Array(points);
  const vV = new Float64Array(points);
  for (let n = 0; n < points; n++) {
    iA[n] = iMin + ((iMax - iMin) * n) / (points - 1);
    vV[n] = panelVoltage(model, iA[n]!, c);
  }
  return { iA, vV };
}

/** I(V) by interpolating the monotone V(I) samples; clamped to the sampled range. */
export function currentAt(curve: IvCurve, vV: number): number {
  const { iA, vV: vs } = curve;
  const n = iA.length;
  if (vV >= vs[0]!) return iA[0]!;
  if (vV <= vs[n - 1]!) return iA[n - 1]!;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (vs[mid]! > vV) lo = mid;
    else hi = mid;
  }
  const t = (vV - vs[lo]!) / (vs[hi]! - vs[lo]!);
  return iA[lo]! + t * (iA[hi]! - iA[lo]!);
}

/** V(I) by interpolation; the current samples must be ascending but need not be uniform. */
export function voltageAt(curve: IvCurve, iA: number): number {
  const { iA: is, vV } = curve;
  const n = is.length;
  if (iA <= is[0]!) return vV[0]!;
  if (iA >= is[n - 1]!) return vV[n - 1]!;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (is[mid]! <= iA) lo = mid;
    else hi = mid;
  }
  const t = (iA - is[lo]!) / (is[hi]! - is[lo]!);
  return vV[lo]! + t * (vV[hi]! - vV[lo]!);
}

export function operatingPoint(curve: IvCurve): OperatingPoint {
  let best = 0;
  let bi = 0;
  for (let n = 0; n < curve.iA.length; n++) {
    const p = curve.iA[n]! * curve.vV[n]!;
    if (curve.iA[n]! >= 0 && curve.vV[n]! >= 0 && p > best) {
      best = p;
      bi = n;
    }
  }
  const vocV = Math.max(0, voltageAt(curve, 0));
  const iscA = Math.max(0, currentAt(curve, 0));
  return {
    pmaxW: best,
    vmppV: curve.vV[bi]!,
    imppA: curve.iA[bi]!,
    vocV,
    iscA,
    fillFactor: vocV * iscA > 0 ? best / (vocV * iscA) : 0,
  };
}

/** Curve points in the first quadrant, for charts and tables. */
export function chartPoints(curve: IvCurve, maxPoints = 90): CurvePoint[] {
  const out: CurvePoint[] = [];
  for (let n = 0; n < curve.iA.length; n++) {
    const i = curve.iA[n]!;
    const v = curve.vV[n]!;
    if (i >= 0 && v >= 0) out.push({ vV: v, iA: i, pW: v * i });
  }
  out.sort((a, b) => a.vV - b.vV);
  if (out.length <= maxPoints) return out;
  const step = out.length / maxPoints;
  return Array.from(
    { length: maxPoints },
    (_, k) => out[Math.min(out.length - 1, Math.round(k * step))]!,
  );
}

export interface FitInput {
  pmaxW: number;
  vocV: number;
  iscA: number;
}

/**
 * Fit a healthy panel to its nameplate: choose the diode factor and series resistance that
 * reproduce Pmax, Voc and Isc. Shunt resistance is an Assumption (300 ohm per panel).
 */
export function fitPanel({ pmaxW, vocV, iscA }: FitInput): PanelModel {
  const rshPanel = 300;
  const rshS = rshPanel / SUBSTRINGS;
  const vocS = vocV / SUBSTRINGS;

  const build = (diodeFactor: number, rsPanel: number): PanelModel => {
    const aV = diodeFactor * CELLS_PER_SUBSTRING * VT;
    const rsS = rsPanel / SUBSTRINGS;
    let il = iscA;
    let i0 = 1e-9;
    for (let k = 0; k < 6; k++) {
      i0 = (il - vocS / rshS) / (Math.exp(vocS / aV) - 1);
      il = iscA + i0 * (Math.exp((iscA * rsS) / aV) - 1) + (iscA * rsS) / rshS;
    }
    const sub: Substring = { ilA: il, i0A: i0, aV, rsOhm: rsS, rshOhm: rshS };
    return { subs: [sub, { ...sub }, { ...sub }] };
  };
  const pmaxOf = (m: PanelModel) => operatingPoint(buildCurve(m, STC, 120)).pmaxW;

  let diodeFactor = DIODE_FACTOR_START;
  while (diodeFactor > 0.6 && pmaxOf(build(diodeFactor, 0)) < pmaxW) diodeFactor -= 0.1;

  let lo = 0;
  let hi = 4;
  for (let k = 0; k < 22; k++) {
    const mid = (lo + hi) / 2;
    if (pmaxOf(build(diodeFactor, mid)) > pmaxW) lo = mid;
    else hi = mid;
  }
  return build(diodeFactor, (lo + hi) / 2);
}

export function cloneModel(m: PanelModel): PanelModel {
  return { subs: m.subs.map((s) => ({ ...s })) };
}

export function totalSeriesResistance(m: PanelModel): number {
  return m.subs.reduce((sum, s) => sum + s.rsOhm, 0);
}
