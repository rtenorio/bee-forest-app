import { Router } from 'express';
import { query, queryOne } from '../db/connection';
import { validate } from '../middleware/validate';
import { DivisionCreateSchema, DivisionUpdateSchema } from '../shared';
import { checkResourceOwnership } from '../middleware/ownership';
import type { Division } from '@bee-forest/shared';

const router = Router();

// ── Access helper ─────────────────────────────────────────────────────────────

async function resolveAccessibleApiaryIds(req: any): Promise<string[] | null> {
  const role = req.user!.role;
  if (role === 'master_admin' || role === 'socio') return null;
  if (role === 'orientador' || role === 'responsavel') return req.user!.apiary_local_ids;
  if (role === 'tratador') {
    const hiveIds = req.user!.hive_local_ids;
    if (!hiveIds.length) return [];
    const rows = await query<{ apiary_local_id: string }>(
      'SELECT DISTINCT apiary_local_id FROM hives WHERE local_id = ANY($1::varchar[]) AND deleted_at IS NULL',
      [hiveIds]
    );
    return rows.map((r) => r.apiary_local_id);
  }
  return [];
}

const SELECT_BASE = `
  SELECT
    d.*,
    ho.code  AS hive_origin_code,
    ao.name  AS apiary_origin_name,
    hn.code  AS hive_new_code,
    ad.name  AS apiary_destination_name
  FROM hive_divisions d
  LEFT JOIN hives ho ON ho.local_id = d.hive_origin_local_id
  LEFT JOIN apiaries ao ON ao.local_id = d.apiary_origin_local_id
  LEFT JOIN hives hn ON hn.local_id = d.hive_new_local_id
  LEFT JOIN apiaries ad ON ad.local_id = d.apiary_destination_local_id
  WHERE d.deleted_at IS NULL
`;

// ── GET /api/divisions ────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const { status, apiary_local_id, hive_local_id, hive_new_local_id } = req.query as Record<string, string | undefined>;
    const accessibleApiaryIds = await resolveAccessibleApiaryIds(req);

    let sql = SELECT_BASE;
    const params: unknown[] = [];
    let p = 1;

    if (accessibleApiaryIds !== null) {
      if (accessibleApiaryIds.length === 0) { res.json([]); return; }
      sql += ` AND d.apiary_origin_local_id = ANY($${p}::varchar[])`;
      params.push(accessibleApiaryIds);
      p++;
    }

    // Tratador: only their hives
    if (req.user!.role === 'tratador') {
      sql += ` AND d.hive_origin_local_id = ANY($${p}::varchar[])`;
      params.push(req.user!.hive_local_ids);
      p++;
    }

    if (status) { sql += ` AND d.status = $${p}`; params.push(status); p++; }
    if (apiary_local_id) { sql += ` AND d.apiary_origin_local_id = $${p}`; params.push(apiary_local_id); p++; }
    if (hive_local_id) { sql += ` AND d.hive_origin_local_id = $${p}`; params.push(hive_local_id); p++; }
    if (hive_new_local_id) { sql += ` AND d.hive_new_local_id = $${p}`; params.push(hive_new_local_id); p++; }

    sql += ' ORDER BY d.identified_at DESC, d.created_at DESC';
    res.json(await query(sql, params));
  } catch (err) { next(err); }
});

// ── GET /api/divisions/:id ────────────────────────────────────────────────────

router.get('/:id', checkResourceOwnership('division'), async (req, res, next) => {
  try {
    const row = await queryOne<Division>(
      SELECT_BASE + ' AND d.local_id = $1',
      [req.params.id]
    );
    if (!row) { res.status(404).json({ error: 'Divisão não encontrada' }); return; }
    res.json(row);
  } catch (err) { next(err); }
});

// ── POST /api/divisions ───────────────────────────────────────────────────────

router.post('/', validate(DivisionCreateSchema), async (req, res, next) => {
  try {
    const { local_id, hive_origin_local_id, apiary_origin_local_id, identified_at, identified_by, notes } = req.body;

    // Ownership check: responsavel/orientador must own the origin apiary; tratador must own the origin hive
    const role = (req as any).user!.role;
    if (role === 'responsavel' || role === 'orientador') {
      if (!(req as any).user!.apiary_local_ids.includes(apiary_origin_local_id)) {
        res.status(403).json({ error: 'Sem permissão para este meliponário' }); return;
      }
    }
    if (role === 'tratador' && !(req as any).user!.hive_local_ids.includes(hive_origin_local_id)) {
      res.status(403).json({ error: 'Sem permissão para esta caixa' }); return;
    }

    // Deduplicate: skip if a pending division already exists for this hive today
    const existing = await queryOne<{ local_id: string }>(
      `SELECT local_id FROM hive_divisions
       WHERE hive_origin_local_id = $1 AND status = 'pendente' AND identified_at = $2 AND deleted_at IS NULL`,
      [hive_origin_local_id, identified_at]
    );
    if (existing) { res.status(200).json(existing); return; }

    const row = await queryOne(
      `INSERT INTO hive_divisions
         (local_id, hive_origin_local_id, apiary_origin_local_id, identified_at, identified_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [local_id, hive_origin_local_id, apiary_origin_local_id, identified_at, identified_by, notes ?? null]
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

// ── PATCH /api/divisions/:id ──────────────────────────────────────────────────

router.patch('/:id', checkResourceOwnership('division'), validate(DivisionUpdateSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await queryOne<Division>(
      'SELECT * FROM hive_divisions WHERE local_id = $1 AND deleted_at IS NULL', [id]
    );
    if (!existing) { res.status(404).json({ error: 'Divisão não encontrada' }); return; }

    const { status, hive_new_local_id, apiary_destination_local_id, divided_at, divided_by, notes } = req.body;

    const updated = await queryOne(
      `UPDATE hive_divisions SET
        status                      = COALESCE($1, status),
        hive_new_local_id           = COALESCE($2, hive_new_local_id),
        apiary_destination_local_id = COALESCE($3, apiary_destination_local_id),
        divided_at                  = COALESCE($4, divided_at),
        divided_by                  = COALESCE($5, divided_by),
        notes                       = COALESCE($6, notes)
       WHERE local_id = $7
       RETURNING *`,
      [
        status ?? null,
        hive_new_local_id ?? null,
        apiary_destination_local_id ?? null,
        divided_at ?? null,
        divided_by ?? null,
        notes ?? null,
        id,
      ]
    );
    res.json(updated);
  } catch (err) { next(err); }
});

// ── DELETE /api/divisions/:id ─────────────────────────────────────────────────

router.delete('/:id', checkResourceOwnership('division'), async (req, res, next) => {
  try {
    const role = req.user!.role;
    if (!['master_admin', 'socio', 'responsavel'].includes(role)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }
    await query('UPDATE hive_divisions SET deleted_at = NOW() WHERE local_id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
