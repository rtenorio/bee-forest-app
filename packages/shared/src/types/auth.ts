export type UserRole = 'socio' | 'responsavel' | 'tratador';

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
  socio: 'Sócio',
  responsavel: 'Responsável',
  tratador: 'Tratador',
};
