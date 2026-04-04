import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@/store/uiStore';
import { useSyncStore } from '@/store/syncStore';
import { useAuthStore } from '@/store/authStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSync } from '@/hooks/useSync';
import { cn } from '@/utils/cn';
import { ROLE_LABELS } from '@bee-forest/shared';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export function TopBar() {
  const navigate = useNavigate();
  const { setSidebarOpen } = useUIStore();
  const { isSyncing, pendingCount } = useSyncStore();
  const isOnline = useOnlineStatus();
  const { triggerSync } = useSync();
  const { user, clearAuth } = useAuthStore();

  function handleLogout() {
    clearAuth();
    navigate('/login', { replace: true });
  }

  return (
    <header className="h-14 bg-stone-900 border-b border-stone-800 flex items-center px-4 gap-3 sticky top-0 z-30">
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden p-2 text-stone-400 hover:text-stone-100 transition-colors"
        aria-label="Abrir menu"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex items-center gap-2 flex-1">
        <span className="text-xl">🐝</span>
        <span className="font-bold text-amber-400 text-lg hidden sm:block">Bee Forest</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Sync status */}
        {pendingCount > 0 && (
          <button
            onClick={triggerSync}
            disabled={!isOnline || isSyncing}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-900/40 border border-amber-700/50 text-amber-300 text-xs font-medium hover:bg-amber-900/60 transition-colors disabled:opacity-50"
          >
            <svg className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {pendingCount}
          </button>
        )}

        {/* Online/Offline indicator */}
        <div className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
          isOnline
            ? 'bg-emerald-900/40 border border-emerald-700/50 text-emerald-300'
            : 'bg-stone-800 border border-stone-700 text-stone-400'
        )}>
          <span className={cn('w-2 h-2 rounded-full', isOnline ? 'bg-emerald-400' : 'bg-stone-500')} />
          <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        {/* Notification bell */}
        <NotificationBell />

        {/* User menu */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-stone-700">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-medium text-stone-200 leading-none">{user.name}</p>
              <p className="text-xs text-stone-500 leading-none mt-0.5">{ROLE_LABELS[user.role]}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
