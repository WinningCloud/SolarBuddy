import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfidenceMeter,
  DecisionPill,
  Input,
  Modal,
  RadioCardGroup,
  Select,
  SourceTag,
  Skeleton,
  ErrorState,
  toast,
} from '@/components/ui';
import { formatInr, formatInrRange, formatNumber, formatUnitRange } from '@/design/format';
import { api } from '@/lib/api';
import { errorMessage, useInvalidatePanels } from '@/lib/queries';
import {
  MATERIALS,
  type AssumptionOverrides,
  type DecisionKind,
  type DecisionOption,
  type PanelPassport,
  type Reason,
} from '@/lib/types';
import { cn } from '@/lib/cn';
import { FlowFooter, StepFrame, StepHeader, stepPath, useDebouncedEffect } from './flow';

const KINDS: DecisionKind[] = ['repair', 'reuse', 'recycle'];
const REASONS = ['customer', 'parts', 'safety', 'access', 'other'] as const;
const ASSUMPTION_KEYS: (keyof AssumptionOverrides)[] = [
  'tariffInrPerKwh',
  'peakSunHoursPerDay',
  'remainingLifeYears',
  'annualDegradation',
  'repairCostScale',
  'resalePriceScale',
  'recoveryRateScale',
];

/** Builds the plain explanation from structured reason codes. Numbers come from the engine. */
export function explainReasons(
  t: (k: string, o?: Record<string, unknown>) => string,
  reasons: Reason[],
): string {
  return reasons
    .slice(0, 3)
    .map((r) =>
      t(
        `decision.explanation.${r.code}`,
        Object.fromEntries(Object.entries(r.values).map(([k, v]) => [k, formatNumber(v)])),
      ),
    )
    .join(' ');
}

export function DecisionStep() {
  return <StepFrame>{(panel) => <Decision key={panel.id} panel={panel} />}</StepFrame>;
}

