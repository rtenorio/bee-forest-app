import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../db/connection';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { ProductionCreateSchema, ProductionUpdateSchema } from '../shared';

const router = Router();

// Tratador não tem acesso a produções
router.use(requireRole('socio', 'responsavel'));

async function scopeHiveIds(apiary_local_ids: string[]): Promise<string[]> {
  if (apiary_local_ids.length === 0) return [];
  const rows = await query<{ local_id: string }>(
    'SELECT local_id FROM hives WHERE apiary_local_id = ANY($1::varchar[]) AND deleted_at IS NULL',
    [apiary_local_ids]
  );
  return rows.map((r) => r.local_id);
}

router.get('/', async (req, res, next) => {
  try {
    const { hive_local_id } = req.query;
    if (hive_local_id) {
      const rows = await query(
        'SELECT * FROM productions WHERE hive_local_id = $1 AND deleted_at IS NULL ORDER BY harvested_at DESC',
        [hive_local_id]
      );
      res.json(rows);
    } else if (req.user!.role === 'responsavel') {
      const hiveIds = await scopeHiveIds(req.user!.apiary_local_ids);
      if (hiveIds.length === 0) { res.json([]); return; }
      const rows = await query(
        'SELECT * FROM productions WHERE hive_local_id = ANY($1::varchar[]) AND deleted_at IS NULL ORDER BY harvested_at DESC LIMIT 200',
        [hiveIds]
      );
      res.json(rows);
    } else {
      const rows = await query('SELECT * FROM productions WHERE deleted_at IS NULL ORDER BY harvested_at DESC LIMIT 200');
      res.json(rows);
    }
  } catch (err) { next(err); }
});

router.get('/:local_id', async (req, res, next) => {
  try {
    const row = await queryOne('SELECT * FROM productions WHERE local_id = $1 AND deleted_at IS NULL', [req.params.local_id]);
    if (!row) { res.status(404).json({ error: 'Produção não encontrada' }); return; }
    res.json(row);
  } catch (err) { next(err); }
});

router.post('/', validate(ProductionCreateSchema), async (req, res, next) => {
  try {
    const local_id = uuidv4();
    const { hive_local_id, product_type, quantity_g, harvested_at, quality_grade, notes } = req.body;
    const hive = await queryOne<{ server_id: number }>('SELECT server_id FROM hives WHERE local_id = $1', [hive_local_id]);
    const row = await queryOne(
      'INSERT INTO productions (local_id,hive_id,hive_local_id,product_type,quantity_g,harvested_at,quality_grade,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [local_id, hive?.server_id ?? null, hive_local_id, product_type, quantity_g, harvested_at, quality_grade, notes]
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.put('/:local_id', validate(ProductionUpdateSchema), async (req, res, next) => {
  try {
    const { product_type, quantity_g, harvested_at, quality_grade, notes } = req.body;
    const row = await queryOne(
      `UPDATE productions SET
        product_type = COALESCE($1, product_type), quantity_g = COALESCE($2, quantity_g),
        harvested_at = COALESCE($3, harvested_at), quality_grade = COALESCE($4, quality_grade),
        notes = COALESCE($5, notes)
       WHERE local_id = $6 AND deleted_at IS NULL RETURNING *`,
      [product_type, quantity_g, harvested_at, quality_grade, notes, req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Produção não encontrada' }); return; }
    res.json(row);
  } catch (err) { next(err); }
});

router.delete('/:local_id', async (req, res, next) => {
  try {
    const row = await queryOne(
      'UPDATE productions SET deleted_at = NOW() WHERE local_id = $1 AND deleted_at IS NULL RETURNING local_id',
      [req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Produção não encontrada' }); return; }
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
