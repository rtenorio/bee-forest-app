import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../db/connection';
import { validate } from '../middleware/validate';
import { SpeciesCreateSchema, SpeciesUpdateSchema } from '../shared';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const rows = await query('SELECT * FROM species WHERE deleted_at IS NULL ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:local_id', async (req, res, next) => {
  try {
    const row = await queryOne('SELECT * FROM species WHERE local_id = $1 AND deleted_at IS NULL', [req.params.local_id]);
    if (!row) { res.status(404).json({ error: 'Espécie não encontrada' }); return; }
    res.json(row);
  } catch (err) { next(err); }
});

router.post('/', validate(SpeciesCreateSchema), async (req, res, next) => {
  try {
    const local_id = uuidv4();
    const { name, scientific_name, description } = req.body;
    const row = await queryOne(
      'INSERT INTO species (local_id, name, scientific_name, description) VALUES ($1,$2,$3,$4) RETURNING *',
      [local_id, name, scientific_name, description]
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.put('/:local_id', validate(SpeciesUpdateSchema), async (req, res, next) => {
  try {
    const { name, scientific_name, description } = req.body;
    const row = await queryOne(
      `UPDATE species SET
        name = COALESCE($1, name),
        scientific_name = COALESCE($2, scientific_name),
        description = COALESCE($3, description)
       WHERE local_id = $4 AND deleted_at IS NULL RETURNING *`,
      [name, scientific_name, description, req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Espécie não encontrada' }); return; }
    res.json(row);
  } catch (err) { next(err); }
});

router.delete('/:local_id', async (req, res, next) => {
  try {
    const row = await queryOne(
      'UPDATE species SET deleted_at = NOW() WHERE local_id = $1 AND deleted_at IS NULL RETURNING local_id',
      [req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Espécie não encontrada' }); return; }
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