function OptionColumn({ option, recommended }: { option: DecisionOption; recommended: boolean }) {
  const { t } = useTranslation();
  const mats = MATERIALS.filter((m) => option.materialsKg[m].high > 0);
  return (
    <Card selected={recommended} className="flex flex-col" aria-labelledby={`col-${option.kind}`}>
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <h3 id={`col-${option.kind}`} className="text-md font-semibold text-navy">
          {t(`decision.columns.${option.kind}`)}
        </h3>
        {recommended ? (
          <span className="rounded-chip bg-primary px-2 py-0.5 text-xs font-medium text-white">
            {t('decision.recommendedTag')}
          </span>
        ) : null}
      </div>
      <dl className="flex flex-1 flex-col gap-3 p-4">
        {!option.viable ? (
          <Banner tone="warning" className="py-2 text-sm">
            {t('decision.notViable', {
              reason: t(`decision.blocked.${option.blockedReasonCode ?? 'low_output'}`),
            })}
          </Banner>
        ) : null}
        <Row label={t('decision.rows.netValue')}>
          <span className="font-semibold text-ink">
            {formatInrRange(option.netValueInr.low, option.netValueInr.high)}
          </span>
          <span className="block text-xs font-normal text-ink-3">
            {t('ui.confidence.expected')} {formatInr(option.netValueInr.expected)}
          </span>
        </Row>
        <Row label={t('decision.rows.powerAfter')}>
          {formatUnitRange(option.powerAfterW.low, option.powerAfterW.high, 'W', 0)}
        </Row>
        <Row label={t('decision.rows.energy')}>
          {formatUnitRange(option.energyKwh.low, option.energyKwh.high, 'kWh', 0)}
        </Row>
        <Row label={t('decision.rows.materials')}>
          {mats.length === 0 ? (
            <span className="text-ink-3">{t('decision.noMaterials')}</span>
          ) : (
            <ul className="flex flex-col gap-0.5 text-sm">
              {mats.map((m) => (
                <li key={m} className="flex justify-between gap-2">
                  <span className="text-ink-2">{t(`materials.${m}`)}</span>
                  <span>
                    {formatUnitRange(
                      option.materialsKg[m].low,
                      option.materialsKg[m].high,
                      'kg',
                      m === 'silver' ? 2 : 1,
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Row>
        <Row label={t('decision.rows.cost')}>
          {formatInrRange(option.costInr.low, option.costInr.high)}
        </Row>
      </dl>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-divider pt-3 first:border-t-0 first:pt-0">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="mt-0.5 text-base text-ink">{children}</dd>
    </div>
  );
}

function Decision({ panel }: { panel: PanelPassport }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidatePanels();
  const [assumptions, setAssumptions] = useState<AssumptionOverrides | null>(
    panel.decision?.assumptionsUsed ?? null,
  );
  const [open, setOpen] = useState(false);
  const [chooseOpen, setChooseOpen] = useState(false);
  const [choice, setChoice] = useState<DecisionKind | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const first = useRef(true);

  const decide = useMutation({
    mutationFn: (o?: Partial<AssumptionOverrides>) => api.decide(panel.id, o),
    onSuccess: (p) => {
      if (!assumptions && p.decision) setAssumptions(p.decision.assumptionsUsed);
      invalidate(panel.id);
    },
  });

  useEffect(() => {
    decide.mutate(undefined);
    // Compute on entering the step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useDebouncedEffect(
    () => {
      if (first.current) {
        first.current = false;
        return;
      }
      if (assumptions) decide.mutate(assumptions);
    },
    [assumptions],
    500,
  );

  const accept = useMutation({
    mutationFn: ({ kind, why }: { kind: DecisionKind; why: string | null }) =>
      api.acceptDecision(panel.id, kind, why),
    onSuccess: async () => {
      await api.patchPanel(panel.id, { stepIndex: 5 });
      invalidate(panel.id);
      toast.success(t('decision.saved'));
      navigate(stepPath(panel.id, 'passport'));
    },
    onError: (e) =>
      toast.error(t('common.saveFailed'), { description: errorMessage(e, t('errors.generic')) }),
  });

  const decision = panel.decision;
  const rec = decision?.recommended;

  function submitChoice() {
    if (!choice || !decision) return;
    if (choice !== decision.recommended && !reason) {
      setReasonError(t('decision.reasonNeeded'));
      return;
    }
    accept.mutate({
      kind: choice,
      why:
        choice === decision.recommended
          ? null
          : t(`decision.reasons.${reason as (typeof REASONS)[number]}`),
    });
  }

  async function go(target: 'back' | 'exit') {
    try {
      invalidate(panel.id);
      if (target === 'exit') {
        toast.success(t('common.saved'));
        navigate('/');
      } else navigate(stepPath(panel.id, 'diagnosis'));
    } catch (e) {
      toast.error(t('common.saveFailed'), { description: errorMessage(e, t('errors.generic')) });
    }
  }

  return (
    <>
      <StepHeader title={t('decision.title')} subtitle={t('decision.subtitle')} />
      {!decision && decide.isError ? (
        <Card>
          <ErrorState
            description={errorMessage(decide.error, t('errors.generic'))}
            onRetry={() => decide.mutate(undefined)}
            retrying={decide.isPending}
          />
        </Card>
      ) : !decision || !rec ? (
        <div className="flex flex-col gap-4" role="status" aria-label={t('decision.running')}>
          <p className="text-sm text-ink-2">{t('decision.running')}</p>
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <Card>
            <CardBody className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
              <div>
                <p className="section-label">{t('decision.recommendation')}</p>
                <p className="mt-1 text-2xl font-semibold text-navy md:text-[32px] md:leading-10">
                  {t(`decision.columns.${rec}`)}
                </p>
                <p className="mt-2 text-base text-ink-2">
                  {explainReasons(t as never, decision.reasons)}
                </p>
                <div className="mt-2">
                  <SourceTag
                    kind="simulated"
                    label={t('decision.templateTag')}
                    source={t('sourceNotes.economics')}
                  />
                </div>
              </div>
              <ConfidenceMeter
                label={t('decision.confidence')}
                low={decision.confidence.low}
                expected={decision.confidence.expected}
                high={decision.confidence.high}
                size="lg"
                tag={<SourceTag kind="simulated" source={t('sourceNotes.triage')} />}
              />
            </CardBody>
          </Card>

          <div
            className={cn('grid gap-4 md:grid-cols-3', decide.isPending && 'opacity-70')}
            aria-busy={decide.isPending}
          >
            {KINDS.map((k) => (
              <OptionColumn key={k} option={decision.options[k]} recommended={k === rec} />
            ))}
          </div>
          {decide.isPending ? (
            <p className="-mt-3 text-sm text-ink-2" role="status">
              {t('decision.recalculating')}
            </p>
          ) : null}
          {decide.isError ? (
            <Banner tone="danger" live>
              {errorMessage(decide.error, t('errors.generic'))}
            </Banner>
          ) : null}

          <Card>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="assumptions-panel"
              className="flex w-full items-center justify-between gap-3 rounded-card px-4 py-4 text-left md:px-5"
            >
              <span>
                <span className="block text-md font-semibold text-navy">
                  {t('decision.assumptionsTitle')}
                </span>
                <span className="block text-sm text-ink-2">{t('decision.assumptionsHint')}</span>
              </span>
              <ChevronDown
                className={cn(
                  'h-5 w-5 shrink-0 text-ink-2 transition-transform duration-fast',
                  open && 'rotate-180',
                )}
                aria-hidden="true"
              />
            </button>
            {open && assumptions ? (
              <div
                id="assumptions-panel"
                className="sm:grid-cols-2 grid gap-4 border-t border-divider p-4 md:p-5"
              >
                {ASSUMPTION_KEYS.map((key) => (
                  <Input
                    key={key}
                    label={t(`decision.assumptions.${key}`)}
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={assumptions[key]}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= 0)
                        setAssumptions({ ...assumptions, [key]: v });
                    }}
                    tag={<SourceTag kind="assumption" source={api.defaultsTable.note} />}
                  />
                ))}
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title={t('decision.actionsTitle')} />
            <CardBody className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={() => accept.mutate({ kind: rec, why: null })}
                loading={accept.isPending && !chooseOpen}
              >
                {t('decision.accept')}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => {
                  setChoice(rec);
                  setReason('');
                  setReasonError(null);
                  setChooseOpen(true);
                }}
              >
                {t('decision.choose')}
              </Button>
              {decision.chosen ? (
                <p className="text-sm text-ink-2">
                  <DecisionPill decision={decision.chosen} />{' '}
                  {decision.reasonIfOverridden
                    ? t('decision.overriddenNote', { reason: decision.reasonIfOverridden })
                    : null}
                </p>
              ) : null}
            </CardBody>
          </Card>
        </div>
      )}

      <Modal
        open={chooseOpen}
        onOpenChange={setChooseOpen}
        title={t('decision.chooseTitle')}
        description={t('decision.chooseHint')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setChooseOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={submitChoice} loading={accept.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <RadioCardGroup
            legend={t('decision.action')}
            value={choice}
            onChange={(v) => {
              setChoice(v);
              setReasonError(null);
            }}
            options={KINDS.map((k) => ({
              value: k,
              label: t(`decision.columns.${k}`),
              meta:
                k === rec ? (
                  <span className="text-xs font-medium text-primary">
                    {t('decision.recommendedTag')}
                  </span>
                ) : undefined,
            }))}
          />
          {choice && choice !== rec ? (
            <Select
              label={t('decision.reason')}
              placeholder={t('decision.reasonPlaceholder')}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError(null);
              }}
              error={reasonError ?? undefined}
              options={REASONS.map((r) => ({ value: r, label: t(`decision.reasons.${r}`) }))}
            />
          ) : null}
        </div>
      </Modal>

      <FlowFooter
        onBack={() => void go('back')}
        onSaveExit={() => go('exit')}
        onContinue={() => navigate(stepPath(panel.id, 'passport'))}
        continueDisabled={!decision?.chosen}
        continueLabel={t('steps.passport')}
      />
    </>
  );
}
