import { BaseRepository } from './base.repository';
import { getDb } from '../schema';
import type { Inspection } from '@bee-forest/shared';

export class InspectionRepository extends BaseRepository<Inspection> {
  readonly storeName = 'inspections' as const;
  readonly entityType = 'inspection' as const;

  async getByHive(hive_local_id: string): Promise<Inspection[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex('inspections', 'by-hive', hive_local_id);
    return all
      .filter((i) => !i.deleted_at)
      .sort((a, b) => b.inspected_at.localeCompare(a.inspected_at));
  }

  async getLatestForHive(hive_local_id: string): Promise<Inspection | null> {
    const all = await this.getByHive(hive_local_id);
    return all[0] ?? null;
  }
}

export const inspectionRepo = new InspectionRepository();
