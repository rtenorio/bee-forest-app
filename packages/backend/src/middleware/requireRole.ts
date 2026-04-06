import { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../shared';

/**
 * Middleware RBAC — master_admin tem acesso irrestrito a todos os endpoints.
 * Passe os roles que devem ter acesso; master_admin é incluído automaticamente.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    // master_admin bypassa qualquer restrição de role
    if (req.user.role === 'master_admin') { next(); return; }
    const secondary = req.user.secondary_role;
    if (!roles.includes(req.user.role) && !(secondary && roles.includes(secondary))) {
      res.status(403).json({ error: 'Sem permissão para esta operação' });
      return;
    }
    next();
  };
}
