import { useEffect, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, ErrorState, Skeleton, Stepper } from '@/components/ui';
import { toast } from '@/components/ui';
import { LanguageSwitcher } from '@/app/LanguageSwitcher';
import { Logo } from '@/app/Logo';
import { api } from '@/lib/api';
import { errorMessage, useInvalidatePanels, usePanel } from '@/lib/queries';
import type { PanelPassport } from '@/lib/types';

export const STEPS = [
  'identify',
  'inspect',
  'questions',
  'diagnosis',
  'decision',
  'passport',
] as const;
export type StepId = (typeof STEPS)[number];

export const stepPath = (id: string, step: StepId) => `/assess/${id}/${step}`;

export function useDebouncedEffect(effect: () => void, deps: unknown[], ms = 600): void {
  useEffect(() => {
    const timer = window.setTimeout(effect, ms);
    return () => window.clearTimeout(timer);
    // The caller owns the dependency list, as with useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Creates a draft and moves into the flow. */
export function NewAssessment() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidatePanels();
  useEffect(() => {
    let live = true;
    api
      .createPanel()
      .then((p) => {
        invalidate();
        if (live) navigate(stepPath(p.id, 'identify'), { replace: true });
      })
      .catch((e: unknown) =>
        toast.error(t('common.saveFailed'), { description: errorMessage(e, t('errors.generic')) }),
      );
    return () => {
      live = false;
    };
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="mx-auto max-w-[720px] px-4 py-12">
      <Skeleton className="h-8 w-48" />
    </div>
  );
}

/** Focused layout: stepper at the top, no sidebar. */
export function FlowLayout() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  // The step is a child route, so read it from the path rather than from route params.
  const step = useLocation().pathname.split('/').filter(Boolean)[2];
  const navigate = useNavigate();
  const { data: panel } = usePanel(id);
  const index = Math.max(0, STEPS.indexOf(step as StepId));
  const reached = panel?.stepIndex ?? 0;

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-3 px-4 py-2 md:px-6">
          <Link to="/" className="rounded-btn" aria-label="SecondSun">
            <Logo onDark={false} />
          </Link>
          <div className="flex items-center gap-2">
            <span className="sm:inline hidden text-sm text-ink-3">{id}</span>
            <LanguageSwitcher />
          </div>
        </div>
        <div className="mx-auto max-w-[1120px] px-4 pb-3 md:px-6 md:pb-1">
          <Stepper
            steps={STEPS.map((s, k) => ({
              id: s,
              label: t(`steps.${s}`),
              complete: k < reached || (k === 5 && panel?.status !== 'draft' && reached >= 5),
            }))}
            currentIndex={index}
            onStepSelect={(k) => navigate(stepPath(id, STEPS[k]!))}
          />
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-[1120px] px-4 pb-32 pt-6 outline-none md:px-6 md:pt-8"
      >
        <Outlet />
      </main>
    </div>
  );
}

/** Loads the panel for the current route and handles loading, error and not-found. */
export function StepFrame({ children }: { children: (panel: PanelPassport) => ReactNode }) {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data, error, isLoading, refetch, isFetching } = usePanel(id);
  if (isLoading)
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label={t('ui.loading')}>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (error || !data)
    return (
      <ErrorState
        title={t('common.loadFailed')}
        description={errorMessage(error, t('errors.generic'))}
        onRetry={() => void refetch()}
        retrying={isFetching}
      />
    );
  return <>{children(data)}</>;
}

export function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl md:text-2xl">{title}</h1>
      {subtitle ? <p className="mt-1 max-w-[640px] text-base text-ink-2">{subtitle}</p> : null}
    </div>
  );
}

interface FlowFooterProps {
  onBack?: () => void;
  onSaveExit: () => void | Promise<void>;
  onContinue: () => void | Promise<void>;
  continueLabel?: string;
  continueDisabled?: boolean;
  continueLoading?: boolean;
  hideContinue?: boolean;
  trailingIcon?: 'arrow' | 'check';
}

export function FlowFooter({
  onBack,
  onSaveExit,
  onContinue,
  continueLabel,
  continueDisabled,
  continueLoading,
  hideContinue,
  trailingIcon = 'arrow',
}: FlowFooterProps) {
  const { t } = useTranslation();
  return (
    <div className="print-hide fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-2 px-4 py-3 md:px-6">
        <div className="sm:gap-2 flex items-center gap-1">
          {onBack ? (
            <Button
              variant="ghost"
              size="lg"
              onClick={onBack}
              leadingIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
            >
              {t('common.back')}
            </Button>
          ) : null}
          <Button variant="secondary" size="lg" onClick={() => void onSaveExit()}>
            {t('common.saveExit')}
          </Button>
        </div>
        {!hideContinue ? (
          <Button
            size="lg"
            onClick={() => void onContinue()}
            disabled={continueDisabled}
            loading={continueLoading}
            trailingIcon={
              trailingIcon === 'check' ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              )
            }
          >
            {continueLabel ?? t('common.continue')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
