import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  DecisionPill,
  EmptyState,
  ErrorState,
  Input,
  SourceTag,
  StatTile,
  TabPanel,
  Tabs,
  type Column,
} from '@/components/ui';
import { SeriesChart } from '@/components/IvChart';
import { formatNumber, formatUnit, formatUnitRange } from '@/design/format';
import { palette } from '@/design/tokens';
import { api } from '@/lib/api';
import { errorMessage, keys } from '@/lib/queries';
import { MATERIALS, type ImpactSummary } from '@/lib/types';

type Row = ImpactSummary['rows'][number];

function toCsv(s: ImpactSummary): string {
  const head =
    'panel_id,decision,pmax_now_W,energy_kWh_low,energy_kWh_expected,energy_kWh_high,materials_kg_low,materials_kg_expected,materials_kg_high';
  const f = (v: number) => v.toFixed(2);
  const lines = s.rows.map((r) =>
    [
      r.panelId,
      r.decision,
      f(r.pmaxNowW),
      f(r.energyKwh.low),
      f(r.energyKwh.expected),
      f(r.energyKwh.high),
      f(r.materialsKg.low),
      f(r.materialsKg.expected),
      f(r.materialsKg.high),
    ].join(','),
  );
  return [head, ...lines].join('\n');
}

// Illustrative Weibull fleet model: installs per year (MW), Assumption.
const SEED_INSTALLS: Record<number, number> = {
  2010: 40,
  2012: 90,
  2014: 230,
  2016: 620,
  2018: 2200,
  2020: 3000,
  2022: 5500,
  2024: 9000,
};
const TONNES_PER_MW = 60;
const cdf = (x: number, k: number, l: number) => (x <= 0 ? 0 : 1 - Math.exp(-Math.pow(x / l, k)));

