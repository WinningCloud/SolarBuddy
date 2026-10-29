// Domain types shared by the API client, the demo engine and the screens.
// Field names carry units (…W, …V, …A, …Kwh, …Kg, …Inr) as in the API contract.

export type DecisionKind = 'repair' | 'reuse' | 'recycle';
export type PanelStatus = 'draft' | 'assessed' | 'in_pool' | 'closed';
export type DataSource = 'measured' | 'extracted' | 'entered' | 'simulated' | 'assumption';

export interface Range {
  low: number;
  expected: number;
  high: number;
}

export const NAMEPLATE_FIELDS = [
  'manufacturer',
  'model',
  'pmaxW',
  'vocV',
  'iscA',
  'vmppV',
  'imppA',
  'yearManufactured',
] as const;
export type NameplateField = (typeof NAMEPLATE_FIELDS)[number];

export interface Nameplate {
  manufacturer: string;
  model: string;
  pmaxW: number | null;
  vocV: number | null;
  iscA: number | null;
  vmppV: number | null;
  imppA: number | null;
  yearManufactured: number | null;
  /** Where each field came from, so the UI can show Extracted vs Entered by you. */
  fieldSource: Partial<Record<NameplateField, 'extracted' | 'manual'>>;
  /** 0..1, only for extracted fields. */
  confidence: Partial<Record<NameplateField, number>>;
}

