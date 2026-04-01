import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, pool } from '../db/connection';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { CreateUserSchema, UpdateUserSchema } from '@bee-forest/shared';

const router = Router();

// Todos os endpoints exigem perfil Sócio
router.use(requireRole('socio'));

router.get('/', async (_req, res, next) => {
  try {
    const users = await query(`
      SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
        COALESCE(
          (SELECT json_agg(apiary_local_id) FROM user_apiary_assignments WHERE user_id = u.id),
          '[]'::json
        ) AS apiary_local_ids,
        COALESCE(
          (SELECT json_agg(hive_local_id) FROM user_hive_assignments WHERE user_id = u.id),
          '[]'::json
        ) AS hive_local_ids
      FROM users u WHERE u.deleted_at IS NULL ORDER BY u.role, u.name
    `);
    res.json(users);
  } catch (err) { next(err); }
});

router.post('/', validate(CreateUserSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, email, password, role, apiary_local_ids, hive_local_ids } = req.body;
    const hash = await bcrypt.hash(password, 10);

    const user = await client.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role, active',
      [name, email.toLowerCase().trim(), hash, role]
    );
    const userId = user.rows[0].id;

    if (role === 'responsavel' && apiary_local_ids.length > 0) {
      for (const id of apiary_local_ids) {
        await client.query('INSERT INTO user_apiary_assignments (user_id, apiary_local_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, id]);
      }
    }
    if (role === 'tratador' && hive_local_ids.length > 0) {
      for (const id of hive_local_ids) {
        await client.query('INSERT INTO user_hive_assignments (user_id, hive_local_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, id]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ ...user.rows[0], apiary_local_ids, hive_local_ids });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

router.put('/:id', validate(UpdateUserSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, email, password, role, apiary_local_ids, hive_local_ids } = req.body;
    const userId = parseInt(req.params.id as string, 10);

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
    }
    if (name || email || role) {
      await client.query(
        `UPDATE users SET
          name = COALESCE($1, name),
          email = COALESCE($2, email),
          role = COALESCE($3::user_role, role)
         WHERE id = $4`,
        [name, email?.toLowerCase().trim(), role, userId]
      );
    }

    if (apiary_local_ids !== undefined) {
      await client.query('DELETE FROM user_apiary_assignments WHERE user_id = $1', [userId]);
      for (const id of apiary_local_ids) {
        await client.query('INSERT INTO user_apiary_assignments (user_id, apiary_local_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, id]);
      }
    }
    if (hive_local_ids !== undefined) {
      await client.query('DELETE FROM user_hive_assignments WHERE user_id = $1', [userId]);
      for (const id of hive_local_ids) {
        await client.query('INSERT INTO user_hive_assignments (user_id, hive_local_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, id]);
      }
    }

    await client.query('COMMIT');
    const updated = await queryOne('SELECT id, name, email, role, active FROM users WHERE id = $1', [userId]);
    res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const row = await queryOne(
      'UPDATE users SET active = NOT active WHERE id = $1 AND deleted_at IS NULL RETURNING id, name, active',
      [req.params.id]
    );
    if (!row) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
    res.json(row);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await queryOne('UPDATE users SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
