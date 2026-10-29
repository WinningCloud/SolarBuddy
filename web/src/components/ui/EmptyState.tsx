import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  /** Primary and secondary actions (Buttons). */
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  compact,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'px-4 py-8' : 'px-6 py-12 md:py-16',
        className,
      )}
    >
      {Icon ? (
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-card border border-line bg-page">
          <Icon className="h-5 w-5 text-ink-3" aria-hidden="true" />
        </div>
      ) : null}
      <h3 className="text-md font-semibold text-navy">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-[420px] text-base text-ink-2">{description}</p>
      ) : null}
      {actions ? <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
