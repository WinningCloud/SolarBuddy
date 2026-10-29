// Bayesian triage over four fault classes, using data/priors.json.
// Next question = highest expected information gain about the decision partition, per unit cost.

import priors from '@data/priors.json';
import type {
  Answer,
  BeliefSnapshot,
  DecisionKind,
  FaultClassId,
  QuestionPayload,
  TriageState,
} from '../types';

const CLASSES = priors.faultClasses.map((c) => c.id) as FaultClassId[];
const QUESTIONS = priors.questions;
export const QUESTION_IDS = QUESTIONS.map((q) => q.id);
export const TOTAL_QUESTIONS = QUESTIONS.length;

type Beliefs = Record<FaultClassId, number>;

export function priorBeliefs(): Beliefs {
  return { ...(priors.priors as Beliefs) };
}

/** P(option | class), normalised so each class's options sum to 1. */
function likelihood(questionId: string, option: string, cls: FaultClassId): number {
  const q = QUESTIONS.find((x) => x.id === questionId);
  if (!q) return 1;
  const table = q.likelihood as unknown as Record<string, number[]>;
  const ci = CLASSES.indexOf(cls);
  const total = q.options.reduce((sum, o) => sum + (table[o]?.[ci] ?? 0), 0);
  return total > 0 ? (table[option]?.[ci] ?? 0) / total : 1;
}

function normalise(b: Beliefs): Beliefs {
  const sum = CLASSES.reduce((s, c) => s + b[c], 0) || 1;
  return Object.fromEntries(CLASSES.map((c) => [c, b[c] / sum])) as Beliefs;
}

export function update(beliefs: Beliefs, questionId: string, answer: string): Beliefs {
  if (answer === 'not_sure') return beliefs;
  return normalise(
    Object.fromEntries(
      CLASSES.map((c) => [c, beliefs[c] * Math.max(1e-6, likelihood(questionId, answer, c))]),
    ) as Beliefs,
  );
}

export function replay(answers: Answer[]): { beliefs: Beliefs; history: BeliefSnapshot[] } {
  let beliefs = priorBeliefs();
  const history: BeliefSnapshot[] = [{ afterQuestionId: null, beliefs }];
  for (const a of answers) {
    beliefs = update(beliefs, a.questionId, a.answer);
    history.push({ afterQuestionId: a.questionId, beliefs });
  }
  return { beliefs, history };
}

export function decisionPosterior(beliefs: Beliefs): Record<DecisionKind, number> {
  const part = priors.decisionPartition as Record<DecisionKind, string[]>;
  const out = { repair: 0, reuse: 0, recycle: 0 } as Record<DecisionKind, number>;
  for (const kind of Object.keys(part) as DecisionKind[]) {
    out[kind] = part[kind].reduce((s, id) => s + (beliefs[id as FaultClassId] ?? 0), 0);
  }
  return out;
}

function entropy(p: Record<DecisionKind, number>): number {
  return -Object.values(p).reduce((s, x) => (x > 0 ? s + x * Math.log2(x) : s), 0);
}

function expectedGain(beliefs: Beliefs, questionId: string): number {
  const q = QUESTIONS.find((x) => x.id === questionId)!;
  const h0 = entropy(decisionPosterior(beliefs));
  let h1 = 0;
  for (const option of q.options) {
    const pOption = CLASSES.reduce((s, c) => s + beliefs[c] * likelihood(questionId, option, c), 0);
    if (pOption <= 0) continue;
    h1 += pOption * entropy(decisionPosterior(update(beliefs, questionId, option)));
  }
  return h0 - h1;
}

export function triageState(answers: Answer[]): TriageState {
  const { beliefs } = replay(answers);
  const posterior = decisionPosterior(beliefs);
  const asked = new Set(answers.map((a) => a.questionId));
  const remaining = QUESTIONS.filter((q) => !asked.has(q.id));
  let next: QuestionPayload | null = null;
  if (remaining.length > 0) {
    const scored = remaining
      .map((q) => ({ q, score: expectedGain(beliefs, q.id) / q.cost }))
      .sort((a, b) => b.score - a.score);
    const best = scored[0]!.q;
    next = {
      questionId: best.id,
      options: best.options,
      index: answers.length,
      total: TOTAL_QUESTIONS,
    };
  }
  const top = Math.max(...Object.values(posterior));
  return {
    beliefs,
    decisionPosterior: posterior,
    readyToRecommend: top >= priors.stopThreshold,
    next,
    answeredCount: answers.length,
  };
}

export const optionsOf = (questionId: string): string[] => [
  ...(QUESTIONS.find((q) => q.id === questionId)?.options ?? []),
];

export const faultLabelKey = (id: FaultClassId) => `faults.${id}` as const;
export const priorsMeta = {
  source: priors.priorsSource,
  status: priors.priorsStatus as 'assumption' | 'sourced',
  partitionNote: priors.partitionNote,
  stopThreshold: priors.stopThreshold,
};
export const faultClassIds = CLASSES;
