import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface KeyValueItem {
  label: ReactNode;
  value: ReactNode;
  /** A SourceTag or small badge beside the value. */
  tag?: ReactNode;
  hint?: ReactNode;
}

interface KeyValueListProps {
  items: KeyValueItem[];
  /** Number of columns from the md breakpoint up. Always one column on phones. */
  columns?: 1 | 2 | 3;
  /** stacked: label above value; inline: label left, value right. */
  layout?: 'stacked' | 'inline';
  className?: string;
}

const columnClasses = { 1: '', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3' };

export function KeyValueList({
  items,
  columns = 1,
  layout = 'inline',
  className,
}: KeyValueListProps) {
  return (
    <dl
      className={cn(
        'grid grid-cols-1',
        layout === 'stacked' ? 'gap-x-6 gap-y-4' : 'gap-x-8',
        columnClasses[columns],
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className={cn(
            layout === 'inline'
              ? 'flex items-baseline justify-between gap-4 border-b border-divider py-2.5 last:border-b-0'
              : 'flex flex-col gap-0.5',
          )}
        >
          <dt className="min-w-0 text-sm text-ink-2">
            {item.label}
            {item.hint ? <span className="block text-xs text-ink-3">{item.hint}</span> : null}
          </dt>
          <dd
            className={cn(
              'flex flex-wrap items-center gap-2 text-base font-medium text-ink',
              layout === 'inline' && 'justify-end text-right',
            )}
          >
            <span>{item.value}</span>
            {item.tag}
          </dd>
        </div>
      ))}
    </dl>
  );
}
