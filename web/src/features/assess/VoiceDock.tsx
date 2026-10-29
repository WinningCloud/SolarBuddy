import { useEffect, useRef, useState } from 'react';
import { useConversation } from '@elevenlabs/react';
import { Check, Mic, MicOff, Square, Undo2, Volume2, VolumeX, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Banner, Button, SegmentedControl, Spinner } from '@/components/ui';
import { LANGUAGES, type LanguageCode } from '@/i18n';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import {
  createVoiceTools,
  type HeardEvent,
  type PendingMeasurement,
  type StepTarget,
} from '@/lib/voice/tools';
import type { PanelPassport } from '@/lib/types';
import { stepPath } from './flow';

const AGENT_ID = (import.meta.env.VITE_ELEVENLABS_AGENT_ID as string | undefined)?.trim() ?? '';
const LANGUAGE_NAMES: Record<LanguageCode, string> = { en: 'English', ta: 'Tamil', hi: 'Hindi' };
const INACTIVITY_MS = 10 * 60 * 1000;

type Phase = 'idle' | 'requesting' | 'connecting' | 'listening' | 'speaking' | 'error';

interface Props {
  panel: PanelPassport;
  /** Refetch panel and triage after the agent changes anything. */
  onChanged: () => void;
  /** Last answer the person tapped, so the agent is told and does not repeat the question. */
  tappedAnswer: { questionId: string; label: string } | null;
}

