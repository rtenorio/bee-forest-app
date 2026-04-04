import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import { stockRepo } from '@/db/repositories/stock.repository';
import type {
  StockItem, StockItemCreate, StockItemUpdate,
  StockMovement, StockMovementCreate,
  StockAlert, StockApiarySummary,
} from '@bee-forest/shared';

const ITEMS_KEY = ['stock-items'];
const MOVEMENTS_KEY = ['stock-movements'];
const ALERTS_KEY = ['stock-alerts'];
const SUMMARY_KEY = ['stock-summary'];

// ── Items ─────────────────────────────────────────────────────────────────────

export function useStockItems(filters?: { apiary_local_id?: string; category?: string }) {
  return useQuery<StockItem[]>({
    queryKey: [...ITEMS_KEY, filters],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (filters?.apiary_local_id) qs.set('apiary_local_id', filters.apiary_local_id);
      if (filters?.category) qs.set('category', filters.category);
      const rows = await apiFetch<StockItem[]>(`/stock?${qs}`);
      for (const item of rows) await stockRepo.upsertFromServer(item);
      return rows;
    },
    staleTime: 30_000,
    networkMode: 'offlineFirst',
  });
}

export function useStockItemsOffline(apiary_local_id?: string) {
  return useQuery<StockItem[]>({
    queryKey: [...ITEMS_KEY, 'offline', apiary_local_id],
    queryFn: () =>
      apiary_local_id ? stockRepo.getByApiary(apiary_local_id) : stockRepo.getAll(),
    networkMode: 'offlineFirst',
    staleTime: Infinity,
  });
}

export function useCreateStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StockItemCreate) =>
      apiFetch<StockItem>('/stock/items', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: async (created) => {
      await stockRepo.upsertFromServer(created);
      qc.invalidateQueries({ queryKey: ITEMS_KEY });
      qc.invalidateQueries({ queryKey: SUMMARY_KEY });
    },
  });
}

export function useUpdateStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ local_id, data }: { local_id: string; data: StockItemUpdate }) =>
      apiFetch<StockItem>(`/stock/items/${local_id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: async (updated) => {
      await stockRepo.upsertFromServer(updated);
      qc.invalidateQueries({ queryKey: ITEMS_KEY });
    },
  });
}

export function useDeleteStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (local_id: string) =>
      apiFetch(`/stock/items/${local_id}`, { method: 'DELETE' }),
    onSuccess: (_r, local_id) => {
      stockRepo.softDelete(local_id);
      qc.invalidateQueries({ queryKey: ITEMS_KEY });
      qc.invalidateQueries({ queryKey: SUMMARY_KEY });
    },
  });
}

// ── Movements ─────────────────────────────────────────────────────────────────

export function useStockMovements(filters?: {
  apiary_local_id?: string; category?: string;
  movement_type?: string; date_from?: string; date_to?: string;
  limit?: number; offset?: number;
}) {
  return useQuery<StockMovement[]>({
    queryKey: [...MOVEMENTS_KEY, filters],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (filters?.apiary_local_id) qs.set('apiary_local_id', filters.apiary_local_id);
      if (filters?.category) qs.set('category', filters.category);
      if (filters?.movement_type) qs.set('movement_type', filters.movement_type);
      if (filters?.date_from) qs.set('date_from', filters.date_from);
      if (filters?.date_to) qs.set('date_to', filters.date_to);
      if (filters?.limit) qs.set('limit', String(filters.limit));
      if (filters?.offset) qs.set('offset', String(filters.offset));
      return apiFetch<StockMovement[]>(`/stock/movements?${qs}`);
    },
    staleTime: 30_000,
  });
}

export function useCreateMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StockMovementCreate) =>
      apiFetch<StockMovement>('/stock/movements', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ITEMS_KEY });
      qc.invalidateQueries({ queryKey: MOVEMENTS_KEY });
      qc.invalidateQueries({ queryKey: SUMMARY_KEY });
      qc.invalidateQueries({ queryKey: ALERTS_KEY });
    },
  });
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export function useStockAlerts() {
  return useQuery<StockAlert[]>({
    queryKey: ALERTS_KEY,
    queryFn: () => apiFetch<StockAlert[]>('/stock/alerts'),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: number) =>
      apiFetch(`/stock/alerts/${alertId}/resolve`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ALERTS_KEY });
      qc.invalidateQueries({ queryKey: ITEMS_KEY });
    },
  });
}

// ── Summary ───────────────────────────────────────────────────────────────────

export function useStockSummary(apiary_local_id?: string) {
  return useQuery<StockApiarySummary[]>({
    queryKey: [...SUMMARY_KEY, apiary_local_id],
    queryFn: () => {
      const qs = apiary_local_id ? `?apiary_local_id=${apiary_local_id}` : '';
      return apiFetch<StockApiarySummary[]>(`/stock/summary${qs}`);
    },
    staleTime: 30_000,
  });
}
