import { BaseRepository } from './base.repository';
import { getDb } from '../schema';
import type { Hive } from '@bee-forest/shared';

export class HiveRepository extends BaseRepository<Hive> {
  readonly storeName = 'hives' as const;
  readonly entityType = 'hive' as const;

  async getByApiary(apiary_local_id: string): Promise<Hive[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex('hives', 'by-apiary', apiary_local_id);
    return all.filter((h) => !h.deleted_at);
  }

  async getByStatus(status: Hive['status']): Promise<Hive[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex('hives', 'by-status', status);
    return all.filter((h) => !h.deleted_at);
  }
}

export const hiveRepo = new HiveRepository();
