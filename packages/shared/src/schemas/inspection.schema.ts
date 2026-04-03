import { z } from 'zod';

// ─── Task schema ──────────────────────────────────────────────────────────────

export const InspectionTaskSchema = z.object({
  id: z.string(),
  label: z.string(),
  custom_text: z.string().default(''),
  due_date: z.string().nullable().default(null),
  assignee_name: z.string().default(''),
  priority: z.enum(['normal', 'urgent']).default('normal'),
});

// ─── Checklist schema ─────────────────────────────────────────────────────────

export const InspectionChecklistSchema = z.object({
  // Contexto
  inspection_type: z.enum(['external_only', 'external_internal']).nullable().default(null),
  time_of_day: z.enum(['morning', 'afternoon', 'night']).nullable().default(null),

  // Clima extras
  precipitation_observed: z.boolean().default(false),
  weather_feel: z.array(z.string()).default([]),
  perceived_bloom: z.enum(['low', 'medium', 'high']).nullable().default(null),
  weather_notes: z.string().default(''),

  // Atividade
  activity_level: z.enum(['very_low', 'low', 'normal', 'high']).nullable().default(null),
  activity_observations: z.array(z.string()).default([]),
  entry_notes: z.string().default(''),

  // Força
  colony_strength: z.enum(['very_weak', 'weak', 'medium', 'strong', 'very_strong']).nullable().default(null),
  strength_observations: z.array(z.string()).default([]),

  // Reservas
  honey_stores: z.enum(['low', 'adequate', 'high']).nullable().default(null),
  pollen_stores: z.enum(['low', 'adequate', 'high']).nullable().default(null),
  food_observations: z.array(z.string()).default([]),
  food_notes: z.string().default(''),

  // Cria
  brood_status: z.enum(['not_evaluated', 'reduced', 'normal', 'intense']).nullable().default(null),
  brood_observations: z.array(z.string()).default([]),
  brood_notes: z.string().default(''),

  // Caixa
  box_observations: z.array(z.string()).default([]),
  box_notes: z.string().default(''),

  // Sanidade
  invaders: z.array(z.string()).default([]),
  other_invader_text: z.string().default(''),
  weakness_signs: z.array(z.string()).default([]),
  internal_changes: z.array(z.string()).default([]),
  odor_description: z.string().default(''),
  sanitary_severity: z.enum(['mild', 'moderate', 'severe', 'critical']).nullable().default(null),

  // Potencial produtivo
  productive_potential: z.enum(['very_low', 'low', 'medium', 'high', 'very_high']).nullable().default(null),
  productive_observations: z.array(z.string()).default([]),
  productive_notes: z.string().default(''),

  // Manejo
  management_actions: z.array(z.string()).default([]),
  management_description: z.string().default(''),
  materials_used: z.string().default(''),

  // Tarefas
  tasks: z.array(InspectionTaskSchema).default([]),

  // Conclusão
  overall_status: z.enum(['healthy', 'attention', 'high_risk', 'critical']).nullable().default(null),
  recommendation: z.enum(['maintain_routine', 'reassess_soon', 'corrective_management', 'refer_to_technician']).nullable().default(null),
  next_inspection_days: z.number().nullable().default(null),
  final_summary: z.string().default(''),
  generate_alert: z.boolean().default(false),
  notify_technician: z.boolean().default(false),
  mark_priority: z.boolean().default(false),
});

// ─── Inspection schemas ───────────────────────────────────────────────────────

export const InspectionCreateSchema = z.object({
  hive_local_id: z.string().uuid('ID da caixa inválido'),
  inspected_at: z.string(),
  inspector_name: z.string().max(150).default(''),
  checklist: InspectionChecklistSchema.default({}),
  weight_kg: z.number().positive().nullable().default(null),
  temperature_c: z.number().nullable().default(null),
  humidity_pct: z.number().min(0).max(100).nullable().default(null),
  precipitation_mm: z.number().min(0).nullable().default(null),
  sky_condition: z.enum(['sunny', 'partly_cloudy', 'cloudy']).nullable().default(null),
  notes: z.string().default(''),
  photos: z.array(z.string()).default([]),
  audio_notes: z.array(z.string()).default([]),
  next_inspection_due: z.string().nullable().default(null),
});

export const InspectionUpdateSchema = InspectionCreateSchema.partial().omit({ hive_local_id: true });

export type InspectionCreateInput = z.infer<typeof InspectionCreateSchema>;
export type InspectionUpdateInput = z.infer<typeof InspectionUpdateSchema>;
