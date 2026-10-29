import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name for the group. */
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  className?: string;
}

const sizes = { sm: 'h-7 px-2.5 text-sm', md: 'h-8 px-3 text-base', lg: 'h-10 px-4 text-md' };

/** A single-choice toggle group. Arrow keys move the selection (radio-group semantics). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  block,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.filter((o) => !o.disabled);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const current = enabled.findIndex((o) => o.value === value);
    let next = current;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
      next = (current + 1) % enabled.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = (current - 1 + enabled.length) % enabled.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = enabled.length - 1;
    const option = enabled[next];
    if (!option) return;
    onChange(option.value);
    refs.current[options.indexOf(option)]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex rounded-btn border border-line bg-page p-0.5',
        block && 'flex w-full',
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={onKeyDown}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[5px] font-medium',
              'transition-colors duration-fast disabled:cursor-not-allowed disabled:text-ink-disabled',
              sizes[size],
              block && 'flex-1',
              selected
                ? 'bg-surface text-ink shadow-card ring-1 ring-line'
                : 'text-ink-2 hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
