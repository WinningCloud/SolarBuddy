import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPercent } from '@/design/format';
import { cn } from '@/lib/cn';

interface ConfidenceMeterProps {
  label: string;
  low: number;
  expected: number;
  high: number;
  /** Value domain for the track. Defaults to 0–1 (fractions). */
  min?: number;
  max?: number;
  format?: (value: number) => string;
  /** Extra content at the right of the label row, e.g. a SourceTag. */
  tag?: ReactNode;
  size?: 'md' | 'lg';
  className?: string;
}

/**
 * Range bar: the shaded band runs from low to high and the marker sits at the expected value.
 * The three numbers are always printed, so the bar is a visual aid, not the only signal.
 */
export function ConfidenceMeter({
  label,
  low,
  expected,
  high,
  min = 0,
  max = 1,
  format = (v) => formatPercent(v),
  tag,
  size = 'md',
  className,
}: ConfidenceMeterProps) {
  const { t } = useTranslation();
  const span = max - min || 1;
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / span) * 100))}%`;
  const summary = t('ui.confidence.summary', {
    label,
    expected: format(expected),
    low: format(low),
    high: format(high),
  });

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink-2">{label}</span>
        {tag}
      </div>
      <div
        role="img"
        aria-label={summary}
        className={cn('relative', size === 'lg' ? 'h-4' : 'h-3')}
      >
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-divider" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent/40"
          style={{ left: pos(low), width: `calc(${pos(high)} - ${pos(low)})` }}
        />
        <div
          className="absolute top-0 h-full w-[3px] -translate-x-1/2 rounded-full bg-navy"
          style={{ left: pos(expected) }}
        />
      </div>
      <div className="grid grid-cols-3 text-sm" aria-hidden="true">
        <span className="text-ink-3">
          {t('ui.confidence.low')} <span className="font-medium text-ink-2">{format(low)}</span>
        </span>
        <span className="text-center text-ink-3">
          {t('ui.confidence.expected')}{' '}
          <span className="font-semibold text-ink">{format(expected)}</span>
        </span>
        <span className="text-right text-ink-3">
          {t('ui.confidence.high')} <span className="font-medium text-ink-2">{format(high)}</span>
        </span>
      </div>
    </div>
  );
}
