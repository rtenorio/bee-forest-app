import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../db/connection';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { FeedingCreateSchema, FeedingUpdateSchema } from '../shared';

const router = Router();

// Tratador não registra alimentações (apenas inspeções)
router.use(requireRole('socio', 'responsavel'));

router.get('/', async (req, res, next) => {
  try {
    const { hive_local_id } = req.query;
    if (hive_local_id) {
      const rows = await query(
        'SELECT * FROM feedings WHERE hive_local_id = $1 AND deleted_at IS NULL ORDER BY fed_at DESC',
        [hive_local_id]
      );
      res.json(rows);
    } else if (req.user!.role === 'responsavel') {
      const ids = req.user!.apiary_local_ids;
      if (ids.length === 0) { res.json([]); return; }
      const hives = await query<{ local_id: string }>(
        'SELECT local_id FROM hives WHERE apiary_local_id = ANY($1::varchar[]) AND deleted_at IS NULL', [ids]
      );
      const hiveIds = hives.map((h) => h.local_id);
      if (hiveIds.length === 0) { res.json([]); return; }
      const rows = await query(
        'SELECT * FROM feedings WHERE hive_local_id = ANY($1::varchar[]) AND deleted_at IS NULL ORDER BY fed_at DESC LIMIT 200',
        [hiveIds]
      );
      res.json(rows);
    } else {
      const rows = await query('SELECT * FROM feedings WHERE deleted_at IS NULL ORDER BY fed_at DESC LIMIT 200');
      res.json(rows);
    }
  } catch (err) { next(err); }
});

router.get('/:local_id', async (req, res, next) => {
  try {
    const row = await queryOne('SELECT * FROM feedings WHERE local_id = $1 AND deleted_at IS NULL', [req.params.local_id]);
    if (!row) { res.status(404).json({ error: 'Alimentação não encontrada' }); return; }
    res.json(row);
  } catch (err) { next(err); }
});

router.post('/', validate(FeedingCreateSchema), async (req, res, next) => {
  try {
    const local_id = uuidv4();
    const { hive_local_id, feed_type, quantity_ml, fed_at, notes } = req.body;
    const hive = await queryOne<{ server_id: number }>('SELECT server_id FROM hives WHERE local_id = $1', [hive_local_id]);
    const row = await queryOne(
      'INSERT INTO feedings (local_id,hive_id,hive_local_id,feed_type,quantity_ml,fed_at,notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [local_id, hive?.server_id ?? null, hive_local_id, feed_type, quantity_ml, fed_at, notes]
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.put('/:local_id', validate(FeedingUpdateSchema), async (req, res, next) => {
  try {
    const { feed_type, quantity_ml, fed_at, notes } = req.body;
    const row = await queryOne(
      `UPDATE feedings SET feed_type = COALESCE($1, feed_type), quantity_ml = COALESCE($2, quantity_ml),
        fed_at = COALESCE($3, fed_at), notes = COALESCE($4, notes)
       WHERE local_id = $5 AND deleted_at IS NULL RETURNING *`,
      [feed_type, quantity_ml, fed_at, notes, req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Alimentação não encontrada' }); return; }
    res.json(row);
  } catch (err) { next(err); }
});

router.delete('/:local_id', async (req, res, next) => {
  try {
    const row = await queryOne(
      'UPDATE feedings SET deleted_at = NOW() WHERE local_id = $1 AND deleted_at IS NULL RETURNING local_id',
      [req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Alimentação não encontrada' }); return; }
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
