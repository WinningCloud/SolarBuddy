import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

type BannerTone = 'info' | 'success' | 'warning' | 'danger';

const toneStyle: Record<BannerTone, { icon: LucideIcon; frame: string; iconClass: string }> = {
  info: { icon: Info, frame: 'border-accent/30 bg-tint', iconClass: 'text-primary' },
  success: {
    icon: CheckCircle2,
    frame: 'border-success/30 bg-success-tint',
    iconClass: 'text-success-ink',
  },
  warning: {
    icon: AlertTriangle,
    frame: 'border-warning/40 bg-warning-tint',
    iconClass: 'text-warning-ink',
  },
  danger: {
    icon: AlertCircle,
    frame: 'border-danger/30 bg-danger-tint',
    iconClass: 'text-danger-ink',
  },
};

interface BannerProps {
  tone?: BannerTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  /** Announce to screen readers when it appears (use for results of an action). */
  live?: boolean;
  className?: string;
}

export function Banner({
  tone = 'info',
  title,
  children,
  action,
  onDismiss,
  live,
  className,
}: BannerProps) {
  const { t } = useTranslation();
  const { icon: Icon, frame, iconClass } = toneStyle[tone];
  return (
    <div
      role={live ? (tone === 'danger' ? 'alert' : 'status') : undefined}
      className={cn('flex items-start gap-3 rounded-card border px-4 py-3', frame, className)}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-base text-ink">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn('text-ink-2', title && 'mt-0.5')}>{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('ui.dismiss')}
          className="-m-1 rounded-btn p-1 text-ink-2 hover:bg-surface/60 hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
