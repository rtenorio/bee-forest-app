import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inspectionRepo } from '@/db/repositories/inspection.repository';
import { syncQueueRepo } from '@/db/repositories/syncQueue.repository';
import { useSyncStore } from '@/store/syncStore';
import type { InspectionCreate, InspectionUpdate } from '@bee-forest/shared';

const QUERY_KEY = ['inspections'];

export function useInspections(hive_local_id?: string) {
  return useQuery({
    queryKey: hive_local_id ? [...QUERY_KEY, 'hive', hive_local_id] : QUERY_KEY,
    queryFn: () => hive_local_id ? inspectionRepo.getByHive(hive_local_id) : inspectionRepo.getAll(),
    networkMode: 'offlineFirst',
    staleTime: 30_000,
  });
}

export function useInspection(local_id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, local_id],
    queryFn: () => inspectionRepo.getById(local_id),
    networkMode: 'offlineFirst',
    enabled: !!local_id,
  });
}

export function useCreateInspection() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: (data: InspectionCreate) => inspectionRepo.create(data),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}

export function useUpdateInspection() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: ({ local_id, data }: { local_id: string; data: InspectionUpdate }) =>
      inspectionRepo.update(local_id, data),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}

export function useDeleteInspection() {
  const qc = useQueryClient();
  const { setPendingCount } = useSyncStore();
  return useMutation({
    mutationFn: (local_id: string) => inspectionRepo.softDelete(local_id),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingCount(await syncQueueRepo.count());
    },
    networkMode: 'offlineFirst',
  });
}
