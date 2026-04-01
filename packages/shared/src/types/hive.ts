import { SyncMeta } from './sync';

export type HiveStatus = 'active' | 'inactive' | 'dead' | 'transferred';

export interface Hive extends SyncMeta {
  apiary_local_id: string;
  species_local_id: string | null;
  code: string;
  status: HiveStatus;
  installation_date: string | null;
  box_type: string;
  notes: string;
  created_at: string;
}

export type HiveCreate = Omit<Hive, keyof SyncMeta | 'created_at'>;
export type HiveUpdate = Partial<HiveCreate>;
