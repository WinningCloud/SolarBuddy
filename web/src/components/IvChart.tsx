import { useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ComposedChart,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { Button, SegmentedControl } from '@/components/ui';
import { palette } from '@/design/tokens';
import { formatNumber } from '@/design/format';
import type { CurvePoint, Measured } from '@/lib/types';

interface IvChartProps {
  rated: CurvePoint[];
  now: CurvePoint[];
  measured: Measured;
  summary: string;
}

const COLORS = { rated: palette['ink-3'], now: palette.primary, measured: palette['success-ink'] };

/** Current and power against voltage: rated (new), estimated now, and the measured point(s). */
export function IvChart({ rated, now, measured, summary }: IvChartProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<'iv' | 'pv'>('iv');
  const [table, setTable] = useState(false);
  const yKey = view === 'iv' ? 'iA' : 'pW';
  const yLabel = view === 'iv' ? t('diagnosis.axisI') : t('diagnosis.axisP');

  const measuredIv = [
    ...(measured.iscA ? [{ vV: 0, iA: measured.iscA }] : []),
    ...(measured.vocV ? [{ vV: measured.vocV, iA: 0 }] : []),
  ];

  const sample = (pts: CurvePoint[]) => pts.filter((_, k) => k % Math.ceil(pts.length / 12) === 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          label={t('diagnosis.chartTitle')}
          value={view}
          onChange={setView}
          options={[
            { value: 'iv', label: t('diagnosis.ivTab') },
            { value: 'pv', label: t('diagnosis.pvTab') },
          ]}
        />
        <Button variant="ghost" size="sm" onClick={() => setTable((v) => !v)} aria-pressed={table}>
          {t('common.showTable')}
        </Button>
      </div>

      <div role="img" aria-label={summary} className="h-[280px] w-full md:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
            <CartesianGrid stroke={palette.divider} />
            <XAxis
              dataKey="vV"
              type="number"
              domain={[0, 'dataMax']}
              tickFormatter={(v: number) => formatNumber(v, 0)}
              label={{
                value: t('diagnosis.axisV'),
                position: 'insideBottom',
                offset: -12,
                fill: palette['ink-2'],
                fontSize: 12,
              }}
              tick={{ fill: palette['ink-2'], fontSize: 12 }}
              stroke={palette['line-strong']}
              allowDuplicatedCategory={false}
            />
            <YAxis
              type="number"
              tickFormatter={(v: number) => formatNumber(v, view === 'iv' ? 1 : 0)}
              label={{
                value: yLabel,
                angle: -90,
                position: 'insideLeft',
                fill: palette['ink-2'],
                fontSize: 12,
              }}
              tick={{ fill: palette['ink-2'], fontSize: 12 }}
              stroke={palette['line-strong']}
              width={52}
            />
            <ChartTooltip
              formatter={(value: number) => formatNumber(value, view === 'iv' ? 2 : 1)}
              labelFormatter={(v: number) => `${formatNumber(v, 1)} V`}
            />
            <Legend verticalAlign="top" height={28} />
            <Line
              data={rated}
              dataKey={yKey}
              name={t('diagnosis.rated')}
              stroke={COLORS.rated}
              strokeDasharray="5 4"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              data={now}
              dataKey={yKey}
              name={t('diagnosis.now')}
              stroke={COLORS.now}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
            {view === 'iv' && measuredIv.length > 0 ? (
              <Scatter
                data={measuredIv}
                dataKey="iA"
                name={t('diagnosis.measuredPoint')}
                fill={COLORS.measured}
                isAnimationActive={false}
              />
            ) : null}
            {view === 'pv' && measured.pmaxW ? (
              <ReferenceLine
                y={measured.pmaxW}
                stroke={COLORS.measured}
                strokeDasharray="2 3"
                label={{
                  value: `${t('diagnosis.measuredPoint')}: ${formatNumber(measured.pmaxW, 0)} W`,
                  position: 'insideTopRight',
                  fill: COLORS.measured,
                  fontSize: 12,
                }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {table ? (
        <div
          className="max-h-56 overflow-auto rounded-control border border-line"
          // Scrollable region must be keyboard-focusable.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          role="region"
          aria-label={t('common.chartTable')}
        >
          <table className="w-full text-sm">
            <caption className="sr-only">{t('common.chartTable')}</caption>
            <thead className="sticky top-0 bg-page text-left text-xs text-ink-2">
              <tr>
                <th scope="col" className="px-3 py-1.5">
                  {t('diagnosis.axisV')}
                </th>
                <th scope="col" className="px-3 py-1.5 text-right">
                  {t('diagnosis.rated')}: {t('diagnosis.axisI')}
                </th>
                <th scope="col" className="px-3 py-1.5 text-right">
                  {t('diagnosis.now')}: {t('diagnosis.axisI')}
                </th>
                <th scope="col" className="px-3 py-1.5 text-right">
                  {t('diagnosis.now')}: {t('diagnosis.axisP')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sample(now).map((p, k) => {
                const r = rated.reduce(
                  (a, b) => (Math.abs(b.vV - p.vV) < Math.abs(a.vV - p.vV) ? b : a),
                  rated[0]!,
                );
                void k;
                return (
                  <tr key={p.vV} className="border-t border-divider">
                    <td className="px-3 py-1.5">{formatNumber(p.vV, 1)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(r.iA, 2)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(p.iA, 2)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(p.pW, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/** Simple line chart used by Composer and Impact: one or more series over a numeric x. */
export function SeriesChart({
  data,
  xKey,
  series,
  xLabel,
  yLabel,
  summary,
  height = 220,
  xFormat,
  cursorX,
}: {
  data: Record<string, number>[];
  xKey: string;
  series: { key: string; name: string; color: string; dashed?: boolean }[];
  xLabel: string;
  yLabel: string;
  summary: string;
  height?: number;
  xFormat?: (v: number) => string;
  /** Draws a vertical marker, e.g. the current time in the day player. */
  cursorX?: number;
}) {
  return (
    <div role="img" aria-label={summary} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
          <CartesianGrid stroke={palette.divider} />
          <XAxis
            dataKey={xKey}
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={xFormat ?? ((v: number) => formatNumber(v, 0))}
            label={{
              value: xLabel,
              position: 'insideBottom',
              offset: -12,
              fill: palette['ink-2'],
              fontSize: 12,
            }}
            tick={{ fill: palette['ink-2'], fontSize: 12 }}
            stroke={palette['line-strong']}
          />
          <YAxis
            tickFormatter={(v: number) => formatNumber(v, 0)}
            label={{
              value: yLabel,
              angle: -90,
              position: 'insideLeft',
              fill: palette['ink-2'],
              fontSize: 12,
            }}
            tick={{ fill: palette['ink-2'], fontSize: 12 }}
            stroke={palette['line-strong']}
            width={52}
          />
          <ChartTooltip
            formatter={(value: number) => formatNumber(value, 0)}
            labelFormatter={xFormat ? (v: number) => xFormat(v) : undefined}
          />
          <Legend verticalAlign="top" height={28} />
          {cursorX !== undefined ? (
            <ReferenceLine x={cursorX} stroke={palette.navy} strokeWidth={1.5} />
          ) : null}
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeDasharray={s.dashed ? '5 4' : undefined}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
