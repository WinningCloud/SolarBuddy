import { cn } from '@/lib/cn';

interface SpinnerProps {
  className?: string;
  /** When set, the spinner is announced; otherwise it is decorative. */
  label?: string;
}

export function Spinner({ className, label }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn('allow-motion h-4 w-4 shrink-0 animate-spin', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
