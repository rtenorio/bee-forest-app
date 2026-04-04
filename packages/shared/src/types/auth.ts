export type UserRole = 'master_admin' | 'socio' | 'responsavel' | 'tratador';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  apiary_local_ids: string[]; // Responsável: apiários atribuídos
  hive_local_ids: string[];   // Tratador: colmeias atribuídas
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  master_admin: 'Master Admin',
  socio: 'Sócio',
  responsavel: 'Responsável',
  tratador: 'Tratador',
};

/** Rank numérico para comparações hierárquicas */
export const ROLE_RANK: Record<UserRole, number> = {
  tratador: 1,
  responsavel: 2,
  socio: 3,
  master_admin: 4,
};

/** Retorna os perfis que o ator pode criar */
export function creatableRoles(actorRole: UserRole): UserRole[] {
  if (actorRole === 'master_admin') return ['master_admin', 'socio', 'responsavel', 'tratador'];
  if (actorRole === 'socio') return ['responsavel'];
  if (actorRole === 'responsavel') return ['tratador'];
  return [];
}

/** Retorna os perfis que o ator pode visualizar/gerenciar */
export function visibleRoles(actorRole: UserRole): UserRole[] {
  if (actorRole === 'master_admin') return ['master_admin', 'socio', 'responsavel', 'tratador'];
  if (actorRole === 'socio') return ['responsavel', 'tratador'];
  if (actorRole === 'responsavel') return ['tratador'];
  return [];
}
