import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { controlFrameClasses, FieldShell, type FieldOwnProps } from './Field';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldOwnProps {
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    id,
    label,
    hint,
    error,
    tag,
    hideLabel,
    highlight,
    required,
    disabled,
    rows = 3,
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
      {({ id: textareaId, describedBy, invalid }) => (
        <div className={controlFrameClasses({ invalid, highlight, disabled })}>
          <textarea
            ref={ref}
            id={textareaId}
            rows={rows}
            disabled={disabled}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(
              'block w-full resize-y rounded-control bg-transparent px-3 py-2 text-base text-ink outline-none',
              'placeholder:text-ink-disabled disabled:cursor-not-allowed',
              className,
            )}
            {...rest}
          />
        </div>
      )}
    </FieldShell>
  );
});
