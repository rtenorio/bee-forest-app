import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { speciesRepo } from '@/db/repositories/species.repository';
import { syncQueueRepo } from '@/db/repositories/syncQueue.repository';
import { useSyncStore } from '@/store/syncStore';
import type { SpeciesCreate, SpeciesUpdate } from '@bee-forest/shared';

const QUERY_KEY = ['species'];

export function useSpecies() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => speciesRepo.getAll(),
    networkMode: 'offlineFirst',
    staleTime: 60_000,
  });
}

export function useCreateSpecies() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: (data: SpeciesCreate) => speciesRepo.create(data),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}

export function useUpdateSpecies() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: ({ local_id, data }: { local_id: string; data: SpeciesUpdate }) =>
      speciesRepo.update(local_id, data),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}

export function useDeleteSpecies() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: (local_id: string) => speciesRepo.softDelete(local_id),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}
