// Browser persistence for the demo adapter, plus the seed data. Replaced by the real api later.

import type {
  Assessment,
  DamageFlag,
  DecisionKind,
  PanelPassport,
  PanelStatus,
  PhotoRef,
  AppSettings,
} from '../types';
import { buildRepairOptions, decide, defaultSettings, twinInputsOf } from './economics';
import { replay } from './triage';
import { estimateTwin } from './twin';

const KEY = 'secondsun.demo.panels.v1';
const SETTINGS_KEY = 'secondsun.demo.settings.v1';
const DEMO_USER = 'Technician (demo)';

export class StorageError extends Error {}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new StorageError('Browser storage is full or unavailable.');
  }
}

export const loadPanels = (): PanelPassport[] => read<PanelPassport[]>(KEY, []);
export const savePanels = (panels: PanelPassport[]): void => write(KEY, panels);

export function loadSettings(): AppSettings {
  const base = defaultSettings();
  const saved = read<Partial<AppSettings>>(SETTINGS_KEY, {});
  return {
    ...base,
    ...saved,
    assumptions: { ...base.assumptions, ...saved.assumptions },
    repairCostsInr: { ...base.repairCostsInr, ...saved.repairCostsInr },
    materialPricesInrPerKg: { ...base.materialPricesInrPerKg, ...saved.materialPricesInrPerKg },
    recoveryRate: { ...base.recoveryRate, ...saved.recoveryRate },
  };
}
export const saveSettings = (s: AppSettings): void => write(SETTINGS_KEY, s);

export function nextPanelId(panels: PanelPassport[]): string {
  const max = panels.reduce((m, p) => Math.max(m, Number(p.id.replace(/\D/g, '')) || 0), 100);
  return `SS-${String(max + 1).padStart(4, '0')}`;
}

export function emptyPanel(id: string): PanelPassport {
  const now = new Date().toISOString();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    siteId: 'site-chennai',
    createdBy: DEMO_USER,
    stepIndex: 0,
    nameplate: {
      manufacturer: '',
      model: '',
      pmaxW: null,
      vocV: null,
      iscA: null,
      vmppV: null,
      imppA: null,
      yearManufactured: null,
      fieldSource: {},
      confidence: {},
    },
    inspection: {
      photos: [],
      damageFlags: [],
      measured: { vocV: null, iscA: null, pmaxW: null, conditions: null },
    },
    assessment: { answers: [], beliefs: replay([]).beliefs, history: replay([]).history },
    twin: null,
    repairOptions: [],
    decision: null,
    note: '',
    isDemo: false,
  };
}

// ---------- Sample images (generated, labelled as samples, not stock art) ----------

export function sampleImage(
  label: string,
  kind: 'front' | 'back' | 'junction' | 'defect' | 'nameplate',
  flags: DamageFlag[] = [],
): string {
  const cells: string[] = [];
  const cw = 28;
  const ch = 28;
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 10; c++) {
      const hit = flags.find((f) => f.cells.some((x) => x.row === r && x.col === c));
      const fill = hit ? (hit.type === 'hot_spot' ? '#7a3b2e' : '#3a4f7a') : '#1f3a6b';
      cells.push(
        `<rect x="${20 + c * (cw + 2)}" y="${20 + r * (ch + 2)}" width="${cw}" height="${ch}" fill="${fill}"/>`,
      );
      if (hit && hit.type === 'cracked_cell')
        cells.push(
          `<path d="M${20 + c * 30} ${20 + r * 30} l${cw} ${ch}" stroke="#cbd5e1" stroke-width="1.5"/>`,
        );
    }
  const body =
    kind === 'nameplate'
      ? `<rect x="20" y="40" width="300" height="130" fill="#e5e7eb" stroke="#94a3b8"/><g fill="#334155" font-family="sans-serif" font-size="12"><text x="32" y="64">SAMPLE NAMEPLATE</text><text x="32" y="90">${label}</text><text x="32" y="112">Pmax / Voc / Isc / Vmpp / Impp</text></g>`
      : kind === 'junction'
        ? `<rect x="110" y="60" width="120" height="90" rx="6" fill="#374151"/><circle cx="140" cy="105" r="6" fill="#9ca3af"/><circle cx="200" cy="105" r="6" fill="#9ca3af"/>`
        : cells.join('');
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 200"><rect width="340" height="200" fill="#f1f5f9"/>${body}<text x="320" y="190" text-anchor="end" font-family="sans-serif" font-size="10" fill="#64748b">Sample image, ${kind}</text></svg>`,
    )
  );
}

// ---------- Seed ----------

