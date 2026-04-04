import { z } from 'zod';

export const HiveStatusSchema = z.enum(['active', 'inactive', 'dead', 'transferred']);

export const HiveCreateSchema = z.object({
  apiary_local_id: z.string().uuid('ID do apiário inválido'),
  species_local_id: z.string().uuid().nullable().default(null),
  code: z.string().min(1, 'Código é obrigatório').max(50),
  status: HiveStatusSchema.default('active'),
  installation_date: z.string().nullable().default(null),
  box_type: z.string().max(50).default(''),
  modules_count: z.number().int().min(1).nullable().default(null),
  wood_type: z.string().max(50).nullable().default(null),
  wood_type_other: z.string().max(100).nullable().default(null),
  notes: z.string().default(''),
});

export const HiveUpdateSchema = HiveCreateSchema.partial().omit({ apiary_local_id: true });

export type HiveCreateInput = z.infer<typeof HiveCreateSchema>;
export type HiveUpdateInput = z.infer<typeof HiveUpdateSchema>;
