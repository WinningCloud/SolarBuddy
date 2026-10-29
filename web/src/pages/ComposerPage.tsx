import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download, Pause, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Banner,
  Button,
  buttonClasses,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  EmptyState,
  ErrorState,
  ProgressBar,
  SegmentedControl,
  Select,
  Skeleton,
  SourceTag,
  TabPanel,
  Tabs,
  toast,
} from '@/components/ui';
import { SeriesChart } from '@/components/IvChart';
import { formatInr, formatNumber, formatPercent, formatUnit } from '@/design/format';
import { palette } from '@/design/tokens';
import { api, decisionOf, healthOf } from '@/lib/api';
import { cn } from '@/lib/cn';
import { errorMessage, usePanels } from '@/lib/queries';
import type { ConfigKind, ConfigResult, DayResult } from '@/lib/types';
import { defaultLayout, type LayoutSlot } from '@/lib/demo/array';

const CONFIG_ORDER: ConfigKind[] = [
  'naive_series',
  'naive_parallel',
  'optimised_grouping',
  'dc_optimiser',
];
const STRING_COLORS = [
  palette.primary,
  palette['success-ink'],
  palette['warning-ink'],
  palette['recycle-ink'],
];
const CELL_W = 100;
const CELL_H = 132;

const clock = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

