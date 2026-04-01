import { z } from 'zod';

export const ApiaryCreateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(150),
  location: z.string().max(255).default(''),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
  owner_name: z.string().max(150).default(''),
  notes: z.string().default(''),
});

export const ApiaryUpdateSchema = ApiaryCreateSchema.partial();

export type ApiaryCreateInput = z.infer<typeof ApiaryCreateSchema>;
export type ApiaryUpdateInput = z.infer<typeof ApiaryUpdateSchema>;
