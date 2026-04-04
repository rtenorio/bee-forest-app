import { SyncMeta } from './sync';

// ─── Inspection Task ──────────────────────────────────────────────────────────

export type TaskPriority = 'normal' | 'urgent';

export interface InspectionTask {
  id: string;
  label: string;
  custom_text: string;
  due_date: string | null;       // YYYY-MM-DD
  assignee_name: string;
  priority: TaskPriority;
}

// ─── Checklist ────────────────────────────────────────────────────────────────

export interface InspectionChecklist {
  // ── Contexto da inspeção ──────────────────────────────────────────────────
  inspection_type: 'external_only' | 'external_internal' | null;
  time_of_day: 'morning' | 'afternoon' | 'night' | null;

  // ── Condições climáticas extras ───────────────────────────────────────────
  precipitation_observed: boolean;
  weather_feel: string[];          // 'dry' | 'humid' | 'rainy' | 'very_hot'
  perceived_bloom: 'low' | 'medium' | 'high' | null;
  weather_notes: string;

  // ── Atividade na entrada ──────────────────────────────────────────────────
  activity_level: 'very_low' | 'low' | 'normal' | 'high' | null;
  activity_observations: string[];
  entry_notes: string;

  // ── Força da colônia ──────────────────────────────────────────────────────
  colony_strength: 'very_weak' | 'weak' | 'medium' | 'strong' | 'very_strong' | null;
  strength_observations: string[];

  // ── Reservas alimentares ──────────────────────────────────────────────────
  honey_stores: 'low' | 'adequate' | 'high' | null;
  pollen_stores: 'low' | 'adequate' | 'high' | null;
  food_observations: string[];
  food_notes: string;

  // ── Cria (somente inspeção interna) ───────────────────────────────────────
  brood_status: 'not_evaluated' | 'reduced' | 'normal' | 'intense' | null;
  brood_observations: string[];
  brood_notes: string;

  // ── Condição da caixa ─────────────────────────────────────────────────────
  box_observations: string[];
  box_notes: string;

  // ── Sanidade ──────────────────────────────────────────────────────────────
  invaders: string[];
  other_invader_text: string;
  weakness_signs: string[];
  internal_changes: string[];
  odor_description: string;
  sanitary_severity: 'mild' | 'moderate' | 'severe' | 'critical' | null;

  // ── Potencial produtivo ───────────────────────────────────────────────────
  productive_potential: 'very_low' | 'low' | 'medium' | 'high' | 'very_high' | null;
  productive_observations: string[];
  productive_notes: string;

  // ── Manejo realizado ──────────────────────────────────────────────────────
  management_actions: string[];
  management_description: string;
  materials_used: string;

  // ── Tarefas vinculadas ────────────────────────────────────────────────────
  tasks: InspectionTask[];

  // ── Conclusão ─────────────────────────────────────────────────────────────
  overall_status: 'healthy' | 'attention' | 'high_risk' | 'critical' | null;
  recommendation: 'maintain_routine' | 'reassess_soon' | 'corrective_management' | 'refer_to_technician' | null;
  next_inspection_days: number | null;
  final_summary: string;
  generate_alert: boolean;
  notify_technician: boolean;
  mark_priority: boolean;
}

// ─── Sky condition ────────────────────────────────────────────────────────────

export type SkyCondition = 'sunny' | 'partly_cloudy' | 'cloudy';

// ─── Inspection ───────────────────────────────────────────────────────────────

export interface Inspection extends SyncMeta {
  hive_local_id: string;
  inspected_at: string;
  inspector_name: string;
  checklist: InspectionChecklist;
  weight_kg: number | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  precipitation_mm: number | null;
  sky_condition: SkyCondition | null;
  notes: string;
  photos: string[];
  audio_notes: string[];
  next_inspection_due: string | null;
  copied_from_previous: boolean;
  created_at: string;
}

export type InspectionCreate = Omit<Inspection, keyof SyncMeta | 'created_at'>;
export type InspectionUpdate = Partial<InspectionCreate>;
