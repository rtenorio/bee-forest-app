import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import type { Instruction, InstructionCreate, InstructionResponse, InstructionResponseCreate } from '@bee-forest/shared';

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
      const rows = await apiFetch<Instruction[]>('/instructions?status=pending');
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

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateInstruction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: InstructionCreate) =>
      apiFetch<Instruction>('/instructions', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateInstructionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ localId, status }: { localId: string; status: 'pending' | 'done' }) =>
      apiFetch(`/instructions/${localId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
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

// ── Audio upload via R2 presigned URL ─────────────────────────────────────────

export async function requestAudioUploadUrl(filename: string, contentType: string) {
  return apiFetch<{ uploadUrl: string; publicUrl: string; key: string }>('/instructions/upload-url', {
    method: 'POST',
    body: JSON.stringify({ filename, contentType }),
  });
}

export async function uploadAudioToR2(uploadUrl: string, blob: Blob): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': blob.type },
  });
  if (!res.ok) throw new Error('Falha ao fazer upload do áudio');
}
