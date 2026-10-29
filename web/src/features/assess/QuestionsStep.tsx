import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Mic, Undo2, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  Drawer,
  ProgressBar,
  RadioCardGroup,
  SourceTag,
  toast,
} from '@/components/ui';
import { formatPercent } from '@/design/format';
import { api } from '@/lib/api';
import { errorMessage, keys, useInvalidatePanels } from '@/lib/queries';
import { faultClassIds, optionsOf, priorsMeta, QUESTION_IDS } from '@/lib/demo/triage';
import type { FaultClassId, PanelPassport, TriageState } from '@/lib/types';
import { FlowFooter, StepFrame, StepHeader, stepPath } from './flow';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return matches;
}

export function QuestionsStep() {
  return <StepFrame>{(panel) => <Questions key={panel.id} panel={panel} />}</StepFrame>;
}

function Beliefs({ triage }: { triage: TriageState }) {
  const { t } = useTranslation();
  const rows = faultClassIds
    .map((id) => ({ id, p: triage.beliefs[id as FaultClassId] }))
    .sort((a, b) => b.p - a.p);
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3" aria-label={t('questions.known.title')}>
        {rows.map((r) => (
          <li key={r.id}>
            <ProgressBar
              label={t(`faults.${r.id}`)}
              valueText={formatPercent(r.p)}
              value={r.p}
              decorative
              tone="accent"
            />
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-2">{t('questions.known.nextWhy')}</p>
      <SourceTag
        kind="assumption"
        label={t('questions.known.noteTag')}
        source={`${t('sourceNotes.triage')} ${priorsMeta.source}`}
      />
    </div>
  );
}

function VoiceDock() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-3">
      <Button
        variant="secondary"
        size="lg"
        disabled
        leadingIcon={<Mic className="h-4 w-4" aria-hidden="true" />}
      >
        {t('questions.voice.mic')}
      </Button>
      <Button
        variant="ghost"
        size="lg"
        disabled
        leadingIcon={<Volume2 className="h-4 w-4" aria-hidden="true" />}
      >
        {t('questions.voice.speaker')}
      </Button>
      <p className="min-w-0 flex-1 text-sm text-ink-2" role="status">
        <span className="font-medium text-ink">{t('questions.voice.notConnected')}</span>{' '}
        {t('questions.voice.notConnectedHelp')}
      </p>
    </div>
  );
}

