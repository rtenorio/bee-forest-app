import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import type { Instruction, InstructionCreate, InstructionResponse, InstructionResponseCreate, InstructionStatus } from '@bee-forest/shared';

const QK = ['instructions'] as const;

// ── Queries ───────────────────────────────────────────────────────────────────

export function useInstructions(filters?: {
  apiary_local_id?: string;
  hive_local_id?: string;
  status?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.apiary_local_id) params.set('apiary_local_id', filters.apiary_local_id);
  if (filters?.hive_local_id)   params.set('hive_local_id', filters.hive_local_id);
  if (filters?.status)          params.set('status', filters.status);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: [...QK, 'list', filters],
    queryFn: () => apiFetch<Instruction[]>(`/instructions${qs}`),
    staleTime: 15_000,
  });
}

export function usePendingInstructionsCount() {
  return useQuery({
    queryKey: [...QK, 'pending-count'],
    queryFn: async () => {
      const rows = await apiFetch<Instruction[]>('/instructions?status=pendente');
      return rows.length;
    },
    staleTime: 30_000,
  });
}

export function useInstructionResponses(instructionLocalId: string) {
  return useQuery({
    queryKey: [...QK, instructionLocalId, 'responses'],
    queryFn: () => apiFetch<InstructionResponse[]>(`/instructions/${instructionLocalId}/responses`),
    staleTime: 10_000,
    enabled: !!instructionLocalId,
  });
}

export function useSLAReport(filters?: {
  apiary_local_id?: string;
  date_from?: string;
  date_to?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.apiary_local_id) params.set('apiary_local_id', filters.apiary_local_id);
  if (filters?.date_from)       params.set('date_from', filters.date_from);
  if (filters?.date_to)         params.set('date_to', filters.date_to);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: [...QK, 'sla-report', filters],
    queryFn: () => apiFetch<SLAReportRow[]>(`/instructions/sla-report${qs}`),
    staleTime: 60_000,
  });
}

export interface SLAReportRow {
  user_id: number;
  user_name: string;
  total: number;
  concluidas_no_prazo: number;
  concluidas_atrasadas: number;
  pendentes: number;
  taxa_cumprimento: number;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateInstruction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: InstructionCreate) =>
      apiFetch<Instruction>('/instructions', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export interface UpdateInstructionStatusPayload {
  localId: string;
  status: InstructionStatus;
  evidencia_key?: string | null;
  evidencia_url?: string | null;
  motivo_rejeicao?: string | null;
}

export function useUpdateInstructionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ localId, status, evidencia_key, evidencia_url, motivo_rejeicao }: UpdateInstructionStatusPayload) =>
      apiFetch(`/instructions/${localId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, evidencia_key, evidencia_url, motivo_rejeicao }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeleteInstruction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (localId: string) =>
      apiFetch(`/instructions/${localId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useCreateInstructionResponse(instructionLocalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: InstructionResponseCreate) =>
      apiFetch<InstructionResponse>(`/instructions/${instructionLocalId}/responses`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
    },
  });
}

// ── Audio / media upload via R2 presigned URL ─────────────────────────────────

export async function requestAudioUploadUrl(filename: string, contentType: string) {
  return apiFetch<{ uploadUrl: string; readUrl: string; key: string }>('/instructions/upload-url', {
    method: 'POST',
    body: JSON.stringify({ filename, contentType }),
  });
}

export async function uploadAudioToR2(uploadUrl: string, blob: Blob, mimeType?: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': mimeType || blob.type || 'audio/webm' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload falhou: HTTP ${res.status} — ${text}`);
  }
}

export async function requestImageUploadUrl(filename: string, contentType: string) {
  return apiFetch<{ uploadUrl: string; readUrl: string; key: string }>('/instructions/upload-url', {
    method: 'POST',
    body: JSON.stringify({ filename, contentType }),
  });
}
