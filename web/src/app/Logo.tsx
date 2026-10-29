import { cn } from '@/lib/cn';

export function Logo({ className, onDark = true }: { className?: string; onDark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill={onDark ? '#3395FF' : '#072654'} />
        <rect
          x="7"
          y="9"
          width="18"
          height="14"
          rx="1.5"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
        />
        <path d="M13 9v14M19 9v14M7 16h18" stroke="#fff" strokeWidth="1.5" />
      </svg>
      <span className={cn('text-md font-semibold', onDark ? 'text-white' : 'text-navy')}>
        SecondSun
      </span>
    </span>
  );
}
