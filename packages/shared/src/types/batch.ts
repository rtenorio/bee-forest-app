import { SyncMeta } from './sync';

export type BatchStatus =
  | 'collected'
  | 'in_natura_ready'
  | 'in_dehumidification'
  | 'dehumidified'
  | 'in_maturation'
  | 'matured'
  | 'bottled'
  | 'sold'
  | 'rejected';

export type ProcessingRoute = 'in_natura' | 'dehumidified' | 'matured' | 'dehumidified_then_matured';

export type DehumidificationMethod =
  | 'passive_controlled_room'
  | 'dehumidifier_room'
  | 'airflow_assisted'
  | 'other';

export type DehumidificationResult = 'in_progress' | 'completed' | 'interrupted' | 'failed';

export type MaturationSessionStatus = 'in_progress' | 'completed' | 'interrupted' | 'spoiled';

export type MaturationDecision =
  | 'approved'
  | 'approved_with_observation'
  | 'rejected'
  | 'redirected_for_new_processing';

export type ClosureType =
  | 'loose_cap'
  | 'sealed_cap'
  | 'cork'
  | 'silicone_airlock'
  | 's_bubbler_airlock'
  | 'three_piece_airlock'
  | 'other';

export type SaleType = 'retail' | 'wholesale' | 'internal_use' | 'sample' | 'discard' | 'other';

// ── Main entity (stored in IDB) ───────────────────────────────────────────────

export interface HoneyBatch extends SyncMeta {
  code: string;                         // LOT-YYYY-NNN
  apiary_local_id: string;
  harvest_local_id: string | null;
  harvest_date: string;                 // YYYY-MM-DD
  honey_type: 'vivo' | 'maturado';
  bee_species: string | null;
  floral_context: string | null;
  gross_weight_grams: number | null;
  net_weight_grams: number | null;
  initial_moisture: number | null;
  initial_brix: number | null;
  current_status: BatchStatus;
  processing_route: ProcessingRoute;
  is_bottled: boolean;
  is_sold: boolean;
  final_destination: string | null;
  collection_responsible_local_id: string | null;
  notes: string;
  created_at: string;
}

export type HoneyBatchCreate = Omit<HoneyBatch, keyof SyncMeta | 'created_at' | 'code'>;
export type HoneyBatchUpdate = Partial<HoneyBatchCreate>;

// ── Sub-entities (API-only, not in IDB) ───────────────────────────────────────

export interface DehumidificationMeasurement {
  id: number;
  local_id: string;
  measured_at: string;
  moisture: number;
  brix: number | null;
  ambient_temperature: number | null;
  ambient_humidity: number | null;
  notes: string | null;
}

export interface DehumidificationSession {
  id: number;
  local_id: string;
  start_datetime: string;
  end_datetime: string | null;
  method: DehumidificationMethod;
  equipment: string | null;
  room_name: string | null;
  ambient_temperature_start: number | null;
  ambient_humidity_start: number | null;
  initial_moisture: number | null;
  initial_brix: number | null;
  final_moisture: number | null;
  final_brix: number | null;
  result_status: DehumidificationResult;
  notes: string;
  measurements: DehumidificationMeasurement[];
}

export interface MaturationObservation {
  id: number;
  local_id: string;
  observed_at: string;
  ambient_temperature: number | null;
  ambient_humidity: number | null;
  bubbles_present: boolean;
  foam_present: boolean;
  pressure_signs: boolean;
  aroma_change: boolean;
  phase_separation: boolean;
  visible_fermentation_signs: boolean;
  observation_text: string | null;
}

export interface MaturationSession {
  id: number;
  local_id: string;
  start_datetime: string;
  end_datetime: string | null;
  container_type: string | null;
  container_material: string | null;
  closure_type: ClosureType;
  has_airlock: boolean;
  maturation_location: string | null;
  ambient_temperature_start: number | null;
  ambient_humidity_start: number | null;
  maturation_status: MaturationSessionStatus;
  sensory_notes_start: string | null;
  final_decision: MaturationDecision | null;
  final_notes: string | null;
  observations: MaturationObservation[];
}

export interface BatchBottling {
  id: number;
  local_id: string;
  bottled_at: string;
  container_type: string | null;
  package_size_ml: number | null;
  quantity_filled: number | null;
  total_volume_bottled_ml: number | null;
  notes: string | null;
}

export interface BatchSale {
  id: number;
  local_id: string;
  sold_at: string;
  sale_type: SaleType;
  destination: string | null;
  quantity_units: number | null;
  total_volume_ml: number | null;
  notes: string | null;
}

// ── Audit log entry ───────────────────────────────────────────────────────────

export interface BatchAuditLog {
  id: number;
  actor_name: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Detail response from API ──────────────────────────────────────────────────

export interface HoneyBatchDetail extends HoneyBatch {
  apiary_name: string | null;
  dehumidification_sessions: DehumidificationSession[];
  maturation_sessions: MaturationSession[];
  bottlings: BatchBottling[];
  sales: BatchSale[];
  audit_logs: BatchAuditLog[];
}
