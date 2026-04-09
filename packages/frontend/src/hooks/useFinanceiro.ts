import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';

const QK = ['financeiro'] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Producao {
  local_id:        string;
  hive_local_id:   string;
  hive_code:       string;
  apiary_local_id: string;
  data_colheita:   string;
  volume_ml:       number;
  observacao:      string | null;
  responsavel_nome: string | null;
  created_at:      string;
}

export interface Custo {
  local_id:        string;
  apiary_local_id: string;
  hive_local_id:   string | null;
  hive_code:       string | null;
  data:            string;
  tipo:            'alimentacao' | 'medicamento' | 'mao_de_obra' | 'equipamento' | 'outro';
  valor_reais:     number;
  descricao:       string | null;
  responsavel_nome: string | null;
  created_at:      string;
}

export interface FinanceiroDashboard {
  resumo_periodo: {
    producao_total_ml:          number;
    custo_total_reais:          number;
    custo_por_ml:               number;
    producao_media_por_colmeia: number;
  };
  ranking_colmeias: Array<{
    hive_local_id: string;
    hive_code:     string;
    producao_ml:   number;
    custos_reais:  number;
    saldo:         number;
  }>;
  producao_por_apiary: Array<{
    apiary_local_id: string;
    apiary_nome:     string;
    producao_ml:     number;
    custos_reais:    number;
  }>;
  evolucao_mensal: Array<{
    mes:          string;
    producao_ml:  number;
    custos_reais: number;
  }>;
  taxa_perda: number;
}

// ── Filters helper ────────────────────────────────────────────────────────────

function toQS(filters?: Record<string, string | undefined>): string {
  if (!filters) return '';
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useProducao(filters?: { apiary_local_id?: string; hive_local_id?: string; date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: [...QK, 'producao', filters],
    queryFn:  () => apiFetch<Producao[]>(`/financeiro/producao${toQS(filters)}`),
    staleTime: 30_000,
  });
}

export function useCustos(filters?: { apiary_local_id?: string; hive_local_id?: string; date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: [...QK, 'custos', filters],
    queryFn:  () => apiFetch<Custo[]>(`/financeiro/custos${toQS(filters)}`),
    staleTime: 30_000,
  });
}

export function useFinanceiroDashboard(filters?: { apiary_local_id?: string; date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: [...QK, 'dashboard', filters],
    queryFn:  () => apiFetch<FinanceiroDashboard>(`/financeiro/dashboard${toQS(filters)}`),
    staleTime: 60_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateProducao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { hive_local_id: string; apiary_local_id: string; data_colheita: string; volume_ml: number; observacao?: string }) =>
      apiFetch<Producao>('/financeiro/producao', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeleteProducao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (local_id: string) =>
      apiFetch(`/financeiro/producao/${local_id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useCreateCusto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { apiary_local_id: string; hive_local_id?: string; data: string; tipo: string; valor_reais: number; descricao?: string }) =>
      apiFetch<Custo>('/financeiro/custos', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeleteCusto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (local_id: string) =>
      apiFetch(`/financeiro/custos/${local_id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
