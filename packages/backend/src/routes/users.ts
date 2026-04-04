import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, pool } from '../db/connection';
import { validate } from '../middleware/validate';
import { CreateUserSchema, UpdateUserSchema, ChangeRoleSchema } from '../shared';
import type { UserRole } from '../shared';

const router = Router();

// ─── Hierarquia ───────────────────────────────────────────────────────────────

const ROLE_RANK: Record<string, number> = {
  tratador: 1, responsavel: 2, socio: 3, master_admin: 4,
};

function rolesVisibleTo(actorRole: string): string[] {
  if (actorRole === 'master_admin') return ['master_admin', 'socio', 'responsavel', 'tratador'];
  if (actorRole === 'socio') return ['responsavel', 'tratador'];
  if (actorRole === 'responsavel') return ['tratador'];
  return [];
}

function canCreate(actorRole: string, targetRole: string): boolean {
  if (actorRole === 'master_admin') return true;
  if (actorRole === 'socio') return targetRole === 'responsavel';
  if (actorRole === 'responsavel') return targetRole === 'tratador';
  return false;
}

function canManage(actorRole: string, targetRole: string): boolean {
  return rolesVisibleTo(actorRole).includes(targetRole);
}

function generatePassword(): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const specials = '@#!';
  const all = upper + lower + digits + specials;
  const rand = (set: string) => set[Math.floor(Math.random() * set.length)];
  const base = Array.from({ length: 8 }, () => rand(all)).join('');
  return rand(upper) + rand(lower) + rand(digits) + rand(specials) + base;
}

async function logAudit(
  actorId: number,
  action: string,
  targetId: number | null,
  metadata: Record<string, unknown> = {}
) {
  await queryOne(
    `INSERT INTO audit_logs (actor_user_id, action, target_user_id, metadata)
     VALUES ($1, $2, $3, $4)`,
    [actorId, action, targetId, JSON.stringify(metadata)]
  );
}

async function fetchUserWithAssignments(userId: number) {
  const user = await queryOne<Record<string, unknown>>(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.active,
            u.observations, u.created_by, u.created_at,
            cb.name AS created_by_name
     FROM users u
     LEFT JOIN users cb ON cb.id = u.created_by
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [userId]
  );
  if (!user) return null;

  const apiaryRows = await query<{ apiary_local_id: string }>(
    'SELECT apiary_local_id FROM user_apiary_assignments WHERE user_id = $1', [userId]
  );
  const hiveRows = await query<{ hive_local_id: string }>(
    'SELECT hive_local_id FROM user_hive_assignments WHERE user_id = $1', [userId]
  );

  return {
    ...user,
    apiary_local_ids: apiaryRows.map((r) => r.apiary_local_id),
    hive_local_ids: hiveRows.map((r) => r.hive_local_id),
  } as Record<string, unknown> & { role: string; apiary_local_ids: string[]; hive_local_ids: string[] };
}

