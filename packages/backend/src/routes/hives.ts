import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../db/connection';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { HiveCreateSchema, HiveUpdateSchema } from '@bee-forest/shared';
import type { Request } from 'express';

const router = Router();

function hiveScopeClause(req: Request, tableAlias = 'h'): { clause: string; params: unknown[] } {
  const role = req.user!.role;
  if (role === 'responsavel') {
    const ids = req.user!.apiary_local_ids;
    if (ids.length === 0) return { clause: 'AND false', params: [] };
    return { clause: `AND ${tableAlias}.apiary_local_id = ANY($1::varchar[])`, params: [ids] };
  }
  if (role === 'tratador') {
    const ids = req.user!.hive_local_ids;
    if (ids.length === 0) return { clause: 'AND false', params: [] };
    return { clause: `AND ${tableAlias}.local_id = ANY($1::varchar[])`, params: [ids] };
  }
  return { clause: '', params: [] };
}

router.get('/', async (req, res, next) => {
  try {
    const { apiary_local_id } = req.query;
    const { clause, params } = hiveScopeClause(req);

    let sql: string;
    let sqlParams: unknown[];

    if (apiary_local_id) {
      if (params.length > 0) {
        sql = `SELECT h.*, s.name as species_name FROM hives h LEFT JOIN species s ON h.species_id = s.server_id WHERE h.apiary_local_id = $${params.length + 1} AND h.deleted_at IS NULL ${clause} ORDER BY h.code`;
        sqlParams = [...params, apiary_local_id];
      } else {
        sql = `SELECT h.*, s.name as species_name FROM hives h LEFT JOIN species s ON h.species_id = s.server_id WHERE h.apiary_local_id = $1 AND h.deleted_at IS NULL ORDER BY h.code`;
        sqlParams = [apiary_local_id];
      }
    } else {
      sql = `SELECT h.*, s.name as species_name FROM hives h LEFT JOIN species s ON h.species_id = s.server_id WHERE h.deleted_at IS NULL ${clause} ORDER BY h.code`;
      sqlParams = params;
    }

    const rows = await query(sql, sqlParams);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:local_id', async (req, res, next) => {
  try {
    const row = await queryOne<Record<string, unknown>>(
      'SELECT h.*, s.name as species_name FROM hives h LEFT JOIN species s ON h.species_id = s.server_id WHERE h.local_id = $1 AND h.deleted_at IS NULL',
      [req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Colmeia não encontrada' }); return; }

    const role = req.user!.role;
    if (role === 'responsavel' && !req.user!.apiary_local_ids.includes(row.apiary_local_id as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }
    if (role === 'tratador' && !req.user!.hive_local_ids.includes(req.params.local_id)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }
    res.json(row);
  } catch (err) { next(err); }
});

router.post('/', requireRole('socio', 'responsavel'), validate(HiveCreateSchema), async (req, res, next) => {
  try {
    const local_id = uuidv4();
    const { apiary_local_id, species_local_id, code, status, installation_date, box_type, notes } = req.body;
    const apiary = await queryOne<{ server_id: number }>('SELECT server_id FROM apiaries WHERE local_id = $1', [apiary_local_id]);
    const species = species_local_id ? await queryOne<{ server_id: number }>('SELECT server_id FROM species WHERE local_id = $1', [species_local_id]) : null;
    const row = await queryOne(
      `INSERT INTO hives (local_id,apiary_id,apiary_local_id,species_id,species_local_id,code,status,installation_date,box_type,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [local_id, apiary?.server_id ?? null, apiary_local_id, species?.server_id ?? null, species_local_id, code, status, installation_date, box_type, notes]
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.put('/:local_id', requireRole('socio', 'responsavel'), validate(HiveUpdateSchema), async (req, res, next) => {
  try {
    const { species_local_id, code, status, installation_date, box_type, notes } = req.body;
    const species = species_local_id ? await queryOne<{ server_id: number }>('SELECT server_id FROM species WHERE local_id = $1', [species_local_id]) : undefined;
    const row = await queryOne(
      `UPDATE hives SET
        species_id = COALESCE($1, species_id), species_local_id = COALESCE($2, species_local_id),
        code = COALESCE($3, code), status = COALESCE($4, status),
        installation_date = COALESCE($5, installation_date), box_type = COALESCE($6, box_type),
        notes = COALESCE($7, notes)
       WHERE local_id = $8 AND deleted_at IS NULL RETURNING *`,
      [species?.server_id ?? null, species_local_id, code, status, installation_date, box_type, notes, req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Colmeia não encontrada' }); return; }
    res.json(row);
  } catch (err) { next(err); }
});

router.delete('/:local_id', requireRole('socio', 'responsavel'), async (req, res, next) => {
  try {
    const row = await queryOne(
      'UPDATE hives SET deleted_at = NOW() WHERE local_id = $1 AND deleted_at IS NULL RETURNING local_id',
      [req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Colmeia não encontrada' }); return; }
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
