import { SyncMeta } from './sync';

export type FeedType = 'sugar_syrup' | 'honey' | 'pollen_sub' | 'other';

export interface Feeding extends SyncMeta {
  hive_local_id: string;
  feed_type: FeedType;
  quantity_ml: number | null;
  fed_at: string;
  notes: string;
  created_at: string;
}

export type FeedingCreate = Omit<Feeding, keyof SyncMeta | 'created_at'>;
export type FeedingUpdate = Partial<FeedingCreate>;