type Seed = {
  manufacturer: string;
  model: string;
  p: [number, number, number, number, number];
  year: number;
  flags: DamageFlag[];
  answers: Record<string, string>;
  measured?: { pmaxW: number; conditions: 'bright_sun' | 'hazy' | 'overcast' };
  chosen?: DecisionKind;
  status: PanelStatus;
};

const cell = (row: number, col: number) => ({ row, col });
const f = (
  type: DamageFlag['type'],
  severity: 1 | 2 | 3,
  cells: { row: number; col: number }[] = [],
): DamageFlag => ({ type, severity, cells });

const SEEDS: Seed[] = [
  {
    manufacturer: 'Waaree',
    model: 'WS-320',
    p: [320, 40.6, 9.9, 33.1, 9.67],
    year: 2019,
    flags: [f('soiling', 1)],
    answers: {
      age_band: '5to10',
      glass_condition: 'dusty',
      discolouration: 'none',
      output_band: 'above90',
    },
    chosen: 'reuse',
    status: 'in_pool',
  },
  {
    manufacturer: 'Vikram Solar',
    model: 'Eldora 330',
    p: [330, 40.8, 10.2, 33.6, 9.82],
    year: 2017,
    flags: [f('junction_box', 2)],
    answers: {
      age_band: '5to10',
      junction_box_condition: 'loose',
      water_ingress: 'no',
      output_band: '70to90',
    },
    chosen: 'repair',
    status: 'in_pool',
  },
  {
    manufacturer: 'Adani Solar',
    model: 'ASP-7-335',
    p: [335, 41.2, 10.3, 34, 9.85],
    year: 2016,
    flags: [f('cracked_glass', 3), f('cracked_cell', 3, [cell(1, 2), cell(1, 3), cell(2, 3)])],
    answers: {
      age_band: '10to20',
      glass_condition: 'shattered',
      hot_spot_history: 'no',
      output_band: '40to70',
    },
    chosen: 'recycle',
    status: 'closed',
  },
  {
    manufacturer: 'Tata Power Solar',
    model: 'TP300',
    p: [300, 39.7, 9.8, 32.3, 9.29],
    year: 2014,
    flags: [f('browning', 2)],
    answers: {
      age_band: '10to20',
      discolouration: 'yellow_brown',
      glass_condition: 'clean',
      output_band: '70to90',
    },
    chosen: 'reuse',
    status: 'in_pool',
  },
  {
    manufacturer: 'Loom Solar',
    model: 'Shark 440',
    p: [440, 49.4, 11.2, 41.2, 10.68],
    year: 2020,
    flags: [f('hot_spot', 2, [cell(2, 4), cell(2, 5)])],
    answers: { age_band: 'lt5', hot_spot_history: 'yes', output_band: '70to90' },
    chosen: 'repair',
    status: 'in_pool',
  },
  {
    manufacturer: 'Waaree',
    model: 'WS-320',
    p: [320, 40.6, 9.9, 33.1, 9.67],
    year: 2018,
    flags: [f('hot_spot', 3, [cell(4, 2), cell(4, 3)]), f('junction_box', 1)],
    answers: {
      age_band: '5to10',
      hot_spot_history: 'yes',
      junction_box_condition: 'loose',
      output_band: '40to70',
    },
    chosen: 'repair',
    status: 'in_pool',
  },
  {
    manufacturer: 'Havells',
    model: 'HS-330',
    p: [330, 40.9, 10.1, 33.5, 9.85],
    year: 2017,
    flags: [f('delamination', 2, [cell(0, 7), cell(1, 7), cell(1, 8)])],
    answers: { age_band: '5to10', water_ingress: 'yes', output_band: '70to90' },
    status: 'assessed',
  },
  {
    manufacturer: 'Renew Sys',
    model: 'RS-325',
    p: [325, 40.7, 10, 33.4, 9.73],
    year: 2018,
    flags: [f('junction_box', 3)],
    answers: { age_band: '5to10', junction_box_condition: 'burnt', output_band: '40to70' },
    status: 'assessed',
  },
  {
    manufacturer: 'Vikram Solar',
    model: 'Somera 320',
    p: [320, 40.6, 9.9, 33.1, 9.67],
    year: 2019,
    flags: [f('hot_spot', 3, [cell(0, 1), cell(1, 1)])],
    answers: { age_band: '5to10', hot_spot_history: 'yes', output_band: '40to70' },
    chosen: 'repair',
    status: 'in_pool',
  },
  {
    manufacturer: 'Emmvee',
    model: 'EM-335',
    p: [335, 41.2, 10.3, 34, 9.85],
    year: 2021,
    flags: [f('cracked_cell', 1, [cell(3, 6)]), f('snail_trails', 1)],
    answers: {
      age_band: 'lt5',
      glass_condition: 'clean',
      discolouration: 'none',
      output_band: 'above90',
    },
    chosen: 'reuse',
    status: 'in_pool',
  },
  {
    manufacturer: 'Servotech',
    model: 'ST-300',
    p: [300, 39.5, 9.7, 32.2, 9.32],
    year: 2010,
    flags: [f('browning', 3), f('delamination', 3, [cell(2, 2), cell(3, 2), cell(3, 3)])],
    answers: { age_band: 'gt20', discolouration: 'dark_patches', output_band: 'below40' },
    measured: { pmaxW: 105, conditions: 'bright_sun' },
    chosen: 'recycle',
    status: 'closed',
  },
];

