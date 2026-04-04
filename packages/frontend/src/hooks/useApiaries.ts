import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiaryRepo } from '@/db/repositories/apiary.repository';
import { syncQueueRepo } from '@/db/repositories/syncQueue.repository';
import { useSyncStore } from '@/store/syncStore';
import { apiFetch } from '@/api/client';
import type { ApiaryCreate, ApiaryUpdate, Apiary } from '@bee-forest/shared';

const QUERY_KEY = ['apiaries'];

export function useApiaries() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiaryRepo.getAll(),
    networkMode: 'offlineFirst',
    staleTime: 30_000,
  });
}

export function useApiary(local_id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, local_id],
    queryFn: () => apiaryRepo.getById(local_id),
    networkMode: 'offlineFirst',
    enabled: !!local_id,
  });
}

export function useCreateApiary() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: (data: ApiaryCreate) => apiaryRepo.create(data),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}

export function useUpdateApiary() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: ({ local_id, data }: { local_id: string; data: ApiaryUpdate }) =>
      apiaryRepo.update(local_id, data),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}

export function useToggleApiaryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ local_id, status }: { local_id: string; status: 'active' | 'inactive' }) =>
      apiFetch<Apiary>(`/apiaries/${local_id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: async (updated) => {
      await apiaryRepo.upsertFromServer(updated);
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteApiary() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: (local_id: string) => apiaryRepo.softDelete(local_id),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}
