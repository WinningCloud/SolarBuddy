import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Banner,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  ErrorState,
  KeyValueList,
  Skeleton,
  SourceTag,
  toast,
  Button,
  type Column,
} from '@/components/ui';
import { IvChart } from '@/components/IvChart';
import { PanelGrid, PanelGridLegend } from '@/components/PanelGrid';
import {
  formatInrRange,
  formatNumber,
  formatPercent,
  formatUnit,
  formatUnitRange,
} from '@/design/format';
import { api, ApiError } from '@/lib/api';
import { errorMessage, useInvalidatePanels } from '@/lib/queries';
import type { PanelPassport, RepairOption } from '@/lib/types';
import { FlowFooter, StepFrame, StepHeader, stepPath } from './flow';

export function DiagnosisStep() {
  return <StepFrame>{(panel) => <Diagnosis key={panel.id} panel={panel} />}</StepFrame>;
}

function calibrationNote(
  t: (k: string) => string,
  twin: NonNullable<PanelPassport['twin']>,
): string {
  return t(
    twin.calibratedTo === 'measured'
      ? 'sourceNotes.twinCalibrated'
      : twin.calibratedTo === 'output_band'
        ? 'sourceNotes.twinBand'
        : 'sourceNotes.twinDefects',
  );
}

function Diagnosis({ panel }: { panel: PanelPassport }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidatePanels();
  const [cell, setCell] = useState<{ row: number; col: number } | null>(null);

  const run = useMutation({
    mutationFn: () => api.diagnose(panel.id),
    onSuccess: () => invalidate(panel.id),
  });
  useEffect(() => {
    run.mutate();
    // Re-estimate each time the step is opened so changes made earlier are reflected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const twin = panel.twin;
  const front =
    panel.inspection.photos.find((p) => p.slot === 'front') ??
    panel.inspection.photos.find((p) => p.slot !== 'nameplate');
  const info =
    cell && twin ? twin.cells.find((c) => c.row === cell.row && c.col === cell.col) : null;

  async function go(target: 'next' | 'back' | 'exit') {
    try {
      if (target === 'next')
        await api.patchPanel(panel.id, { stepIndex: Math.max(panel.stepIndex, 4) });
      invalidate(panel.id);
      if (target === 'exit') {
        toast.success(t('common.saved'));
        navigate('/');
      } else navigate(stepPath(panel.id, target === 'next' ? 'decision' : 'questions'));
    } catch (e) {
      toast.error(t('common.saveFailed'), { description: errorMessage(e, t('errors.generic')) });
    }
  }

  const missing = run.error instanceof ApiError && run.error.code === 'MISSING_NAMEPLATE';
  const simTag = (
    <SourceTag
      kind="simulated"
      source={`${t('diagnosis.simulatedTip')} ${twin ? calibrationNote(t as never, twin) : ''}`}
    />
  );

  const repairColumns: Column<RepairOption>[] = [
    {
      id: 'repair',
      header: t('diagnosis.repairCols.repair'),
      cell: (r) => <span className="font-medium">{t(`repairs.${r.id}`)}</span>,
    },
    {
      id: 'recovered',
      header: t('diagnosis.repairCols.recovered'),
      align: 'right',
      cell: (r) =>
        r.applicable ? (
          <span>
            {formatUnitRange(r.powerRecoveredW.low, r.powerRecoveredW.high, 'W', 0)}
            <span className="text-ink-3">
              {' '}
              ({formatPercent(r.powerRecoveredPercentOfRated.expected, 1)})
            </span>
          </span>
        ) : (
          '—'
        ),
    },
    {
      id: 'cost',
      header: t('diagnosis.repairCols.cost'),
      align: 'right',
      cell: (r) => formatInrRange(r.costInrLow, r.costInrHigh),
    },
    {
      id: 'verdict',
      header: t('diagnosis.repairCols.verdict'),
      cell: (r) =>
        r.recommended ? (
          <Badge tone="success">{t('diagnosis.recommended')}</Badge>
        ) : r.applicable ? (
          <Badge>{t('diagnosis.noGain')}</Badge>
        ) : (
          <span className="text-ink-3">{t('diagnosis.notApplicable')}</span>
        ),
    },
  ];

  return (
    <>
      <StepHeader title={t('diagnosis.title')} subtitle={t('diagnosis.subtitle')} />

      {missing ? (
        <Card>
          <ErrorState
            title={t('common.loadFailed')}
            description={t('diagnosis.needNameplate')}
            onRetry={() => navigate(stepPath(panel.id, 'identify'))}
          />
        </Card>
      ) : run.isError && !twin ? (
        <Card>
          <ErrorState
            description={errorMessage(run.error, t('errors.generic'))}
            onRetry={() => run.mutate()}
            retrying={run.isPending}
          />
        </Card>
      ) : !twin ? (
        <div className="flex flex-col gap-4" role="status" aria-label={t('diagnosis.running')}>
          <p className="text-sm text-ink-2">{t('diagnosis.running')}</p>
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Card>
              <CardHeader
                title={t('diagnosis.cellsTitle')}
                description={t('diagnosis.cellsHint')}
              />
              <CardBody className="flex flex-col gap-3">
                <div className="relative overflow-hidden rounded-control bg-navy">
                  {front ? (
                    <img
                      src={front.url}
                      alt=""
                      className="block aspect-[5/3] w-full object-cover opacity-90"
                    />
                  ) : (
                    <div className="aspect-[5/3] w-full bg-navy" />
                  )}
                  <PanelGrid
                    overlay
                    flags={panel.inspection.damageFlags}
                    label={t('diagnosis.cellsTitle')}
                    selected={cell}
                    onCellClick={(row, col) => setCell({ row, col })}
                    className="absolute inset-0 content-stretch"
                  />
                </div>
                <PanelGridLegend />
                {info ? (
                  <div
                    className="rounded-control border border-line bg-page p-3"
                    aria-live="polite"
                  >
                    <p className="text-base font-medium text-ink">
                      {t('diagnosis.cellDetail', { row: info.row + 1, col: info.col + 1 })}
                    </p>
                    <KeyValueList
                      items={[
                        {
                          label: t('diagnosis.cellSubstring', { n: info.substring + 1 }),
                          value: '',
                        },
                        {
                          label: t('diagnosis.cellIrradiance'),
                          value: formatPercent(info.effectiveIrradianceFraction),
                          tag: simTag,
                        },
                        {
                          label: t('inspect.damageTitle'),
                          value: info.notes.length
                            ? info.notes.map((n) => t(`damage.${n}`)).join(', ')
                            : t('diagnosis.cellNone'),
                        },
                      ]}
                    />
                  </div>
                ) : null}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title={t('diagnosis.chartTitle')} actions={simTag} />
              <CardBody className="flex flex-col gap-5">
                <IvChart
                  rated={twin.rated.curve}
                  now={twin.now.curve}
                  measured={panel.inspection.measured}
                  summary={t('diagnosis.chartSummary', {
                    now: formatUnit(twin.now.point.pmaxW, 'W'),
                    rated: formatUnit(twin.rated.point.pmaxW, 'W'),
                    percent: formatPercent(twin.now.fractionOfRated.expected),
                  })}
                />
                <div className="overflow-x-auto">
                  <table className="w-full text-base">
                    <caption className="sr-only">{t('diagnosis.summaryTitle')}</caption>
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-ink-2">
                        <th scope="col" className="py-2 pr-3 font-medium">
                          {t('diagnosis.summaryTitle')}
                        </th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">
                          {t('diagnosis.cols.rated')}
                        </th>
                        <th scope="col" className="py-2 pl-3 text-right font-medium">
                          {t('diagnosis.cols.now')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="[&_td]:border-b [&_td]:border-divider [&_td]:py-2 [&_th]:border-b [&_th]:border-divider [&_th]:py-2">
                      <tr>
                        <th scope="row" className="pr-3 text-left font-normal text-ink-2">
                          {t('diagnosis.rows.pmax')}
                        </th>
                        <td className="px-3 text-right">
                          {formatUnit(twin.rated.point.pmaxW, 'W', 0)}
                        </td>
                        <td className="pl-3 text-right font-medium">
                          {formatUnit(twin.now.point.pmaxW, 'W', 0)}
                          <span className="block text-xs font-normal text-ink-3">
                            {t('common.range')}{' '}
                            {formatUnitRange(
                              twin.now.pmaxRangeW.low,
                              twin.now.pmaxRangeW.high,
                              'W',
                              0,
                            )}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <th scope="row" className="pr-3 text-left font-normal text-ink-2">
                          {t('diagnosis.rows.vmpp')}
                        </th>
                        <td className="px-3 text-right">
                          {formatUnit(twin.rated.point.vmppV, 'V')}
                        </td>
                        <td className="pl-3 text-right font-medium">
                          {formatUnit(twin.now.point.vmppV, 'V')}
                        </td>
                      </tr>
                      <tr>
                        <th scope="row" className="pr-3 text-left font-normal text-ink-2">
                          {t('diagnosis.rows.impp')}
                        </th>
                        <td className="px-3 text-right">
                          {formatUnit(twin.rated.point.imppA, 'A')}
                        </td>
                        <td className="pl-3 text-right font-medium">
                          {formatUnit(twin.now.point.imppA, 'A')}
                        </td>
                      </tr>
                      <tr>
                        <th scope="row" className="pr-3 text-left font-normal text-ink-2">
                          {t('diagnosis.rows.fillFactor')}
                        </th>
                        <td className="px-3 text-right">
                          {formatNumber(twin.rated.point.fillFactor, 2)}
                        </td>
                        <td className="pl-3 text-right font-medium">
                          {formatNumber(twin.now.point.fillFactor, 2)}
                        </td>
                      </tr>
                      <tr>
                        <th scope="row" className="pr-3 text-left font-normal text-ink-2">
                          {t('diagnosis.rows.series')}
                        </th>
                        <td className="px-3 text-right">—</td>
                        <td className="pl-3 text-right font-medium">
                          {formatUnit(twin.now.seriesResistanceOhm, 'Ω')}
                        </td>
                      </tr>
                      <tr>
                        <th scope="row" className="pr-3 text-left font-normal text-ink-2">
                          {t('diagnosis.rows.fraction')}
                        </th>
                        <td className="px-3 text-right">100%</td>
                        <td className="pl-3 text-right font-medium">
                          {formatPercent(twin.now.fractionOfRated.expected)}
                          <span className="block text-xs font-normal text-ink-3">
                            {t('common.range')} {formatPercent(twin.now.fractionOfRated.low)}–
                            {formatPercent(twin.now.fractionOfRated.high)}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-ink-3">{calibrationNote(t as never, twin)}</p>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader
              title={t('diagnosis.repairsTitle')}
              description={t('diagnosis.repairsHint')}
              actions={simTag}
            />
            <CardBody className="px-0 pb-0 md:px-0 md:pb-0">
              <DataTable
                caption={t('diagnosis.repairsTitle')}
                columns={repairColumns}
                rows={panel.repairOptions}
                getRowId={(r) => r.id}
                empty={<EmptyState compact title={t('diagnosis.noRepairs')} />}
              />
              {panel.repairOptions.every((r) => !r.applicable) ? (
                <Banner tone="info" className="m-4">
                  {t('diagnosis.noRepairs')}
                </Banner>
              ) : null}
            </CardBody>
          </Card>
          {run.isError ? (
            <Banner
              tone="warning"
              live
              action={
                <Button size="sm" variant="secondary" onClick={() => run.mutate()}>
                  {t('common.tryAgain')}
                </Button>
              }
            >
              {errorMessage(run.error, t('errors.generic'))}
            </Banner>
          ) : null}
        </div>
      )}

      <FlowFooter
        onBack={() => void go('back')}
        onSaveExit={() => go('exit')}
        onContinue={() => go('next')}
        continueDisabled={!twin}
      />
    </>
  );
}
