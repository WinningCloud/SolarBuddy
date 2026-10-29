import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-hover active:bg-primary-pressed disabled:bg-line disabled:text-ink-3',
  secondary:
    'border border-line-strong bg-surface text-ink hover:border-line-input hover:bg-page active:bg-divider disabled:border-line disabled:bg-surface disabled:text-ink-disabled',
  ghost:
    'text-primary hover:bg-tint active:bg-tint active:text-primary-pressed disabled:bg-transparent disabled:text-ink-disabled',
  danger:
    'bg-danger-strong text-white hover:bg-danger-ink active:bg-danger-ink disabled:bg-line disabled:text-ink-3',
};

// lg is 44px tall: the minimum touch target used throughout the technician flow.
const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-9 gap-2 px-4 text-base',
  lg: 'h-11 gap-2 px-5 text-md',
};

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
} = {}): string {
  return cn(
    'inline-flex select-none items-center justify-center whitespace-nowrap rounded-btn font-medium',
    'transition-colors duration-fast disabled:cursor-not-allowed',
    variantClasses[variant],
    sizeClasses[size],
    block && 'w-full',
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  /** Replaces the label while loading, e.g. "Saving". Defaults to the label itself. */
  loadingLabel?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    block,
    loading = false,
    loadingLabel,
    leadingIcon,
    trailingIcon,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, block, className })}
      {...rest}
    >
      {loading ? <Spinner /> : leadingIcon}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
      {!loading && trailingIcon}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  icon: ReactNode;
  size?: ButtonSize;
  variant?: 'ghost' | 'secondary';
}

const iconSize: Record<ButtonSize, string> = { sm: 'h-8 w-8', md: 'h-9 w-9', lg: 'h-11 w-11' };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, size = 'md', variant = 'ghost', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-btn transition-colors duration-fast',
        'disabled:cursor-not-allowed disabled:text-ink-disabled',
        variant === 'ghost'
          ? 'text-ink-2 hover:bg-divider hover:text-ink'
          : 'border border-line-strong bg-surface text-ink-2 hover:bg-page hover:text-ink',
        iconSize[size],
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
});
