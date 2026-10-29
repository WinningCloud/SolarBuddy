// The one interface the screens use. Today it is backed by the in-browser demo engine
// (lib/demo/*), labelled "Demo data" in the UI. The real api service replaces this file's
// implementation without touching any screen.

import type {
  AppSettings,
  ConfigResult,
  DamageFlag,
  DecisionKind,
  DayResult,
  ImpactSummary,
  Measured,
  Material,
  Nameplate,
  PanelListFilter,
  PanelPassport,
  PhotoRef,
  Range,
  TriageState,
  AssumptionOverrides,
} from './types';
import { MATERIALS } from './types';
import { defaultsTable } from './demo/economics';
import { buildRepairOptions, decide, twinInputsOf } from './demo/economics';
import { replay, triageState } from './demo/triage';
import { estimateTwin, nowModel } from './demo/twin';
import {
  SCENARIOS,
  clearSkyIrradiance,
  defaultLayout,
  optimise,
  simulateDay,
  type LayoutSlot,
} from './demo/array';
import { buildCurve, type Conditions } from './demo/diode';
import {
  emptyPanel,
  loadPanels,
  loadSettings,
  nextPanelId,
  savePanels,
  saveSettings,
  seedDemoPanels,
} from './demo/store';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function requirePanel(id: string): { panels: PanelPassport[]; panel: PanelPassport } {
  const panels = loadPanels();
  const panel = panels.find((p) => p.id === id);
  if (!panel) throw new ApiError('NOT_FOUND', `Panel ${id} was not found.`);
  return { panels, panel };
}

function persist(panels: PanelPassport[], panel: PanelPassport): PanelPassport {
  const updated = { ...panel, updatedAt: new Date().toISOString() };
  savePanels(panels.map((p) => (p.id === updated.id ? updated : p)));
  return updated;
}

export const healthOf = (p: PanelPassport): number | null =>
  p.twin ? p.twin.now.fractionOfRated.expected : null;

export const decisionOf = (p: PanelPassport): DecisionKind | null =>
  p.decision ? (p.decision.chosen ?? p.decision.recommended) : null;

function downscale(file: File, maxEdge = 560): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ApiError('BAD_IMAGE', 'That file could not be read as an image.'));
    };
    img.src = url;
  });
}

// Fixture extractions: the demo adapter does not read the photo. The UI says so.
const EXTRACTION_FIXTURES: Nameplate[] = [
  {
    manufacturer: 'Waaree',
    model: 'WS-320',
    pmaxW: 320,
    vocV: 40.6,
    iscA: 9.9,
    vmppV: 33.1,
    imppA: 9.67,
    yearManufactured: null,
    fieldSource: {},
    confidence: {
      manufacturer: 0.98,
      model: 0.95,
      pmaxW: 0.97,
      vocV: 0.93,
      iscA: 0.92,
      vmppV: 0.9,
      imppA: 0.55,
    },
  },
  {
    manufacturer: 'Vikram Solar',
    model: 'Eldora 330',
    pmaxW: 330,
    vocV: 40.8,
    iscA: 10.2,
    vmppV: 33.6,
    imppA: 9.82,
    yearManufactured: 2017,
    fieldSource: {},
    confidence: {
      manufacturer: 0.96,
      model: 0.91,
      pmaxW: 0.97,
      vocV: 0.9,
      iscA: 0.9,
      vmppV: 0.88,
      imppA: 0.86,
      yearManufactured: 0.6,
    },
  },
  {
    manufacturer: 'Tata Power Solar',
    model: 'TP300',
    pmaxW: 300,
    vocV: 39.7,
    iscA: 9.8,
    vmppV: 32.3,
    imppA: 9.29,
    yearManufactured: 2014,
    fieldSource: {},
    confidence: {
      manufacturer: 0.94,
      model: 0.62,
      pmaxW: 0.95,
      vocV: 0.91,
      iscA: 0.9,
      vmppV: 0.89,
      imppA: 0.87,
      yearManufactured: 0.8,
    },
  },
];

