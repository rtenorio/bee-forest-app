import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { harvestRepo } from '@/db/repositories/harvest.repository';
import { syncQueueRepo } from '@/db/repositories/syncQueue.repository';
import { useSyncStore } from '@/store/syncStore';
import type { HarvestCreate, HarvestUpdate } from '@bee-forest/shared';

const QUERY_KEY = ['harvests'];

export function useHarvests(apiary_local_id?: string) {
  return useQuery({
    queryKey: apiary_local_id ? [...QUERY_KEY, 'apiary', apiary_local_id] : QUERY_KEY,
    queryFn: () =>
      apiary_local_id ? harvestRepo.getByApiary(apiary_local_id) : harvestRepo.getAll(),
    networkMode: 'offlineFirst',
    staleTime: 30_000,
  });
}

export function useHarvest(local_id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, local_id],
    queryFn: () => harvestRepo.getById(local_id),
    networkMode: 'offlineFirst',
    staleTime: 30_000,
    enabled: !!local_id,
  });
}

export function useCreateHarvest() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: (data: HarvestCreate) => harvestRepo.create(data),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}

export function useUpdateHarvest() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: ({ local_id, data }: { local_id: string; data: HarvestUpdate }) =>
      harvestRepo.update(local_id, data),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}

export function useDeleteHarvest() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: (local_id: string) => harvestRepo.softDelete(local_id),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}
