import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from './Skeleton';

interface StatTileProps {
  label: ReactNode;
  /** Preformatted value including its unit, e.g. "1,240 kWh". */
  value: ReactNode;
  /** Range or context line, e.g. "Range 980–1,460 kWh". */
  detail?: ReactNode;
  /** A SourceTag, shown beside the label. */
  source?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function StatTile({ label, value, detail, source, loading, className }: StatTileProps) {
  return (
    <div className={cn('rounded-card border border-line bg-surface p-4 shadow-card', className)}>
      <div className="flex min-h-5 flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-2">{label}</p>
        {source}
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-2 h-8 w-28" />
          <Skeleton className="mt-2 h-4 w-36" />
        </>
      ) : (
        <>
          <p className="mt-1 text-xl font-semibold text-navy md:text-2xl">{value}</p>
          {detail ? <p className="mt-1 text-sm text-ink-3">{detail}</p> : null}
        </>
      )}
    </div>
  );
}