// ─── GET /api/users ───────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const actorRole = req.user!.role;
    const visible = rolesVisibleTo(actorRole);
    if (visible.length === 0) {
      res.status(403).json({ error: 'Sem permissão para listar usuários' });
      return;
    }

    const placeholders = visible.map((_, i) => `$${i + 1}`).join(', ');
    const users = await query<Record<string, unknown>>(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.active,
              u.observations, u.created_by, u.created_at,
              cb.name AS created_by_name,
              COALESCE(
                (SELECT json_agg(apiary_local_id) FROM user_apiary_assignments WHERE user_id = u.id),
                '[]'::json
              ) AS apiary_local_ids,
              COALESCE(
                (SELECT json_agg(hive_local_id) FROM user_hive_assignments WHERE user_id = u.id),
                '[]'::json
              ) AS hive_local_ids
       FROM users u
       LEFT JOIN users cb ON cb.id = u.created_by
       WHERE u.deleted_at IS NULL AND u.role::text IN (${placeholders})
       ORDER BY u.role, u.name`,
      visible
    );

    res.json(users);
  } catch (err) { next(err); }
});

// ─── POST /api/users ──────────────────────────────────────────────────────────

router.post('/', validate(CreateUserSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const actorRole = req.user!.role;
    const { name, email, phone, role, apiary_local_ids = [], hive_local_ids = [], observations = '' } = req.body;

    if (!canCreate(actorRole, role)) {
      res.status(403).json({ error: `Perfil ${actorRole} não pode criar usuários com perfil ${role}` });
      return;
    }

    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing) {
      res.status(409).json({ error: 'E-mail já cadastrado' });
      return;
    }

    const plainPassword = generatePassword();
    const hash = await bcrypt.hash(plainPassword, 10);

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role, observations, created_by)
       VALUES ($1, $2, $3, $4, $5::user_role, $6, $7)
       RETURNING id, name, email, phone, role, active, observations, created_by, created_at`,
      [name, email.toLowerCase().trim(), phone ?? null, hash, role, observations, req.user!.id]
    );
    const newUser = result.rows[0];
    const userId = newUser.id as number;

    if (role === 'responsavel' && apiary_local_ids.length > 0) {
      for (const id of apiary_local_ids) {
        await client.query(
          'INSERT INTO user_apiary_assignments (user_id, apiary_local_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [userId, id]
        );
      }
    }
    if (role === 'tratador' && hive_local_ids.length > 0) {
      for (const id of hive_local_ids) {
        await client.query(
          'INSERT INTO user_hive_assignments (user_id, hive_local_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [userId, id]
        );
      }
    }

    await client.query('COMMIT');

    await logAudit(req.user!.id, 'user_created', userId, { role, email: newUser.email });

    res.status(201).json({
      ...newUser,
      apiary_local_ids,
      hive_local_ids,
      generated_password: plainPassword, // exibir uma vez no frontend
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// ─── GET /api/users/:id ───────────────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const actorRole = req.user!.role;
    const userId = parseInt(req.params.id as string, 10);

    const user = await fetchUserWithAssignments(userId);
    if (!user) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
    if (!canManage(actorRole, user.role as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }

    res.json(user);
  } catch (err) { next(err); }
});

// ─── PUT /api/users/:id ───────────────────────────────────────────────────────

