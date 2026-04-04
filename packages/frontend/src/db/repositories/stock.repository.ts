import { getDb } from '../schema';
import { BaseRepository } from './base.repository';
import type { StockItem, StockCategory } from '@bee-forest/shared';

export class StockRepository extends BaseRepository<StockItem> {
  readonly storeName = 'stock_items' as const;
  readonly entityType = 'stock_item' as const;

  async getByApiary(apiary_local_id: string): Promise<StockItem[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex('stock_items', 'by-apiary', apiary_local_id);
    return all.filter((s) => !s.deleted_at);
  }

  async getByCategory(category: StockCategory): Promise<StockItem[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex('stock_items', 'by-category', category);
    return all.filter((s) => !s.deleted_at);
  }

  async getByApiaryAndCategory(apiary_local_id: string, category: StockCategory): Promise<StockItem[]> {
    const byApiary = await this.getByApiary(apiary_local_id);
    return byApiary.filter((s) => s.category === category);
  }
}

export const stockRepo = new StockRepository();
