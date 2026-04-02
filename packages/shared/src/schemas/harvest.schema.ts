import { z } from 'zod';

export const HarvestCreateSchema = z.object({
  apiary_local_id: z.string().uuid('ID do meliponário inválido'),
  harvested_at: z.string().min(1, 'Data obrigatória'),
  responsible_name: z.string().default(''),
  hive_local_ids: z.array(z.string().uuid()).min(1, 'Selecione ao menos uma caixa'),

  honey_type: z.enum(['vivo', 'maturado']),
  total_volume_ml: z.number().positive().nullable().default(null),
  total_weight_kg: z.number().positive().nullable().default(null),
  humidity_pct: z.number().min(0).max(100).nullable().default(null),
  brix: z.number().min(0).max(100).nullable().default(null),
  visual_aspect: z.enum(['clear', 'cloudy', 'crystallized']).nullable().default(null),
  bubbles: z.enum(['none', 'few', 'many']).nullable().default(null),
  paper_test: z.enum(['pass', 'fail']).nullable().default(null),
  viscosity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).nullable().default(null),

  syrup_provided: z.boolean().default(false),
  pollen_ball_provided: z.boolean().default(false),
  wax_provided: z.boolean().default(false),

  notes: z.string().default(''),
});

export const HarvestUpdateSchema = HarvestCreateSchema.partial().omit({ apiary_local_id: true });

export type HarvestCreateInput = z.infer<typeof HarvestCreateSchema>;
export type HarvestUpdateInput = z.infer<typeof HarvestUpdateSchema>;