function Questions({ panel }: { panel: PanelPassport }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidatePanels();
  const wide = useMediaQuery('(min-width: 1024px)');
  const [sheet, setSheet] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const answers = panel.assessment.answers;

  const triage = useQuery({
    queryKey: [...keys.triage(panel.id), answers.length],
    queryFn: () => api.getTriage(panel.id),
  });

  const answer = useMutation({
    mutationFn: ({ questionId, value }: { questionId: string; value: string }) =>
      api.answer(panel.id, questionId, value),
    onSuccess: () => {
      setViewing(null);
      invalidate(panel.id);
    },
    onError: (e) =>
      toast.error(t('common.saveFailed'), { description: errorMessage(e, t('errors.generic')) }),
  });
  const undo = useMutation({
    mutationFn: () => api.undoAnswer(panel.id),
    onSuccess: () => {
      setViewing(null);
      invalidate(panel.id);
    },
  });

  const state = triage.data;
  const questionId = viewing ?? state?.next?.questionId ?? null;
  const current = answers.find((a) => a.questionId === questionId)?.answer ?? null;
  const index = questionId ? QUESTION_IDS.indexOf(questionId) : 0;
  const answered = answers.length;
  const total = QUESTION_IDS.length;
  const canContinue = Boolean(state && (state.readyToRecommend || answered >= 3 || !state.next));

  async function go(target: 'next' | 'back' | 'exit') {
    try {
      if (target === 'next')
        await api.patchPanel(panel.id, { stepIndex: Math.max(panel.stepIndex, 3) });
      invalidate(panel.id);
      if (target === 'exit') {
        toast.success(t('common.saved'));
        navigate('/');
      } else navigate(stepPath(panel.id, target === 'next' ? 'diagnosis' : 'inspect'));
    } catch (e) {
      toast.error(t('common.saveFailed'), { description: errorMessage(e, t('errors.generic')) });
    }
  }

  const knownCard = state ? (
    <Card>
      <CardHeader title={t('questions.known.title')} />
      <CardBody className="flex flex-col gap-4">
        <Beliefs triage={state} />
        {state.readyToRecommend ? (
          <Banner tone="success" title={t('questions.known.enough')} live>
            {t('questions.known.enoughHint')}
          </Banner>
        ) : (
          <p className="text-sm text-ink-3">{t('questions.known.notEnough')}</p>
        )}
      </CardBody>
    </Card>
  ) : null;

  return (
    <>
      <StepHeader title={t('questions.title')} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          <VoiceDock />

          {triage.isError ? (
            <Banner
              tone="danger"
              live
              action={
                <Button size="sm" variant="secondary" onClick={() => void triage.refetch()}>
                  {t('common.tryAgain')}
                </Button>
              }
            >
              {errorMessage(triage.error, t('errors.generic'))}
            </Banner>
          ) : null}

          {questionId ? (
            <Card>
              <CardBody className="flex flex-col gap-4">
                <div>
                  <p className="text-sm text-ink-2">
                    {t('questions.progress', { current: Math.min(total, index + 1), total })}
                  </p>
                  <ProgressBar
                    className="mt-2"
                    label={t('questions.title')}
                    hideLabel
                    value={answered / total}
                    size="sm"
                    valueText={`${answered} / ${total}`}
                  />
                </div>
                <RadioCardGroup
                  key={questionId}
                  legend={t(`questions.items.${questionId}.text`)}
                  description={
                    t(`questions.items.${questionId}.hint`, { defaultValue: '' }) || undefined
                  }
                  value={current}
                  onChange={(value) => answer.mutate({ questionId, value })}
                  options={[
                    ...optionsOf(questionId).map((o) => ({
                      value: o,
                      label: t(`questions.items.${questionId}.options.${o}`),
                    })),
                    { value: 'not_sure', label: t('questions.notSure') },
                  ]}
                />
              </CardBody>
            </Card>
          ) : state ? (
            <Banner tone="success" title={t('questions.allAnswered')}>
              {t('questions.allAnsweredHint')}
            </Banner>
          ) : (
            <Card>
              <CardBody className="text-sm text-ink-2" role="status">
                {t('ui.loading')}
              </CardBody>
            </Card>
          )}

          {answers.length > 0 ? (
            <Card>
              <CardHeader
                title={t('questions.history')}
                actions={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => undo.mutate()}
                    loading={undo.isPending}
                    leadingIcon={<Undo2 className="h-4 w-4" aria-hidden="true" />}
                  >
                    {t('questions.undo')}
                  </Button>
                }
              />
              <CardBody>
                <ol className="flex flex-col divide-y divide-divider">
                  {answers.map((a) => (
                    <li
                      key={a.questionId}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-ink-2">
                          {t(`questions.items.${a.questionId}.text`)}
                        </p>
                        <p className="flex items-center gap-1.5 text-base font-medium text-ink">
                          <CheckCircle2
                            className="h-4 w-4 shrink-0 text-success"
                            aria-hidden="true"
                          />
                          {a.answer === 'not_sure'
                            ? t('questions.notSure')
                            : t(`questions.items.${a.questionId}.options.${a.answer}`)}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setViewing(a.questionId)}>
                        {t('questions.change')}
                      </Button>
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          ) : null}
        </div>

        {wide ? <div className="self-start lg:sticky lg:top-40">{knownCard}</div> : null}
      </div>

      {!wide && state ? (
        <>
          <button
            type="button"
            onClick={() => setSheet(true)}
            className="print-hide fixed inset-x-4 bottom-[88px] z-10 flex items-center justify-between rounded-card border border-line bg-surface px-4 py-3 text-left shadow-overlay"
          >
            <span className="text-base font-medium text-ink">{t('questions.known.title')}</span>
            <span className="text-sm text-ink-2">
              {t(
                `faults.${[...faultClassIds].sort((a, b) => state.beliefs[b as FaultClassId] - state.beliefs[a as FaultClassId])[0] as FaultClassId}`,
              )}{' '}
              {formatPercent(
                Math.max(...faultClassIds.map((id) => state.beliefs[id as FaultClassId])),
              )}
            </span>
          </button>
          <Drawer
            open={sheet}
            onOpenChange={setSheet}
            side="bottom"
            title={t('questions.known.title')}
          >
            {knownCard}
          </Drawer>
        </>
      ) : null}

      <FlowFooter
        onBack={() => void go('back')}
        onSaveExit={() => go('exit')}
        onContinue={() => go('next')}
        continueDisabled={!canContinue}
      />
    </>
  );
}