export interface ExtractionResult {
  nameplate: Nameplate;
  mode: 'demo' | 'live';
}

export const api = {
  mode: 'demo' as const,

  // ----- panels -----
  async listPanels(filter: PanelListFilter = {}): Promise<PanelPassport[]> {
    await tick();
    const q = filter.q?.trim().toLowerCase();
    return loadPanels()
      .filter((p) => {
        const d = decisionOf(p);
        const h = healthOf(p);
        if (filter.decision && d !== filter.decision) return false;
        if (filter.healthBand) {
          if (h === null) return false;
          const band = h >= 0.8 ? 'good' : h >= 0.5 ? 'fair' : 'poor';
          if (band !== filter.healthBand) return false;
        }
        if (filter.from && p.createdAt < filter.from) return false;
        if (filter.to && p.createdAt > `${filter.to}T23:59:59`) return false;
        if (
          q &&
          !`${p.id} ${p.nameplate.manufacturer} ${p.nameplate.model}`.toLowerCase().includes(q)
        )
          return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getPanel(id: string): Promise<PanelPassport> {
    await tick();
    return requirePanel(id).panel;
  },

  async createPanel(): Promise<PanelPassport> {
    await tick();
    const panels = loadPanels();
    const panel = emptyPanel(nextPanelId(panels));
    savePanels([...panels, panel]);
    return panel;
  },

  async patchPanel(
    id: string,
    patch: Partial<
      Pick<PanelPassport, 'nameplate' | 'inspection' | 'stepIndex' | 'note' | 'status'>
    >,
  ): Promise<PanelPassport> {
    await tick();
    const { panels, panel } = requirePanel(id);
    return persist(panels, { ...panel, ...patch });
  },

  async deletePanel(id: string): Promise<void> {
    await tick();
    savePanels(loadPanels().filter((p) => p.id !== id));
  },

  async getPublicPassport(id: string): Promise<PanelPassport> {
    await tick();
    const panel = loadPanels().find((p) => p.id === id);
    if (!panel || panel.status === 'draft')
      throw new ApiError('NOT_FOUND', 'This passport does not exist or is not published yet.');
    return panel;
  },

  // ----- identify / inspect -----
  async extractNameplate(id: string, file: File): Promise<ExtractionResult> {
    await tick();
    const { panels, panel } = requirePanel(id);
    const fixture =
      EXTRACTION_FIXTURES[(file.size + file.name.length) % EXTRACTION_FIXTURES.length]!;
    const fieldSource = Object.fromEntries(
      Object.keys(fixture.confidence).map((k) => [k, 'extracted']),
    ) as Nameplate['fieldSource'];
    const nameplate: Nameplate = { ...fixture, fieldSource, confidence: { ...fixture.confidence } };
    persist(panels, { ...panel, nameplate });
    return { nameplate, mode: 'demo' };
  },

  async addPhoto(id: string, slot: PhotoRef['slot'], file: File): Promise<PhotoRef> {
    const url = await downscale(file);
    const { panels, panel } = requirePanel(id);
    const photo: PhotoRef = { id: `${id}-${slot}-${Date.now()}`, slot, url, name: file.name };
    persist(panels, {
      ...panel,
      inspection: {
        ...panel.inspection,
        photos: [...panel.inspection.photos.filter((p) => p.slot !== slot), photo],
      },
    });
    return photo;
  },

  async removePhoto(id: string, photoId: string): Promise<PanelPassport> {
    await tick();
    const { panels, panel } = requirePanel(id);
    return persist(panels, {
      ...panel,
      inspection: {
        ...panel.inspection,
        photos: panel.inspection.photos.filter((p) => p.id !== photoId),
      },
    });
  },

  async saveInspection(
    id: string,
    damageFlags: DamageFlag[],
    measured: Measured,
  ): Promise<PanelPassport> {
    await tick();
    const { panels, panel } = requirePanel(id);
    return persist(panels, {
      ...panel,
      inspection: { ...panel.inspection, damageFlags, measured },
    });
  },

  // ----- assessment -----
  async getTriage(id: string): Promise<TriageState> {
    await tick();
    return triageState(requirePanel(id).panel.assessment.answers);
  },

  async answer(id: string, questionId: string, answer: string): Promise<TriageState> {
    await tick();
    const { panels, panel } = requirePanel(id);
    const answers = [
      ...panel.assessment.answers.filter((a) => a.questionId !== questionId),
      { questionId, answer, at: new Date().toISOString() },
    ];
    const { beliefs, history } = replay(answers);
    persist(panels, { ...panel, assessment: { answers, beliefs, history } });
    return triageState(answers);
  },

  async undoAnswer(id: string): Promise<TriageState> {
    await tick();
    const { panels, panel } = requirePanel(id);
    const answers = panel.assessment.answers.slice(0, -1);
    const { beliefs, history } = replay(answers);
    persist(panels, { ...panel, assessment: { answers, beliefs, history } });
    return triageState(answers);
  },

  // ----- diagnose / decide -----
  async diagnose(id: string): Promise<PanelPassport> {
    await tick();
    const { panels, panel } = requirePanel(id);
    const settings = loadSettings();
    const twin = estimateTwin(twinInputsOf(panel));
    if (!twin)
      throw new ApiError(
        'MISSING_NAMEPLATE',
        'Rated power, Voc and Isc are needed to estimate current output.',
      );
    const withTwin = { ...panel, twin };
    const repairOptions = buildRepairOptions(withTwin, settings);
    return persist(panels, { ...withTwin, repairOptions });
  },

  async decide(id: string, overrides?: Partial<AssumptionOverrides>): Promise<PanelPassport> {
    await tick();
    const { panels, panel } = requirePanel(id);
    const base = loadSettings();
    const settings: AppSettings = { ...base, assumptions: { ...base.assumptions, ...overrides } };
    const withOptions = { ...panel, repairOptions: buildRepairOptions(panel, settings) };
    const decision = decide(withOptions, settings);
    if (!decision) throw new ApiError('NOT_DIAGNOSED', 'Run the diagnosis before the decision.');
    return persist(panels, {
      ...withOptions,
      decision,
      status: panel.status === 'draft' ? 'assessed' : panel.status,
    });
  },

  async acceptDecision(
    id: string,
    chosen: DecisionKind,
    reason: string | null,
  ): Promise<PanelPassport> {
    await tick();
    const { panels, panel } = requirePanel(id);
    if (!panel.decision) throw new ApiError('NOT_DECIDED', 'There is no decision to accept yet.');
    const decision = {
      ...panel.decision,
      chosen,
      reasonIfOverridden: chosen === panel.decision.recommended ? null : reason,
      decidedBy: panel.createdBy,
      decidedAt: new Date().toISOString(),
    };
    const status =
      chosen === 'recycle' ? 'closed' : panel.status === 'in_pool' ? 'in_pool' : 'assessed';
    return persist(panels, { ...panel, decision, status });
  },

  async addToPool(id: string, inPool: boolean): Promise<PanelPassport> {
    await tick();
    const { panels, panel } = requirePanel(id);
    return persist(panels, { ...panel, status: inPool ? 'in_pool' : 'assessed' });
  },

  // ----- demo data -----
  async loadDemoData(onProgress?: (done: number, total: number) => void): Promise<number> {
    const seeded = await seedDemoPanels(onProgress);
    const existing = loadPanels().filter((p) => !p.isDemo);
    savePanels([...existing, ...seeded]);
    return seeded.length;
  },

  async clearDemoData(): Promise<void> {
    await tick();
    savePanels(loadPanels().filter((p) => !p.isDemo));
  },

  // ----- settings -----
  async getSettings(): Promise<AppSettings> {
    await tick();
    return loadSettings();
  },
  async putSettings(s: AppSettings): Promise<AppSettings> {
    await tick();
    saveSettings(s);
    return s;
  },
  defaultsTable,

  // ----- impact -----
  async impactSummary(range: { from?: string; to?: string } = {}): Promise<ImpactSummary> {
    await tick();
    const panels = loadPanels().filter((p) => {
      if (!p.decision) return false;
      if (range.from && p.createdAt < range.from) return false;
      if (range.to && p.createdAt > `${range.to}T23:59:59`) return false;
      return true;
    });
    const zero = (): Range => ({ low: 0, expected: 0, high: 0 });
    const add = (a: Range, b: Range): Range => ({
      low: a.low + b.low,
      expected: a.expected + b.expected,
      high: a.high + b.high,
    });
    const decisions = { repair: 0, reuse: 0, recycle: 0 } as Record<DecisionKind, number>;
    let energy = zero();
    const mats = Object.fromEntries(MATERIALS.map((m) => [m, zero()])) as Record<Material, Range>;
    const rows: ImpactSummary['rows'] = [];
    for (const p of panels) {
      const kind = decisionOf(p)!;
      decisions[kind]++;
      const opt = p.decision!.options[kind];
      energy = add(energy, opt.energyKwh);
      let matSum = zero();
      for (const m of MATERIALS) {
        mats[m] = add(mats[m], opt.materialsKg[m]);
        matSum = add(matSum, opt.materialsKg[m]);
      }
      rows.push({
        panelId: p.id,
        decision: kind,
        pmaxNowW: p.twin?.now.point.pmaxW ?? 0,
        energyKwh: opt.energyKwh,
        materialsKg: matSum,
      });
    }
    const total = MATERIALS.reduce((t, m) => add(t, mats[m]), zero());
    return {
      panelCount: panels.length,
      decisions,
      poolSize: loadPanels().filter((p) => p.status === 'in_pool').length,
      energyKwh: energy,
      materialsKg: mats,
      totalMaterialsKg: total,
      rows,
    };
  },

  // ----- composer -----
  scenarios: SCENARIOS,

  async runComposer(
    panelIds: string[],
    scenarioId: string,
    layout?: LayoutSlot[],
  ): Promise<{ day: DayResult; layout: LayoutSlot[]; labels: Record<string, string> }> {
    await tick();
    const all = loadPanels();
    const settings = loadSettings();
    const chosen = panelIds
      .map((id) => all.find((p) => p.id === id))
      .filter((p): p is PanelPassport => Boolean(p));
    if (chosen.length < 2)
      throw new ApiError('NOT_ENOUGH_PANELS', 'Select at least two panels to compose an array.');
    const panels = chosen.flatMap((p) => {
      const model = nowModel(twinInputsOf(p));
      return model ? [{ id: p.id, model }] : [];
    });
    const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!;
    const useLayout =
      layout && layout.length === panels.length ? layout : defaultLayout(panels.map((p) => p.id));
    await new Promise((r) => setTimeout(r, 16));
    const day = simulateDay(panels, useLayout, scenario, settings, settings.latitudeDeg, {
      relayCost: settings.relayCostInrPerPanel,
      optimiserCost: settings.optimiserCostInrPerPanel,
    });
    return {
      day,
      layout: useLayout,
      labels: Object.fromEntries(chosen.map((p) => [p.id, `${p.nameplate.model}`])),
    };
  },

  /** Exposed for the Composer's per-panel exclusion note and the noon curve. */
  async previewOptimise(panelIds: string[]): Promise<ConfigResult['excluded']> {
    await tick();
    const all = loadPanels();
    const panels = panelIds.flatMap((id) => {
      const p = all.find((x) => x.id === id);
      const model = p ? nowModel(twinInputsOf(p)) : null;
      return model ? [{ id, model }] : [];
    });
    const c: Conditions = { irradiance: [1000, 1000, 1000], cellTempC: 45 };
    const curves = new Map(panels.map((p) => [p.id, buildCurve(p.model, c, 140)]));
    return optimise(panels, curves, c).excluded;
  },
};

export { clearSkyIrradiance };
