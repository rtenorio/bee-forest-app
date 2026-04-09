import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';

const QK = ['lotes'] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export type LoteStatus = 'coletado' | 'desumidificando' | 'maturando' | 'envasado' | 'vendido';
export type EtapaTipo  = 'desumidificacao' | 'maturacao' | 'envase' | 'analise' | 'outro';
export type FrascoDestino = 'consumo_proprio' | 'venda_direta' | 'bee_forest_luxe' | 'exportacao';

export interface Lote {
  local_id:        string;
  codigo:          string;
  apiary_local_id: string;
  apiary_nome:     string;
  colheitas_ids:   number[];
  data_colheita:   string;
  volume_total_ml: number;
  umidade:         number | null;
  brix:            number | null;
  status:          LoteStatus;
  observacao:      string | null;
  responsavel_nome: string | null;
  etapas_count:    number;
  volume_envasado_ml: number;
  created_at:      string;
}

export interface EtapaLote {
  id:              number;
  lote_local_id:   string;
  tipo:            EtapaTipo;
  data_inicio:     string;
  data_fim:        string | null;
  observacao:      string | null;
  responsavel_nome: string | null;
}

export interface FrascoLote {
  id:            number;
  lote_local_id: string;
  quantidade:    number;
  volume_ml:     number;
  destino:       FrascoDestino | null;
  data_envase:   string | null;
}

export interface LoteDetail extends Lote {
  apiary_localizacao: string | null;
  etapas:  EtapaLote[];
  frascos: FrascoLote[];
}

export interface LotePublic {
  codigo:             string;
  data_colheita:      string;
  apiary_nome:        string;
  apiary_localizacao: string;
  colmeias_origem:    Array<{ codigo_qr: string | null; hive_code: string; especie: string | null }>;
  etapas:             Array<{ tipo: string; data_inicio: string; data_fim: string | null; observacao: string | null; responsavel_nome: string | null }>;
  umidade:            number | null;
  brix:               number | null;
  status:             string;
  volume_total_ml:    number;
}

function toQS(f?: Record<string, string | undefined>) {
  if (!f) return '';
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useLotes(filters?: { apiary_local_id?: string; status?: string; date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: [...QK, 'list', filters],
    queryFn:  () => apiFetch<Lote[]>(`/lotes${toQS(filters)}`),
    staleTime: 30_000,
  });
}

export function useLote(local_id: string) {
  return useQuery({
    queryKey: [...QK, local_id],
    queryFn:  () => apiFetch<LoteDetail>(`/lotes/${local_id}`),
    enabled:  !!local_id,
    staleTime: 15_000,
  });
}

export function useLotePublic(local_id: string) {
  return useQuery({
    queryKey: [...QK, 'public', local_id],
    queryFn:  () => apiFetch<LotePublic>(`/lotes/${local_id}/public`),
    enabled:  !!local_id,
    staleTime: 300_000,
    retry: 1,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      apiary_local_id: string; colheitas_ids: number[];
      data_colheita: string; volume_total_ml: number;
      umidade?: number; brix?: number; observacao?: string;
    }) => apiFetch<Lote>('/lotes', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateLoteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ local_id, status, observacao }: { local_id: string; status: LoteStatus; observacao?: string }) =>
      apiFetch<Lote>(`/lotes/${local_id}/status`, { method: 'PATCH', body: JSON.stringify({ status, observacao }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useAddEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ local_id, ...data }: { local_id: string; tipo: EtapaTipo; data_inicio: string; data_fim?: string; observacao?: string }) =>
      apiFetch<EtapaLote>(`/lotes/${local_id}/etapas`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useAddFrasco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ local_id, ...data }: { local_id: string; quantidade: number; volume_ml: number; destino?: FrascoDestino; data_envase?: string }) =>
      apiFetch<FrascoLote>(`/lotes/${local_id}/frascos`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