export function ImpactPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tab, setTab] = useState('summary');
  const [shape, setShape] = useState(2.4);
  const [scale, setScale] = useState(24);
  const [installs, setInstalls] = useState<Record<number, number>>(SEED_INSTALLS);

  const q = useQuery({
    queryKey: [...keys.impact, from, to],
    queryFn: () => api.impactSummary({ from: from || undefined, to: to || undefined }),
  });
  const s = q.data;

  const fc = useMemo(
    () =>
      Array.from({ length: 21 }, (_, n) => {
        const year = 2025 + n;
        const mw = Object.entries(installs).reduce(
          (sum, [y, inst]) =>
            sum +
            inst * (cdf(year - Number(y) + 1, shape, scale) - cdf(year - Number(y), shape, scale)),
          0,
        );
        return { year, tonnes: Math.round(mw * TONNES_PER_MW) };
      }),
    [installs, shape, scale],
  );

  const columns: Column<Row>[] = [
    {
      id: 'panel',
      header: t('impact.cols.panel'),
      sortValue: (r) => r.panelId,
      cell: (r) => <span className="font-medium">{r.panelId}</span>,
    },
    {
      id: 'decision',
      header: t('impact.cols.decision'),
      sortValue: (r) => r.decision,
      cell: (r) => <DecisionPill decision={r.decision} />,
    },
    {
      id: 'power',
      header: t('impact.cols.power'),
      align: 'right',
      sortValue: (r) => r.pmaxNowW,
      cell: (r) => formatUnit(r.pmaxNowW, 'W', 0),
    },
    {
      id: 'energy',
      header: t('impact.cols.energy'),
      align: 'right',
      sortValue: (r) => r.energyKwh.expected,
      cell: (r) => formatUnitRange(r.energyKwh.low, r.energyKwh.high, 'kWh', 0),
    },
    {
      id: 'materials',
      header: t('impact.cols.materials'),
      align: 'right',
      hideBelow: 'md',
      sortValue: (r) => r.materialsKg.expected,
      cell: (r) =>
        r.materialsKg.high > 0
          ? formatUnitRange(r.materialsKg.low, r.materialsKg.high, 'kg', 1)
          : '—',
    },
  ];

  function download() {
    if (!s) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toCsv(s)], { type: 'text/csv' }));
    a.download = 'secondsun-impact.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl">{t('impact.title')}</h1>
          <p className="mt-1 text-base text-ink-2">{t('impact.subtitle')}</p>
        </div>
        <Button
          variant="secondary"
          size="lg"
          onClick={download}
          disabled={!s || s.rows.length === 0}
          leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
        >
          {t('impact.export')}
        </Button>
      </div>

      <Tabs
        label={t('impact.title')}
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'summary', label: t('impact.summaryTab') },
          { value: 'forecast', label: t('impact.forecastTab') },
          { value: 'methodology', label: t('impact.methodologyTab') },
        ]}
      >
        <TabPanel value="summary">
          <div className="flex flex-col gap-6">
            <div className="sm:grid-cols-2 grid gap-3 md:max-w-[520px]">
              <Input
                label={t('common.from')}
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <Input
                label={t('common.to')}
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            {q.isError ? (
              <Card>
                <ErrorState
                  title={t('common.loadFailed')}
                  description={errorMessage(q.error, t('errors.generic'))}
                  onRetry={() => void q.refetch()}
                  retrying={q.isFetching}
                />
              </Card>
            ) : !q.isLoading && s && s.panelCount === 0 ? (
              <Card>
                <EmptyState
                  icon={BarChart3}
                  title={t('impact.emptyTitle')}
                  description={t('impact.emptyBody')}
                  actions={<Button onClick={() => navigate('/')}>{t('nav.overview')}</Button>}
                />
              </Card>
            ) : (
              <>
                <div className="sm:grid-cols-2 grid gap-4 xl:grid-cols-3">
                  <StatTile
                    loading={q.isLoading}
                    label={t('impact.energy')}
                    value={formatUnit(s?.energyKwh.expected, 'kWh', 0)}
                    detail={
                      s
                        ? `${t('common.range')} ${formatUnitRange(s.energyKwh.low, s.energyKwh.high, 'kWh', 0)}`
                        : undefined
                    }
                    source={<SourceTag kind="simulated" source={t('sourceNotes.economics')} />}
                  />
                  <StatTile
                    loading={q.isLoading}
                    label={t('overview.tiles.materials')}
                    value={formatUnit(s?.totalMaterialsKg.expected, 'kg')}
                    detail={
                      s
                        ? `${t('common.range')} ${formatUnitRange(s.totalMaterialsKg.low, s.totalMaterialsKg.high, 'kg')}`
                        : undefined
                    }
                    source={<SourceTag kind="assumption" source={t('sourceNotes.economics')} />}
                  />
                  <StatTile
                    loading={q.isLoading}
                    label={t('overview.tiles.assessed')}
                    value={formatNumber(s?.panelCount ?? 0)}
                  />
                </div>
                <Card>
                  <CardHeader
                    title={t('impact.materialsTitle')}
                    description={t('impact.materialsHint')}
                    actions={<SourceTag kind="assumption" source={t('sourceNotes.economics')} />}
                  />
                  <CardBody className="overflow-x-auto px-0 md:px-0">
                    <table className="w-full text-base">
                      <caption className="sr-only">{t('impact.materialsTitle')}</caption>
                      <thead>
                        <tr className="border-b border-line text-left text-xs text-ink-2">
                          <th scope="col" className="px-5 py-2 font-medium">
                            {t('impact.materialsTitle')}
                          </th>
                          <th scope="col" className="px-5 py-2 text-right font-medium">
                            {t('ui.confidence.low')}
                          </th>
                          <th scope="col" className="px-5 py-2 text-right font-medium">
                            {t('ui.confidence.expected')}
                          </th>
                          <th scope="col" className="px-5 py-2 text-right font-medium">
                            {t('ui.confidence.high')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {MATERIALS.map((m) => (
                          <tr key={m} className="border-b border-divider">
                            <th scope="row" className="px-5 py-2 text-left font-normal">
                              {t(`materials.${m}`)}
                            </th>
                            <td className="px-5 py-2 text-right text-ink-2">
                              {formatUnit(s?.materialsKg[m].low, 'kg', m === 'silver' ? 3 : 1)}
                            </td>
                            <td className="px-5 py-2 text-right font-medium">
                              {formatUnit(s?.materialsKg[m].expected, 'kg', m === 'silver' ? 3 : 1)}
                            </td>
                            <td className="px-5 py-2 text-right text-ink-2">
                              {formatUnit(s?.materialsKg[m].high, 'kg', m === 'silver' ? 3 : 1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title={t('impact.tableTitle')} />
                  <CardBody className="px-0 pb-0 md:px-0 md:pb-0">
                    <DataTable
                      caption={t('impact.tableTitle')}
                      columns={columns}
                      rows={s?.rows ?? []}
                      getRowId={(r) => r.panelId}
                      loading={q.isLoading}
                      maxHeight={360}
                    />
                  </CardBody>
                </Card>
              </>
            )}
          </div>
        </TabPanel>

        <TabPanel value="forecast">
          <Card>
            <CardHeader
              title={t('impact.forecast.title')}
              description={t('impact.forecast.body')}
              actions={
                <SourceTag
                  kind="assumption"
                  label={t('impact.forecast.tag')}
                  source={t('impact.forecast.tag')}
                />
              }
            />
            <CardBody className="flex flex-col gap-4">
              <div className="sm:grid-cols-2 grid max-w-[480px] gap-3">
                <Input
                  label={t('impact.forecast.shape')}
                  type="number"
                  step="0.1"
                  value={shape}
                  onChange={(e) => setShape(Math.max(0.5, Number(e.target.value) || 0.5))}
                />
                <Input
                  label={t('impact.forecast.scale')}
                  type="number"
                  value={scale}
                  onChange={(e) => setScale(Math.max(5, Number(e.target.value) || 5))}
                />
              </div>
              <SeriesChart
                data={fc}
                xKey="year"
                xFormat={(v) => String(v)}
                xLabel={t('impact.forecast.axisYear')}
                yLabel={t('impact.forecast.axisTonnes')}
                height={260}
                series={[{ key: 'tonnes', name: t('impact.forecast.eol'), color: palette.primary }]}
                summary={`${t('impact.forecast.title')}: ${formatNumber(fc[0]?.tonnes ?? 0)} to ${formatNumber(fc[fc.length - 1]?.tonnes ?? 0)} t`}
              />
              <div
                className="max-h-64 overflow-auto rounded-control border border-line"
                // Scrollable region must be keyboard-focusable.
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
                role="region"
                aria-label={t('impact.forecast.installed')}
              >
                <table className="w-full text-sm">
                  <caption className="sr-only">{t('impact.forecast.installed')}</caption>
                  <thead className="sticky top-0 bg-page text-left text-xs text-ink-2">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t('impact.forecast.year')}
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t('impact.forecast.installed')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(installs).map(([year, mw]) => (
                      <tr key={year} className="border-t border-divider">
                        <th scope="row" className="px-3 py-1 text-left font-normal">
                          {year}
                        </th>
                        <td className="px-3 py-1">
                          <Input
                            label={`${t('impact.forecast.installed')} ${year}`}
                            hideLabel
                            type="number"
                            value={mw}
                            suffix="MW"
                            onChange={(e) =>
                              setInstalls((i) => ({
                                ...i,
                                [year]: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </TabPanel>

        <TabPanel value="methodology">
          <Card>
            <CardHeader title={t('impact.methodology.title')} />
            <CardBody className="flex max-w-[720px] flex-col gap-4">
              {(
                t('impact.methodology.sections', { returnObjects: true }) as unknown as {
                  h: string;
                  p: string;
                }[]
              ).map((sec) => (
                <section key={sec.h}>
                  <h3 className="text-base">{sec.h}</h3>
                  <p className="mt-1 text-base text-ink-2">{sec.p}</p>
                </section>
              ))}
            </CardBody>
          </Card>
        </TabPanel>
      </Tabs>
    </>
  );
}
