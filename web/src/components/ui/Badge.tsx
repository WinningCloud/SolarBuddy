import type { HTMLAttributes, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

export type Tone =
  'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'repair' | 'reuse' | 'recycle';

export type Decision = 'repair' | 'reuse' | 'recycle';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-divider text-ink-2',
  info: 'bg-tint text-primary',
  success: 'bg-success-tint text-success-ink',
  warning: 'bg-warning-tint text-warning-ink',
  danger: 'bg-danger-tint text-danger-ink',
  repair: 'bg-repair-tint text-repair-ink',
  reuse: 'bg-reuse-tint text-reuse-ink',
  recycle: 'bg-recycle-tint text-recycle-ink',
};

const dotClasses: Record<Tone, string> = {
  neutral: 'bg-ink-3',
  info: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  repair: 'bg-repair',
  reuse: 'bg-reuse',
  recycle: 'bg-recycle',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  icon?: ReactNode;
  size?: 'sm' | 'md';
}

/** Rectangular chip (6px radius) for categories and counts. */
export function Badge({
  tone = 'neutral',
  icon,
  size = 'sm',
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-chip font-medium',
        size === 'sm' ? 'h-5 px-1.5 text-xs' : 'h-6 px-2 text-sm',
        toneClasses[tone],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}

interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

/** Rounded status pill with a dot. Colour is never the only signal: the label is always text. */
export function StatusPill({ tone = 'neutral', className, children, ...rest }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-sm font-medium',
        toneClasses[tone],
        className,
      )}
      {...rest}
    >
      <span
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClasses[tone])}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

export function DecisionPill({ decision, className }: { decision: Decision; className?: string }) {
  const { t } = useTranslation();
  return (
    <StatusPill tone={decision} className={className}>
      {t(`ui.decision.${decision}`)}
    </StatusPill>
  );
}
