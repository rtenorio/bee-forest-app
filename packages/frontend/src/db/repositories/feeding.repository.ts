import { BaseRepository } from './base.repository';
import { getDb } from '../schema';
import type { Feeding } from '@bee-forest/shared';

export class FeedingRepository extends BaseRepository<Feeding> {
  readonly storeName = 'feedings' as const;
  readonly entityType = 'feeding' as const;

  async getByHive(hive_local_id: string): Promise<Feeding[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex('feedings', 'by-hive', hive_local_id);
    return all
      .filter((f) => !f.deleted_at)
      .sort((a, b) => b.fed_at.localeCompare(a.fed_at));
  }
}

export const feedingRepo = new FeedingRepository();
