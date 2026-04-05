import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import type { EquipmentItem, EquipmentMovement, EquipmentAdjust } from '@bee-forest/shared';

const QK_ITEMS = ['equipment-items'] as const;
const QK_MOVEMENTS = ['equipment-movements'] as const;

export function useEquipmentItems() {
  return useQuery({
    queryKey: QK_ITEMS,
    queryFn: () => apiFetch<EquipmentItem[]>('/equipment'),
    staleTime: 30_000,
  });
}

export function useEquipmentMovements(filters?: { item_type?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.item_type) params.set('item_type', filters.item_type);
  if (filters?.limit)     params.set('limit', String(filters.limit));
  const qs = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    queryKey: [...QK_MOVEMENTS, filters],
    queryFn: () => apiFetch<EquipmentMovement[]>(`/equipment/movements${qs}`),
    staleTime: 30_000,
  });
}

export function useAdjustEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EquipmentAdjust) =>
      apiFetch<EquipmentItem>('/equipment/adjust', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK_ITEMS });
      qc.invalidateQueries({ queryKey: QK_MOVEMENTS });
    },
  });
}
