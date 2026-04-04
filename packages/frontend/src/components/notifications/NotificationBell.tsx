import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from '@/hooks/useNotifications';
import { cn } from '@/utils/cn';

const TYPE_ICONS: Record<string, string> = {
  inspection_overdue: '🔍',
  task_overdue: '📋',
  batch_fermentation_risk: '⚠️',
  batch_stalled: '⏸️',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data } = useNotifications({ limit: 10 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = data?.unread_count ?? 0;
  const notifications = data?.notifications ?? [];

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleClick(notif: (typeof notifications)[number]) {
    if (!notif.read_at) markRead.mutate(notif.id);
    if (notif.url) { setOpen(false); navigate(notif.url); }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors"
        title="Notificações"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-stone-900 border border-stone-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800">
            <span className="font-semibold text-stone-200 text-sm">Notificações</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                Marcar tudo como lido
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-stone-800">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-stone-500 text-sm">Nenhuma notificação</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-stone-800 transition-colors flex gap-3',
                    !n.read_at && 'bg-stone-800/50'
                  )}
                >
                  <span className="text-lg shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium truncate', n.read_at ? 'text-stone-400' : 'text-stone-100')}>
                      {n.title}
                    </p>
                    <p className="text-xs text-stone-500 line-clamp-2 mt-0.5">{n.body}</p>
                    <p className="text-xs text-stone-600 mt-1">
                      {new Date(n.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  {!n.read_at && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-2" />}
                </button>
              ))
            )}
          </div>

          <div className="border-t border-stone-800 px-4 py-2">
            <button
              onClick={() => { setOpen(false); navigate('/notifications'); }}
              className="w-full text-center text-xs text-amber-400 hover:text-amber-300 py-1 transition-colors"
            >
              Ver todas as notificações →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
