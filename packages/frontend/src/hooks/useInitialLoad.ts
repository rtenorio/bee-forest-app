/**
 * useInitialLoad
 *
 * Runs once when the app comes online with a valid auth token.
 * If IndexedDB appears empty (no apiaries), calls GET /api/sync/pull
 * with since=epoch to fetch ALL server data and populate IDB.
 *
 * This is intentionally separate from the push-sync cycle (useSync)
 * so it is never blocked by sync-queue state or stale closures.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOnlineStatus } from './useOnlineStatus';
import { useAuthStore } from '@/store/authStore';
import { apiaryRepo } from '@/db/repositories/apiary.repository';
import { hiveRepo } from '@/db/repositories/hive.repository';
import { speciesRepo } from '@/db/repositories/species.repository';
import { inspectionRepo } from '@/db/repositories/inspection.repository';
import { productionRepo } from '@/db/repositories/production.repository';
import { feedingRepo } from '@/db/repositories/feeding.repository';
import { harvestRepo } from '@/db/repositories/harvest.repository';
import { batchRepo } from '@/db/repositories/batch.repository';
import { stockRepo } from '@/db/repositories/stock.repository';
import type { EntityType } from '@bee-forest/shared';

const repoMap = {
  apiary:     apiaryRepo,
  hive:       hiveRepo,
  species:    speciesRepo,
  inspection: inspectionRepo,
  production: productionRepo,
  feeding:    feedingRepo,
  harvest:    harvestRepo,
  batch:      batchRepo,
  stock_item: stockRepo,
};

export function useInitialLoad() {
  const isOnline = useOnlineStatus();
  const token    = useAuthStore((s) => s.token);
  const qc       = useQueryClient();
  const ran      = useRef(false);

  useEffect(() => {
    if (!isOnline || !token || ran.current) return;

    const run = async () => {
      // Only pull if IDB has no apiaries (fresh install / cache cleared)
      const existing = await apiaryRepo.getAll();
      if (existing.length > 0) return;

      ran.current = true;
      console.log('[InitialLoad] IDB vazio — buscando todos os dados do servidor...');

      try {
        const res = await fetch('/api/sync/pull?since=1970-01-01T00:00:00.000Z', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          console.error('[InitialLoad] Pull falhou:', res.status);
          return;
        }

        const { server_changes } = await res.json() as {
          server_changes: Array<{ entity_type: string; records: unknown[] }>;
        };

        let total = 0;
        for (const change of server_changes) {
          const repo = repoMap[change.entity_type as EntityType];
          if (!repo) continue;
          for (const record of change.records as Parameters<typeof repo.upsertFromServer>[0][]) {
            await repo.upsertFromServer(record as never);
            total++;
          }
        }

        console.log(`[InitialLoad] ${total} registros restaurados do servidor.`);
        localStorage.setItem('bee-forest-last-sync', new Date().toISOString());
        qc.invalidateQueries();
      } catch (err) {
        ran.current = false; // allow retry on next render
        console.error('[InitialLoad] Erro:', err);
      }
    };

    run();
  }, [isOnline, token, qc]);
}
