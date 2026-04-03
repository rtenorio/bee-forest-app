import { SyncMeta } from './sync';

// ─── Inspection Task ──────────────────────────────────────────────────────────

export type TaskPriority = 'normal' | 'urgent';

export interface InspectionTask {
  id: string;                    // client-generated UUID
  label: string;                 // predefined key or 'custom'
  custom_text: string;           // used when label === 'custom'
  due_date: string | null;       // YYYY-MM-DD
  assignee_name: string;
  priority: TaskPriority;
}

// ─── Inspection Checklist ─────────────────────────────────────────────────────

export interface InspectionChecklist {
  // ── Colônia (Melipona — sem ferrão) ─────────────────────────────────────────
  /** Força da colônia: forte / média / fraca */
  colony_strength: 'strong' | 'medium' | 'weak';
  /** Cria saudável presente */
  brood_present: boolean;
  /** Nível de agitação das abelhas */
  agitation_level: 'calm' | 'agitated' | 'defensive' | null;
  /** Pronta para divisão */
  ready_for_split: boolean;
  /** Mel disponível para colheita */
  honey_ready_for_harvest: boolean;
  /** Presença de intrusos (outras espécies) */
  intruder_species: boolean;

  // ── Alimentação ─────────────────────────────────────────────────────────────
  honey_stores: 'low' | 'adequate' | 'abundant';
  pollen_stores: 'low' | 'adequate' | 'abundant';
  propolis_quality: 'poor' | 'normal' | 'good' | null;
  /** Precisa de xarope */
  needs_syrup: boolean;
  syrup_urgency: 'normal' | 'urgent';
  /** Precisa de bombom de pólen */
  needs_pollen_ball: boolean;
  /** Precisa de cera */
  needs_wax: boolean;

  // ── Pragas e Sanidade ────────────────────────────────────────────────────────
  ants: 'none' | 'few' | 'infested';
  phorid_flies: 'none' | 'few' | 'infested';
  wax_moths: boolean;
  beetles: boolean;
  caterpillar: boolean;
  other_pests_text: string;
  strange_odor: boolean;
  diseases_observed: string[];

  // ── Estrutura da Caixa ───────────────────────────────────────────────────────
  /** Batume íntegro */
  propolis_seal_intact: boolean | null;
  entrance_blocked: boolean;
  moisture_infiltration: boolean;
  needs_box_replacement: boolean;
  /** Estado geral da caixa */
  box_condition: 'poor' | 'fair' | 'good' | null;

  // ── Tarefas vinculadas ───────────────────────────────────────────────────────
  tasks: InspectionTask[];

  // ── Legado (mantidos para compatibilidade com registros anteriores) ──────────
  /** @deprecated use colony_strength */
  population_strength?: 1 | 2 | 3 | 4 | 5;
  queen_seen?: boolean | null;
  temperament?: 'calm' | 'nervous' | 'aggressive' | null;
  pests_observed?: string[];
  interventions?: string[];
  needs_feeding?: boolean;
  needs_space_expansion?: boolean;
}

// ─── Condition types ──────────────────────────────────────────────────────────

export type SkyCondition = 'sunny' | 'partly_cloudy' | 'cloudy';

// ─── Inspection ───────────────────────────────────────────────────────────────

export interface Inspection extends SyncMeta {
  hive_local_id: string;
  inspected_at: string;
  inspector_name: string;
  checklist: InspectionChecklist;
  weight_kg: number | null;
  /** Temperatura ambiente em °C */
  temperature_c: number | null;
  /** Umidade do ar em % */
  humidity_pct: number | null;
  /** Precipitação em mm */
  precipitation_mm: number | null;
  /** Condição do céu */
  sky_condition: SkyCondition | null;
  notes: string;
  photos: string[];
  audio_notes: string[];
  next_inspection_due: string | null;
  created_at: string;
}

export type InspectionCreate = Omit<Inspection, keyof SyncMeta | 'created_at'>;
export type InspectionUpdate = Partial<InspectionCreate>;
