import { useTranslation } from 'react-i18next';
import { DataTable, DecisionPill, EmptyState, StatusPill, type Column } from '@/components/ui';
import { formatDate, formatPercent } from '@/design/format';
import { decisionOf, healthOf } from '@/lib/api';
import type { PanelPassport } from '@/lib/types';
import { SearchX } from 'lucide-react';

const statusTone = {
  draft: 'neutral',
  assessed: 'info',
  in_pool: 'success',
  closed: 'neutral',
} as const;

interface PanelTableProps {
  panels: PanelPassport[] | undefined;
  loading: boolean;
  caption: string;
  onOpen: (p: PanelPassport) => void;
  empty?: React.ReactNode;
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  maxHeight?: number;
}

export function PanelTable({
  panels,
  loading,
  caption,
  onOpen,
  empty,
  selectable,
  selectedIds,
  onSelectionChange,
  maxHeight,
}: PanelTableProps) {
  const { t } = useTranslation();
  const columns: Column<PanelPassport>[] = [
    {
      id: 'id',
      header: t('common.id'),
      sortValue: (p) => p.id,
      cell: (p) => <span className="font-medium text-ink">{p.id}</span>,
    },
    {
      id: 'model',
      header: t('common.model'),
      sortValue: (p) => `${p.nameplate.manufacturer} ${p.nameplate.model}`,
      hideBelow: 'md',
      cell: (p) => `${p.nameplate.manufacturer} ${p.nameplate.model}`.trim() || '—',
    },
    {
      id: 'health',
      header: t('common.health'),
      align: 'right',
      sortValue: (p) => healthOf(p),
      cell: (p) => (healthOf(p) === null ? '—' : formatPercent(healthOf(p))),
    },
    {
      id: 'decision',
      header: t('common.decision'),
      sortValue: (p) => decisionOf(p),
      cell: (p) => {
        const d = decisionOf(p);
        return d ? (
          <DecisionPill decision={d} />
        ) : (
          <StatusPill tone={statusTone[p.status]}>{t(`status.${p.status}`)}</StatusPill>
        );
      },
    },
    {
      id: 'confidence',
      header: t('common.confidence'),
      align: 'right',
      hideBelow: 'md',
      sortValue: (p) => p.decision?.confidence.expected ?? null,
      cell: (p) => (p.decision ? formatPercent(p.decision.confidence.expected) : '—'),
    },
    {
      id: 'date',
      header: t('common.date'),
      hideBelow: 'lg',
      sortValue: (p) => p.createdAt,
      cell: (p) => formatDate(p.createdAt),
    },
  ];
  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={panels ?? []}
      getRowId={(p) => p.id}
      getRowLabel={(p) => p.id}
      loading={loading}
      onRowClick={onOpen}
      defaultSort={{ columnId: 'date', direction: 'desc' }}
      selectable={selectable}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      maxHeight={maxHeight}
      empty={
        empty ?? (
          <EmptyState
            compact
            icon={SearchX}
            title={t('overview.noMatches')}
            description={t('overview.noMatchesHint')}
          />
        )
      }
    />
  );
}
