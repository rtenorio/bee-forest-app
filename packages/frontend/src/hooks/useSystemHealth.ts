import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';

export interface SystemHealth {
  services: {
    database: 'ok' | 'error';
    r2: 'ok' | 'error';
    uptime_seconds: number;
  };
  sync_pending: {
    total: number;
    by_user: Array<{ user_id: number; user_name: string; count: number }>;
  };
  media_errors_24h: number;
  recent_errors: unknown[];
  last_backup: {
    timestamp: string | null;
    status: string;
  };
  stats: {
    total_hives: number;
    total_inspections: number;
    total_users: number;
    inspections_last_7_days: number;
  };
}

const QUERY_KEY = ['system-health'];

export function useSystemHealth() {
  return useQuery<SystemHealth>({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch('/admin/system-health'),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useRefreshSystemHealth() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: QUERY_KEY });
}
