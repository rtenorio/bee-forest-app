export type UserRole = 'master_admin' | 'socio' | 'orientador' | 'responsavel' | 'tratador';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  apiary_local_ids: string[]; // Responsável/Orientador: apiários atribuídos
  hive_local_ids: string[];   // Tratador: colmeias atribuídas
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  master_admin: 'Master Admin',
  socio: 'Sócio',
  orientador: 'Orientador Técnico',
  responsavel: 'Responsável',
  tratador: 'Tratador',
};

/** Rank numérico para comparações hierárquicas */
export const ROLE_RANK: Record<UserRole, number> = {
  tratador: 1,
  responsavel: 2,
  orientador: 2,
  socio: 3,
  master_admin: 4,
};

/** Retorna os perfis que o ator pode criar */
export function creatableRoles(actorRole: UserRole): UserRole[] {
  if (actorRole === 'master_admin') return ['master_admin', 'socio', 'orientador', 'responsavel', 'tratador'];
  if (actorRole === 'socio') return ['orientador', 'responsavel', 'tratador'];
  if (actorRole === 'responsavel') return ['orientador', 'tratador'];
  return [];
}

/** Retorna os perfis que o ator pode visualizar/gerenciar */
export function visibleRoles(actorRole: UserRole): UserRole[] {
  if (actorRole === 'master_admin') return ['master_admin', 'socio', 'orientador', 'responsavel', 'tratador'];
  if (actorRole === 'socio') return ['orientador', 'responsavel', 'tratador'];
  if (actorRole === 'responsavel') return ['tratador'];
  return [];
}
