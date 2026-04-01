import { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@bee-forest/shared';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Sem permissão para esta operação' });
      return;
    }
    next();
  };
}
