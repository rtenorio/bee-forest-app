import { z } from 'zod';

export const SpeciesCreateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  scientific_name: z.string().max(150).default(''),
  description: z.string().default(''),
});

export const SpeciesUpdateSchema = SpeciesCreateSchema.partial();

export type SpeciesCreateInput = z.infer<typeof SpeciesCreateSchema>;
export type SpeciesUpdateInput = z.infer<typeof SpeciesUpdateSchema>;
