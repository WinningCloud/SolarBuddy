import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, SunMedium } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Banner,
  Button,
  buttonClasses,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  Select,
  SourceTag,
  StatTile,
  toast,
} from '@/components/ui';
import { formatNumber, formatUnit, formatUnitRange } from '@/design/format';
import { decisionColor } from '@/design/tokens';
import { api } from '@/lib/api';
import { errorMessage, keys, useInvalidatePanels, usePanels } from '@/lib/queries';
import type { DecisionKind } from '@/lib/types';
import { PanelTable } from './PanelTable';

const KINDS: DecisionKind[] = ['repair', 'reuse', 'recycle'];

export function OverviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidatePanels();
  const [q, setQ] = useState('');
  const [decision, setDecision] = useState<DecisionKind | ''>('');
  const [progress, setProgress] = useState<[number, number] | null>(null);

  const all = usePanels();
  const filtered = usePanels({ q: q || undefined, decision: decision || undefined });
  const impact = useQuery({
    queryKey: [...keys.impact, 'overview'],
    queryFn: () => api.impactSummary(),
  });

  const load = useMutation({
    mutationFn: () => api.loadDemoData((d, total) => setProgress([d, total])),
    onSuccess: () => {
      invalidate();
      setProgress(null);
      toast.success(t('overview.demoLoaded'));
    },
    onError: (e) => {
      setProgress(null);
      toast.error(t('common.saveFailed'), { description: errorMessage(e, t('errors.storage')) });
    },
  });

  const assess = (
    <Button
      size="lg"
      onClick={() => navigate('/assess/new')}
      leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
    >
      {t('nav.assess')}
    </Button>
  );

  const header = (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl md:text-2xl">{t('overview.title')}</h1>
        <p className="mt-1 text-base text-ink-2">{t('overview.subtitle')}</p>
      </div>
      {assess}
    </div>
  );

  if (all.isError)
    return (
      <>
        {header}
        <Card>
          <ErrorState
            title={t('common.loadFailed')}
            description={errorMessage(all.error, t('errors.generic'))}
            onRetry={() => void all.refetch()}
            retrying={all.isFetching}
          />
        </Card>
      </>
    );

  if (!all.isLoading && (all.data?.length ?? 0) === 0)
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={SunMedium}
            title={t('overview.emptyTitle')}
            description={t('overview.emptyBody')}
            actions={
              <>
                {assess}
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => load.mutate()}
                  loading={load.isPending}
                  loadingLabel={`${t('overview.loadingDemo')}${progress ? ` ${progress[0]}/${progress[1]}` : ''}`}
                >
                  {t('overview.loadDemo')}
                </Button>
              </>
            }
          />
        </Card>
      </>
    );

  const s = impact.data;
  const drafts = (all.data ?? []).filter((p) => p.status === 'draft').length;
  const total = s ? KINDS.reduce((sum, k) => sum + s.decisions[k], 0) : 0;

  return (
    <>
      {header}
      <div className="sm:grid-cols-2 grid gap-4 xl:grid-cols-4">
        <StatTile
          loading={impact.isLoading}
          label={t('overview.tiles.assessed')}
          value={formatNumber(s?.panelCount ?? 0)}
          detail={drafts ? t('overview.drafts', { count: drafts }) : undefined}
        />
        <StatTile
          loading={impact.isLoading}
          label={t('overview.tiles.pool')}
          value={formatNumber(s?.poolSize ?? 0)}
          detail={t('overview.poolDetail')}
        />
        <StatTile
          loading={impact.isLoading}
          label={t('overview.tiles.energy')}
          value={formatUnit(s?.energyKwh.expected, 'kWh')}
          detail={
            s
              ? `${t('common.range')} ${formatUnitRange(s.energyKwh.low, s.energyKwh.high, 'kWh')}`
              : undefined
          }
          source={<SourceTag kind="simulated" source={t('sourceNotes.economics')} />}
        />
        <StatTile
          loading={impact.isLoading}
          label={t('overview.tiles.materials')}
          value={formatUnit(s?.totalMaterialsKg.expected, 'kg')}
          detail={
            s
              ? `${t('common.range')} ${formatUnitRange(s.totalMaterialsKg.low, s.totalMaterialsKg.high, 'kg')}`
              : undefined
          }
          source={<SourceTag kind="assumption" source={t('sourceNotes.economics')} />}
        />
      </div>

      <Card className="mt-6">
        <CardHeader title={t('overview.breakdown')} description={t('overview.breakdownHint')} />
        <CardBody>
          {total === 0 ? (
            <p className="text-sm text-ink-3">—</p>
          ) : (
            <>
              <div
                className="flex h-3 w-full overflow-hidden rounded-full bg-divider"
                role="img"
                aria-label={KINDS.map(
                  (k) => `${t(`decision.columns.${k}`)}: ${s?.decisions[k] ?? 0}`,
                ).join(', ')}
              >
                {KINDS.map((k) => {
                  const n = s?.decisions[k] ?? 0;
                  return n > 0 ? (
                    <div
                      key={k}
                      style={{ width: `${(n / total) * 100}%`, background: decisionColor[k].solid }}
                    />
                  ) : null;
                })}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {KINDS.map((k) => (
                  <li key={k} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: decisionColor[k].solid }}
                      aria-hidden="true"
                    />
                    <span className="text-ink-2">{t(`decision.columns.${k}`)}</span>
                    <span className="font-medium text-ink">{s?.decisions[k] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title={t('overview.recent')}
          actions={
            <Link to="/panels" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
              {t('overview.viewAll')}
            </Link>
          }
        />
        <CardBody className="flex flex-col gap-4 px-0 md:px-0">
          <div className="sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] grid gap-3 px-4 md:px-5">
            <Input
              label={t('common.search')}
              placeholder={t('overview.searchPlaceholder')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="search"
            />
            <Select
              label={t('common.decision')}
              value={decision}
              onChange={(e) => setDecision(e.target.value as DecisionKind | '')}
              options={[
                { value: '', label: t('common.all') },
                ...KINDS.map((k) => ({ value: k, label: t(`decision.columns.${k}`) })),
              ]}
            />
          </div>
          <PanelTable
            caption={t('overview.recent')}
            panels={filtered.data?.slice(0, 8)}
            loading={filtered.isLoading}
            onOpen={(p) =>
              navigate(
                p.status === 'draft'
                  ? `/assess/${p.id}/${['identify', 'inspect', 'questions', 'diagnosis', 'decision', 'passport'][p.stepIndex] ?? 'identify'}`
                  : `/panels/${p.id}`,
              )
            }
          />
          {filtered.isError ? (
            <Banner tone="danger" className="mx-4" live>
              {errorMessage(filtered.error, t('errors.generic'))}
            </Banner>
          ) : null}
        </CardBody>
      </Card>
    </>
  );
}
