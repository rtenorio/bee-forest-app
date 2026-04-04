import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSyncStore } from '@/store/syncStore';
import { useOnlineStatus } from './useOnlineStatus';
import { syncQueueRepo } from '@/db/repositories/syncQueue.repository';
import { apiaryRepo } from '@/db/repositories/apiary.repository';
import { hiveRepo } from '@/db/repositories/hive.repository';
import { speciesRepo } from '@/db/repositories/species.repository';
import { inspectionRepo } from '@/db/repositories/inspection.repository';
import { productionRepo } from '@/db/repositories/production.repository';
import { feedingRepo } from '@/db/repositories/feeding.repository';
import { harvestRepo } from '@/db/repositories/harvest.repository';
import { batchRepo } from '@/db/repositories/batch.repository';
import { stockRepo } from '@/db/repositories/stock.repository';
import type { SyncResult, EntityType } from '@bee-forest/shared';

const CLIENT_ID_KEY = 'bee-forest-client-id';

// Items that fail this many times get purged from the queue to prevent infinite loops
const MAX_ATTEMPTS = 5;

function getClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

const repoMap = {
  apiary: apiaryRepo,
  hive: hiveRepo,
  species: speciesRepo,
  inspection: inspectionRepo,
  production: productionRepo,
  feeding: feedingRepo,
  harvest: harvestRepo,
  batch: batchRepo,
  stock_item: stockRepo,
};

export function useSync() {
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const { isSyncing, setIsSyncing, setPendingCount, setLastSyncAt, setConflicts, setLastError } = useSyncStore();
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshPendingCount = useCallback(async () => {
    const count = await syncQueueRepo.count();
    setPendingCount(count);
  }, [setPendingCount]);

  const triggerSync = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    setLastError(null);

    try {
      let items = await syncQueueRepo.getAll();

      // Purge items that have exceeded the max retry threshold
      const stuckItems = items.filter((i) => i.attempts >= MAX_ATTEMPTS);
      if (stuckItems.length > 0) {
        console.warn(`[Sync] Removing ${stuckItems.length} stuck item(s) after ${MAX_ATTEMPTS}+ failed attempts`);
        await syncQueueRepo.removeMany(stuckItems.map((i) => i.id));
        items = items.filter((i) => i.attempts < MAX_ATTEMPTS);
      }

      if (items.length === 0) {
        setIsSyncing(false);
        return;
      }

      const lastSyncAt = localStorage.getItem('bee-forest-last-sync');
      const payload = { client_id: getClientId(), items, last_sync_at: lastSyncAt };

      const { token } = (await import('@/store/authStore')).useAuthStore.getState();
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Increment attempt counter for all pending items so they eventually get purged
        await Promise.all(items.map((i) => syncQueueRepo.incrementAttempt(i.id, `HTTP ${response.status}`)));
        throw new Error(`Sync failed: ${response.status}`);
      }

      const result: SyncResult = await response.json();

      // Mark resolved items as synced
      const resolvedIds = new Set(result.resolved.map((r) => r.local_id));
      const toRemove = items.filter((i) => resolvedIds.has(i.entity_local_id)).map((i) => i.id);
      await syncQueueRepo.removeMany(toRemove);

      // Apply server changes to IDB
      for (const change of result.server_changes) {
        const repo = repoMap[change.entity_type as EntityType];
        if (!repo) continue;
        for (const record of change.records as Parameters<typeof repo.upsertFromServer>[0][]) {
          await repo.upsertFromServer(record as never);
        }
      }

      setConflicts(result.conflicts);
      const now = new Date().toISOString();
      setLastSyncAt(now);
      localStorage.setItem('bee-forest-last-sync', now);

      // Invalidate all queries to refresh UI
      queryClient.invalidateQueries();

    } catch (err) {
      setLastError(err instanceof Error ? err.message : 'Erro de sincronização');
    } finally {
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [isSyncing, isOnline, setIsSyncing, setLastError, setConflicts, setLastSyncAt, queryClient, refreshPendingCount]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline) {
      triggerSync();
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic sync every 5 minutes
  useEffect(() => {
    if (!isOnline) {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      return;
    }
    syncIntervalRef.current = setInterval(triggerSync, 5 * 60 * 1000);
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [isOnline, triggerSync]);

  // Refresh pending count on mount
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  return { triggerSync, refreshPendingCount };
}
