// The ten client tools the ElevenLabs agent calls. They run in the browser, use the same api
// client as the screens, and every number they return comes from the engine, never from a model.

import i18n from '@/i18n';
import { formatInrRange, formatNumber, formatPercent, formatUnitRange } from '@/design/format';
import { api, decisionOf } from '../api';
import { explainReasons } from '@/features/assess/DecisionStep';
import { faultClassIds, optionsOf, QUESTION_IDS } from '../demo/triage';
import type { FaultClassId, PanelPassport, TriageState } from '../types';
import { parseAnswer, parseMeasurement, QUANTITY_UNIT, type Quantity } from './parse';

export const STEP_IDS = [
  'identify',
  'inspect',
  'questions',
  'diagnosis',
  'decision',
  'passport',
] as const;
export type StepTarget = (typeof STEP_IDS)[number];

export interface PendingMeasurement {
  quantity: Quantity;
  value: number;
  unit: 'V' | 'A' | 'W';
}

export interface HeardEvent {
  heard: string;
  matchedLabel: string | null;
  questionId: string;
  status: 'accepted' | 'unclear' | 'not_sure';
}

export interface VoiceToolContext {
  panelId: string;
  /** Called after any change so the screen refetches. */
  refresh: () => void;
  navigateTo: (step: StepTarget) => void;
  onHeard: (e: HeardEvent) => void;
  onPending: (m: PendingMeasurement | null) => void;
  getPending: () => PendingMeasurement | null;
  endSession: () => void;
}

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts) as string;
const json = (v: unknown) => JSON.stringify(v);

function questionPayload(state: TriageState) {
  const q = state.next;
  if (!q) return null;
  return {
    questionId: q.questionId,
    text: t(`questions.items.${q.questionId}.text`),
    options: [
      ...q.options.map((id) => ({ id, label: t(`questions.items.${q.questionId}.options.${id}`) })),
      { id: 'not_sure', label: t('questions.notSure') },
    ],
    stepIndex: q.index + 1,
    totalSteps: QUESTION_IDS.length,
  };
}

async function currentTriage(panelId: string): Promise<TriageState> {
  return api.getTriage(panelId);
}

