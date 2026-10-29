import { useState, type ReactNode } from 'react';
import { ClipboardList, Download, Plus, SunMedium, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Banner,
  Button,
  CameraCapture,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  ConfidenceMeter,
  DataTable,
  DecisionPill,
  Drawer,
  EmptyState,
  ErrorState,
  FileDropzone,
  IconButton,
  Input,
  KeyValueList,
  Modal,
  ProgressBar,
  RadioCardGroup,
  SegmentedControl,
  Select,
  Skeleton,
  SkeletonText,
  SourceTag,
  StatTile,
  StatusPill,
  Stepper,
  TabPanel,
  Tabs,
  Textarea,
  toast,
  Tooltip,
  type Column,
  type Decision,
  type UploadItem,
} from '@/components/ui';
import {
  formatDate,
  formatInr,
  formatInrCompact,
  formatInrRange,
  formatNumber,
  formatPercent,
  formatUnit,
  formatUnitRange,
} from '@/design/format';
import { fontSize, palette, type PaletteName } from '@/design/tokens';
import { LANGUAGES, type LanguageCode } from '@/i18n';

// ---------- helpers ----------

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const swatchGroups: { title: string; names: PaletteName[]; note: string }[] = [
  {
    title: 'Brand',
    names: ['navy', 'accent', 'primary', 'primary-hover', 'primary-pressed', 'tint'],
    note: 'Accent is for focus rings, selection borders, chart series and icons. Text on blue uses primary.',
  },
  {
    title: 'Surfaces and lines',
    names: ['page', 'surface', 'line', 'line-strong', 'line-input', 'divider'],
    note: 'Form control borders use line-input, which meets 3:1 against white.',
  },
  {
    title: 'Text',
    names: ['ink', 'ink-2', 'ink-3', 'ink-disabled'],
    note: 'ink-disabled is for disabled controls and placeholders only.',
  },
  {
    title: 'Status',
    names: [
      'success',
      'success-ink',
      'success-tint',
      'warning',
      'warning-ink',
      'warning-tint',
      'danger',
      'danger-ink',
      'danger-tint',
    ],
    note: 'The plain colour is for icons and bars; the -ink shade is the text colour on its tint.',
  },
  {
    title: 'Decisions',
    names: [
      'repair',
      'repair-ink',
      'repair-tint',
      'reuse',
      'reuse-ink',
      'reuse-tint',
      'recycle',
      'recycle-ink',
      'recycle-tint',
    ],
    note: 'Always paired with the word Repair, Reuse or Recycle.',
  },
];

interface DemoPanel {
  id: string;
  model: string;
  health: number | null;
  decision: Decision | null;
  confidence: number | null;
  assessedAt: string;
}

const demoPanels: DemoPanel[] = [
  {
    id: 'SS-0142',
    model: 'Waaree WS-320',
    health: 0.91,
    decision: 'reuse',
    confidence: 0.84,
    assessedAt: '2026-10-27',
  },
  {
    id: 'SS-0139',
    model: 'Vikram Eldora 330',
    health: 0.62,
    decision: 'repair',
    confidence: 0.71,
    assessedAt: '2026-10-26',
  },
  {
    id: 'SS-0137',
    model: 'Adani ASP-7-335',
    health: 0.38,
    decision: 'recycle',
    confidence: 0.88,
    assessedAt: '2026-10-24',
  },
  {
    id: 'SS-0131',
    model: 'Tata TP300',
    health: null,
    decision: null,
    confidence: null,
    assessedAt: '2026-10-22',
  },
  {
    id: 'SS-0128',
    model: 'Waaree WS-320',
    health: 0.84,
    decision: 'reuse',
    confidence: 0.79,
    assessedAt: '2026-10-21',
  },
  {
    id: 'SS-0120',
    model: 'Loom Solar Shark 440',
    health: 0.71,
    decision: 'repair',
    confidence: 0.66,
    assessedAt: '2026-10-19',
  },
];

