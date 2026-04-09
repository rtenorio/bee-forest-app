import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, pool } from '../db/connection';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { checkResourceOwnership } from '../middleware/ownership';
import { auditLog } from '../middleware/auditLog';
import { HiveCreateSchema, HiveUpdateSchema } from '../shared';
import type { Request } from 'express';

function buildQrCode(locationOrName: string, seq: number): string {
  const raw = (locationOrName || 'BEE').trim();
  const locAbbr = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, 'X');
  return `CME-${String(seq).padStart(3, '0')}-${locAbbr}`;
}

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

router.get('/:local_id/qrcode', checkResourceOwnership('hive'), async (req, res, next) => {
  try {
    const row = await queryOne<{ qr_code: string | null }>(
      'SELECT qr_code FROM hives WHERE local_id = $1 AND deleted_at IS NULL',
      [req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Caixa de abelha não encontrada' }); return; }

    const appUrl = process.env.APP_URL ?? 'https://beeforest.app';
    const url = row.qr_code ? `${appUrl}/h/${row.qr_code}` : null;
    res.json({ qr_code: row.qr_code, url });
  } catch (err) { next(err); }
});

router.get('/:local_id', async (req, res, next) => {
  try {
    const row = await queryOne<Record<string, unknown>>(
      'SELECT h.*, s.name as species_name FROM hives h LEFT JOIN species s ON h.species_id = s.server_id WHERE h.local_id = $1 AND h.deleted_at IS NULL',
      [req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Caixa de abelha não encontrada' }); return; }

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

router.post('/',
  requireRole('socio', 'responsavel'),
  validate(HiveCreateSchema),
  auditLog('CREATE', 'hive', (req, body: any) => ({
    resource_id: body?.local_id,
    resource_label: body?.qr_code ?? body?.code ?? req.body.code,
    payload: { apiary_local_id: req.body.apiary_local_id, code: req.body.code, status: req.body.status },
  })),
  async (req, res, next) => {
  try {
    const local_id = uuidv4();
    const { apiary_local_id, species_local_id, code, status, installation_date, box_type, modules_count, wood_type, wood_type_other, notes } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const apiaryRow = await client.query<{ server_id: number; location: string; name: string }>(
        'SELECT server_id, location, name FROM apiaries WHERE local_id = $1',
        [apiary_local_id]
      );
      const apiary = apiaryRow.rows[0] ?? null;

      const countRow = await client.query<{ n: number }>(
        'SELECT COUNT(*)::int AS n FROM hives WHERE apiary_local_id = $1 AND deleted_at IS NULL',
        [apiary_local_id]
      );
      const seq = (countRow.rows[0]?.n ?? 0) + 1;
      const label = apiary?.location || apiary?.name || 'BEE';
      const qr_code = buildQrCode(label, seq);

      const speciesRow = species_local_id
        ? await client.query<{ server_id: number }>('SELECT server_id FROM species WHERE local_id = $1', [species_local_id])
        : null;
      const speciesServerId = speciesRow?.rows[0]?.server_id ?? null;

      const result = await client.query(
        `INSERT INTO hives (local_id,apiary_id,apiary_local_id,species_id,species_local_id,code,status,installation_date,box_type,modules_count,wood_type,wood_type_other,notes,qr_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [local_id, apiary?.server_id ?? null, apiary_local_id, speciesServerId, species_local_id, code, status, installation_date, box_type, modules_count ?? null, wood_type ?? null, wood_type_other ?? null, notes, qr_code]
      );

      await client.query('COMMIT');
      res.status(201).json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

router.put('/:local_id',
  requireRole('socio', 'responsavel'),
  checkResourceOwnership('hive'),
  validate(HiveUpdateSchema),
  auditLog('UPDATE', 'hive', (req, body: any) => ({
    resource_id: req.params.local_id as string,
    resource_label: body?.qr_code ?? body?.code ?? req.body.code,
    payload: { code: req.body.code, status: req.body.status },
  })),
  async (req, res, next) => {
  try {
    const { species_local_id, code, status, installation_date, box_type, modules_count, wood_type, wood_type_other, notes } = req.body;
    const species = species_local_id ? await queryOne<{ server_id: number }>('SELECT server_id FROM species WHERE local_id = $1', [species_local_id]) : undefined;
    const row = await queryOne(
      `UPDATE hives SET
        species_id = COALESCE($1, species_id), species_local_id = COALESCE($2, species_local_id),
        code = COALESCE($3, code), status = COALESCE($4, status),
        installation_date = COALESCE($5, installation_date), box_type = COALESCE($6, box_type),
        modules_count = COALESCE($7, modules_count), wood_type = COALESCE($8, wood_type),
        wood_type_other = COALESCE($9, wood_type_other), notes = COALESCE($10, notes)
       WHERE local_id = $11 AND deleted_at IS NULL RETURNING *`,
      [species?.server_id ?? null, species_local_id, code, status, installation_date, box_type, modules_count ?? null, wood_type ?? null, wood_type_other ?? null, notes, req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Caixa de abelha não encontrada' }); return; }
    res.json(row);
  } catch (err) { next(err); }
});

router.delete('/:local_id',
  requireRole('socio', 'responsavel'),
  checkResourceOwnership('hive'),
  auditLog('DELETE', 'hive', (req) => ({
    resource_id: req.params.local_id as string,
  })),
  async (req, res, next) => {
  try {
    const row = await queryOne(
      'UPDATE hives SET deleted_at = NOW() WHERE local_id = $1 AND deleted_at IS NULL RETURNING local_id',
      [req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Caixa de abelha não encontrada' }); return; }
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
