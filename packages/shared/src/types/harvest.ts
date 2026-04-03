import { SyncMeta } from './sync';

export type HoneyType = 'vivo' | 'maturado';
export type VisualAspect = 'clear' | 'cloudy' | 'crystallized';
export type BubblesLevel = 'none' | 'few' | 'many';
export type PaperTest = 'pass' | 'fail';
export type ViscosityLevel = 1 | 2 | 3 | 4 | 5;
export type MaturationStatus = 'aguardando_maturacao' | 'em_maturacao' | 'concluido';

export interface Harvest extends SyncMeta {
  apiary_local_id: string;
  harvested_at: string; // ISO date string (YYYY-MM-DD)
  responsible_name: string;
  hive_local_ids: string[]; // colmeias colhidas nesta colheita

  /** Volume colhido por caixa individual: { hive_local_id → volume_ml } */
  hive_volumes: Record<string, number>;

  // Parâmetros de qualidade do mel
  honey_type: HoneyType;
  maturation_status: MaturationStatus | null;
  total_volume_ml: number | null;
  total_weight_kg: number | null;
  humidity_pct: number | null;
  brix: number | null;
  visual_aspect: VisualAspect | null;
  bubbles: BubblesLevel | null;
  paper_test: PaperTest | null;
  viscosity: ViscosityLevel | null;

  // Insumos fornecidos às colmeias colhidas
  syrup_provided: boolean;
  pollen_ball_provided: boolean;
  wax_provided: boolean;
  input_notes: string;

  notes: string;
  created_at: string;
}

export type HarvestCreate = Omit<Harvest, keyof SyncMeta | 'created_at'>;
export type HarvestUpdate = Partial<HarvestCreate>;
