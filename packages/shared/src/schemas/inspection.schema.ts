import { z } from 'zod';

export const InspectionChecklistSchema = z.object({
  // Population
  population_strength: z.union([
    z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
  ]).default(3),
  queen_seen: z.boolean().nullable().default(null),
  brood_present: z.boolean().default(true),
  temperament: z.enum(['calm', 'nervous', 'aggressive']).nullable().default(null),
  // Honey & pollen
  honey_stores: z.enum(['low', 'adequate', 'abundant']).default('adequate'),
  pollen_stores: z.enum(['low', 'adequate', 'abundant']).default('adequate'),
  propolis_quality: z.enum(['poor', 'normal', 'good']).nullable().default(null),
  // Health
  pests_observed: z.array(z.string()).default([]),
  diseases_observed: z.array(z.string()).default([]),
  // Infrastructure
  box_condition: z.enum(['poor', 'fair', 'good']).nullable().default(null),
  // Actions
  interventions: z.array(z.string()).default([]),
  needs_feeding: z.boolean().default(false),
  needs_space_expansion: z.boolean().default(false),
});

export const InspectionCreateSchema = z.object({
  hive_local_id: z.string().uuid('ID da caixa inválido'),
  inspected_at: z.string(),
  inspector_name: z.string().max(150).default(''),
  checklist: InspectionChecklistSchema.default({}),
  weight_kg: z.number().positive().nullable().default(null),
  temperature_c: z.number().nullable().default(null),
  weather: z.enum(['sunny', 'cloudy', 'rainy']).nullable().default(null),
  notes: z.string().default(''),
  photos: z.array(z.string()).default([]),
  audio_notes: z.array(z.string()).default([]),
  next_inspection_due: z.string().nullable().default(null),
});

export const InspectionUpdateSchema = InspectionCreateSchema.partial().omit({ hive_local_id: true });

export type InspectionCreateInput = z.infer<typeof InspectionCreateSchema>;
export type InspectionUpdateInput = z.infer<typeof InspectionUpdateSchema>;
