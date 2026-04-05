import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import type { Melgueira, MelgueiraCreate, MelgueiraUpdate } from '@bee-forest/shared';

const QK = ['melgueiras'] as const;

export function useMelgueiras(filters?: {
  status?: string;
  hive_local_id?: string;
  apiary_local_id?: string;
  code?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status)          params.set('status', filters.status);
  if (filters?.hive_local_id)   params.set('hive_local_id', filters.hive_local_id);
  if (filters?.apiary_local_id) params.set('apiary_local_id', filters.apiary_local_id);
  if (filters?.code)            params.set('code', filters.code);
  const qs = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    queryKey: [...QK, 'list', filters],
    queryFn: () => apiFetch<Melgueira[]>(`/melgueiras${qs}`),
    staleTime: 30_000,
  });
}

export function useMelgueira(localId: string) {
  return useQuery({
    queryKey: [...QK, 'detail', localId],
    queryFn: () => apiFetch<Melgueira>(`/melgueiras/${localId}`),
    staleTime: 30_000,
    enabled: !!localId,
  });
}

export function useCreateMelgueira() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MelgueiraCreate) =>
      apiFetch<Melgueira>('/melgueiras', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateMelgueira() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ localId, data }: { localId: string; data: MelgueiraUpdate }) =>
      apiFetch<Melgueira>(`/melgueiras/${localId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useInstallMelgueira() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ localId, hive_local_id, installed_at, performed_by }: {
      localId: string; hive_local_id: string; installed_at: string; performed_by?: string;
    }) =>
      apiFetch<Melgueira>(`/melgueiras/${localId}/instalar`, {
        method: 'PATCH',
        body: JSON.stringify({ hive_local_id, installed_at, performed_by }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ['equipment-movements'] });
    },
  });
}

export function useRemoveMelgueira() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ localId, performed_by, reason }: {
      localId: string; performed_by?: string; reason?: string;
    }) =>
      apiFetch<Melgueira>(`/melgueiras/${localId}/retirar`, {
        method: 'PATCH',
        body: JSON.stringify({ performed_by, reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ['equipment-movements'] });
    },
  });
}

export function useDeleteMelgueira() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (localId: string) =>
      apiFetch(`/melgueiras/${localId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
