import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** Highlighted state used for the recommended column: blue tint and border, not a banner. */
  selected?: boolean;
  padded?: boolean;
}

export function Card({ as: Tag = 'section', selected, padded, className, ...rest }: CardProps) {
  return (
    <Tag
      className={cn(
        'rounded-card border bg-surface shadow-card',
        selected ? 'border-accent bg-tint' : 'border-line',
        padded && 'p-4 md:p-5',
        className,
      )}
      {...rest}
    />
  );
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Tiny uppercase label above the title. */
  eyebrow?: ReactNode;
  actions?: ReactNode;
  titleAs?: 'h2' | 'h3' | 'h4';
  titleId?: string;
  className?: string;
}

export function CardHeader({
  title,
  description,
  eyebrow,
  actions,
  titleAs: Title = 'h2',
  titleId,
  className,
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 px-4 pt-4 md:px-5 md:pt-5',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="section-label mb-1">{eyebrow}</p> : null}
        <Title id={titleId} className="text-md font-semibold text-navy">
          {title}
        </Title>
        {description ? <p className="mt-0.5 text-sm text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 md:p-5', className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-end gap-2 border-t border-divider px-4 py-3 md:px-5',
        className,
      )}
      {...rest}
    />
  );
}
