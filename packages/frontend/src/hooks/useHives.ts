import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hiveRepo, sortByQRCode } from '@/db/repositories/hive.repository';
import { syncQueueRepo } from '@/db/repositories/syncQueue.repository';
import { useSyncStore } from '@/store/syncStore';
import type { HiveCreate, HiveUpdate } from '@bee-forest/shared';

const QUERY_KEY = ['hives'];

export function useHives(apiary_local_id?: string) {
  return useQuery({
    queryKey: apiary_local_id ? [...QUERY_KEY, 'apiary', apiary_local_id] : QUERY_KEY,
    queryFn: () => apiary_local_id ? hiveRepo.getByApiary(apiary_local_id) : hiveRepo.getAll(),
    networkMode: 'offlineFirst',
    staleTime: 30_000,
    select: (data) => {
      if (!apiary_local_id) {
        // Múltiplos apiários: agrupa por apiary_local_id (alfabético) e ordena por sequência do código
        return [...data].sort((a, b) => {
          const apiaryCompare = a.apiary_local_id.localeCompare(b.apiary_local_id);
          if (apiaryCompare !== 0) return apiaryCompare;
          const seqA = parseInt(/CME-(\d+)-/i.exec(a.code)?.[1] ?? '0', 10);
          const seqB = parseInt(/CME-(\d+)-/i.exec(b.code)?.[1] ?? '0', 10);
          return seqA - seqB;
        });
      }
      return sortByQRCode(data);
    },
  });
}

export function useHive(local_id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, local_id],
    queryFn: () => hiveRepo.getById(local_id),
    networkMode: 'offlineFirst',
    enabled: !!local_id,
  });
}

export function useCreateHive() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: (data: HiveCreate) => hiveRepo.create(data),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}

export function useUpdateHive() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: ({ local_id, data }: { local_id: string; data: HiveUpdate }) =>
      hiveRepo.update(local_id, data),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}

export function useDeleteHive() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: (local_id: string) => hiveRepo.softDelete(local_id),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}
