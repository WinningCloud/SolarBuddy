import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

export interface StepItem {
  id: string;
  label: string;
  complete?: boolean;
}

interface StepperProps {
  steps: StepItem[];
  currentIndex: number;
  /** Called when a completed or earlier step is chosen. Omit to make the stepper read-only. */
  onStepSelect?: (index: number) => void;
  className?: string;
}

/**
 * Wide screens: every step with its number and label.
 * Phones: "Step 2 of 6", the step name and a segmented bar, so the person always knows where they are.
 */
export function Stepper({ steps, currentIndex, onStepSelect, className }: StepperProps) {
  const { t } = useTranslation();
  const current = steps[currentIndex];

  return (
    <nav aria-label={t('ui.stepper.label')} className={className}>
      {/* Phone layout */}
      <div className="md:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm text-ink-2">
            {t('ui.stepper.stepOf', { current: currentIndex + 1, total: steps.length })}
          </p>
          <p className="text-base font-semibold text-navy">{current?.label}</p>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden="true">
          {steps.map((step, index) => (
            <span
              key={step.id}
              className={cn(
                'h-1 flex-1 rounded-full',
                index < currentIndex || step.complete
                  ? 'bg-primary'
                  : index === currentIndex
                    ? 'bg-accent'
                    : 'bg-line',
              )}
            />
          ))}
        </div>
      </div>

      {/* Tablet and desktop layout */}
      <ol className="hidden items-center md:flex">
        {steps.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isComplete = Boolean(step.complete) && !isCurrent;
          const reachable =
            Boolean(onStepSelect) && !isCurrent && (isComplete || index < currentIndex);
          const marker = (
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                isComplete && 'bg-primary text-white',
                isCurrent && 'border-2 border-accent bg-surface text-primary',
                !isComplete && !isCurrent && 'border border-line-input bg-surface text-ink-3',
              )}
              aria-hidden="true"
            >
              {isComplete ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
            </span>
          );
          const text = (
            <span
              className={cn(
                'whitespace-nowrap text-sm',
                isCurrent
                  ? 'font-semibold text-navy'
                  : isComplete
                    ? 'font-medium text-ink'
                    : 'text-ink-3',
              )}
            >
              {step.label}
            </span>
          );
          const status = isCurrent
            ? t('ui.stepper.current')
            : isComplete
              ? t('ui.stepper.completed')
              : null;

          return (
            <li
              key={step.id}
              className={cn('flex items-center', index < steps.length - 1 && 'flex-1')}
            >
              {reachable ? (
                <button
                  type="button"
                  onClick={() => onStepSelect?.(index)}
                  className="flex min-h-11 items-center gap-2 rounded-btn px-1.5 hover:bg-divider"
                >
                  {marker}
                  {text}
                  {status ? <span className="sr-only">({status})</span> : null}
                </button>
              ) : (
                <span
                  className="flex min-h-11 items-center gap-2 px-1.5"
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {marker}
                  {text}
                  {status ? <span className="sr-only">({status})</span> : null}
                </span>
              )}
              {index < steps.length - 1 ? (
                <span
                  className={cn(
                    'mx-2 h-px min-w-4 flex-1',
                    index < currentIndex ? 'bg-primary' : 'bg-line',
                  )}
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
