import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size'
> {
  label?: ReactNode;
  description?: ReactNode;
  indeterminate?: boolean;
  /** lg pads the row to a 44px touch target for the technician flow. */
  size?: 'md' | 'lg';
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, indeterminate = false, size = 'md', className, disabled, ...rest },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const box = (
    <span className="relative inline-flex h-4 w-4 shrink-0">
      <input
        ref={inputRef}
        type="checkbox"
        disabled={disabled}
        className={cn(
          'peer h-4 w-4 cursor-pointer appearance-none rounded-sm border border-line-input bg-surface',
          'transition-colors duration-fast checked:border-primary checked:bg-primary',
          'indeterminate:border-primary indeterminate:bg-primary',
          'disabled:cursor-not-allowed disabled:border-line disabled:bg-page',
          !label && className,
        )}
        {...rest}
      />
      {indeterminate ? (
        <Minus
          className="pointer-events-none absolute inset-0 h-4 w-4 p-0.5 text-white"
          strokeWidth={3}
          aria-hidden="true"
        />
      ) : (
        <Check
          className="pointer-events-none absolute inset-0 h-4 w-4 p-0.5 text-white opacity-0 peer-checked:opacity-100"
          strokeWidth={3}
          aria-hidden="true"
        />
      )}
    </span>
  );

  if (!label) return box;

  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-start gap-2.5',
        size === 'lg' && 'min-h-11 items-center py-2',
        disabled && 'cursor-not-allowed',
        className,
      )}
    >
      <span className={cn('flex', size === 'md' && 'mt-0.5')}>{box}</span>
      <span className="min-w-0">
        <span
          className={cn(
            'block text-ink',
            size === 'lg' ? 'text-md' : 'text-base',
            disabled && 'text-ink-disabled',
          )}
        >
          {label}
        </span>
        {description ? <span className="block text-sm text-ink-3">{description}</span> : null}
      </span>
    </label>
  );
});
