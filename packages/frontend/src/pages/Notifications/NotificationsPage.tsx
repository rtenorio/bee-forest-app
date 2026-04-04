import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotifications';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';

const TYPE_LABELS: Record<string, string> = {
  inspection_overdue: 'Inspeção Atrasada',
  task_overdue: 'Tarefa Vencida',
  batch_fermentation_risk: 'Risco de Fermentação',
  batch_stalled: 'Lote Parado',
};

const TYPE_ICONS: Record<string, string> = {
  inspection_overdue: '🔍',
  task_overdue: '📋',
  batch_fermentation_risk: '⚠️',
  batch_stalled: '⏸️',
};

const PAGE_SIZE = 20;

export function NotificationsPage() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [offset, setOffset] = useState(0);

  const { data, isLoading } = useNotifications({
    type: typeFilter || undefined,
    unread_only: unreadOnly,
    limit: PAGE_SIZE,
    offset,
  });

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unread_count ?? 0;

  function handleClick(n: (typeof notifications)[number]) {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.url) navigate(n.url);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Notificações</h1>
          {unreadCount > 0 && (
            <p className="text-stone-400 text-sm">{unreadCount} não lida{unreadCount !== 1 ? 's' : ''}</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
            Marcar tudo como lido
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setOffset(0); }}
          className="bg-stone-800 border border-stone-700 text-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500"
        >
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-stone-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => { setUnreadOnly(e.target.checked); setOffset(0); }}
            className="rounded border-stone-600 bg-stone-800 text-amber-500 focus:ring-amber-500"
          />
          Somente não lidas
        </label>
      </div>

      <Card>
        {isLoading ? (
          <div className="py-12 text-center text-stone-500">Carregando...</div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center text-stone-500">
            <p className="text-4xl mb-3">🔔</p>
            <p>Nenhuma notificação encontrada</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-800">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  'w-full text-left px-4 py-4 hover:bg-stone-800/50 transition-colors flex gap-4',
                  !n.read_at && 'bg-stone-800/30'
                )}
              >
                <span className="text-2xl shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('font-medium', n.read_at ? 'text-stone-400' : 'text-stone-100')}>
                      {n.title}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="default" className="text-xs">{TYPE_LABELS[n.type] ?? n.type}</Badge>
                      {!n.read_at && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
                    </div>
                  </div>
                  <p className="text-sm text-stone-500 mt-1">{n.body}</p>
                  <p className="text-xs text-stone-600 mt-1">
                    {new Date(n.created_at).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Pagination */}
      {notifications.length === PAGE_SIZE && (
        <div className="flex justify-center gap-3">
          {offset > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              ← Anterior
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setOffset(offset + PAGE_SIZE)}>
            Próxima →
          </Button>
        </div>
      )}
    </div>
  );
}
