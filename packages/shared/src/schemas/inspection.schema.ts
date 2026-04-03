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
  // Colônia
  colony_strength: z.enum(['strong', 'medium', 'weak']).default('medium'),
  brood_present: z.boolean().default(true),
  agitation_level: z.enum(['calm', 'agitated', 'defensive']).nullable().default(null),
  ready_for_split: z.boolean().default(false),
  honey_ready_for_harvest: z.boolean().default(false),
  intruder_species: z.boolean().default(false),

  // Alimentação
  honey_stores: z.enum(['low', 'adequate', 'abundant']).default('adequate'),
  pollen_stores: z.enum(['low', 'adequate', 'abundant']).default('adequate'),
  propolis_quality: z.enum(['poor', 'normal', 'good']).nullable().default(null),
  needs_syrup: z.boolean().default(false),
  syrup_urgency: z.enum(['normal', 'urgent']).default('normal'),
  needs_pollen_ball: z.boolean().default(false),
  needs_wax: z.boolean().default(false),

  // Pragas e Sanidade
  ants: z.enum(['none', 'few', 'infested']).default('none'),
  phorid_flies: z.enum(['none', 'few', 'infested']).default('none'),
  wax_moths: z.boolean().default(false),
  beetles: z.boolean().default(false),
  caterpillar: z.boolean().default(false),
  other_pests_text: z.string().default(''),
  strange_odor: z.boolean().default(false),
  diseases_observed: z.array(z.string()).default([]),

  // Estrutura da caixa
  propolis_seal_intact: z.boolean().nullable().default(null),
  entrance_blocked: z.boolean().default(false),
  moisture_infiltration: z.boolean().default(false),
  needs_box_replacement: z.boolean().default(false),
  box_condition: z.enum(['poor', 'fair', 'good']).nullable().default(null),

  // Tarefas vinculadas
  tasks: z.array(InspectionTaskSchema).default([]),

  // Legado (aceita mas ignora em novos registros)
  population_strength: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  queen_seen: z.boolean().nullable().optional(),
  temperament: z.enum(['calm', 'nervous', 'aggressive']).nullable().optional(),
  pests_observed: z.array(z.string()).optional(),
  interventions: z.array(z.string()).optional(),
  needs_feeding: z.boolean().optional(),
  needs_space_expansion: z.boolean().optional(),
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
