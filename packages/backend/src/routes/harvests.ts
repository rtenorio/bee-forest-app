import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, query, queryOne } from '../db/connection';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { HarvestCreateSchema, HarvestUpdateSchema } from '@bee-forest/shared';
import type { Request } from 'express';

const router = Router();

// ── Scope helpers ─────────────────────────────────────────────────────────────

/** Returns apiary_local_ids the user can access, or null for unrestricted (sócio). */
function accessibleApiaryIds(req: Request): string[] | null {
  const { role, apiary_local_ids } = req.user!;
  if (role === 'socio') return null;
  if (role === 'responsavel') return apiary_local_ids;
  return null; // tratador handled separately via hive_local_ids
}

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const { apiary_local_id } = req.query;

    let rows;

    if (user.role === 'tratador') {
      const ids = user.hive_local_ids;
      if (ids.length === 0) { res.json([]); return; }
      // Array overlap: harvest contains at least one of tratador's hives
      const base = apiary_local_id
        ? 'WHERE apiary_local_id = $1 AND hive_local_ids && $2::varchar[] AND deleted_at IS NULL'
        : 'WHERE hive_local_ids && $1::varchar[] AND deleted_at IS NULL';
      const params = apiary_local_id ? [apiary_local_id, ids] : [ids];
      rows = await query(
        `SELECT * FROM harvests ${base} ORDER BY harvested_at DESC LIMIT 200`,
        params
      );
    } else if (apiary_local_id) {
      rows = await query(
        'SELECT * FROM harvests WHERE apiary_local_id = $1 AND deleted_at IS NULL ORDER BY harvested_at DESC',
        [apiary_local_id]
      );
    } else if (user.role === 'responsavel') {
      const ids = user.apiary_local_ids;
      if (ids.length === 0) { res.json([]); return; }
      rows = await query(
        'SELECT * FROM harvests WHERE apiary_local_id = ANY($1::varchar[]) AND deleted_at IS NULL ORDER BY harvested_at DESC LIMIT 200',
        [ids]
      );
    } else {
      rows = await query(
        'SELECT * FROM harvests WHERE deleted_at IS NULL ORDER BY harvested_at DESC LIMIT 200'
      );
    }

    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /:local_id ────────────────────────────────────────────────────────────