const panelColumns: Column<DemoPanel>[] = [
  {
    id: 'id',
    header: 'Panel ID',
    cell: (r) => <span className="font-medium">{r.id}</span>,
    sortValue: (r) => r.id,
  },
  {
    id: 'model',
    header: 'Model',
    cell: (r) => r.model,
    sortValue: (r) => r.model,
    hideBelow: 'md',
  },
  {
    id: 'health',
    header: 'Health',
    align: 'right',
    cell: (r) => formatPercent(r.health),
    sortValue: (r) => r.health,
  },
  {
    id: 'decision',
    header: 'Decision',
    cell: (r) =>
      r.decision ? <DecisionPill decision={r.decision} /> : <StatusPill>Draft</StatusPill>,
    sortValue: (r) => r.decision,
  },
  {
    id: 'confidence',
    header: 'Confidence',
    align: 'right',
    cell: (r) => formatPercent(r.confidence),
    sortValue: (r) => r.confidence,
    hideBelow: 'md',
  },
  {
    id: 'date',
    header: 'Assessed',
    cell: (r) => formatDate(r.assessedAt),
    sortValue: (r) => r.assessedAt,
    hideBelow: 'lg',
  },
];

// Static class names so Tailwind can see them at build time.
const typeScaleClass: Record<keyof typeof fontSize, string> = {
  '2xs': 'text-2xs',
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  md: 'text-md',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
};

const flowSteps = ['Identify', 'Inspect', 'Questions', 'Diagnosis', 'Decision', 'Passport'];

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <h2 id={`${id}-title`} className="text-lg">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 max-w-[680px] text-base text-ink-2">{description}</p>
      ) : null}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Demo({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card>
      <CardHeader title={title} titleAs="h3" />
      <CardBody className={className}>{children}</CardBody>
    </Card>
  );
}

const sections = [
  ['foundations', 'Foundations'],
  ['buttons', 'Buttons'],
  ['forms', 'Form controls'],
  ['selection', 'Selection'],
  ['labels', 'Badges and source tags'],
  ['data', 'Cards and data display'],
  ['table', 'Table'],
  ['navigation', 'Tabs and stepper'],
  ['overlays', 'Overlays'],
  ['feedback', 'Feedback states'],
  ['upload', 'Photo capture'],
] as const;

// ---------- page ----------

