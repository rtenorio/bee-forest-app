import { getDb } from '../schema';
import type { SyncQueueItem } from '@bee-forest/shared';

export const syncQueueRepo = {
  async getAll(): Promise<SyncQueueItem[]> {
    const db = await getDb();
    return db.getAll('sync_queue');
  },

  async count(): Promise<number> {
    const db = await getDb();
    return db.count('sync_queue');
  },

  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('sync_queue', id);
  },

  async removeMany(ids: string[]): Promise<void> {
    const db = await getDb();
    const tx = db.transaction('sync_queue', 'readwrite');
    await Promise.all(ids.map((id) => tx.store.delete(id)));
    await tx.done;
  },

  async incrementAttempt(id: string, error?: string): Promise<void> {
    const db = await getDb();
    const item = await db.get('sync_queue', id);
    if (!item) return;
    await db.put('sync_queue', {
      ...item,
      attempts: item.attempts + 1,
      last_error: error ?? null,
    });
  },

  async clear(): Promise<void> {
    const db = await getDb();
    await db.clear('sync_queue');
  },
};