router.get('/:local_id', async (req, res, next) => {
  try {
    const row = await queryOne<Record<string, unknown>>(
      'SELECT * FROM harvests WHERE local_id = $1 AND deleted_at IS NULL',
      [req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Colheita não encontrada' }); return; }

    const user = req.user!;
    if (user.role === 'responsavel' && !user.apiary_local_ids.includes(row.apiary_local_id as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }
    if (user.role === 'tratador') {
      const hiveIds = (row.hive_local_ids as string[]) ?? [];
      const allowed = hiveIds.some((id) => user.hive_local_ids.includes(id));
      if (!allowed) { res.status(403).json({ error: 'Sem permissão' }); return; }
    }

    res.json(row);
  } catch (err) { next(err); }
});

// ── POST / ────────────────────────────────────────────────────────────────────

router.post('/', validate(HarvestCreateSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const user = req.user!;
    const {
      apiary_local_id, harvested_at, responsible_name,
      hive_local_ids, hive_volumes,
      honey_type, maturation_status, total_volume_ml, total_weight_kg,
      humidity_pct, brix, visual_aspect, bubbles, paper_test, viscosity,
      syrup_provided, pollen_ball_provided, wax_provided, input_notes, notes,
    } = req.body;

    // Tratador: can only create harvests for their assigned hives
    if (user.role === 'tratador') {
      const unauthorized = (hive_local_ids as string[]).filter(
        (id) => !user.hive_local_ids.includes(id)
      );
      if (unauthorized.length > 0) {
        await client.query('ROLLBACK');
        res.status(403).json({ error: 'Caixas não atribuídas a este tratador' }); return;
      }
    }

    // Auto-compute total_volume_ml from hive_volumes if not provided
    const hvMap = (hive_volumes ?? {}) as Record<string, number>;
    const computed_total = Object.values(hvMap).reduce((a: number, b: number) => a + b, 0);
    const final_total_ml = total_volume_ml ?? (computed_total > 0 ? computed_total : null);

    // Set maturation_status automatically for maturado honey on completion
    const final_maturation = maturation_status ??
      (honey_type === 'maturado' ? 'aguardando_maturacao' : null);

    const local_id = uuidv4();
    const apiary = await client.query(
      'SELECT server_id FROM apiaries WHERE local_id = $1', [apiary_local_id]
    );

    const row = await client.query(
      `INSERT INTO harvests (
         local_id, apiary_id, apiary_local_id, harvested_at, responsible_name,
         hive_local_ids, hive_volumes,
         honey_type, maturation_status, total_volume_ml, total_weight_kg,
         humidity_pct, brix, visual_aspect, bubbles, paper_test, viscosity,
         syrup_provided, pollen_ball_provided, wax_provided, input_notes, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [
        local_id, apiary.rows[0]?.server_id ?? null, apiary_local_id,
        harvested_at, responsible_name,
        hive_local_ids, JSON.stringify(hvMap),
        honey_type, final_maturation, final_total_ml, total_weight_kg,
        humidity_pct, brix, visual_aspect, bubbles, paper_test, viscosity,
        syrup_provided ?? false, pollen_ball_provided ?? false, wax_provided ?? false,
        input_notes ?? '', notes ?? '',
      ]
    );

    // Populate harvest_hives normalized table
    for (const hive_local_id of (hive_local_ids as string[])) {
      await client.query(
        'INSERT INTO harvest_hives (harvest_local_id, hive_local_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [local_id, hive_local_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(row.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ── PUT /:local_id ────────────────────────────────────────────────────────────
// Only sócio and responsável can edit

router.put('/:local_id', requireRole('socio', 'responsavel'), validate(HarvestUpdateSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      harvested_at, responsible_name, hive_local_ids, hive_volumes,
      honey_type, maturation_status, total_volume_ml, total_weight_kg,
      humidity_pct, brix, visual_aspect, bubbles, paper_test, viscosity,
      syrup_provided, pollen_ball_provided, wax_provided, input_notes, notes,
    } = req.body;

    const hvMap = hive_volumes ? JSON.stringify(hive_volumes) : null;

    const row = await client.query(
      `UPDATE harvests SET
         harvested_at         = COALESCE($1,  harvested_at),
         responsible_name     = COALESCE($2,  responsible_name),
         hive_local_ids       = COALESCE($3,  hive_local_ids),
         hive_volumes         = COALESCE($4,  hive_volumes),
         honey_type           = COALESCE($5,  honey_type),
         maturation_status    = COALESCE($6,  maturation_status),
         total_volume_ml      = COALESCE($7,  total_volume_ml),
         total_weight_kg      = COALESCE($8,  total_weight_kg),
         humidity_pct         = COALESCE($9,  humidity_pct),
         brix                 = COALESCE($10, brix),
         visual_aspect        = COALESCE($11, visual_aspect),
         bubbles              = COALESCE($12, bubbles),
         paper_test           = COALESCE($13, paper_test),
         viscosity            = COALESCE($14, viscosity),
         syrup_provided       = COALESCE($15, syrup_provided),
         pollen_ball_provided = COALESCE($16, pollen_ball_provided),
         wax_provided         = COALESCE($17, wax_provided),
         input_notes          = COALESCE($18, input_notes),
         notes                = COALESCE($19, notes)
       WHERE local_id = $20 AND deleted_at IS NULL
       RETURNING *`,
      [
        harvested_at, responsible_name, hive_local_ids ?? null, hvMap,
        honey_type, maturation_status, total_volume_ml, total_weight_kg,
        humidity_pct, brix, visual_aspect, bubbles, paper_test, viscosity,
        syrup_provided, pollen_ball_provided, wax_provided,
        input_notes, notes,
        req.params.local_id,
      ]
    );

    if (!row.rows[0]) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Colheita não encontrada' }); return;
    }

    // Re-sync harvest_hives if hive_local_ids updated
    if (hive_local_ids) {
      await client.query('DELETE FROM harvest_hives WHERE harvest_local_id = $1', [req.params.local_id]);
      for (const hive_local_id of (hive_local_ids as string[])) {
        await client.query(
          'INSERT INTO harvest_hives (harvest_local_id, hive_local_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.local_id, hive_local_id]
        );
      }
    }

    await client.query('COMMIT');
    res.json(row.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ── DELETE /:local_id ─────────────────────────────────────────────────────────

router.delete('/:local_id', requireRole('socio', 'responsavel'), async (req, res, next) => {
  try {
    const row = await queryOne(
      'UPDATE harvests SET deleted_at = NOW() WHERE local_id = $1 AND deleted_at IS NULL RETURNING local_id',
      [req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Colheita não encontrada' }); return; }
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
