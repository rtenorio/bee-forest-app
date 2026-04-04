import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import type { UserRole } from '@bee-forest/shared';

export interface ManagedUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  active: boolean;
  observations: string;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  apiary_local_ids: string[];
  hive_local_ids: string[];
}

export interface AuditLog {
  id: number;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_name: string | null;
  actor_role: string | null;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  apiary_local_ids?: string[];
  hive_local_ids?: string[];
  observations?: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  phone?: string;
  observations?: string;
  apiary_local_ids?: string[];
  hive_local_ids?: string[];
}

const QK = ['users'];

export function useUsers() {
  return useQuery({
    queryKey: QK,
    queryFn: () => apiFetch<ManagedUser[]>('/users'),
    staleTime: 30_000,
  });
}

export function useUser(id: number | null) {
  return useQuery({
    queryKey: [...QK, id],
    queryFn: () => apiFetch<ManagedUser>(`/users/${id}`),
    enabled: !!id,
  });
}

export function useUserAudit(id: number | null) {
  return useQuery({
    queryKey: [...QK, id, 'audit'],
    queryFn: () => apiFetch<AuditLog[]>(`/users/${id}/audit`),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserPayload) =>
      apiFetch<ManagedUser & { generated_password: string }>('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserPayload }) =>
      apiFetch<ManagedUser>(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useToggleUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ id: number; active: boolean }>(`/users/${id}/status`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useChangeUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: UserRole }) =>
      apiFetch<{ id: number; role: UserRole }>(`/users/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