export function ComposerPage() {
  const { t } = useTranslation();
  const { data: allPanels, isLoading, isError, error, refetch, isFetching } = usePanels();
  // Every assessed Reuse or Repair panel can be composed, not only ones explicitly added to the
  // pool: otherwise a panel assessed but not yet "added" looks like a missing pool.
  const pool = useMemo(
    () =>
      (allPanels ?? []).filter((p) => {
        if (p.status === 'in_pool') return true;
        const d = decisionOf(p);
        return Boolean(p.twin) && p.status !== 'draft' && (d === 'reuse' || d === 'repair');
      }),
    [allPanels],
  );
  const inPoolIds = pool.filter((p) => p.status === 'in_pool').map((p) => p.id);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [scenarioId, setScenarioId] = useState(api.scenarios[0]!.id);
  const [layout, setLayout] = useState<LayoutSlot[]>([]);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  // Until the person moves a panel, the layout follows the optimised wiring order.
  const [touched, setTouched] = useState(false);
  const [view, setView] = useState<ConfigKind>('optimised_grouping');
  const [tab, setTab] = useState('layout');
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [result, setResult] = useState<{ day: DayResult; labels: Record<string, string> } | null>(
    null,
  );

  const ids = selected ?? (inPoolIds.length >= 2 ? inPoolIds : pool.map((p) => p.id));
  const chosen = ids.filter((id) => pool.some((p) => p.id === id));

  // Keep the layout in step with the selection.
  useEffect(() => {
    setLayout((current) => {
      const keep = current.filter((s) => chosen.includes(s.panelId));
      if (keep.length === chosen.length && keep.length === current.length) return current;
      return defaultLayout(chosen);
    });
    setResult(null);
    setPlaying(false);
    setFrame(0);
    setTouched(false);
    // chosen.join keeps this stable between renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen.join('|')]);

  const run = useMutation({
    mutationFn: () => api.runComposer(chosen, scenarioId, touched ? layout : undefined),
    onSuccess: (r) => {
      setResult({ day: r.day, labels: r.labels });
      setLayout(r.layout);
      setFrame(Math.floor(r.day.frames.length / 2));
      setPlaying(false);
    },
    onError: (e) =>
      toast.error(t('composer.running'), { description: errorMessage(e, t('errors.generic')) }),
  });

  useEffect(() => {
    if (!playing || !result) return;
    const timer = window.setInterval(() => {
      setFrame((f) => {
        if (f >= result.day.frames.length - 1) {
          setPlaying(false);
          return f;
        }
        return f + 1;
      });
    }, 400 / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed, result]);

  const cols = Math.max(1, Math.ceil(chosen.length / 2));
  const cfg = result?.day.configs.find((c) => c.kind === view);
  const current = result?.day.frames[frame];
  const excluded = new Map(
    (result?.day.configs.find((c) => c.kind === 'optimised_grouping')?.excluded ?? []).map((e) => [
      e.panelId,
      e.deltaOutputW,
    ]),
  );

  function swap(col: number, row: number) {
    const at = layout.find((s) => s.col === col && s.row === row);
    if (!swapFrom) {
      if (at) setSwapFrom(at.panelId);
      return;
    }
    setLayout((l) =>
      l.map((s) => {
        if (s.panelId === swapFrom) return { ...s, col, row };
        if (at && s.panelId === at.panelId) {
          const from = l.find((x) => x.panelId === swapFrom)!;
          return { ...s, col: from.col, row: from.row };
        }
        return s;
      }),
    );
    setSwapFrom(null);
    setTouched(true);
    setResult(null);
  }

  function exportJson() {
    if (!result) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            scenario: scenarioId,
            layout,
            configs: result.day.configs.map((c) => ({ ...c, curve: undefined })),
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `array-${scenarioId}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const header = (
    <div className="mb-6">
      <h1 className="text-xl md:text-2xl">{t('composer.title')}</h1>
      <p className="mt-1 text-base text-ink-2">{t('composer.subtitle')}</p>
    </div>
  );

  if (isError)
    return (
      <>
        {header}
        <Card>
          <ErrorState
            title={t('common.loadFailed')}
            description={errorMessage(error, t('errors.generic'))}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        </Card>
      </>
    );

  if (!isLoading && pool.length < 2)
    return (
      <>
        {header}
        <Card>
          <EmptyState
            title={pool.length === 1 ? t('composer.selectAtLeast') : t('composer.poolEmpty')}
            description={`${t('composer.poolEmptyHint')} ${pool.length === 1 ? t('composer.selectAtLeast') : ''}`}
            actions={
              <Link to="/panels" className={buttonClasses({})}>
                {t('nav.panels')}
              </Link>
            }
          />
        </Card>
      </>
    );

  const best = result?.day.winnerByEnergy;

  return (
    <>
      {header}
      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
        {/* Pool */}
        <Card className="self-start">
          <CardHeader title={t('composer.poolTitle')} description={t('composer.poolHint')} />
          <CardBody className="flex flex-col gap-1">
            {isLoading ? <Skeleton className="h-32 w-full" /> : null}
            {pool.map((p) => {
              const h = healthOf(p);
              const on = chosen.includes(p.id);
              return (
                <div key={p.id} className="border-b border-divider py-2 last:border-b-0">
                  <Checkbox
                    label={<span className="font-medium">{p.id}</span>}
                    description={`${p.nameplate.model} · ${formatUnit(p.twin?.now.point.pmaxW, 'W', 0)}`}
                    checked={on}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? [...chosen, p.id] : chosen.filter((x) => x !== p.id),
                      )
                    }
                  />
                  <div className="ml-7 mt-1.5">
                    <ProgressBar
                      label={`${p.id} ${t('common.health')}`}
                      hideLabel
                      value={h ?? 0}
                      size="sm"
                      tone={(h ?? 0) >= 0.8 ? 'success' : (h ?? 0) >= 0.5 ? 'warning' : 'danger'}
                      valueText={formatPercent(h)}
                    />
                    <p className="mt-0.5 text-xs text-ink-3">
                      {t('common.health')} {formatPercent(h)}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>

        {/* Canvas */}
        <Card className="min-w-0">
          <CardBody className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <Select
                label={t('composer.scenario')}
                value={scenarioId}
                onChange={(e) => {
                  setScenarioId(e.target.value);
                  setResult(null);
                }}
                options={api.scenarios.map((s) => ({ value: s.id, label: t(s.nameKey) }))}
                containerClassName="min-w-[220px] flex-1"
              />
              <Button
                onClick={() => run.mutate()}
                loading={run.isPending}
                loadingLabel={t('composer.running')}
                disabled={chosen.length < 2}
              >
                {t('composer.run')}
              </Button>
            </div>
            <p className="text-sm text-ink-2">
              {t(api.scenarios.find((s) => s.id === scenarioId)!.descriptionKey)}
            </p>
            {chosen.length < 2 ? (
              <Banner tone="warning">{t('composer.selectAtLeast')}</Banner>
            ) : null}
            {run.isError ? (
              <Banner tone="danger" live>
                {errorMessage(run.error, t('errors.generic'))}
              </Banner>
            ) : null}

            <Tabs
              label={t('composer.title')}
              value={tab}
              onValueChange={setTab}
              items={[
                { value: 'layout', label: t('composer.layoutTab') },
                { value: 'validation', label: t('composer.validationTab') },
              ]}
            >
              <TabPanel value="layout">
                <div className="flex flex-col gap-4">
                  <SegmentedControl
                    label={t('composer.wiringTitle')}
                    value={view}
                    onChange={setView}
                    options={CONFIG_ORDER.map((k) => ({
                      value: k,
                      label: t(`composer.configs.${k}`),
                    }))}
                    size="sm"
                    className="max-w-full flex-wrap"
                  />
                  <p className="text-sm text-ink-2">
                    {t(`composer.wiring.${view}`, { strings: cfg?.grouping[0]?.length ?? '—' })}
                  </p>
                  <WiringCanvas
                    layout={layout}
                    cols={cols}
                    cfg={cfg}
                    labels={result?.labels}
                    frame={current}
                    excluded={excluded}
                    swapFrom={swapFrom}
                    view={view}
                  />
                  <div>
                    <p className="mb-1 text-sm font-medium text-ink">{t('composer.layoutTitle')}</p>
                    <p className="mb-2 text-xs text-ink-3">{t('composer.layoutHint')}</p>
                    <div
                      className="grid gap-1.5"
                      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                    >
                      {Array.from({ length: cols * 2 }, (_, n) => {
                        const col = n % cols;
                        const row = Math.floor(n / cols);
                        const at = layout.find((s) => s.col === col && s.row === row);
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => swap(col, row)}
                            aria-pressed={at ? swapFrom === at.panelId : false}
                            aria-label={
                              at
                                ? `${at.panelId}, row ${row + 1} column ${col + 1}`
                                : `Empty, row ${row + 1} column ${col + 1}`
                            }
                            className={cn(
                              'h-10 rounded-btn border text-sm',
                              at
                                ? 'border-line-strong bg-surface text-ink hover:bg-page'
                                : 'border-dashed border-line-strong text-ink-3 hover:bg-page',
                              at && swapFrom === at.panelId && 'border-accent bg-tint',
                            )}
                          >
                            {at ? at.panelId.replace('SS-', '') : '·'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </TabPanel>
              <TabPanel value="validation">
                <Banner tone="info" title={t('composer.validationTab')}>
                  {t('composer.validationBody')}
                </Banner>
              </TabPanel>
            </Tabs>
          </CardBody>
        </Card>

        {/* Results */}
        <Card className="self-start">
          <CardHeader
            title={t('composer.resultsTitle')}
            description={t('composer.resultsHint')}
            actions={<SourceTag kind="simulated" source={t('sourceNotes.demoEngine')} />}
          />
          <CardBody className="flex flex-col gap-3">
            {run.isPending ? (
              <div role="status" aria-label={t('composer.running')} className="flex flex-col gap-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : !result ? (
              <p className="text-sm text-ink-3">{t('composer.run')}</p>
            ) : (
              <>
                {result.day.configs.map((c) => (
                  <ConfigCard key={c.kind} c={c} best={c.kind === best} />
                ))}
                <Banner tone={best === 'optimised_grouping' ? 'success' : 'info'} live>
                  {t(best === 'optimised_grouping' ? 'composer.bestIs' : 'composer.bestIsNot', {
                    winner: t(`composer.configs.${best ?? 'naive_series'}`),
                  })}
                </Banner>
                <p className="text-xs text-ink-3">{t('composer.honestNote')}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={exportJson}
                  leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
                >
                  {t('composer.export')}
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Player */}
      <Card className="mt-4">
        <CardHeader title={t('composer.playerTitle')} description={t('composer.shadowNote')} />
        <CardBody className="flex flex-col gap-4">
          {!result ? (
            <p className="text-sm text-ink-3">{t('composer.run')}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => {
                    if (frame >= result.day.frames.length - 1) setFrame(0);
                    setPlaying((p) => !p);
                  }}
                  leadingIcon={
                    playing ? (
                      <Pause className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Play className="h-4 w-4" aria-hidden="true" />
                    )
                  }
                >
                  {playing ? t('composer.pause') : t('composer.play')}
                </Button>
                <label className="flex min-w-[200px] flex-1 items-center gap-3 text-sm text-ink-2">
                  <span className="shrink-0">{t('composer.time')}</span>
                  <input
                    type="range"
                    min={0}
                    max={result.day.frames.length - 1}
                    value={frame}
                    onChange={(e) => {
                      setFrame(Number(e.target.value));
                      setPlaying(false);
                    }}
                    className="h-6 w-full accent-primary"
                    aria-valuetext={current ? clock(current.minuteOfDay) : undefined}
                  />
                  <span className="w-12 shrink-0 text-right font-medium text-ink">
                    {current ? clock(current.minuteOfDay) : ''}
                  </span>
                </label>
                <Select
                  label={t('composer.speed')}
                  hideLabel
                  value={String(speed)}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  options={[
                    { value: '1', label: '1×' },
                    { value: '2', label: '2×' },
                    { value: '4', label: '4×' },
                  ]}
                />
              </div>
              {current ? (
                <dl className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-live="off">
                  <div>
                    <dt className="text-xs text-ink-2">{t('composer.irradiance')}</dt>
                    <dd className="text-base font-medium">
                      {formatUnit(current.irradianceWm2, 'W/m²')}
                    </dd>
                  </div>
                  {CONFIG_ORDER.map((k) => (
                    <div key={k}>
                      <dt className="text-xs text-ink-2">{t(`composer.configs.${k}`)}</dt>
                      <dd className="text-base font-medium">
                        {formatUnit(current.powerW[k], 'W', 0)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <div>
                <p className="mb-1 text-sm font-medium text-ink">{t('composer.powerTimeline')}</p>
                <SeriesChart
                  data={result.day.frames.map((f) => ({ minute: f.minuteOfDay, ...f.powerW }))}
                  xKey="minute"
                  xFormat={clock}
                  xLabel={t('composer.time')}
                  yLabel="W"
                  cursorX={current?.minuteOfDay}
                  height={240}
                  series={[
                    {
                      key: 'naive_series',
                      name: t('composer.configs.naive_series'),
                      color: palette['ink-3'],
                    },
                    {
                      key: 'naive_parallel',
                      name: t('composer.configs.naive_parallel'),
                      color: palette['warning-ink'],
                      dashed: true,
                    },
                    {
                      key: 'optimised_grouping',
                      name: t('composer.configs.optimised_grouping'),
                      color: palette.primary,
                    },
                    {
                      key: 'dc_optimiser',
                      name: t('composer.configs.dc_optimiser'),
                      color: palette['success-ink'],
                    },
                  ]}
                  summary={CONFIG_ORDER.map(
                    (k) =>
                      `${t(`composer.configs.${k}`)}: ${formatNumber(result.day.configs.find((c) => c.kind === k)?.dailyKwh ?? 0, 2)} kWh`,
                  ).join('. ')}
                />
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </>
  );
}

function ConfigCard({ c, best }: { c: ConfigResult; best: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      className={cn('rounded-control border p-3', best ? 'border-accent bg-tint' : 'border-line')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-navy">{t(`composer.configs.${c.kind}`)}</h3>
        {best ? <Badge tone="info">{t('composer.best')}</Badge> : null}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-ink-2">{t('composer.cols.energy')}</dt>
        <dd className="text-right font-medium">{formatUnit(c.dailyKwh, 'kWh', 2)}</dd>
        <dt className="text-ink-2">{t('composer.cols.mismatch')}</dt>
        <dd className="text-right font-medium">{formatNumber(c.mismatchLossPercent, 1)}%</dd>
        <dt className="text-ink-2">{t('composer.cols.reverse')}</dt>
        <dd className="text-right font-medium">{formatNumber(c.reverseCurrentEvents)}</dd>
        <dt className="text-ink-2">{t('composer.cols.peaks')}</dt>
        <dd className="text-right font-medium">{formatNumber(c.localMaxima)}</dd>
        <dt className="text-ink-2">{t('composer.cols.cost')}</dt>
        <dd className="text-right font-medium">
          {c.hardwareCostInr ? formatInr(c.hardwareCostInr) : '—'}
        </dd>
      </dl>
      {c.violations.length > 0 ? (
        <p className="mt-2 text-xs text-warning-ink">
          {c.violations.map((v) => t(`composer.violation.${v}`)).join(', ')}
        </p>
      ) : null}
    </div>
  );
}

interface CanvasProps {
  layout: LayoutSlot[];
  cols: number;
  cfg: ConfigResult | undefined;
  labels: Record<string, string> | undefined;
  frame: DayResult['frames'][number] | undefined;
  excluded: Map<string, number>;
  swapFrom: string | null;
  view: ConfigKind;
}

function WiringCanvas({ layout, cols, cfg, frame, excluded, view }: CanvasProps) {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const width = cols * CELL_W + 20;
  const height = 2 * CELL_H + 54;
  const pos = new Map(
    layout.map((s) => [s.panelId, { x: s.col * CELL_W + 10, y: s.row * CELL_H + 10 }]),
  );
  const busY = 2 * CELL_H + 30;
  const strings = cfg ? cfg.grouping.flat() : [];
  const showExcluded = view === 'optimised_grouping';

  return (
    <div className="overflow-x-auto rounded-control border border-line bg-page p-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto block h-auto w-full"
        style={{ minWidth: Math.min(width, 520), maxWidth: width * 1.4 }}
        role="img"
        aria-label={t(`composer.wiring.${view}`, { strings: cfg?.grouping[0]?.length ?? '' })}
      >
        {layout.map((s) => {
          const p = pos.get(s.panelId)!;
          const dim = showExcluded && excluded.has(s.panelId);
          const shade = frame?.panelShade[s.panelId] ?? 1;
          return (
            <g key={s.panelId} opacity={dim ? 0.45 : 1}>
              <rect
                x={p.x}
                y={p.y}
                width={80}
                height={108}
                rx={4}
                fill={palette.surface}
                stroke={palette['line-strong']}
              />
              {[0, 1, 2].map((k) => (
                <rect
                  key={k}
                  x={p.x + 6 + k * 23}
                  y={p.y + 6}
                  width={21}
                  height={78}
                  fill={palette.tint}
                  stroke={palette['line-strong']}
                />
              ))}
              <rect
                x={p.x}
                y={p.y}
                width={80}
                height={108}
                rx={4}
                fill={palette.navy}
                opacity={Math.max(0, 1 - shade) * 0.75}
              />
              <text
                x={p.x + 40}
                y={p.y + 100}
                textAnchor="middle"
                fontSize={11}
                fill={palette.ink}
                fontWeight={600}
              >
                {s.panelId.replace('SS-', '')}
              </text>
            </g>
          );
        })}
        {frame && frame.shadowEnd > 0 ? (
          <rect
            x={10 + frame.shadowStart * CELL_W}
            y={4}
            width={(frame.shadowEnd - frame.shadowStart) * CELL_W}
            height={2 * CELL_H}
            fill={palette.navy}
            opacity={0.08}
          />
        ) : null}
        <line
          x1={10}
          x2={width - 10}
          y1={busY}
          y2={busY}
          stroke={palette['ink-2']}
          strokeWidth={2}
        />
        {strings.map((str, k) => {
          const pts = str
            .map((id) => pos.get(id))
            .filter((p): p is { x: number; y: number } => Boolean(p))
            .map((p) => ({ x: p.x + 40, y: p.y + 54 }));
          if (pts.length === 0) return null;
          const color = STRING_COLORS[k % STRING_COLORS.length]!;
          const last = pts[pts.length - 1]!;
          return (
            <g
              key={k}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} />
              <polyline points={`${last.x},${last.y} ${last.x},${busY}`} strokeDasharray="1 5" />
              {pts.map((p, n) => (
                <circle key={n} cx={p.x} cy={p.y} r={3.5} fill={color} stroke="none" />
              ))}
            </g>
          );
        })}
        {showExcluded
          ? layout
              .filter((s) => excluded.has(s.panelId))
              .map((s) => {
                const p = pos.get(s.panelId)!;
                const delta = excluded.get(s.panelId)!;
                return (
                  <text
                    key={s.panelId}
                    x={p.x + 40}
                    y={p.y + 122}
                    textAnchor="middle"
                    fontSize={9}
                    fill={palette['ink-2']}
                  >
                    {t('composer.excludedReason', {
                      delta: `${delta >= 0 ? '+' : '−'}${formatNumber(Math.abs(delta), 0)} W`,
                    })}
                  </text>
                );
              })
          : null}
      </svg>
      {cfg ? (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          {strings.map((str, k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span
                className="h-0.5 w-4"
                style={{ background: STRING_COLORS[k % STRING_COLORS.length] }}
                aria-hidden="true"
              />
              {str.map((id) => id.replace('SS-', '')).join(' → ')}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
