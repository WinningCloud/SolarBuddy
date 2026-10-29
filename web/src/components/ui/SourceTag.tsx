import type { ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import {
  BookOpen,
  Calculator,
  Gauge,
  Info,
  PencilLine,
  ScanText,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

export type SourceKind =
  'measured' | 'extracted' | 'entered' | 'simulated' | 'assumption' | 'sourced';

const kindStyle: Record<SourceKind, { icon: LucideIcon; classes: string }> = {
  measured: { icon: Gauge, classes: 'border-success/40 bg-success-tint text-success-ink' },
  extracted: { icon: ScanText, classes: 'border-accent/40 bg-tint text-primary' },
  entered: { icon: PencilLine, classes: 'border-line-strong bg-surface text-ink-2' },
  simulated: { icon: Calculator, classes: 'border-line-strong bg-surface text-ink-2' },
  assumption: { icon: Info, classes: 'border-warning/40 bg-warning-tint text-warning-ink' },
  sourced: { icon: BookOpen, classes: 'border-line-strong bg-surface text-ink-2' },
};

export interface SourceTagProps {
  kind: SourceKind;
  /** Explanation of where the value comes from. When present the tag opens on tap or click. */
  source?: ReactNode;
  /** Overrides the default label, e.g. "Simulated: single-diode model". */
  label?: string;
  className?: string;
}

/**
 * Provenance label for a value: measured, extracted, entered, simulated, assumption or sourced.
 * Uses a popover rather than a hover tooltip so the source is reachable by touch.
 */
export function SourceTag({ kind, source, label, className }: SourceTagProps) {
  const { t } = useTranslation();
  const { icon: Icon, classes } = kindStyle[kind];
  const text = label ?? t(`ui.source.${kind}`);

  const body = (
    <>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </>
  );
  const base = cn(
    'inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-chip border px-1.5 text-xs font-medium',
    classes,
    className,
  );

  if (!source) return <span className={base}>{body}</span>;

  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(base, 'cursor-pointer underline decoration-dotted underline-offset-2')}
        aria-label={t('ui.source.showSource', { label: text })}
      >
        {body}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={16}
          className={cn(
            'z-50 max-w-[300px] rounded-card border border-line bg-surface p-3 text-sm text-ink shadow-overlay',
            'data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
          )}
        >
          <p className="section-label mb-1">{t('ui.source.sourceLabel')}</p>
          <div className="text-ink-2">{source}</div>
          <Popover.Arrow className="fill-surface" width={12} height={6} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
