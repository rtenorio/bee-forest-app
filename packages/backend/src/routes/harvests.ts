import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, query, queryOne } from '../db/connection';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { HarvestCreateSchema, HarvestUpdateSchema } from '@bee-forest/shared';

const router = Router();

// Tratador não tem acesso a colheitas
router.use(requireRole('socio', 'responsavel'));

// Escopa os apiary_local_ids acessíveis ao usuário
function accessibleApiaryIds(req: Parameters<typeof requireRole>[0] extends never ? never : import('express').Request): string[] | null {
  const user = (req as import('express').Request).user!;
  if (user.role === 'socio') return null;
  return user.apiary_local_ids;
}

router.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const { apiary_local_id } = req.query;

    let rows;
    if (apiary_local_id) {
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

router.get('/:local_id', async (req, res, next) => {
  try {
    const row = await queryOne(
      'SELECT * FROM harvests WHERE local_id = $1 AND deleted_at IS NULL',
      [req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Colheita não encontrada' }); return; }
    res.json(row);
  } catch (err) { next(err); }
});

router.post('/', validate(HarvestCreateSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const local_id = uuidv4();
    const {
      apiary_local_id, harvested_at, responsible_name, hive_local_ids,
      honey_type, total_volume_ml, total_weight_kg, humidity_pct, brix,
      visual_aspect, bubbles, paper_test, viscosity,
      syrup_provided, pollen_ball_provided, wax_provided, notes,
    } = req.body;

    const apiary = await client.query(
      'SELECT server_id FROM apiaries WHERE local_id = $1',
      [apiary_local_id]
    );

    const row = await client.query(
      `INSERT INTO harvests (
        local_id, apiary_id, apiary_local_id, harvested_at, responsible_name,
        hive_local_ids, honey_type, total_volume_ml, total_weight_kg,
        humidity_pct, brix, visual_aspect, bubbles, paper_test, viscosity,
        syrup_provided, pollen_ball_provided, wax_provided, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING *`,
      [
        local_id, apiary.rows[0]?.server_id ?? null, apiary_local_id, harvested_at, responsible_name,
        hive_local_ids, honey_type, total_volume_ml, total_weight_kg,
        humidity_pct, brix, visual_aspect, bubbles, paper_test, viscosity,
        syrup_provided, pollen_ball_provided, wax_provided, notes,
      ]
    );

    // Popula harvest_hives normalizado
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

router.put('/:local_id', validate(HarvestUpdateSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      harvested_at, responsible_name, hive_local_ids,
      honey_type, total_volume_ml, total_weight_kg, humidity_pct, brix,
      visual_aspect, bubbles, paper_test, viscosity,
      syrup_provided, pollen_ball_provided, wax_provided, notes,
    } = req.body;

    const row = await client.query(
      `UPDATE harvests SET
        harvested_at         = COALESCE($1, harvested_at),
        responsible_name     = COALESCE($2, responsible_name),
        hive_local_ids       = COALESCE($3, hive_local_ids),
        honey_type           = COALESCE($4, honey_type),
        total_volume_ml      = COALESCE($5, total_volume_ml),
        total_weight_kg      = COALESCE($6, total_weight_kg),
        humidity_pct         = COALESCE($7, humidity_pct),
        brix                 = COALESCE($8, brix),
        visual_aspect        = COALESCE($9, visual_aspect),
        bubbles              = COALESCE($10, bubbles),
        paper_test           = COALESCE($11, paper_test),
        viscosity            = COALESCE($12, viscosity),
        syrup_provided       = COALESCE($13, syrup_provided),
        pollen_ball_provided = COALESCE($14, pollen_ball_provided),
        wax_provided         = COALESCE($15, wax_provided),
        notes                = COALESCE($16, notes)
       WHERE local_id = $17 AND deleted_at IS NULL
       RETURNING *`,
      [
        harvested_at, responsible_name, hive_local_ids ?? null,
        honey_type, total_volume_ml, total_weight_kg, humidity_pct, brix,
        visual_aspect, bubbles, paper_test, viscosity,
        syrup_provided, pollen_ball_provided, wax_provided, notes,
        req.params.local_id,
      ]
    );

    if (!row.rows[0]) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Colheita não encontrada' }); return; }

    // Re-sincroniza harvest_hives se hive_local_ids foi atualizado
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

router.delete('/:local_id', async (req, res, next) => {
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
