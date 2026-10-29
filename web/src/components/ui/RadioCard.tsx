import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface RadioCardOption<T extends string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  /** Right-aligned extra, e.g. a badge. */
  meta?: ReactNode;
  disabled?: boolean;
}

export interface RadioCardGroupProps<T extends string> {
  legend: ReactNode;
  hideLegend?: boolean;
  description?: ReactNode;
  options: RadioCardOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  name?: string;
  columns?: 1 | 2 | 3;
  error?: string;
  className?: string;
}

const columnClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-3',
};

/**
 * Large, tappable single-choice cards. Native radio inputs keep arrow-key navigation and
 * screen-reader semantics; the card shows focus and selection.
 */
export function RadioCardGroup<T extends string>({
  legend,
  hideLegend,
  description,
  options,
  value,
  onChange,
  name,
  columns = 1,
  error,
  className,
}: RadioCardGroupProps<T>) {
  const autoName = useId();
  const groupName = name ?? autoName;
  const descriptionId = description ? `${groupName}-description` : undefined;
  const errorId = error ? `${groupName}-error` : undefined;

  return (
    <fieldset
      className={cn('min-w-0', className)}
      aria-describedby={[descriptionId, errorId].filter(Boolean).join(' ') || undefined}
    >
      <legend className={cn('mb-1 text-md font-semibold text-navy', hideLegend && 'sr-only')}>
        {legend}
      </legend>
      {description ? (
        <p id={descriptionId} className="mb-3 text-base text-ink-2">
          {description}
        </p>
      ) : null}
      <div className={cn('grid gap-2', columnClasses[columns])}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                'relative flex min-h-14 cursor-pointer items-start gap-3 rounded-card border bg-surface px-4 py-3.5',
                'transition-colors duration-fast',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
                selected
                  ? 'border-accent bg-tint'
                  : 'border-line hover:border-line-strong hover:bg-page',
                option.disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={option.value}
                checked={selected}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 bg-surface',
                  selected ? 'border-primary' : 'border-line-input',
                )}
              >
                {selected ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-md font-medium text-ink">{option.label}</span>
                {option.description ? (
                  <span className="mt-0.5 block text-sm text-ink-2">{option.description}</span>
                ) : null}
              </span>
              {option.meta ? <span className="shrink-0">{option.meta}</span> : null}
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} className="mt-2 text-xs text-danger-ink">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
