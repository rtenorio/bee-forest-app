import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { feedingRepo } from '@/db/repositories/feeding.repository';
import { syncQueueRepo } from '@/db/repositories/syncQueue.repository';
import { useSyncStore } from '@/store/syncStore';
import type { FeedingCreate, FeedingUpdate } from '@bee-forest/shared';

const QUERY_KEY = ['feedings'];

export function useFeedings(hive_local_id?: string) {
  return useQuery({
    queryKey: hive_local_id ? [...QUERY_KEY, 'hive', hive_local_id] : QUERY_KEY,
    queryFn: () => hive_local_id ? feedingRepo.getByHive(hive_local_id) : feedingRepo.getAll(),
    networkMode: 'offlineFirst',
    staleTime: 30_000,
  });
}

export function useCreateFeeding() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: (data: FeedingCreate) => feedingRepo.create(data),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}

export function useUpdateFeeding() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: ({ local_id, data }: { local_id: string; data: FeedingUpdate }) =>
      feedingRepo.update(local_id, data),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}

export function useDeleteFeeding() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: (local_id: string) => feedingRepo.softDelete(local_id),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}
