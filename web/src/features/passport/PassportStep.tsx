import { useMutation } from '@tanstack/react-query';
import { Copy, Download, Plus, PlusSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Banner, Button, toast } from '@/components/ui';
import { api, decisionOf } from '@/lib/api';
import { errorMessage, useInvalidatePanels } from '@/lib/queries';
import { FlowFooter, StepFrame, StepHeader, stepPath } from '@/features/assess/flow';
import { PassportView, publicUrl } from './PassportView';
import type { PanelPassport } from '@/lib/types';

export function PassportStep() {
  return <StepFrame>{(panel) => <Passport key={panel.id} panel={panel} />}</StepFrame>;
}

export function PassportActions({ panel }: { panel: PanelPassport }) {
  const { t } = useTranslation();
  const invalidate = useInvalidatePanels();
  const kind = decisionOf(panel);
  const canPool = kind === 'reuse' || kind === 'repair';
  const inPool = panel.status === 'in_pool';

  const pool = useMutation({
    mutationFn: () => api.addToPool(panel.id, !inPool),
    onSuccess: () => {
      invalidate(panel.id);
      toast.success(t('panels.poolAdded'));
    },
    onError: (e) =>
      toast.error(t('common.saveFailed'), { description: errorMessage(e, t('errors.generic')) }),
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl(panel.id));
      toast.success(t('common.copied'));
    } catch {
      toast.info(publicUrl(panel.id));
    }
  }

  return (
    <div className="print-hide flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="lg"
        onClick={() => window.print()}
        leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
      >
        {t('common.print')}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        onClick={() => void copy()}
        leadingIcon={<Copy className="h-4 w-4" aria-hidden="true" />}
      >
        {t('common.copy')}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        disabled={!canPool}
        loading={pool.isPending}
        onClick={() => pool.mutate()}
        leadingIcon={<PlusSquare className="h-4 w-4" aria-hidden="true" />}
      >
        {inPool ? t('passport.removePool') : t('passport.addPool')}
      </Button>
    </div>
  );
}

function Passport({ panel }: { panel: PanelPassport }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const kind = decisionOf(panel);
  return (
    <>
      <div className="print-hide">
        <StepHeader title={t('passport.title')} subtitle={t('passport.subtitle')} />
        <div className="mb-6 flex flex-col gap-3">
          <PassportActions panel={panel} />
          {kind !== 'reuse' && kind !== 'repair' ? (
            <p className="text-sm text-ink-3">{t('passport.poolOnlyFor')}</p>
          ) : null}
          {!panel.decision?.chosen ? (
            <Banner
              tone="warning"
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(stepPath(panel.id, 'decision'))}
                >
                  {t('steps.decision')}
                </Button>
              }
            >
              {t('passport.notDecided')}
            </Banner>
          ) : null}
        </div>
      </div>
      <PassportView panel={panel} />
      <FlowFooter
        onBack={() => navigate(stepPath(panel.id, 'decision'))}
        onSaveExit={() => navigate('/')}
        onContinue={() => navigate('/assess/new')}
        continueLabel={t('passport.another')}
        trailingIcon="arrow"
      />
    </>
  );
}

export { Plus };
