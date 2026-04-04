import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { batchRepo } from '@/db/repositories/batch.repository';
import { syncQueueRepo } from '@/db/repositories/syncQueue.repository';
import { useSyncStore } from '@/store/syncStore';
import { apiFetch } from '@/api/client';
import type { HoneyBatch, HoneyBatchCreate, HoneyBatchDetail } from '@bee-forest/shared';

export type QualitySummary = {
  attention: (HoneyBatch & { apiary_name: string | null; high_moisture: boolean; stale: boolean; has_fermentation_signs: boolean })[];
  in_processing: (HoneyBatch & { apiary_name: string | null })[];
  ready_for_next: (HoneyBatch & { apiary_name: string | null })[];
  stats: { active: string; bottled: string; sold: string; rejected: string; total: string };
};

export type BatchReportsData = {
  by_month: { month: string; count: string; total_kg: string | null }[];
  by_route: { processing_route: string; count: string }[];
  by_status: { current_status: string; count: string }[];
  moisture_stats: { avg_moisture: string | null; avg_brix: string | null; min_moisture: string | null; max_moisture: string | null } | null;
  dehum_stats: { avg_moisture_reduction: string | null; avg_duration_hours: string | null; total_sessions: string } | null;
  maturation_stats: { final_decision: string; count: string }[];
  moisture_evolution: { day: string; avg_moisture: string; avg_brix: string | null }[];
};

const QUERY_KEY = ['batches'];

export function useBatches(apiary_local_id?: string) {
  return useQuery({
    queryKey: apiary_local_id ? [...QUERY_KEY, 'apiary', apiary_local_id] : QUERY_KEY,
    queryFn: () =>
      apiary_local_id ? batchRepo.getByApiary(apiary_local_id) : batchRepo.getAll(),
    networkMode: 'offlineFirst',
    staleTime: 30_000,
  });
}

export function useBatch(local_id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, local_id],
    queryFn: () => batchRepo.getById(local_id),
    networkMode: 'offlineFirst',
    staleTime: 30_000,
    enabled: !!local_id,
  });
}

export function useBatchDetail(local_id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, local_id, 'detail'],
    queryFn: () => apiFetch<HoneyBatchDetail>(`/batches/${local_id}`),
    staleTime: 15_000,
    enabled: !!local_id,
  });
}

export function useQualitySummary() {
  return useQuery({
    queryKey: ['batches', 'quality-summary'],
    queryFn: () => apiFetch<QualitySummary>('/batches/quality-summary'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useBatchReports(period: string, apiary_local_id?: string) {
  const params = new URLSearchParams({ period });
  if (apiary_local_id) params.set('apiary_local_id', apiary_local_id);
  return useQuery({
    queryKey: ['batches', 'reports', period, apiary_local_id],
    queryFn: () => apiFetch<BatchReportsData>(`/batches/reports?${params.toString()}`),
    staleTime: 60_000,
  });
}

export function useCreateBatch() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: (data: HoneyBatchCreate) =>
      apiFetch<HoneyBatch>('/batches', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: async (created) => {
      await batchRepo.upsertFromServer(created);
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
  });
}

export function useUpdateBatchStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ local_id, status, final_destination }: { local_id: string; status: string; final_destination?: string }) =>
      apiFetch<HoneyBatch>(`/batches/${local_id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, final_destination }),
      }),
    onSuccess: async (updated) => {
      await batchRepo.upsertFromServer(updated);
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useRejectBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ local_id, reason }: { local_id: string; reason?: string }) =>
      apiFetch<HoneyBatch>(`/batches/${local_id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: async (updated) => {
      await batchRepo.upsertFromServer(updated);
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useStartDehumidification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ local_id, ...data }: Record<string, unknown> & { local_id: string }) =>
      apiFetch(`/batches/${local_id}/dehumidification`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: async (_r, { local_id }) => {
      const updated = await apiFetch<HoneyBatch>(`/batches/${local_id}`);
      await batchRepo.upsertFromServer(updated);
      qc.invalidateQueries({ queryKey: [...QUERY_KEY, local_id] });
    },
  });
}

export function useAddDehumMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ local_id, sessionId, ...data }: Record<string, unknown> & { local_id: string; sessionId: string }) =>
      apiFetch(`/batches/${local_id}/dehumidification/${sessionId}/measurements`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_r, { local_id }) => {
      qc.invalidateQueries({ queryKey: [...QUERY_KEY, local_id, 'detail'] });
    },
  });
}

export function useCompleteDehumidification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ local_id, sessionId, ...data }: Record<string, unknown> & { local_id: string; sessionId: string }) =>
      apiFetch(`/batches/${local_id}/dehumidification/${sessionId}/complete`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: async (_r, { local_id }) => {
      const updated = await apiFetch<HoneyBatch>(`/batches/${local_id}`);
      await batchRepo.upsertFromServer(updated);
      qc.invalidateQueries({ queryKey: [...QUERY_KEY, local_id] });
    },
  });
}

export function useStartMaturation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ local_id, ...data }: Record<string, unknown> & { local_id: string }) =>
      apiFetch(`/batches/${local_id}/maturation`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: async (_r, { local_id }) => {
      const updated = await apiFetch<HoneyBatch>(`/batches/${local_id}`);
      await batchRepo.upsertFromServer(updated);
      qc.invalidateQueries({ queryKey: [...QUERY_KEY, local_id] });
    },
  });
}

export function useAddMaturationObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ local_id, sessionId, ...data }: Record<string, unknown> & { local_id: string; sessionId: string }) =>
      apiFetch(`/batches/${local_id}/maturation/${sessionId}/observations`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_r, { local_id }) => {
      qc.invalidateQueries({ queryKey: [...QUERY_KEY, local_id, 'detail'] });
    },
  });
}

export function useCompleteMaturation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ local_id, sessionId, ...data }: Record<string, unknown> & { local_id: string; sessionId: string }) =>
      apiFetch(`/batches/${local_id}/maturation/${sessionId}/complete`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: async (_r, { local_id }) => {
      const updated = await apiFetch<HoneyBatch>(`/batches/${local_id}`);
      await batchRepo.upsertFromServer(updated);
      qc.invalidateQueries({ queryKey: [...QUERY_KEY, local_id] });
    },
  });
}

export function useBottleBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ local_id, ...data }: Record<string, unknown> & { local_id: string }) =>
      apiFetch(`/batches/${local_id}/bottle`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: async (_r, { local_id }) => {
      const updated = await apiFetch<HoneyBatch>(`/batches/${local_id}`);
      await batchRepo.upsertFromServer(updated);
      qc.invalidateQueries({ queryKey: [...QUERY_KEY, local_id] });
    },
  });
}

export function useSellBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ local_id, ...data }: Record<string, unknown> & { local_id: string }) =>
      apiFetch(`/batches/${local_id}/sell`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: async (_r, { local_id }) => {
      const updated = await apiFetch<HoneyBatch>(`/batches/${local_id}`);
      await batchRepo.upsertFromServer(updated);
      qc.invalidateQueries({ queryKey: [...QUERY_KEY, local_id] });
    },
  });
}
