import { z } from 'zod';

export const FeedingCreateSchema = z.object({
  hive_local_id: z.string().uuid('ID da colmeia inválido'),
  feed_type: z.enum(['sugar_syrup', 'honey', 'pollen_sub', 'other']),
  quantity_ml: z.number().positive().nullable().default(null),
  fed_at: z.string(),
  notes: z.string().default(''),
});

export const FeedingUpdateSchema = FeedingCreateSchema.partial().omit({ hive_local_id: true });

export type FeedingCreateInput = z.infer<typeof FeedingCreateSchema>;
export type FeedingUpdateInput = z.infer<typeof FeedingUpdateSchema>;
