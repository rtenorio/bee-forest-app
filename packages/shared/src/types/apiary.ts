import { SyncMeta } from './sync';

export type ApiaryStatus = 'active' | 'inactive';

export interface Apiary extends SyncMeta {
  name: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  owner_name: string;
  notes: string;
  status: ApiaryStatus;
  created_at: string;
}

export type ApiaryCreate = Omit<Apiary, keyof SyncMeta | 'created_at'>;
export type ApiaryUpdate = Partial<ApiaryCreate>;
