import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type ProgressTone =
  'accent' | 'success' | 'warning' | 'danger' | 'repair' | 'reuse' | 'recycle' | 'neutral';

const fill: Record<ProgressTone, string> = {
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  repair: 'bg-repair',
  reuse: 'bg-reuse',
  recycle: 'bg-recycle',
  neutral: 'bg-ink-3',
};

interface ProgressBarProps {
  /** 0 to 1. */
  value: number;
  label: ReactNode;
  /** Visible value text, e.g. "54%". */
  valueText?: string;
  hideLabel?: boolean;
  tone?: ProgressTone;
  size?: 'sm' | 'md';
  /**
   * When the number is already shown as text next to the bar (likelihood lists, health bars),
   * the bar is decorative and hidden from assistive technology.
   */
  decorative?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  label,
  valueText,
  hideLabel,
  tone = 'accent',
  size = 'md',
  decorative,
  className,
}: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const percent = Math.round(clamped * 100);
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {!hideLabel ? (
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 text-ink">{label}</span>
          {valueText ? <span className="shrink-0 font-medium text-ink">{valueText}</span> : null}
        </div>
      ) : null}
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-divider',
          size === 'sm' ? 'h-1.5' : 'h-2',
        )}
        {...(decorative
          ? { 'aria-hidden': true }
          : {
              role: 'progressbar',
              'aria-valuemin': 0,
              'aria-valuemax': 100,
              'aria-valuenow': percent,
              'aria-valuetext': valueText,
              'aria-label': typeof label === 'string' ? label : undefined,
            })}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-slow', fill[tone])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
