import { z } from 'zod';

export const ProductionCreateSchema = z.object({
  hive_local_id: z.string().uuid('ID da colmeia inválido'),
  product_type: z.enum(['honey', 'propolis', 'pollen', 'wax']),
  quantity_g: z.number().positive('Quantidade deve ser positiva'),
  harvested_at: z.string(),
  quality_grade: z.enum(['A', 'B', 'C']).nullable().default(null),
  notes: z.string().default(''),
});

export const ProductionUpdateSchema = ProductionCreateSchema.partial().omit({ hive_local_id: true });

export type ProductionCreateInput = z.infer<typeof ProductionCreateSchema>;
export type ProductionUpdateInput = z.infer<typeof ProductionUpdateSchema>;