router.put('/:id', validate(UpdateUserSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const actorRole = req.user!.role;
    const userId = parseInt(req.params.id as string, 10);
    const { name, email, phone, observations, apiary_local_ids, hive_local_ids } = req.body;

    const existing = await queryOne<{ role: string }>(
      'SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]
    );
    if (!existing) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
    if (!canManage(actorRole, existing.role)) {
      res.status(403).json({ error: 'Sem permissão para editar este usuário' }); return;
    }

    await client.query('BEGIN');

    await client.query(
      `UPDATE users SET
         name         = COALESCE($1, name),
         email        = COALESCE($2, email),
         phone        = COALESCE($3, phone),
         observations = COALESCE($4, observations)
       WHERE id = $5`,
      [name, email?.toLowerCase().trim() ?? null, phone ?? null, observations ?? null, userId]
    );

    if (apiary_local_ids !== undefined) {
      await client.query('DELETE FROM user_apiary_assignments WHERE user_id = $1', [userId]);
      for (const id of apiary_local_ids) {
        await client.query(
          'INSERT INTO user_apiary_assignments (user_id, apiary_local_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [userId, id]
        );
      }
    }
    if (hive_local_ids !== undefined) {
      await client.query('DELETE FROM user_hive_assignments WHERE user_id = $1', [userId]);
      for (const id of hive_local_ids) {
        await client.query(
          'INSERT INTO user_hive_assignments (user_id, hive_local_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [userId, id]
        );
      }
    }

    await client.query('COMMIT');
    await logAudit(req.user!.id, 'user_updated', userId, { fields: Object.keys(req.body) });

    const updated = await fetchUserWithAssignments(userId);
    res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// ─── PATCH /api/users/:id/status ─────────────────────────────────────────────

router.patch('/:id/status', async (req, res, next) => {
  try {
    const actorRole = req.user!.role;
    const userId = parseInt(req.params.id as string, 10);

    if (userId === req.user!.id) {
      res.status(403).json({ error: 'Não é permitido alterar seu próprio status' }); return;
    }

    const existing = await queryOne<{ role: string; active: boolean }>(
      'SELECT role, active FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]
    );
    if (!existing) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
    if (!canManage(actorRole, existing.role)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }

    const newActive = !existing.active;
    await queryOne('UPDATE users SET active = $1 WHERE id = $2', [newActive, userId]);
    await logAudit(req.user!.id, newActive ? 'user_activated' : 'user_deactivated', userId, {});

    res.json({ id: userId, active: newActive });
  } catch (err) { next(err); }
});

// ─── PATCH /api/users/:id/role ────────────────────────────────────────────────

router.patch('/:id/role', validate(ChangeRoleSchema), async (req, res, next) => {
  try {
    const actorRole = req.user!.role;
    const userId = parseInt(req.params.id as string, 10);
    const { role: newRole } = req.body as { role: UserRole };

    if (userId === req.user!.id) {
      res.status(403).json({ error: 'Não é permitido alterar seu próprio perfil' }); return;
    }

    const existing = await queryOne<{ role: string }>(
      'SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]
    );
    if (!existing) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
    if (!canManage(actorRole, existing.role)) {
      res.status(403).json({ error: 'Sem permissão para alterar este usuário' }); return;
    }
    if (!canCreate(actorRole, newRole)) {
      res.status(403).json({ error: `Perfil ${actorRole} não pode promover para ${newRole}` }); return;
    }

    await queryOne(
      'UPDATE users SET role = $1::user_role WHERE id = $2',
      [newRole, userId]
    );
    await logAudit(req.user!.id, 'user_role_changed', userId, {
      from: existing.role, to: newRole,
    });

    res.json({ id: userId, role: newRole });
  } catch (err) { next(err); }
});

// ─── POST /api/users/:id/apiaries ────────────────────────────────────────────

router.post('/:id/apiaries', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const actorRole = req.user!.role;
    const userId = parseInt(req.params.id as string, 10);
    const { apiary_local_ids = [], hive_local_ids = [] } = req.body as {
      apiary_local_ids?: string[];
      hive_local_ids?: string[];
    };

    const existing = await queryOne<{ role: string }>(
      'SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]
    );
    if (!existing) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
    if (!canManage(actorRole, existing.role)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }

    await client.query('BEGIN');

    if (apiary_local_ids.length > 0) {
      await client.query('DELETE FROM user_apiary_assignments WHERE user_id = $1', [userId]);
      for (const id of apiary_local_ids) {
        await client.query(
          'INSERT INTO user_apiary_assignments (user_id, apiary_local_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [userId, id]
        );
      }
    }
    if (hive_local_ids.length > 0) {
      await client.query('DELETE FROM user_hive_assignments WHERE user_id = $1', [userId]);
      for (const id of hive_local_ids) {
        await client.query(
          'INSERT INTO user_hive_assignments (user_id, hive_local_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [userId, id]
        );
      }
    }

    await client.query('COMMIT');
    await logAudit(req.user!.id, 'user_apiaries_updated', userId, {
      apiary_count: apiary_local_ids.length,
      hive_count: hive_local_ids.length,
    });

    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// ─── GET /api/users/:id/audit ─────────────────────────────────────────────────

router.get('/:id/audit', async (req, res, next) => {
  try {
    const actorRole = req.user!.role;
    const userId = parseInt(req.params.id as string, 10);

    const existing = await queryOne<{ role: string }>(
      'SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]
    );
    if (!existing) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
    if (!canManage(actorRole, existing.role)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }

    const logs = await query(
      `SELECT al.id, al.action, al.metadata, al.created_at,
              u.name AS actor_name, u.role AS actor_role
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_user_id
       WHERE al.target_user_id = $1
       ORDER BY al.created_at DESC
       LIMIT 100`,
      [userId]
    );

    res.json(logs);
  } catch (err) { next(err); }
});

export default router;
