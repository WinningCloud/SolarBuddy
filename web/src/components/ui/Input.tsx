import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { controlFrameClasses, FieldShell, type FieldOwnProps } from './Field';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'>, FieldOwnProps {
  /** Unit shown inside the field, e.g. "W" or "V". */
  suffix?: string;
  prefix?: string;
  /** lg is 44px tall, for the technician flow. */
  controlSize?: 'md' | 'lg';
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id,
    label,
    hint,
    error,
    tag,
    hideLabel,
    highlight,
    required,
    suffix,
    prefix,
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
      {({ id: inputId, describedBy, invalid }) => (
        <div
          className={cn(
            'flex items-center',
            controlFrameClasses({ invalid, highlight, disabled }),
            controlSize === 'lg' ? 'h-11' : 'h-9',
          )}
        >
          {prefix ? <span className="pl-3 text-ink-3">{prefix}</span> : null}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(
              'h-full w-full min-w-0 rounded-control bg-transparent px-3 text-ink outline-none',
              'placeholder:text-ink-disabled disabled:cursor-not-allowed',
              controlSize === 'lg' ? 'text-md' : 'text-base',
              prefix && 'pl-1.5',
              suffix && 'pr-1.5',
              className,
            )}
            {...rest}
          />
          {suffix ? (
            <span className="shrink-0 pr-3 text-sm text-ink-3" aria-hidden="true">
              {suffix}
            </span>
          ) : null}
        </div>
      )}
    </FieldShell>
  );
});