export const DAMAGE_TYPES = [
  'cracked_glass',
  'cracked_cell',
  'browning',
  'delamination',
  'hot_spot',
  'junction_box',
  'frame_damage',
  'snail_trails',
  'soiling',
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export interface CellRef {
  row: number;
  col: number;
}

export interface DamageFlag {
  type: DamageType;
  severity: 1 | 2 | 3;
  cells: CellRef[];
}

export type MeasureConditions = 'bright_sun' | 'hazy' | 'overcast';

export interface Measured {
  vocV: number | null;
  iscA: number | null;
  pmaxW: number | null;
  conditions: MeasureConditions | null;
}

export interface PhotoRef {
  id: string;
  slot: 'front' | 'back' | 'junction_box' | 'defect' | 'nameplate';
  url: string;
  name: string;
}

export interface Inspection {
  photos: PhotoRef[];
  damageFlags: DamageFlag[];
  measured: Measured;
}

export type FaultClassId =
  'junction_box' | 'cell_cracking' | 'browning_soiling' | 'substring_failure';

export interface Answer {
  questionId: string;
  answer: string;
  at: string;
}

export interface BeliefSnapshot {
  afterQuestionId: string | null;
  beliefs: Record<FaultClassId, number>;
}

export interface Assessment {
  answers: Answer[];
  beliefs: Record<FaultClassId, number>;
  history: BeliefSnapshot[];
}

export interface CurvePoint {
  vV: number;
  iA: number;
  pW: number;
}

export interface OperatingPoint {
  pmaxW: number;
  vmppV: number;
  imppA: number;
  vocV: number;
  iscA: number;
  fillFactor: number;
}

export interface CellInfo {
  row: number;
  col: number;
  substring: number;
  effectiveIrradianceFraction: number;
  notes: string[];
}

export interface Twin {
  rated: { curve: CurvePoint[]; point: OperatingPoint };
  now: {
    curve: CurvePoint[];
    point: OperatingPoint;
    pmaxRangeW: Range;
    seriesResistanceOhm: number;
    fractionOfRated: Range;
  };
  calibratedTo: 'measured' | 'output_band' | 'defects_only';
  cells: CellInfo[];
  generatedAt: string;
}

export type RepairId =
  'replace_junction_box' | 'bypass_dead_substring' | 'resolder_busbar' | 'clean_glass';

export interface RepairOption {
  id: RepairId;
  applicable: boolean;
  powerRecoveredW: Range;
  powerRecoveredPercentOfRated: Range;
  costInrLow: number;
  costInrHigh: number;
  recommended: boolean;
}

export const MATERIALS = ['glass', 'aluminium', 'silicon', 'copper', 'silver'] as const;
export type Material = (typeof MATERIALS)[number];

export interface DecisionOption {
  kind: DecisionKind;
  netValueInr: Range;
  powerAfterW: Range;
  energyKwh: Range;
  materialsKg: Record<Material, Range>;
  costInr: Range;
  viable: boolean;
  blockedReasonCode?: string;
}

export type ReasonCode =
  | 'safety_block'
  | 'low_output'
  | 'repair_gain'
  | 'no_repair_gain'
  | 'value_margin'
  | 'cracking_risk';

export interface Reason {
  code: ReasonCode;
  /** Numbers come from the engine; the text is built from these. */
  values: Record<string, number>;
}

export interface DecisionRecord {
  options: Record<DecisionKind, DecisionOption>;
  recommended: DecisionKind;
  confidence: Range;
  reasons: Reason[];
  chosen: DecisionKind | null;
  reasonIfOverridden: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  assumptionsUsed: AssumptionOverrides;
}

export interface AssumptionOverrides {
  tariffInrPerKwh: number;
  peakSunHoursPerDay: number;
  remainingLifeYears: number;
  annualDegradation: number;
  repairCostScale: number;
  resalePriceScale: number;
  recoveryRateScale: number;
}

export interface PanelPassport {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: PanelStatus;
  siteId: string;
  createdBy: string;
  /** Last completed flow step index (0 to 5) so a refresh resumes in place. */
  stepIndex: number;
  nameplate: Nameplate;
  inspection: Inspection;
  assessment: Assessment;
  twin: Twin | null;
  repairOptions: RepairOption[];
  decision: DecisionRecord | null;
  note: string;
  isDemo: boolean;
}

export interface QuestionPayload {
  questionId: string;
  options: string[];
  index: number;
  total: number;
}

export interface TriageState {
  beliefs: Record<FaultClassId, number>;
  decisionPosterior: Record<DecisionKind, number>;
  readyToRecommend: boolean;
  next: QuestionPayload | null;
  answeredCount: number;
}

export interface DefaultsEntry {
  value?: number;
  low?: number;
  high?: number;
  unit?: string;
  status: 'sourced' | 'assumption';
  source: string;
}

export interface AppSettings {
  siteName: string;
  latitudeDeg: number;
  longitudeDeg: number;
  assumptions: AssumptionOverrides;
  repairCostsInr: Record<RepairId, { low: number; high: number }>;
  materialPricesInrPerKg: Record<Material, number>;
  recoveryRate: Record<Material, { low: number; high: number }>;
  converterEfficiency: number;
  relayRdsOnOhm: number;
  optimiserCostInrPerPanel: number;
  relayCostInrPerPanel: number;
}

// ---------- Composer ----------

export type ConfigKind = 'naive_series' | 'naive_parallel' | 'optimised_grouping' | 'dc_optimiser';

export interface ArrayLayoutPanel {
  panelId: string;
  col: number;
  row: number;
}

export interface ConfigResult {
  kind: ConfigKind;
  /** Nested lists of panel ids: groups of parallel strings of series panels. */
  grouping: string[][][];
  excluded: { panelId: string; deltaOutputW: number }[];
  maxPowerW: number;
  vmppV: number;
  imppA: number;
  dailyKwh: number;
  mismatchLossPercent: number;
  reverseCurrentEvents: number;
  localMaxima: number;
  hardwareCostInr: number;
  curve: CurvePoint[];
  violations: string[];
}

export interface DayFrame {
  minuteOfDay: number;
  irradianceWm2: number;
  shadowStart: number;
  shadowEnd: number;
  powerW: Record<ConfigKind, number>;
  /** Per-panel irradiance fraction (0..1), for the shadow overlay. */
  panelShade: Record<string, number>;
}

export interface ScenarioMeta {
  id: string;
  nameKey: string;
  descriptionKey: string;
}

export interface DayResult {
  scenarioId: string;
  frames: DayFrame[];
  configs: ConfigResult[];
  winnerByEnergy: ConfigKind;
}

export interface ImpactSummary {
  panelCount: number;
  decisions: Record<DecisionKind, number>;
  poolSize: number;
  energyKwh: Range;
  materialsKg: Record<Material, Range>;
  totalMaterialsKg: Range;
  rows: {
    panelId: string;
    decision: DecisionKind;
    pmaxNowW: number;
    energyKwh: Range;
    materialsKg: Range;
  }[];
}

export interface PanelListFilter {
  decision?: DecisionKind;
  healthBand?: 'good' | 'fair' | 'poor';
  from?: string;
  to?: string;
  q?: string;
}
