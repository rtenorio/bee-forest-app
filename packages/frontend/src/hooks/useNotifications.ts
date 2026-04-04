import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';

export interface Notification {
  id: number;
  type: 'inspection_overdue' | 'task_overdue' | 'batch_fermentation_risk' | 'batch_stalled';
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  url: string | null;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationSettings {
  id: number;
  user_id: number;
  web_push_enabled: boolean;
  whatsapp_enabled: boolean;
  whatsapp_phone: string | null;
  inspection_overdue_days: number;
  notify_inspection_overdue: boolean;
  notify_task_overdue: boolean;
  notify_batch_risk: boolean;
  notify_batch_stalled: boolean;
}

interface ListResponse {
  notifications: Notification[];
  unread_count: number;
}

const NOTIF_KEY = ['notifications'];
const SETTINGS_KEY = ['notification-settings'];

export function useNotifications(params?: { type?: string; unread_only?: boolean; limit?: number; offset?: number }) {
  const search = new URLSearchParams();
  if (params?.type) search.set('type', params.type);
  if (params?.unread_only) search.set('unread_only', 'true');
  if (params?.limit !== undefined) search.set('limit', String(params.limit));
  if (params?.offset !== undefined) search.set('offset', String(params.offset));
  const qs = search.toString();

  return useQuery<ListResponse>({
    queryKey: [...NOTIF_KEY, params],
    queryFn: () => apiFetch<ListResponse>(`/notifications${qs ? '?' + qs : ''}`),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIF_KEY }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/notifications/read-all', { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIF_KEY }),
  });
}

export function useNotificationSettings() {
  return useQuery<NotificationSettings>({
    queryKey: SETTINGS_KEY,
    queryFn: () => apiFetch<NotificationSettings>('/notifications/settings'),
  });
}

export function useUpdateNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<NotificationSettings>) =>
      apiFetch<NotificationSettings>('/notifications/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}

export function useVapidPublicKey() {
  return useQuery<{ key: string | null }>({
    queryKey: ['vapid-public-key'],
    queryFn: () => apiFetch<{ key: string | null }>('/notifications/vapid-public-key'),
    staleTime: Infinity,
  });
}

export function useSubscribePush() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vapidKey: string) => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const json = sub.toJSON();
      await apiFetch('/notifications/subscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
      });
      return sub;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}

export function useUnsubscribePush() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiFetch('/notifications/subscription', {
          method: 'DELETE',
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}

// Utility: converts VAPID public key (base64url) to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
