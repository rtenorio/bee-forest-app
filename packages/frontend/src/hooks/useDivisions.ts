import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import type { Division, DivisionCreate, DivisionUpdate } from '@bee-forest/shared';

const QK = ['divisions'] as const;

export function useDivisions(filters?: {
  status?: string;
  apiary_local_id?: string;
  hive_local_id?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status)          params.set('status', filters.status);
  if (filters?.apiary_local_id) params.set('apiary_local_id', filters.apiary_local_id);
  if (filters?.hive_local_id)   params.set('hive_local_id', filters.hive_local_id);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: [...QK, 'list', filters],
    queryFn: () => apiFetch<Division[]>(`/divisions${qs}`),
    staleTime: 15_000,
  });
}

export function useDivision(localId: string) {
  return useQuery({
    queryKey: [...QK, localId],
    queryFn: () => apiFetch<Division>(`/divisions/${localId}`),
    enabled: !!localId,
    staleTime: 10_000,
  });
}

export function usePendingDivisionsCount() {
  return useQuery({
    queryKey: [...QK, 'pending-count'],
    queryFn: async () => {
      const rows = await apiFetch<Division[]>('/divisions?status=pendente');
      return rows.length;
    },
    staleTime: 30_000,
  });
}

export function useCreateDivision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DivisionCreate) =>
      apiFetch<Division>('/divisions', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateDivision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ localId, data }: { localId: string; data: DivisionUpdate }) =>
      apiFetch<Division>(`/divisions/${localId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
