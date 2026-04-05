import { SyncMeta } from './sync';

export type HiveStatus = 'active' | 'inactive' | 'dead' | 'transferred';

export interface Hive extends SyncMeta {
  apiary_local_id: string;
  apiary_origin_local_id: string | null;  // meliponário de origem (nunca muda)
  species_local_id: string | null;
  code: string;
  status: HiveStatus;
  installation_date: string | null;
  box_type: string;
  modules_count: number | null;
  wood_type: string | null;
  wood_type_other: string | null;
  notes: string;
  has_honey_super: boolean;
  honey_super_placed_at: string | null;
  honey_super_removed_at: string | null;
  qr_code?: string | null;
  created_at: string;
}

export type HiveCreate = Omit<Hive, keyof SyncMeta | 'created_at'>;
export type HiveUpdate = Partial<HiveCreate>;
