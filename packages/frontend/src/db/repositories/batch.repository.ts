import { getDb } from '../schema';
import { BaseRepository } from './base.repository';
import type { HoneyBatch } from '@bee-forest/shared';

export class BatchRepository extends BaseRepository<HoneyBatch> {
  readonly storeName = 'honey_batches' as const;
  readonly entityType = 'batch' as const;

  async getByApiary(apiary_local_id: string): Promise<HoneyBatch[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex('honey_batches', 'by-apiary', apiary_local_id);
    return all.filter((b) => !b.deleted_at);
  }

  async getByStatus(status: HoneyBatch['current_status']): Promise<HoneyBatch[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex('honey_batches', 'by-status', status);
    return all.filter((b) => !b.deleted_at);
  }
}

export const batchRepo = new BatchRepository();
