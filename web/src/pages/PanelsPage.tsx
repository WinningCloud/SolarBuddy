import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Banner,
  Button,
  Card,
  CardBody,
  DecisionPill,
  Drawer,
  EmptyState,
  ErrorState,
  Input,
  KeyValueList,
  Modal,
  Select,
  StatusPill,
  toast,
} from '@/components/ui';
import { formatDate, formatPercent, formatUnitRange } from '@/design/format';
import { api, decisionOf, healthOf } from '@/lib/api';
import { errorMessage, useInvalidatePanels, usePanel, usePanels } from '@/lib/queries';
import type { DecisionKind, PanelListFilter } from '@/lib/types';
import { PassportActions } from '@/features/passport/PassportStep';
import { PassportView } from '@/features/passport/PassportView';
import { PanelTable } from './PanelTable';
import { SunMedium } from 'lucide-react';

const KINDS: DecisionKind[] = ['repair', 'reuse', 'recycle'];
const STEPS = ['identify', 'inspect', 'questions', 'diagnosis', 'decision', 'passport'];

export function PanelsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidatePanels();
  const [filter, setFilter] = useState<PanelListFilter>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data, isLoading, isError, error, refetch, isFetching } = usePanels(filter);
  const detail = usePanel(drawerId ?? undefined);

  const patch = (p: Partial<PanelListFilter>) => setFilter((f) => ({ ...f, ...p }));
  const hasFilter = Object.values(filter).some(Boolean);

  const bulkPool = useMutation({
    mutationFn: async () => {
      const panels = (data ?? []).filter((p) => selected.has(p.id));
      for (const p of panels) {
        const d = decisionOf(p);
        if (d === 'reuse' || d === 'repair') await api.addToPool(p.id, true);
      }
    },
    onSuccess: () => {
      invalidate();
      setSelected(new Set());
      toast.success(t('panels.poolAdded'));
    },
    onError: (e) =>
      toast.error(t('common.saveFailed'), { description: errorMessage(e, t('errors.generic')) }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      for (const id of selected) await api.deletePanel(id);
    },
    onSuccess: () => {
      invalidate();
      setSelected(new Set());
      setConfirmDelete(false);
      toast.success(t('panels.deleted'));
    },
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl">{t('panels.title')}</h1>
          <p className="mt-1 text-base text-ink-2">{t('panels.subtitle')}</p>
        </div>
        <Button
          size="lg"
          onClick={() => navigate('/assess/new')}
          leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          {t('nav.assess')}
        </Button>
      </div>

      <Card>
        <CardBody className="sm:grid-cols-2 grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
          <Input
            label={t('common.search')}
            type="search"
            placeholder={t('overview.searchPlaceholder')}
            value={filter.q ?? ''}
            onChange={(e) => patch({ q: e.target.value || undefined })}
          />
          <Select
            label={t('panels.decisionFilter')}
            value={filter.decision ?? ''}
            onChange={(e) =>
              patch({ decision: (e.target.value || undefined) as DecisionKind | undefined })
            }
            options={[
              { value: '', label: t('common.all') },
              ...KINDS.map((k) => ({ value: k, label: t(`decision.columns.${k}`) })),
            ]}
          />
          <Select
            label={t('panels.healthFilter')}
            value={filter.healthBand ?? ''}
            onChange={(e) =>
              patch({ healthBand: (e.target.value || undefined) as PanelListFilter['healthBand'] })
            }
            options={[
              { value: '', label: t('common.all') },
              ...(['good', 'fair', 'poor'] as const).map((b) => ({
                value: b,
                label: t(`health.${b}`),
              })),
            ]}
          />
          <Input
            label={t('common.from')}
            type="date"
            value={filter.from ?? ''}
            onChange={(e) => patch({ from: e.target.value || undefined })}
          />
          <Input
            label={t('common.to')}
            type="date"
            value={filter.to ?? ''}
            onChange={(e) => patch({ to: e.target.value || undefined })}
          />
          <Button variant="ghost" onClick={() => setFilter({})} disabled={!hasFilter}>
            {t('common.clear')}
          </Button>
        </CardBody>
      </Card>

      {selected.size > 0 ? (
        <Banner
          tone="info"
          className="mt-4"
          live
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bulkPool.mutate()}
                loading={bulkPool.isPending}
              >
                {t('panels.addSelectedToPool')}
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => setConfirmDelete(true)}
                leadingIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                {t('panels.deleteSelected')}
              </Button>
            </div>
          }
        >
          {t('panels.selected', { count: selected.size })}
        </Banner>
      ) : null}

      <Card className="mt-4">
        {isError ? (
          <ErrorState
            title={t('common.loadFailed')}
            description={errorMessage(error, t('errors.generic'))}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        ) : (
          <PanelTable
            caption={t('panels.title')}
            panels={data}
            loading={isLoading}
            selectable
            selectedIds={selected}
            onSelectionChange={setSelected}
            onOpen={(p) =>
              p.status === 'draft'
                ? navigate(`/assess/${p.id}/${STEPS[p.stepIndex] ?? 'identify'}`)
                : setDrawerId(p.id)
            }
            empty={
              <EmptyState
                compact
                icon={SunMedium}
                title={hasFilter ? t('overview.noMatches') : t('overview.emptyTitle')}
                description={hasFilter ? t('overview.noMatchesHint') : t('overview.emptyBody')}
                actions={
                  hasFilter ? (
                    <Button variant="secondary" onClick={() => setFilter({})}>
                      {t('common.clear')}
                    </Button>
                  ) : (
                    <Button onClick={() => navigate('/')}>{t('nav.overview')}</Button>
                  )
                }
              />
            }
          />
        )}
      </Card>

      <Drawer
        open={Boolean(drawerId)}
        onOpenChange={(o) => !o && setDrawerId(null)}
        title={drawerId ?? ''}
        description={
          detail.data
            ? `${detail.data.nameplate.manufacturer} ${detail.data.nameplate.model}`
            : undefined
        }
        footer={
          drawerId ? (
            <Button onClick={() => navigate(`/panels/${drawerId}`)}>
              {t('panels.openPassport')}
            </Button>
          ) : undefined
        }
      >
        {detail.isLoading ? (
          <p className="text-sm text-ink-2" role="status">
            {t('ui.loading')}
          </p>
        ) : detail.data ? (
          <KeyValueList
            items={[
              {
                label: t('common.decision'),
                value: decisionOf(detail.data) ? (
                  <DecisionPill decision={decisionOf(detail.data)!} />
                ) : (
                  <StatusPill>{t(`status.${detail.data.status}`)}</StatusPill>
                ),
              },
              { label: t('common.health'), value: formatPercent(healthOf(detail.data)) },
              {
                label: t('panels.estimatedNow'),
                value: detail.data.twin
                  ? formatUnitRange(
                      detail.data.twin.now.pmaxRangeW.low,
                      detail.data.twin.now.pmaxRangeW.high,
                      'W',
                      0,
                    )
                  : '—',
              },
              { label: t('panels.assessed'), value: formatDate(detail.data.createdAt) },
            ]}
          />
        ) : detail.isError ? (
          <ErrorState compact description={errorMessage(detail.error, t('errors.generic'))} />
        ) : null}
      </Drawer>

      <Modal
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('panels.deleteSelected')}
        description={t('panels.confirmDelete', { count: selected.size })}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => remove.mutate()} loading={remove.isPending}>
              {t('panels.deleteSelected')}
            </Button>
          </>
        }
      />
    </>
  );
}

/** A passport inside the app shell: /panels/:id */
export function PanelPassportPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data, isLoading, isError, error, refetch, isFetching } = usePanel(id);
  if (isLoading)
    return (
      <p className="text-sm text-ink-2" role="status">
        {t('ui.loading')}
      </p>
    );
  if (isError || !data)
    return (
      <Card>
        <ErrorState
          title={t('common.notFound')}
          description={errorMessage(error, t('errors.generic'))}
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      </Card>
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="print-hide">
        <PassportActions panel={data} />
      </div>
      <PassportView panel={data} />
    </div>
  );
}