export function DesignPage() {
  const { i18n } = useTranslation();
  const [installed, setInstalled] = useState<'rooftop' | 'ground' | 'unsure'>('rooftop');
  const [ageBand, setAgeBand] = useState<string | null>('5-10');
  const [flags, setFlags] = useState({ glass: true, browning: false, jbox: false });
  const [selected, setSelected] = useState<Set<string>>(new Set(['SS-0139']));
  const [tab, setTab] = useState('all');
  const [step, setStep] = useState(2);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<UploadItem[]>([]);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(true);

  function addPhotos(files: File[]) {
    setPhotos((current) => [
      ...current,
      ...files.map((file, i) => ({
        id: `${file.name}-${Date.now()}-${i}`,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        slotLabel: ['Front', 'Back', 'Junction box', 'Defect close-up'][current.length + i],
        status: 'done' as const,
      })),
    ]);
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const item = current.find((p) => p.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return current.filter((p) => p.id !== id);
    });
  }

  function fakeSave() {
    setSaving(true);
    window.setTimeout(() => setSaving(false), 1200);
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="section-label">Internal</p>
          <h1 className="mt-1 text-xl">SecondSun design system</h1>
          <p className="mt-1 max-w-[640px] text-base text-ink-2">
            Tokens, components and their states. This page is not linked from the app. Component
            strings follow the language switch.
          </p>
        </div>
        <SegmentedControl
          label="Language"
          value={i18n.language as LanguageCode}
          onChange={(lng) => void i18n.changeLanguage(lng)}
          options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
        />
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Sections" className="hidden lg:block">
          <ul className="sticky top-6 flex flex-col gap-0.5">
            {sections.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="block rounded-btn px-2.5 py-1.5 text-base text-ink-2 hover:bg-divider hover:text-ink"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex min-w-0 flex-col gap-12">
          {/* Foundations */}
          <Section
            id="foundations"
            title="Foundations"
            description="Colour tokens are defined once in design/tokens.ts and exposed as CSS variables. Ratios are against white."
          >
            {swatchGroups.map((group) => (
              <Demo key={group.title} title={group.title}>
                <p className="mb-4 text-sm text-ink-2">{group.note}</p>
                <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  {group.names.map((name) => (
                    <li key={name} className="overflow-hidden rounded-control border border-line">
                      <div className="h-12" style={{ background: palette[name] }} />
                      <div className="px-2.5 py-2">
                        <p className="text-sm font-medium text-ink">{name}</p>
                        <p className="font-mono text-xs text-ink-3">{palette[name]}</p>
                        <p className="text-xs text-ink-3">
                          {formatNumber(contrast(palette[name], '#FFFFFF'), 1)}:1
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Demo>
            ))}

            <Demo title="Type scale">
              <ul className="flex flex-col gap-3">
                {(Object.keys(fontSize) as (keyof typeof fontSize)[]).map((key) => (
                  <li
                    key={key}
                    className="flex items-baseline gap-4 border-b border-divider pb-3 last:border-b-0"
                  >
                    <span className="w-24 shrink-0 font-mono text-xs text-ink-3">
                      {key} · {fontSize[key][0]}
                    </span>
                    <span
                      className={
                        key === '2xs' ? 'section-label' : `${typeScaleClass[key]} text-navy`
                      }
                    >
                      {key === '2xs' ? 'Section label' : 'Junction box fault likely, 312 W rated'}
                    </span>
                  </li>
                ))}
              </ul>
            </Demo>

            <Demo title="Number formatting">
              <p className="mb-3 text-sm text-ink-2">
                en-IN grouping, ₹ before the amount, a narrow no-break space before units, tabular
                figures everywhere.
              </p>
              <KeyValueList
                columns={2}
                items={[
                  { label: 'formatUnit(312, "W")', value: formatUnit(312, 'W') },
                  { label: 'formatUnit(37.24, "V")', value: formatUnit(37.24, 'V') },
                  { label: 'formatUnit(8.913, "A")', value: formatUnit(8.913, 'A') },
                  { label: 'formatUnit(12.43, "kg")', value: formatUnit(12.43, 'kg') },
                  { label: 'formatInr(1234567)', value: formatInr(1234567) },
                  { label: 'formatInrCompact(245000)', value: formatInrCompact(245000) },
                  { label: 'formatInrCompact(31000000)', value: formatInrCompact(31000000) },
                  { label: 'formatInrRange(1200, 2400)', value: formatInrRange(1200, 2400) },
                  {
                    label: 'formatUnitRange(980, 1460, "kWh")',
                    value: formatUnitRange(980, 1460, 'kWh'),
                  },
                  { label: 'formatPercent(0.537)', value: formatPercent(0.537) },
                  { label: 'Missing value', value: formatUnit(null, 'W') },
                  { label: 'formatDate', value: formatDate('2026-10-29') },
                ]}
              />
            </Demo>
          </Section>

          {/* Buttons */}
          <Section
            id="buttons"
            title="Buttons"
            description="Four variants, three sizes. lg is 44 px tall and is the size used in the technician flow."
          >
            <Demo title="Variants and sizes" className="flex flex-col gap-5">
              {(['sm', 'md', 'lg'] as const).map((size) => (
                <div key={size} className="flex flex-wrap items-center gap-3">
                  <span className="w-8 font-mono text-xs text-ink-3">{size}</span>
                  <Button size={size}>Continue</Button>
                  <Button size={size} variant="secondary">
                    Save and exit
                  </Button>
                  <Button size={size} variant="ghost">
                    Back
                  </Button>
                  <Button size={size} variant="danger">
                    Delete draft
                  </Button>
                </div>
              ))}
            </Demo>
            <Demo title="States" className="flex flex-wrap items-center gap-3">
              <Button leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>
                Assess a panel
              </Button>
              <Button loading={saving} loadingLabel="Saving" onClick={fakeSave}>
                Save draft
              </Button>
              <Button disabled>Continue</Button>
              <Button variant="secondary" disabled>
                Disabled
              </Button>
              <Button
                variant="secondary"
                leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
              >
                Export CSV
              </Button>
              <IconButton
                label="Delete photo"
                icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              />
              <IconButton
                variant="secondary"
                label="Delete photo"
                icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              />
            </Demo>
          </Section>

          {/* Forms */}
          <Section
            id="forms"
            title="Form controls"
            description="Labels are always visible. Errors appear under the field; low-confidence values are highlighted for confirmation."
          >
            <Demo title="Inputs" className="grid gap-5 md:grid-cols-2">
              <Input
                label="Rated power (Pmax)"
                suffix="W"
                inputMode="decimal"
                defaultValue="320"
                tag={
                  <SourceTag
                    kind="extracted"
                    source="Read from the nameplate photo. Confidence 96%."
                  />
                }
              />
              <Input
                label="Open-circuit voltage (Voc)"
                suffix="V"
                inputMode="decimal"
                defaultValue="45.8"
                highlight
                hint="Low confidence. Check this against the nameplate."
                tag={
                  <SourceTag
                    kind="extracted"
                    source="Read from the nameplate photo. Confidence 58%."
                  />
                }
              />
              <Input
                label="Short-circuit current (Isc)"
                suffix="A"
                inputMode="decimal"
                defaultValue="91"
                error="Isc must be between 0.5 A and 20 A."
                tag={<SourceTag kind="entered" />}
              />
              <Input label="Model" placeholder="e.g. WS-320" hint="As printed on the nameplate." />
              <Input label="Manufacturer" defaultValue="Waaree" disabled />
              <Input
                label="Measured Voc"
                suffix="V"
                controlSize="lg"
                placeholder="Optional"
                hint="Large size, used in the flow."
              />
            </Demo>
            <Demo title="Select and textarea" className="grid gap-5 md:grid-cols-2">
              <Select
                label="Measurement conditions"
                placeholder="Choose conditions"
                defaultValue=""
                options={[
                  { value: 'bright', label: 'Bright sun, clear sky' },
                  { value: 'hazy', label: 'Hazy or thin cloud' },
                  { value: 'overcast', label: 'Overcast' },
                ]}
              />
              <Select
                label="Reason for a different action"
                error="Choose a reason."
                defaultValue=""
                placeholder="Choose a reason"
                options={[
                  { value: 'customer', label: 'Customer request' },
                  { value: 'parts', label: 'Repair parts not available' },
                ]}
              />
              <Textarea
                label="Notes"
                placeholder="Anything the next technician should know"
                containerClassName="md:col-span-2"
                hint="Stored in the passport."
              />
            </Demo>
          </Section>

          {/* Selection */}
          <Section id="selection" title="Selection">
            <Demo title="Segmented control" className="flex flex-col gap-4">
              <SegmentedControl
                label="Installation"
                value={installed}
                onChange={setInstalled}
                options={[
                  { value: 'rooftop', label: 'Rooftop' },
                  { value: 'ground', label: 'Ground mount' },
                  { value: 'unsure', label: 'Not sure' },
                ]}
              />
              <SegmentedControl
                label="Installation, large"
                size="lg"
                block
                value={installed}
                onChange={setInstalled}
                options={[
                  { value: 'rooftop', label: 'Rooftop' },
                  { value: 'ground', label: 'Ground mount' },
                  { value: 'unsure', label: 'Not sure' },
                ]}
              />
            </Demo>
            <Demo title="Checkboxes" className="flex flex-col gap-1">
              <Checkbox
                size="lg"
                label="Cracked glass"
                checked={flags.glass}
                onChange={(e) => setFlags({ ...flags, glass: e.target.checked })}
              />
              <Checkbox
                size="lg"
                label="Browning or discolouration"
                description="Yellow or brown tint across cells"
                checked={flags.browning}
                onChange={(e) => setFlags({ ...flags, browning: e.target.checked })}
              />
              <Checkbox
                size="lg"
                label="Loose or burnt junction box"
                checked={flags.jbox}
                onChange={(e) => setFlags({ ...flags, jbox: e.target.checked })}
              />
              <Checkbox size="lg" label="Frame damage" disabled />
            </Demo>
            <Demo title="Radio cards">
              <RadioCardGroup
                legend="How old is the panel?"
                description="Use the year on the nameplate, or the install date if you know it."
                value={ageBand}
                onChange={setAgeBand}
                options={[
                  { value: '0-5', label: 'Under 5 years' },
                  { value: '5-10', label: '5 to 10 years' },
                  { value: '10-20', label: '10 to 20 years' },
                  { value: '20+', label: 'Over 20 years' },
                  {
                    value: 'unsure',
                    label: 'Not sure',
                    description: 'We will rely on the other answers.',
                  },
                ]}
              />
            </Demo>
          </Section>

          {/* Labels */}
          <Section
            id="labels"
            title="Badges and source tags"
            description="Every simulated or assumed value carries a source tag. Tags with a source open on tap."
          >
            <Demo title="Decision and status pills" className="flex flex-wrap gap-2">
              <DecisionPill decision="repair" />
              <DecisionPill decision="reuse" />
              <DecisionPill decision="recycle" />
              <StatusPill>Draft</StatusPill>
              <StatusPill tone="info">In array pool</StatusPill>
              <StatusPill tone="success">Assessed</StatusPill>
              <StatusPill tone="warning">Needs review</StatusPill>
              <StatusPill tone="danger">Unsafe to handle</StatusPill>
            </Demo>
            <Demo title="Badges" className="flex flex-wrap gap-2">
              <Badge>60 cells</Badge>
              <Badge tone="info">3 photos</Badge>
              <Badge tone="success">Within tolerance</Badge>
              <Badge tone="warning">Low confidence</Badge>
              <Badge tone="danger">Reverse current</Badge>
              <Badge size="md" tone="reuse">
                Reuse pool: 8
              </Badge>
            </Demo>
            <Demo title="Source tags" className="flex flex-wrap gap-2">
              <SourceTag
                kind="measured"
                source="Multimeter reading, bright sun, 29 Oct 2026 11:40."
              />
              <SourceTag kind="extracted" source="Read from the nameplate photo. Confidence 96%." />
              <SourceTag kind="entered" />
              <SourceTag
                kind="simulated"
                source="Single-diode model. Parameters estimated from nameplate values and measured points."
              />
              <SourceTag
                kind="assumption"
                source="Assumption, to be verified: repair labour ₹450 per hour."
              />
              <SourceTag
                kind="sourced"
                source="CEA tariff order 2025–26, residential slab average."
              />
            </Demo>
          </Section>

          {/* Data display */}
          <Section id="data" title="Cards and data display">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatTile label="Panels assessed" value={formatNumber(42)} detail="12 this week" />
              <StatTile
                label="Estimated kWh recoverable"
                value={formatUnit(18640, 'kWh')}
                detail={`Range ${formatUnitRange(14200, 22300, 'kWh')}`}
                source={
                  <SourceTag
                    kind="simulated"
                    source="Remaining-life energy from the panel models."
                  />
                }
              />
              <StatTile
                label="Material recoverable"
                value={formatUnit(412.6, 'kg')}
                detail="From 9 panels marked Recycle"
              />
              <StatTile label="Reuse pool size" value="" loading />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader
                  eyebrow="Panel SS-0139"
                  title="Diagnosis summary"
                  description="Vikram Eldora 330, installed 2017"
                  actions={
                    <SourceTag
                      kind="simulated"
                      source="Single-diode model fitted to nameplate and measured Voc."
                    />
                  }
                />
                <CardBody>
                  <KeyValueList
                    items={[
                      {
                        label: 'Rated power',
                        value: formatUnit(330, 'W'),
                        tag: <SourceTag kind="extracted" />,
                      },
                      {
                        label: 'Estimated power now',
                        value: formatUnit(205, 'W'),
                        tag: <SourceTag kind="simulated" />,
                      },
                      {
                        label: 'Measured Voc',
                        value: formatUnit(44.1, 'V'),
                        tag: <SourceTag kind="measured" />,
                      },
                      { label: 'Series resistance estimate', value: formatUnit(0.82, 'Ω') },
                      { label: 'Percent of rated power', value: formatPercent(0.62) },
                    ]}
                  />
                </CardBody>
                <CardFooter>
                  <Button variant="secondary">View curves</Button>
                </CardFooter>
              </Card>

              <Card selected>
                <CardHeader
                  eyebrow="Recommended"
                  title="Repair"
                  description="Selected state: blue tint and border, no banner."
                />
                <CardBody className="flex flex-col gap-5">
                  <ConfidenceMeter
                    label="Confidence"
                    low={0.62}
                    expected={0.74}
                    high={0.85}
                    size="lg"
                  />
                  <ConfidenceMeter
                    label="Net value"
                    low={1800}
                    expected={3200}
                    high={4100}
                    min={0}
                    max={5000}
                    format={(v) => formatInr(v)}
                    tag={
                      <SourceTag
                        kind="simulated"
                        source="Economics model with the assumptions listed below."
                      />
                    }
                  />
                </CardBody>
              </Card>
            </div>

            <Demo title="Progress and likelihood bars" className="flex flex-col gap-4">
              <ProgressBar label="Junction box fault" valueText="54%" value={0.54} decorative />
              <ProgressBar label="Cell cracking" valueText="31%" value={0.31} decorative />
              <ProgressBar label="Soiling or browning" valueText="15%" value={0.15} decorative />
              <ProgressBar
                label="Upload progress"
                valueText="70%"
                value={0.7}
                tone="success"
                size="sm"
              />
            </Demo>
          </Section>

          {/* Table */}
          <Section
            id="table"
            title="Table"
            description="Sortable headers, sticky header in a scroll region, dense 40 px rows, bulk selection."
          >
            <Card>
              <CardHeader
                title="Recent panels"
                description={`${selected.size} selected`}
                actions={
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={selected.size === 0}
                    onClick={() => setSelected(new Set())}
                  >
                    Clear selection
                  </Button>
                }
              />
              <CardBody className="px-0 pb-0 md:px-0 md:pb-0">
                <DataTable
                  caption="Recent panels"
                  columns={panelColumns}
                  rows={demoPanels}
                  getRowId={(r) => r.id}
                  getRowLabel={(r) => r.id}
                  selectable
                  selectedIds={selected}
                  onSelectionChange={setSelected}
                  onRowClick={(r) => toast.info(`Open passport ${r.id}`)}
                  defaultSort={{ columnId: 'date', direction: 'desc' }}
                  maxHeight={280}
                />
              </CardBody>
            </Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader title="Loading" titleAs="h3" />
                <CardBody className="px-0 md:px-0">
                  <DataTable
                    caption="Loading example"
                    columns={panelColumns.slice(0, 4)}
                    rows={[]}
                    getRowId={(r) => r.id}
                    loading
                    loadingRows={3}
                  />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Empty" titleAs="h3" />
                <CardBody className="px-0 md:px-0">
                  <DataTable
                    caption="Empty example"
                    columns={panelColumns.slice(0, 4)}
                    rows={[]}
                    getRowId={(r) => r.id}
                    empty={
                      <EmptyState
                        compact
                        icon={ClipboardList}
                        title="No panels match these filters"
                        description="Clear a filter or widen the date range."
                      />
                    }
                  />
                </CardBody>
              </Card>
            </div>
          </Section>

          {/* Navigation */}
          <Section id="navigation" title="Tabs and stepper">
            <Demo title="Tabs">
              <Tabs
                label="Panels by decision"
                value={tab}
                onValueChange={setTab}
                items={[
                  { value: 'all', label: 'All', count: 42 },
                  { value: 'repair', label: 'Repair', count: 11 },
                  { value: 'reuse', label: 'Reuse', count: 22 },
                  { value: 'recycle', label: 'Recycle', count: 9 },
                ]}
              >
                <TabPanel value="all">
                  <p className="text-base text-ink-2">All 42 assessed panels.</p>
                </TabPanel>
                <TabPanel value="repair">
                  <p className="text-base text-ink-2">11 panels recommended for repair.</p>
                </TabPanel>
                <TabPanel value="reuse">
                  <p className="text-base text-ink-2">22 panels ready to reuse.</p>
                </TabPanel>
                <TabPanel value="recycle">
                  <p className="text-base text-ink-2">9 panels for material recovery.</p>
                </TabPanel>
              </Tabs>
            </Demo>
            <Demo title="Stepper" className="flex flex-col gap-5">
              <Stepper
                steps={flowSteps.map((label, i) => ({ id: label, label, complete: i < step }))}
                currentIndex={step}
                onStepSelect={setStep}
              />
              <p className="text-sm text-ink-3">
                Narrow the window below 768 px to see the phone layout. Completed steps can be
                revisited.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep((s) => Math.min(flowSteps.length - 1, s + 1))}
                  disabled={step === flowSteps.length - 1}
                >
                  Continue
                </Button>
              </div>
            </Demo>
          </Section>

          {/* Overlays */}
          <Section
            id="overlays"
            title="Overlays"
            description="Modal, side drawer, bottom sheet, toast and tooltip. Focus is trapped and returned on close."
          >
            <Demo title="Triggers" className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => setModalOpen(true)}>
                Open modal
              </Button>
              <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                Open drawer
              </Button>
              <Button variant="secondary" onClick={() => setSheetOpen(true)}>
                Open bottom sheet
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  toast.success('Draft saved', { description: 'Panel SS-0143, step 2 of 6.' })
                }
              >
                Success toast
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  toast.error('Could not reach the simulation service', {
                    description: 'Your answers are saved. Try again in a moment.',
                    action: { label: 'Retry', onClick: () => toast.info('Retrying') },
                  })
                }
              >
                Error toast
              </Button>
              <Tooltip content="Fill factor is Pmax divided by Voc times Isc.">
                <Button variant="ghost">Hover or focus for tooltip</Button>
              </Tooltip>
            </Demo>
          </Section>

          {/* Feedback */}
          <Section
            id="feedback"
            title="Feedback states"
            description="Every async view has loading, empty, error and success states."
          >
            <div className="flex flex-col gap-3">
              <Banner tone="info" title="Simulated values">
                Power and energy figures come from a single-diode model, not a lab test.
              </Banner>
              <Banner tone="success" title="We have enough to recommend">
                You can continue now or keep answering to narrow the range.
              </Banner>
              <Banner tone="warning" title="Measured power is far below rated">
                Check the connection and the irradiance before trusting this reading.
              </Banner>
              {showBanner ? (
                <Banner
                  tone="danger"
                  title="Burnt junction box"
                  onDismiss={() => setShowBanner(false)}
                >
                  Disconnect the panel before handling. Do not measure under load.
                </Banner>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader title="Loading" titleAs="h3" />
                <CardBody className="flex flex-col gap-4">
                  <Skeleton className="h-32 w-full" />
                  <SkeletonText lines={3} />
                </CardBody>
              </Card>
              <Card>
                <EmptyState
                  icon={SunMedium}
                  title="No panels assessed yet"
                  description="Assess your first panel, or load the demo site to explore."
                  actions={
                    <>
                      <Button>Assess a panel</Button>
                      <Button variant="secondary">Load demo data</Button>
                    </>
                  }
                />
              </Card>
              <Card>
                <ErrorState
                  title="Could not load panels"
                  description="The server did not respond. Check your connection and try again."
                  code="NETWORK_TIMEOUT"
                  onRetry={() => toast.info('Retrying')}
                />
              </Card>
            </div>
          </Section>

          {/* Upload */}
          <Section
            id="upload"
            title="Photo capture"
            description="On phones the camera opens directly. On desktops a webcam preview opens in a modal, with file upload as a fallback."
          >
            <Demo title="Inspection photos (up to 4)">
              <FileDropzone
                label="Panel photos"
                description="Front, back, junction box, and a close-up of any defect."
                items={photos}
                onAdd={addPhotos}
                onRemove={removePhoto}
                maxFiles={4}
              />
            </Demo>
            <Demo title="Camera only" className="flex flex-wrap items-center gap-3">
              <CameraCapture
                onCapture={(file) =>
                  setLastCapture(`${file.name}, ${formatNumber(file.size / 1024)} KB`)
                }
              />
              <span className="text-sm text-ink-2">
                {lastCapture ? `Captured ${lastCapture}` : 'No photo captured yet.'}
              </span>
            </Demo>
          </Section>
        </main>
      </div>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Choose a different action"
        description="Your choice and reason are stored in the panel passport."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setModalOpen(false)}>Save choice</Button>
          </>
        }
      >
        <Select
          label="Reason"
          defaultValue=""
          placeholder="Choose a reason"
          options={[
            { value: 'customer', label: 'Customer request' },
            { value: 'parts', label: 'Repair parts not available' },
            { value: 'safety', label: 'Safety concern not captured above' },
          ]}
        />
      </Modal>

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="SS-0139"
        description="Vikram Eldora 330"
        footer={<Button onClick={() => setDrawerOpen(false)}>Open passport</Button>}
      >
        <KeyValueList
          items={[
            { label: 'Decision', value: <DecisionPill decision="repair" /> },
            { label: 'Health', value: formatPercent(0.62) },
            { label: 'Estimated power now', value: formatUnit(205, 'W') },
            { label: 'Repair cost', value: formatInrRange(900, 1600) },
          ]}
        />
      </Drawer>

      <Drawer
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        side="bottom"
        title="What we know so far"
      >
        <div className="flex flex-col gap-4">
          <ProgressBar label="Junction box fault" valueText="54%" value={0.54} decorative />
          <ProgressBar label="Cell cracking" valueText="31%" value={0.31} decorative />
          <ProgressBar label="Soiling or browning" valueText="15%" value={0.15} decorative />
        </div>
      </Drawer>
    </div>
  );
}
