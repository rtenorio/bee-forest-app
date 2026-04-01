import { BaseRepository } from './base.repository';
import { getDb } from '../schema';
import type { Production } from '@bee-forest/shared';

export class ProductionRepository extends BaseRepository<Production> {
  readonly storeName = 'productions' as const;
  readonly entityType = 'production' as const;

  async getByHive(hive_local_id: string): Promise<Production[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex('productions', 'by-hive', hive_local_id);
    return all
      .filter((p) => !p.deleted_at)
      .sort((a, b) => b.harvested_at.localeCompare(a.harvested_at));
  }
}

export const productionRepo = new ProductionRepository();
