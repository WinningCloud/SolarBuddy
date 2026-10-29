import { useId, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface FieldOwnProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** Rendered at the right of the label row, e.g. a SourceTag. */
  tag?: ReactNode;
  hideLabel?: boolean;
  required?: boolean;
  /** Draws attention to a value the user should confirm (e.g. low-confidence extraction). */
  highlight?: boolean;
}

export interface FieldIds {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

interface FieldShellProps extends FieldOwnProps {
  id?: string;
  className?: string;
  children: (ids: FieldIds) => ReactNode;
}

/** Label, hint and error wiring shared by Input, Select and Textarea. */
export function FieldShell({
  id: idProp,
  label,
  hint,
  error,
  tag,
  hideLabel,
  required,
  className,
  children,
}: FieldShellProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div
        className={cn('flex min-h-5 items-center justify-between gap-2', hideLabel && 'sr-only')}
      >
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {required && (
            <span className="text-danger-ink" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
        {tag}
      </div>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} className="flex items-start gap-1 text-xs text-danger-ink">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function controlFrameClasses({
  invalid,
  highlight,
  disabled,
}: {
  invalid?: boolean;
  highlight?: boolean;
  disabled?: boolean;
}): string {
  return cn(
    'rounded-control border bg-surface transition-colors duration-fast',
    'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
    invalid
      ? 'border-danger'
      : highlight
        ? 'border-warning bg-warning-tint'
        : 'border-line-input hover:border-ink-2',
    disabled && 'cursor-not-allowed border-line bg-page text-ink-disabled hover:border-line',
  );
}
