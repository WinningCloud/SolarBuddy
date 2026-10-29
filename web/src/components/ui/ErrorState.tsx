import type { ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Button } from './Button';

interface ErrorStateProps {
  title?: ReactNode;
  description: ReactNode;
  /** Machine error code from the API, shown small for support. */
  code?: string;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
  className?: string;
}

export function ErrorState({
  title,
  description,
  code,
  onRetry,
  retrying,
  compact,
  className,
}: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'px-4 py-8' : 'px-6 py-12 md:py-16',
        className,
      )}
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-card bg-danger-tint">
        <AlertTriangle className="h-5 w-5 text-danger-ink" aria-hidden="true" />
      </div>
      <h3 className="text-md font-semibold text-navy">{title ?? t('ui.error.title')}</h3>
      <p className="mt-1 max-w-[420px] text-base text-ink-2">{description}</p>
      {code ? (
        <p className="mt-2 font-mono text-xs text-ink-3">{t('ui.error.code', { code })}</p>
      ) : null}
      {onRetry ? (
        <Button
          variant="secondary"
          className="mt-5"
          onClick={onRetry}
          loading={retrying}
          leadingIcon={<RotateCw className="h-4 w-4" aria-hidden="true" />}
        >
          {t('ui.retry')}
        </Button>
      ) : null}
    </div>
  );
}
