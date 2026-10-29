import { cn } from '@/lib/cn';

/** Loading placeholder. Pulses gently; static when reduced motion is requested. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-sm bg-divider', className)} aria-hidden="true" />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  );
}
