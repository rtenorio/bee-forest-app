import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../db/connection';
import type { UserRole } from '../shared';

interface JwtPayload {
  sub: number;
  role: UserRole;
  email: string;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticação obrigatório' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as unknown as JwtPayload;

    // Load user from DB to get fresh data + assignments
    const users = await query<{ id: number; name: string; email: string; role: UserRole; active: boolean }>(
      'SELECT id, name, email, role, active FROM users WHERE id = $1 AND deleted_at IS NULL',
      [payload.sub]
    );

    if (!users[0] || !users[0].active) {
      res.status(401).json({ error: 'Usuário inativo ou não encontrado' });
      return;
    }

    const user = users[0];
    let apiary_local_ids: string[] = [];
    let hive_local_ids: string[] = [];

    if (user.role === 'responsavel') {
      const rows = await query<{ apiary_local_id: string }>(
        'SELECT apiary_local_id FROM user_apiary_assignments WHERE user_id = $1',
        [user.id]
      );
      apiary_local_ids = rows.map((r) => r.apiary_local_id);
    }

    if (user.role === 'tratador') {
      const rows = await query<{ hive_local_id: string }>(
        'SELECT hive_local_id FROM user_hive_assignments WHERE user_id = $1',
        [user.id]
      );
      hive_local_ids = rows.map((r) => r.hive_local_id);
    }

    req.user = { ...user, apiary_local_ids, hive_local_ids };
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}
