import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';

export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_role: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  resource_label: string | null;
  payload: Record<string, unknown> | null;
  ip_address: string | null;
  timestamp: string;
}

export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AuditLogsFilters {
  page?: number;
  limit?: number;
  user_id?: number | '';
  resource_type?: string;
  action?: string;
  date_from?: string;
  date_to?: string;
}

export function useAuditLogs(filters: AuditLogsFilters = {}) {
  const params = new URLSearchParams();
  if (filters.page)          params.set('page', String(filters.page));
  if (filters.limit)         params.set('limit', String(filters.limit));
  if (filters.user_id)       params.set('user_id', String(filters.user_id));
  if (filters.resource_type) params.set('resource_type', filters.resource_type);
  if (filters.action)        params.set('action', filters.action);
  if (filters.date_from)     params.set('date_from', filters.date_from);
  if (filters.date_to)       params.set('date_to', filters.date_to);

  const qs = params.toString();
  return useQuery<AuditLogsResponse>({
    queryKey: ['audit-logs', filters],
    queryFn: () => apiFetch(`/admin/audit-logs${qs ? `?${qs}` : ''}`),
    staleTime: 30_000,
  });
}
