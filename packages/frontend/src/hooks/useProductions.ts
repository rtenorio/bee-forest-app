import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productionRepo } from '@/db/repositories/production.repository';
import { syncQueueRepo } from '@/db/repositories/syncQueue.repository';
import { useSyncStore } from '@/store/syncStore';
import type { ProductionCreate, ProductionUpdate } from '@bee-forest/shared';

const QUERY_KEY = ['productions'];

export function useProductions(hive_local_id?: string) {
  return useQuery({
    queryKey: hive_local_id ? [...QUERY_KEY, 'hive', hive_local_id] : QUERY_KEY,
    queryFn: () => hive_local_id ? productionRepo.getByHive(hive_local_id) : productionRepo.getAll(),
    networkMode: 'offlineFirst',
    staleTime: 30_000,
  });
}

export function useCreateProduction() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: (data: ProductionCreate) => productionRepo.create(data),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}

export function useUpdateProduction() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: ({ local_id, data }: { local_id: string; data: ProductionUpdate }) =>
      productionRepo.update(local_id, data),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}

export function useDeleteProduction() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: (local_id: string) => productionRepo.softDelete(local_id),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}
