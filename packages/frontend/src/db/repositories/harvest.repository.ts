import { BaseRepository } from './base.repository';
import { getDb } from '../schema';
import type { Harvest } from '@bee-forest/shared';

export class HarvestRepository extends BaseRepository<Harvest> {
  readonly storeName = 'harvests' as const;
  readonly entityType = 'harvest' as const;

  async getByApiary(apiary_local_id: string): Promise<Harvest[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex('harvests', 'by-apiary', apiary_local_id);
    return all
      .filter((h) => !h.deleted_at)
      .sort((a, b) => b.harvested_at.localeCompare(a.harvested_at));
  }
}

export const harvestRepo = new HarvestRepository();
