import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../schema';
import type { PendingQRScan } from '../schema';

export const qrScanRepo = {
  async add(hive_local_id: string): Promise<PendingQRScan> {
    const db = await getDb();
    const record: PendingQRScan = {
      id: uuidv4(),
      hive_local_id,
      scanned_at: new Date().toISOString(),
    };
    await db.put('qr_scans', record);
    return record;
  },

  async getAll(): Promise<PendingQRScan[]> {
    const db = await getDb();
    return db.getAll('qr_scans');
  },

  async removeMany(ids: string[]): Promise<void> {
    const db = await getDb();
    const tx = db.transaction('qr_scans', 'readwrite');
    await Promise.all(ids.map((id) => tx.store.delete(id)));
    await tx.done;
  },

  async count(): Promise<number> {
    const db = await getDb();
    return db.count('qr_scans');
  },
};
