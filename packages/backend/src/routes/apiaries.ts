import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../db/connection';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { ApiaryCreateSchema, ApiaryUpdateSchema } from '../shared';
import type { Request } from 'express';

const router = Router();

function scopeClause(req: Request): { clause: string; params: unknown[] } {
  if (req.user!.role === 'responsavel') {
    const ids = req.user!.apiary_local_ids;
    if (ids.length === 0) return { clause: 'AND false', params: [] };
    return { clause: 'AND local_id = ANY($1::varchar[])', params: [ids] };
  }
  return { clause: '', params: [] };
}

router.get('/', async (req, res, next) => {
  try {
    if (req.user!.role === 'tratador') { res.status(403).json({ error: 'Sem permissão' }); return; }
    const { clause, params } = scopeClause(req);
    const rows = await query(
      `SELECT * FROM apiaries WHERE deleted_at IS NULL ${clause} ORDER BY name`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:local_id', async (req, res, next) => {
  try {
    if (req.user!.role === 'tratador') { res.status(403).json({ error: 'Sem permissão' }); return; }
    const row = await queryOne('SELECT * FROM apiaries WHERE local_id = $1 AND deleted_at IS NULL', [req.params.local_id]);
    if (!row) { res.status(404).json({ error: 'Meliponário não encontrado' }); return; }
    if (req.user!.role === 'responsavel' && !req.user!.apiary_local_ids.includes(req.params.local_id as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }
    res.json(row);
  } catch (err) { next(err); }
});

router.post('/', requireRole('socio', 'responsavel'), validate(ApiaryCreateSchema), async (req, res, next) => {
  try {
    const local_id = uuidv4();
    const { name, location, latitude, longitude, owner_name, notes } = req.body;
    const row = await queryOne(
      'INSERT INTO apiaries (local_id,name,location,latitude,longitude,owner_name,notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [local_id, name, location, latitude, longitude, owner_name, notes]
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.put('/:local_id', requireRole('socio', 'responsavel'), validate(ApiaryUpdateSchema), async (req, res, next) => {
  try {
    if (req.user!.role === 'responsavel' && !req.user!.apiary_local_ids.includes(req.params.local_id as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }
    const { name, location, latitude, longitude, owner_name, notes } = req.body;
    const row = await queryOne(
      `UPDATE apiaries SET
        name = COALESCE($1, name), location = COALESCE($2, location),
        latitude = COALESCE($3, latitude), longitude = COALESCE($4, longitude),
        owner_name = COALESCE($5, owner_name), notes = COALESCE($6, notes)
       WHERE local_id = $7 AND deleted_at IS NULL RETURNING *`,
      [name, location, latitude, longitude, owner_name, notes, req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Meliponário não encontrado' }); return; }
    res.json(row);
  } catch (err) { next(err); }
});

router.patch('/:local_id/status', requireRole('socio'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status || !['active', 'inactive'].includes(status)) {
      res.status(400).json({ error: 'status deve ser "active" ou "inactive"' }); return;
    }
    const row = await queryOne(
      'UPDATE apiaries SET status = $1, updated_at = NOW() WHERE local_id = $2 AND deleted_at IS NULL RETURNING *',
      [status, req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Meliponário não encontrado' }); return; }
    res.json(row);
  } catch (err) { next(err); }
});

router.delete('/:local_id', requireRole('socio'), async (req, res, next) => {
  try {
    const row = await queryOne(
      'UPDATE apiaries SET deleted_at = NOW() WHERE local_id = $1 AND deleted_at IS NULL RETURNING local_id',
      [req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Meliponário não encontrado' }); return; }
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