export function createVoiceTools(ctx: VoiceToolContext) {
  return {
    get_current_question: async () => {
      const state = await currentTriage(ctx.panelId);
      return json(questionPayload(state) ?? { done: true, message: 'All questions are answered.' });
    },

    submit_answer: async ({ answer_text }: { answer_text?: string }) => {
      const state = await currentTriage(ctx.panelId);
      const q = state.next;
      if (!q)
        return json({ status: 'accepted', done: true, readyToRecommend: state.readyToRecommend });
      const parsed = parseAnswer(q.questionId, String(answer_text ?? ''));
      if (parsed.status === 'unclear') {
        ctx.onHeard({
          heard: String(answer_text ?? ''),
          matchedLabel: null,
          questionId: q.questionId,
          status: 'unclear',
        });
        return json({
          status: 'unclear',
          options: optionsOf(q.questionId).map((id) =>
            t(`questions.items.${q.questionId}.options.${id}`),
          ),
        });
      }
      const option = parsed.status === 'not_sure' ? 'not_sure' : parsed.option;
      const next = await api.answer(ctx.panelId, q.questionId, option);
      const matchedLabel =
        option === 'not_sure'
          ? t('questions.notSure')
          : t(`questions.items.${q.questionId}.options.${option}`);
      ctx.onHeard({
        heard: String(answer_text ?? ''),
        matchedLabel,
        questionId: q.questionId,
        status: parsed.status,
      });
      ctx.refresh();
      return json({
        status: parsed.status === 'not_sure' ? 'not_sure' : 'accepted',
        matchedLabel,
        nextQuestion: questionPayload(next),
        readyToRecommend: next.readyToRecommend,
      });
    },

    repeat_question: async () => {
      const state = await currentTriage(ctx.panelId);
      return json(questionPayload(state) ?? { done: true });
    },

    go_back: async () => {
      const state = await api.undoAnswer(ctx.panelId);
      ctx.refresh();
      return json({ status: 'undone', question: questionPayload(state) });
    },

    get_what_we_know: async () => {
      const state = await currentTriage(ctx.panelId);
      const top = [...faultClassIds]
        .sort((a, b) => state.beliefs[b as FaultClassId] - state.beliefs[a as FaultClassId])
        .slice(0, 3)
        .map((id) => ({
          label: t(`faults.${id}`),
          percent: Math.round(state.beliefs[id as FaultClassId] * 100),
        }));
      return json({ likelihoods: top, readyToRecommend: state.readyToRecommend });
    },

    record_measurement: async ({
      quantity,
      utterance,
    }: {
      quantity?: string;
      utterance?: string;
    }) => {
      if (quantity !== 'voc' && quantity !== 'isc' && quantity !== 'pmax')
        return json({ status: 'error', reason: 'unknown_quantity' });
      const parsed = parseMeasurement(quantity, String(utterance ?? ''));
      if ('error' in parsed) return json({ status: 'error', reason: parsed.error });
      const pending: PendingMeasurement = { quantity, ...parsed };
      ctx.onPending(pending);
      return json({
        status: 'needs_confirmation',
        quantity,
        value: parsed.value,
        unit: parsed.unit,
      });
    },

    confirm_measurement: async ({ confirmed }: { confirmed?: boolean | string }) => {
      const pending = ctx.getPending();
      if (!pending) return json({ status: 'error', reason: 'nothing_pending' });
      const yes = confirmed === true || confirmed === 'true';
      if (!yes) {
        ctx.onPending(null);
        return json({ status: 'discarded' });
      }
      const result = await saveMeasurement(ctx.panelId, pending);
      ctx.onPending(null);
      ctx.refresh();
      return json(result);
    },

    navigate: async ({ target }: { target?: string }) => {
      if (!STEP_IDS.includes(target as StepTarget))
        return json({ status: 'error', reason: 'unknown_target' });
      const panel = await api.getPanel(ctx.panelId);
      const missing = missingFor(target as StepTarget, panel);
      if (missing) return json({ status: 'blocked', missing });
      ctx.navigateTo(target as StepTarget);
      return json({ status: 'ok', target });
    },

    get_decision_summary: async () => {
      let panel = await api.getPanel(ctx.panelId);
      if (!panel.twin) {
        try {
          panel = await api.diagnose(ctx.panelId);
        } catch {
          return json({ status: 'blocked', missing: 'rated power, Voc and Isc on the nameplate' });
        }
      }
      if (!panel.decision) panel = await api.decide(ctx.panelId);
      const d = panel.decision;
      const kind = decisionOf(panel);
      if (!d || !kind) return json({ status: 'blocked', missing: 'the diagnosis' });
      const o = d.options[d.recommended];
      return json({
        status: 'ok',
        recommendation: t(`decision.columns.${d.recommended}`),
        confidence: `${formatPercent(d.confidence.low)} to ${formatPercent(d.confidence.high)}`,
        netValue: formatInrRange(o.netValueInr.low, o.netValueInr.high),
        energy: formatUnitRange(o.energyKwh.low, o.energyKwh.high, 'kWh', 0),
        reason: explainReasons(t as never, d.reasons),
        note: 'These figures are simulated and use assumptions. The technician makes the final choice.',
      });
    },

    end_session: async () => {
      ctx.endSession();
      return json({ status: 'ended' });
    },
  };
}

async function saveMeasurement(panelId: string, m: PendingMeasurement) {
  const panel = await api.getPanel(panelId);
  const measured = { ...panel.inspection.measured };
  if (m.quantity === 'pmax' && !measured.conditions)
    return {
      status: 'needs_conditions',
      message: 'Choose the measurement conditions on the Inspect screen first.',
    };
  if (m.quantity === 'voc') measured.vocV = m.value;
  if (m.quantity === 'isc') measured.iscA = m.value;
  if (m.quantity === 'pmax') measured.pmaxW = m.value;
  await api.saveInspection(panelId, panel.inspection.damageFlags, measured);
  return {
    status: 'saved',
    quantity: m.quantity,
    value: formatNumber(m.value, 1),
    unit: QUANTITY_UNIT[m.quantity],
  };
}

function missingFor(target: StepTarget, p: PanelPassport): string | null {
  const np = p.nameplate;
  const hasNameplate = Boolean(np.pmaxW && np.vocV && np.iscA);
  if (target === 'identify' || target === 'inspect') return null;
  if (!hasNameplate) return 'rated power, Voc and Isc on the nameplate';
  if (target === 'questions') return null;
  if (target === 'diagnosis')
    return p.assessment.answers.length < 3 ? 'at least three answers' : null;
  if (target === 'decision')
    return p.assessment.answers.length < 3 ? 'at least three answers' : null;
  if (target === 'passport')
    return p.decision?.chosen ? null : 'a decision accepted on the Decision screen';
  return null;
}
