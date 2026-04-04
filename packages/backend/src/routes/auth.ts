import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne, query } from '../db/connection';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { config } from '../config';
import { LoginSchema } from '../shared';
import type { UserRole } from '../shared';

const router = Router();

async function buildUserResponse(userId: number) {
  const user = await queryOne<{ id: number; name: string; email: string; role: UserRole }>(
    'SELECT id, name, email, role FROM users WHERE id = $1 AND deleted_at IS NULL AND active = true',
    [userId]
  );
  if (!user) return null;

  let apiary_local_ids: string[] = [];
  let hive_local_ids: string[] = [];

  if (user.role === 'responsavel') {
    const rows = await query<{ apiary_local_id: string }>(
      'SELECT apiary_local_id FROM user_apiary_assignments WHERE user_id = $1', [userId]
    );
    apiary_local_ids = rows.map((r) => r.apiary_local_id);
  }

  if (user.role === 'tratador') {
    const rows = await query<{ hive_local_id: string }>(
      'SELECT hive_local_id FROM user_hive_assignments WHERE user_id = $1', [userId]
    );
    hive_local_ids = rows.map((r) => r.hive_local_id);
  }

  return { ...user, apiary_local_ids, hive_local_ids };
}

// POST /api/auth/login
router.post('/login', validate(LoginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await queryOne<{ id: number; password_hash: string; active: boolean }>(
      'SELECT id, password_hash, active FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email.toLowerCase().trim()]
    );

    if (!user || !user.active || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: 'E-mail ou senha incorretos' });
      return;
    }

    const fullUser = await buildUserResponse(user.id);
    if (!fullUser) { res.status(401).json({ error: 'Usuário não encontrado' }); return; }

    const token = jwt.sign(
      { sub: fullUser.id, email: fullUser.email, role: fullUser.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    res.json({ token, user: fullUser });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const fullUser = await buildUserResponse(req.user!.id);
    if (!fullUser) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
    res.json(fullUser);
  } catch (err) { next(err); }
});

export default router;
