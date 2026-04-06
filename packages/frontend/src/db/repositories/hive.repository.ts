import { BaseRepository } from './base.repository';
import { getDb } from '../schema';
import type { Hive } from '@bee-forest/shared';

export function sortByQRCode(hives: Hive[]): Hive[] {
  return [...hives].sort((a, b) => {
    const seqA = parseInt(/CME-(\d+)-/i.exec(a.code)?.[1] ?? '0', 10);
    const seqB = parseInt(/CME-(\d+)-/i.exec(b.code)?.[1] ?? '0', 10);
    return seqA - seqB;
  });
}

export class HiveRepository extends BaseRepository<Hive> {
  readonly storeName = 'hives' as const;
  readonly entityType = 'hive' as const;

  override async getAll(): Promise<Hive[]> {
    const hives = await super.getAll();
    return sortByQRCode(hives);
  }

  async getByApiary(apiary_local_id: string): Promise<Hive[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex('hives', 'by-apiary', apiary_local_id);
    return sortByQRCode(all.filter((h) => !h.deleted_at));
  }

  async getByStatus(status: Hive['status']): Promise<Hive[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex('hives', 'by-status', status);
    return sortByQRCode(all.filter((h) => !h.deleted_at));
  }
}

export const hiveRepo = new HiveRepository();
