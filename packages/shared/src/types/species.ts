import { SyncMeta } from './sync';

export interface Species extends SyncMeta {
  name: string;
  scientific_name: string;
  description: string;
  created_at: string;
}

export type SpeciesCreate = Omit<Species, keyof SyncMeta | 'created_at'>;
export type SpeciesUpdate = Partial<SpeciesCreate>;
