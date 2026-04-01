import { SyncMeta } from './sync';

export interface Apiary extends SyncMeta {
  name: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  owner_name: string;
  notes: string;
  created_at: string;
}

export type ApiaryCreate = Omit<Apiary, keyof SyncMeta | 'created_at'>;
export type ApiaryUpdate = Partial<ApiaryCreate>;
