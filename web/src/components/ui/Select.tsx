import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { controlFrameClasses, FieldShell, type FieldOwnProps } from './Field';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'>, FieldOwnProps {
  options: SelectOption[];
  placeholder?: string;
  controlSize?: 'md' | 'lg';
  containerClassName?: string;
}

/** Native select: the most reliable control on phones, styled to match the system. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    id,
    label,
    hint,
    error,
    tag,
    hideLabel,
    highlight,
    required,
    options,
    placeholder,
    controlSize = 'md',
    disabled,
    className,
    containerClassName,
    ...rest
  },
  ref,
) {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      tag={tag}
      hideLabel={hideLabel}
      required={required}
      className={containerClassName}
    >
      {({ id: selectId, describedBy, invalid }) => (
        <div
          className={cn(
            'relative',
            controlFrameClasses({ invalid, highlight, disabled }),
            controlSize === 'lg' ? 'h-11' : 'h-9',
          )}
        >
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(
              'h-full w-full cursor-pointer appearance-none rounded-control bg-transparent pl-3 pr-9 text-ink outline-none',
              'disabled:cursor-not-allowed',
              controlSize === 'lg' ? 'text-md' : 'text-base',
              className,
            )}
            {...rest}
          >
            {placeholder ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
            aria-hidden="true"
          />
        </div>
      )}
    </FieldShell>
  );
});
