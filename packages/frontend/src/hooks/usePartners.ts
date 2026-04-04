import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import type {
  PartnerSummary,
  PartnerDetail,
  PartnerCreate,
  PartnerUpdate,
  PartnerApiaryCreate,
  EquipmentLoanCreate,
  DeliveryCreate,
  QualityTestCreate,
  PartnerQualitySummary,
  PartnerFinanceSummary,
} from '@bee-forest/shared';

const QK = ['partners'] as const;

// ── Queries ───────────────────────────────────────────────────────────────────

export function usePartners(filters?: { status?: string; city?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.city)   params.set('city', filters.city);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: [...QK, 'list', filters],
    queryFn: () => apiFetch<PartnerSummary[]>(`/partners${qs}`),
    staleTime: 30_000,
  });
}

export function usePartner(localId: string) {
  return useQuery({
    queryKey: [...QK, localId],
    queryFn: () => apiFetch<PartnerDetail>(`/partners/${localId}`),
    staleTime: 15_000,
    enabled: !!localId,
  });
}

export function usePartnerQualityPanel() {
  return useQuery({
    queryKey: [...QK, 'quality-panel'],
    queryFn: () => apiFetch<PartnerQualitySummary[]>('/partners/quality/panel'),
    staleTime: 30_000,
  });
}

export function usePartnerFinancePanel() {
  return useQuery({
    queryKey: [...QK, 'finance-panel'],
    queryFn: () => apiFetch<PartnerFinanceSummary[]>('/partners/finance/panel'),
    staleTime: 30_000,
  });
}

// ── Mutations: Partner ────────────────────────────────────────────────────────

export function useCreatePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PartnerCreate) =>
      apiFetch('/partners', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdatePartner(localId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PartnerUpdate) =>
      apiFetch(`/partners/${localId}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdatePartnerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ localId, status }: { localId: string; status: string }) =>
      apiFetch(`/partners/${localId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

// ── Mutations: Apiary ─────────────────────────────────────────────────────────

export function useCreatePartnerApiary(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PartnerApiaryCreate) =>
      apiFetch(`/partners/${partnerId}/apiaries`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QK, partnerId] }),
  });
}

// ── Mutations: Loans ──────────────────────────────────────────────────────────

export function useCreateEquipmentLoan(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EquipmentLoanCreate) =>
      apiFetch(`/partners/${partnerId}/loans`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QK, partnerId] }),
  });
}

export function useReturnLoan(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ loanLocalId, actual_return_date, return_condition }: {
      loanLocalId: string; actual_return_date?: string; return_condition?: string;
    }) =>
      apiFetch(`/partners/${partnerId}/loans/${loanLocalId}/return`, {
        method: 'PATCH',
        body: JSON.stringify({ actual_return_date, return_condition }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QK, partnerId] }),
  });
}

// ── Mutations: Deliveries ─────────────────────────────────────────────────────

export function useCreateDelivery(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DeliveryCreate) =>
      apiFetch(`/partners/${partnerId}/deliveries`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QK, partnerId] }),
  });
}

export function useCreateQualityTest(partnerId: string, deliveryLocalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: QualityTestCreate) =>
      apiFetch(`/partners/${partnerId}/deliveries/${deliveryLocalId}/quality`, {
        method: 'POST', body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QK, partnerId] }),
  });
}

// ── Mutations: Payments ───────────────────────────────────────────────────────

export function usePayInstallment(partnerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentLocalId, paid_date, payment_method, notes }: {
      paymentLocalId: string; paid_date?: string; payment_method?: string; notes?: string;
    }) =>
      apiFetch(`/partners/${partnerId}/payments/${paymentLocalId}/pay`, {
        method: 'PATCH',
        body: JSON.stringify({ paid_date, payment_method, notes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...QK, partnerId] });
      qc.invalidateQueries({ queryKey: [...QK, 'finance-panel'] });
    },
  });
}
