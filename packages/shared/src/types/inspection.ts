import { SyncMeta } from './sync';

export interface InspectionChecklist {
  // Step 2 – Population
  population_strength: 1 | 2 | 3 | 4 | 5;
  queen_seen: boolean | null;
  brood_present: boolean;
  temperament: 'calm' | 'nervous' | 'aggressive' | null;
  // Step 3 – Honey & pollen
  honey_stores: 'low' | 'adequate' | 'abundant';
  pollen_stores: 'low' | 'adequate' | 'abundant';
  propolis_quality: 'poor' | 'normal' | 'good' | null;
  // Step 4 – Health
  pests_observed: string[];
  diseases_observed: string[];
  // Step 5 – Infrastructure
  box_condition: 'poor' | 'fair' | 'good' | null;
  // Step 6 – Actions
  interventions: string[];
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
  audio_notes: string[];
  next_inspection_due: string | null;
  created_at: string;
}

export type InspectionCreate = Omit<Inspection, keyof SyncMeta | 'created_at'>;
export type InspectionUpdate = Partial<InspectionCreate>;
