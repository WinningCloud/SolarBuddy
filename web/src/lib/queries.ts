import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { PanelListFilter } from './types';

export const keys = {
  panels: ['panels'] as const,
  panel: (id: string) => ['panel', id] as const,
  triage: (id: string) => ['triage', id] as const,
  settings: ['settings'] as const,
  impact: ['impact'] as const,
};

export function usePanels(filter: PanelListFilter = {}) {
  return useQuery({ queryKey: [...keys.panels, filter], queryFn: () => api.listPanels(filter) });
}

export function usePanel(id: string | undefined) {
  return useQuery({
    queryKey: keys.panel(id ?? ''),
    queryFn: () => api.getPanel(id as string),
    enabled: Boolean(id),
  });
}

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: () => api.getSettings() });
}

/** Invalidate everything derived from panels after a write. */
export function useInvalidatePanels() {
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: keys.panels });
    void qc.invalidateQueries({ queryKey: keys.impact });
    if (id) void qc.invalidateQueries({ queryKey: keys.panel(id) });
  };
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
