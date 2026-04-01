import { SyncMeta } from './sync';

export interface InspectionChecklist {
  population_strength: 1 | 2 | 3 | 4 | 5;
  brood_present: boolean;
  queen_seen: boolean | null;
  honey_stores: 'low' | 'adequate' | 'abundant';
  pests_observed: string[];
  diseases_observed: string[];
  propolis_quality: 'poor' | 'normal' | 'good' | null;
  temperament: 'calm' | 'nervous' | 'aggressive' | null;
  needs_feeding: boolean;
  needs_space_expansion: boolean;
}

export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy';

export interface Inspection extends SyncMeta {
  hive_local_id: string;
  inspected_at: string;
  inspector_name: string;
  checklist: InspectionChecklist;
  weight_kg: number | null;
  temperature_c: number | null;
  weather: WeatherCondition | null;
  notes: string;
  photos: string[];
  next_inspection_due: string | null;
  created_at: string;
}

export type InspectionCreate = Omit<Inspection, keyof SyncMeta | 'created_at'>;
export type InspectionUpdate = Partial<InspectionCreate>;
