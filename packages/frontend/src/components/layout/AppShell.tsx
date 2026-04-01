import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { useSync } from '@/hooks/useSync';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useSyncStore } from '@/store/syncStore';

function UpdateBanner() {
  const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      console.log('SW registered:', r);
    },
  });

  if (needRefresh[0]) {
    return (
      <div className="bg-amber-500 text-stone-950 px-4 py-2 text-sm flex items-center justify-between">
        <span className="font-medium">Nova versão disponível!</span>
        <button onClick={() => updateServiceWorker(true)} className="underline font-semibold">
          Atualizar
        </button>
      </div>
    );
  }

  if (offlineReady[0]) {
    return (
      <div className="bg-emerald-800 text-emerald-100 px-4 py-2 text-sm text-center">
        App pronto para uso offline!
      </div>
    );
  }

  return null;
}

function SyncBanner() {
  const { lastError, conflicts } = useSyncStore();

  if (lastError) {
    return (
      <div className="bg-red-900/80 border-b border-red-700 text-red-200 px-4 py-2 text-sm flex items-center gap-2">
        <span>⚠️</span>
        <span>Erro de sincronização: {lastError}</span>
      </div>
    );
  }

  if (conflicts.length > 0) {
    return (
      <div className="bg-amber-900/80 border-b border-amber-700 text-amber-200 px-4 py-2 text-sm flex items-center gap-2">
        <span>⚡</span>
        <span>{conflicts.length} conflito(s) de sincronização detectado(s)</span>
      </div>
    );
  }

  return null;
}

export function AppShell() {
  // Initialize sync
  useSync();

  return (
    <div className="flex h-screen bg-stone-950">
      <Sidebar />
      <Sidebar mobile />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <UpdateBanner />
        <SyncBanner />

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