function buildSeedPanel(seed: Seed, index: number, settings: AppSettings): PanelPassport {
  const id = `SS-${String(101 + index).padStart(4, '0')}`;
  const base = emptyPanel(id);
  const when = new Date(Date.now() - (index * 31 + 6) * 3600 * 1000 * 2.4).toISOString();
  const answers = Object.entries(seed.answers).map(([questionId, answer], k) => ({
    questionId,
    answer,
    at: new Date(new Date(when).getTime() + k * 60000).toISOString(),
  }));
  const { beliefs, history } = replay(answers);
  const assessment: Assessment = { answers, beliefs, history };
  const photos: PhotoRef[] = [
    {
      id: `${id}-np`,
      slot: 'nameplate',
      url: sampleImage(`${seed.manufacturer} ${seed.model}`, 'nameplate'),
      name: 'nameplate-sample.svg',
    },
    {
      id: `${id}-fr`,
      slot: 'front',
      url: sampleImage('front', 'front', seed.flags),
      name: 'front-sample.svg',
    },
    {
      id: `${id}-jb`,
      slot: 'junction_box',
      url: sampleImage('jbox', 'junction'),
      name: 'junction-box-sample.svg',
    },
  ];
  const [pmaxW, vocV, iscA, vmppV, imppA] = seed.p;
  const panel: PanelPassport = {
    ...base,
    createdAt: when,
    updatedAt: when,
    status: seed.status,
    stepIndex: 5,
    nameplate: {
      manufacturer: seed.manufacturer,
      model: seed.model,
      pmaxW,
      vocV,
      iscA,
      vmppV,
      imppA,
      yearManufactured: seed.year,
      fieldSource: {
        manufacturer: 'extracted',
        model: 'extracted',
        pmaxW: 'extracted',
        vocV: 'extracted',
        iscA: 'extracted',
        vmppV: 'extracted',
        imppA: 'extracted',
        yearManufactured: 'manual',
      },
      confidence: {
        manufacturer: 0.97,
        model: 0.93,
        pmaxW: 0.96,
        vocV: 0.9,
        iscA: 0.9,
        vmppV: 0.88,
        imppA: 0.88,
      },
    },
    inspection: {
      photos,
      damageFlags: seed.flags,
      measured: {
        vocV: null,
        iscA: null,
        pmaxW: seed.measured?.pmaxW ?? null,
        conditions: seed.measured?.conditions ?? null,
      },
    },
    assessment,
    isDemo: true,
  };
  panel.twin = estimateTwin(twinInputsOf(panel));
  panel.repairOptions = buildRepairOptions(panel, settings);
  const decision = decide(panel, settings);
  if (decision) {
    decision.chosen = seed.chosen ?? null;
    decision.decidedBy = seed.chosen ? DEMO_USER : null;
    decision.decidedAt = seed.chosen ? when : null;
    panel.decision = decision;
  }
  return panel;
}

export async function seedDemoPanels(
  onProgress?: (done: number, total: number) => void,
): Promise<PanelPassport[]> {
  const settings = loadSettings();
  const out: PanelPassport[] = [];
  for (let k = 0; k < SEEDS.length; k++) {
    await new Promise((r) => setTimeout(r, 0));
    out.push(buildSeedPanel(SEEDS[k]!, k, settings));
    onProgress?.(k + 1, SEEDS.length + 1);
  }
  // One draft panel, so the list shows an unfinished record.
  const draft = emptyPanel(`SS-${String(101 + SEEDS.length).padStart(4, '0')}`);
  draft.isDemo = true;
  draft.nameplate = {
    ...draft.nameplate,
    manufacturer: 'Adani Solar',
    model: 'ASP-7-330',
    pmaxW: 330,
    vocV: 40.9,
    iscA: 10.1,
    vmppV: 33.5,
    imppA: 9.85,
    yearManufactured: 2018,
    fieldSource: { manufacturer: 'manual', model: 'manual', pmaxW: 'manual' },
  };
  draft.stepIndex = 1;
  out.push(draft);
  onProgress?.(SEEDS.length + 1, SEEDS.length + 1);
  return out;
}