export function VoiceDock({ panel, onChanged, tappedAnswer }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [userLine, setUserLine] = useState('');
  const [agentLine, setAgentLine] = useState('');
  const [heard, setHeard] = useState<HeardEvent | null>(null);
  const [pending, setPending] = useState<PendingMeasurement | null>(null);
  const [pushToTalk, setPushToTalk] = useState(false);
  const [volume, setVolume] = useState(1);
  const pendingRef = useRef<PendingMeasurement | null>(null);
  const pushToTalkRef = useRef(false);
  pushToTalkRef.current = pushToTalk;
  const idleTimer = useRef<number | undefined>(undefined);
  const sessionRef = useRef<{ end: () => void }>({ end: () => undefined });

  const setPendingBoth = (m: PendingMeasurement | null) => {
    pendingRef.current = m;
    setPending(m);
  };

  const tools = createVoiceTools({
    panelId: panel.id,
    refresh: onChanged,
    navigateTo: (step: StepTarget) => navigate(stepPath(panel.id, step)),
    onHeard: setHeard,
    onPending: setPendingBoth,
    getPending: () => pendingRef.current,
    endSession: () => sessionRef.current.end(),
  });

  const conversation = useConversation({
    clientTools: tools,
    onConnect: () => {
      setPhase('listening');
      // Push to talk starts muted; the hold button unmutes. Only valid once a session exists.
      if (pushToTalkRef.current) conversation.setMuted(true);
      // Give the agent the current question straight away, so it can start even if a dashboard
      // tool is misconfigured. The tools remain the source for every later question.
      void tools
        .get_current_question()
        .then((q) =>
          conversation.sendContextualUpdate(
            `Current assessment question from the app (read it to the technician, then call submit_answer with their words): ${q}`,
          ),
        );
    },
    onDisconnect: () => {
      setPhase('idle');
      window.clearTimeout(idleTimer.current);
    },
    onError: (message: string) => {
      setError(message || t('questions.voice.connectionFailed'));
      setPhase('error');
    },
    onMessage: ({ message, role }: { message: string; role?: string }) => {
      if (role === 'user') setUserLine(message);
      else setAgentLine(message);
      armInactivity();
    },
    onModeChange: ({ mode }: { mode: string }) =>
      setPhase(mode === 'speaking' ? 'speaking' : 'listening'),
  });
  sessionRef.current = { end: () => conversation.endSession() };

  function armInactivity() {
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => conversation.endSession(), INACTIVITY_MS);
  }

  useEffect(() => () => window.clearTimeout(idleTimer.current), []);

  // Tell the agent when the person taps an answer.
  useEffect(() => {
    if (tappedAnswer && phase !== 'idle' && phase !== 'error')
      conversation.sendContextualUpdate(
        `The technician tapped the answer "${tappedAnswer.label}" on screen for ${tappedAnswer.questionId}. Call get_current_question for the next one.`,
      );
    // Only react to a new tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tappedAnswer]);

  async function start() {
    setError(null);
    setHeard(null);
    setUserLine('');
    setAgentLine('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t('questions.voice.noMic'));
      setPhase('error');
      return;
    }
    setPhase('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      setError(t(name === 'NotFoundError' ? 'questions.voice.noMic' : 'questions.voice.micDenied'));
      setPhase('error');
      return;
    }
    setPhase('connecting');
    const settings = await api.getSettings();
    const language =
      (i18n.language as LanguageCode) in LANGUAGE_NAMES ? (i18n.language as LanguageCode) : 'en';
    try {
      conversation.startSession({
        agentId: AGENT_ID,
        connectionType: 'webrtc',
        dynamicVariables: {
          language_name: LANGUAGE_NAMES[language],
          technician_name: t('shell.user'),
          site_name: settings.siteName,
          panel_label: panel.id,
          current_step: 'questions',
          total_questions: 8,
        },
        overrides: { agent: { language } },
      });
      armInactivity();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('questions.voice.connectionFailed'));
      setPhase('error');
    }
  }

  function stop() {
    conversation.endSession();
    setPhase('idle');
  }

  if (!AGENT_ID)
    return (
      <Banner tone="info" title={t('questions.voice.title')}>
        {t('questions.voice.notConfigured')}
      </Banner>
    );

  const live = phase === 'listening' || phase === 'speaking';
  const status =
    phase === 'requesting'
      ? t('questions.voice.requesting')
      : phase === 'connecting'
        ? t('questions.voice.connecting')
        : phase === 'listening'
          ? t('questions.voice.listening')
          : phase === 'speaking'
            ? t('questions.voice.speaking')
            : phase === 'error'
              ? t('questions.voice.error')
              : t('questions.voice.idle');

  return (
    <section
      aria-label={t('questions.voice.title')}
      className="rounded-card border border-line bg-surface"
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        {live || phase === 'connecting' || phase === 'requesting' ? (
          <Button
            variant="secondary"
            size="lg"
            onClick={stop}
            leadingIcon={<Square className="h-4 w-4" aria-hidden="true" />}
          >
            {t('questions.voice.stop')}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="lg"
            onClick={() => void start()}
            leadingIcon={<Mic className="h-4 w-4" aria-hidden="true" />}
          >
            {phase === 'error' ? t('questions.voice.reconnect') : t('questions.voice.mic')}
          </Button>
        )}
        <p
          className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink-2"
          role="status"
          aria-live="polite"
        >
          {phase === 'requesting' || phase === 'connecting' ? <Spinner /> : null}
          <span className={cn('font-medium', live ? 'text-ink' : 'text-ink-2')}>{status}</span>
        </p>
        {live ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="lg"
              aria-pressed={conversation.isMuted}
              onClick={() => conversation.setMuted(!conversation.isMuted)}
              leadingIcon={
                conversation.isMuted ? (
                  <MicOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Mic className="h-4 w-4" aria-hidden="true" />
                )
              }
            >
              {conversation.isMuted ? t('questions.voice.unmute') : t('questions.voice.mute')}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              aria-pressed={volume === 0}
              onClick={() => {
                const next = volume === 0 ? 1 : 0;
                setVolume(next);
                conversation.setVolume({ volume: next });
              }}
              leadingIcon={
                volume === 0 ? (
                  <VolumeX className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                )
              }
            >
              {t('questions.voice.speaker')}
            </Button>
          </div>
        ) : null}
      </div>

      {phase === 'idle' || phase === 'error' ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-divider px-4 py-2.5">
          <SegmentedControl
            label={t('questions.voice.language')}
            size="sm"
            value={
              (i18n.language as LanguageCode) in LANGUAGE_NAMES
                ? (i18n.language as LanguageCode)
                : 'en'
            }
            onChange={(l) => void i18n.changeLanguage(l)}
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
          />
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={pushToTalk}
              onChange={(e) => setPushToTalk(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            {t('questions.voice.pushToTalk')}
          </label>
          <p className="text-xs text-ink-3">{t('questions.voice.quiet')}</p>
        </div>
      ) : null}

      {pushToTalk && live ? (
        <div className="border-t border-divider px-4 py-2.5">
          <Button
            variant="secondary"
            size="lg"
            block
            onPointerDown={() => conversation.setMuted(false)}
            onPointerUp={() => conversation.setMuted(true)}
            onPointerLeave={() => conversation.setMuted(true)}
            onKeyDown={(e) => e.key === ' ' && conversation.setMuted(false)}
            onKeyUp={(e) => e.key === ' ' && conversation.setMuted(true)}
          >
            {t('questions.voice.holdToTalk')}
          </Button>
        </div>
      ) : null}

      {error ? (
        <div className="border-t border-divider px-4 py-3">
          <Banner tone="danger" live>
            {error}
          </Banner>
        </div>
      ) : null}

      {userLine || agentLine ? (
        <dl className="grid gap-1 border-t border-divider px-4 py-3 text-sm">
          {userLine ? (
            <div className="flex gap-2">
              <dt className="shrink-0 text-ink-3">{t('questions.voice.you')}</dt>
              <dd className="text-ink">{userLine}</dd>
            </div>
          ) : null}
          {agentLine ? (
            <div className="flex gap-2">
              <dt className="shrink-0 text-ink-3">{t('questions.voice.assistant')}</dt>
              <dd className="text-ink-2">{agentLine}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {heard ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-t border-divider px-4 py-3"
          role="status"
        >
          <p className="text-sm text-ink">
            {t('questions.voice.heard')}: <q>{heard.heard}</q> →{' '}
            {heard.matchedLabel ? (
              <span className="font-medium">
                {t('questions.voice.matched')}: {heard.matchedLabel}
              </span>
            ) : (
              <span className="text-warning-ink">{t('questions.voice.unclear')}</span>
            )}
          </p>
          {heard.matchedLabel ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void api.undoAnswer(panel.id).then(onChanged);
                setHeard(null);
              }}
              leadingIcon={<Undo2 className="h-4 w-4" aria-hidden="true" />}
            >
              {t('questions.undo')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {pending ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-t border-divider bg-tint px-4 py-3"
          role="alert"
        >
          <p className="text-base text-ink">
            {t('questions.voice.confirmMeasurement', {
              quantity: pending.quantity.toUpperCase(),
              value: pending.value,
              unit: pending.unit,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPendingBoth(null)}
              leadingIcon={<X className="h-4 w-4" aria-hidden="true" />}
            >
              {t('common.no')}
            </Button>
            <Button
              size="sm"
              leadingIcon={<Check className="h-4 w-4" aria-hidden="true" />}
              onClick={() => {
                void tools.confirm_measurement({ confirmed: true });
              }}
            >
              {t('common.yes')}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
