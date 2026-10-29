// Client for the api's vision endpoints. The model key never reaches the browser: the api holds
// it, resizes the photo, strips EXIF and calls the model. Nothing here produces a number itself.

import type { DamageFlag, DamageType, Nameplate, NameplateField } from './types';

/** If the page is opened as 127.0.0.1 or a network address, call the api on that same host. */
function resolveApiUrl(): string {
  const configured = (
    (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000'
  ).replace(/\/$/, '');
  try {
    const url = new URL(configured);
    const local = ['localhost', '127.0.0.1'];
    if (local.includes(url.hostname) && window.location.hostname !== url.hostname) {
      url.hostname = window.location.hostname;
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return configured;
  }
}
const API_URL = resolveApiUrl();

/** The service cannot be reached or has no model configured: the screen falls back to manual entry. */
export class VisionUnavailable extends Error {}
/** The service answered but could not read the photo. */
export class VisionFailed extends Error {}

async function call<T>(path: string, form: FormData): Promise<T> {
  let res: Response | null = null;
  // One retry covers the api restarting while the photo is sent.
  for (let attempt = 0; attempt < 2 && !res; attempt++) {
    try {
      res = await fetch(`${API_URL}${path}`, { method: 'POST', body: form });
    } catch {
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1200));
    }
  }
  if (!res) throw new VisionUnavailable('The analysis service could not be reached.');
  const body = (await res.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  if (!res.ok) {
    const code = body?.error?.code ?? '';
    const message = body?.error?.message ?? 'The photo could not be analysed.';
    if (res.status === 503 || code === 'LLM_UNAVAILABLE') throw new VisionUnavailable(message);
    throw new VisionFailed(message);
  }
  return body as T;
}

interface FieldRead<T> {
  value: T | null;
  confidence: number;
  evidenceText: string;
}

interface NameplateResponse {
  model: string;
  fields: {
    manufacturer: FieldRead<string>;
    model: FieldRead<string>;
    pmaxW: FieldRead<number>;
    vocV: FieldRead<number>;
    iscA: FieldRead<number>;
    vmppV: FieldRead<number>;
    imppA: FieldRead<number>;
    yearManufactured: FieldRead<number>;
  };
}

export interface NameplateReading {
  nameplate: Nameplate;
  evidence: Partial<Record<NameplateField, string>>;
  modelName: string;
  /** Number of fields that were read (non-null). */
  readCount: number;
}

export async function readNameplate(
  file: Blob,
  fileName = 'nameplate.jpg',
): Promise<NameplateReading> {
  const form = new FormData();
  form.append('image', file, fileName);
  const r = await call<NameplateResponse>('/vision/nameplate', form);
  const f = r.fields;
  const nameplate: Nameplate = {
    manufacturer: f.manufacturer.value ?? '',
    model: f.model.value ?? '',
    pmaxW: f.pmaxW.value,
    vocV: f.vocV.value,
    iscA: f.iscA.value,
    vmppV: f.vmppV.value,
    imppA: f.imppA.value,
    yearManufactured:
      f.yearManufactured.value === null ? null : Math.round(f.yearManufactured.value),
    fieldSource: {},
    confidence: {},
  };
  const evidence: NameplateReading['evidence'] = {};
  let readCount = 0;
  for (const key of Object.keys(f) as NameplateField[]) {
    const read = f[key];
    if (read.value === null) continue;
    readCount++;
    nameplate.fieldSource[key] = 'extracted';
    nameplate.confidence[key] = read.confidence;
    if (read.evidenceText) evidence[key] = read.evidenceText;
  }
  return { nameplate, evidence, modelName: r.model, readCount };
}

export interface DefectSuggestion {
  flag: DamageFlag;
  confidence: number;
  evidence: string;
}

interface DefectsResponse {
  defects: {
    type: DamageType;
    severity: number;
    photo: number;
    approxCells: { row: number; col: number }[];
    confidence: number;
    evidence: string;
  }[];
}

/** Suggestions only: the technician confirms each one before it becomes part of the record. */
export async function suggestDefects(
  photos: { blob: Blob; slot: string }[],
): Promise<DefectSuggestion[]> {
  const form = new FormData();
  photos.forEach((p, i) => form.append('images', p.blob, `photo-${i}.jpg`));
  form.append('slots', JSON.stringify(photos.map((p) => p.slot)));
  const r = await call<DefectsResponse>('/vision/defects', form);
  const byType = new Map<DamageType, DefectSuggestion>();
  for (const d of r.defects) {
    const severity = Math.min(3, Math.max(1, d.severity)) as 1 | 2 | 3;
    const existing = byType.get(d.type);
    if (!existing) {
      byType.set(d.type, {
        flag: { type: d.type, severity, cells: d.approxCells },
        confidence: d.confidence,
        evidence: d.evidence,
      });
    } else {
      // Same type seen twice: keep the worse severity and the union of cells.
      const cells = [...existing.flag.cells];
      for (const c of d.approxCells)
        if (!cells.some((x) => x.row === c.row && x.col === c.col)) cells.push(c);
      existing.flag = {
        type: d.type,
        severity: Math.max(existing.flag.severity, severity) as 1 | 2 | 3,
        cells,
      };
      existing.confidence = Math.max(existing.confidence, d.confidence);
    }
  }
  return [...byType.values()].sort((a, b) => b.flag.severity - a.flag.severity);
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}
