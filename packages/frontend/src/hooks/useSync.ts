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
const INITIAL_PULL_KEY = 'bee-forest-initial-pull-done';

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

      // Check IDB state once for both the early-exit decision and lastSyncAt override
      const existingApiaries = await apiaryRepo.getAll();
      const idbEmpty = existingApiaries.length === 0;

      if (items.length === 0) {
        const initialPullDone = !!localStorage.getItem(INITIAL_PULL_KEY);
        if (!idbEmpty && initialPullDone) {
          // Nothing to push and IDB already has data — nothing to do
          setIsSyncing(false);
          return;
        }
        // IDB is empty or initial pull hasn't run yet — proceed to pull all data
      }

      // Force last_sync_at = null when IDB is empty so the server returns ALL records
      const lastSyncAt = idbEmpty ? null : localStorage.getItem('bee-forest-last-sync');
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

      // Clear is_dirty for resolved records — server_changes may not include them
      // if their updated_at <= last_sync_at (timing race between edit and sync cycles)
      await Promise.all(
        items
          .filter((i) => resolvedIds.has(i.entity_local_id))
          .map((i) => {
            const repo = repoMap[i.entity_type as EntityType];
            return repo ? repo.clearDirty(i.entity_local_id) : Promise.resolve();
          })
      );

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
      localStorage.setItem(INITIAL_PULL_KEY, '1');

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
