import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

export const RoleEnum = z.enum(['master_admin', 'socio', 'responsavel', 'tratador']);

export const CreateUserSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(150),
  email: z.string().email('E-mail inválido'),
  phone: z.string().max(30).optional(),
  role: RoleEnum,
  apiary_local_ids: z.array(z.string().uuid()).default([]),
  hive_local_ids: z.array(z.string().uuid()).default([]),
  observations: z.string().max(1000).optional(),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  observations: z.string().max(1000).optional(),
  apiary_local_ids: z.array(z.string().uuid()).optional(),
  hive_local_ids: z.array(z.string().uuid()).optional(),
});

export const ChangeRoleSchema = z.object({
  role: RoleEnum,
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ChangeRoleInput = z.infer<typeof ChangeRoleSchema>;
