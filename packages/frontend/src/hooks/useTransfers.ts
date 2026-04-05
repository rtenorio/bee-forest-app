import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import type { HiveTransfer, HiveTransferCreate } from '@bee-forest/shared';

const QK = ['transfers'] as const;

export function useTransfers(filters?: { hive_local_id?: string; apiary_local_id?: string }) {
  const params = new URLSearchParams();
  if (filters?.hive_local_id)   params.set('hive_local_id', filters.hive_local_id);
  if (filters?.apiary_local_id) params.set('apiary_local_id', filters.apiary_local_id);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: [...QK, 'list', filters],
    queryFn: () => apiFetch<HiveTransfer[]>(`/transfers${qs}`),
    staleTime: 15_000,
    enabled: !!(filters?.hive_local_id || filters?.apiary_local_id),
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: HiveTransferCreate) =>
      apiFetch<HiveTransfer>('/transfers', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ['hives'] }); // refresh hive's apiary_local_id
    },
  });
}
