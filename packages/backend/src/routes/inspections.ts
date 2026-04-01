import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../db/connection';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { InspectionCreateSchema, InspectionUpdateSchema } from '@bee-forest/shared';
import type { Request } from 'express';

const router = Router();

async function resolveHiveScope(req: Request): Promise<string[] | null> {
  const role = req.user!.role;
  if (role === 'socio') return null; // null = sem filtro
  if (role === 'tratador') return req.user!.hive_local_ids;
  if (role === 'responsavel') {
    const ids = req.user!.apiary_local_ids;
    if (ids.length === 0) return [];
    const rows = await query<{ local_id: string }>(
      'SELECT local_id FROM hives WHERE apiary_local_id = ANY($1::varchar[]) AND deleted_at IS NULL',
      [ids]
    );
    return rows.map((r) => r.local_id);
  }
  return [];
}

router.get('/', async (req, res, next) => {
  try {
    const { hive_local_id } = req.query;
    const scope = await resolveHiveScope(req);

    if (hive_local_id) {
      if (scope !== null && !scope.includes(hive_local_id as string)) { res.json([]); return; }
      const rows = await query(
        'SELECT * FROM inspections WHERE hive_local_id = $1 AND deleted_at IS NULL ORDER BY inspected_at DESC',
        [hive_local_id]
      );
      res.json(rows);
    } else {
      if (scope !== null) {
        if (scope.length === 0) { res.json([]); return; }
        const rows = await query(
          'SELECT * FROM inspections WHERE hive_local_id = ANY($1::varchar[]) AND deleted_at IS NULL ORDER BY inspected_at DESC LIMIT 200',
          [scope]
        );
        res.json(rows);
      } else {
        const rows = await query('SELECT * FROM inspections WHERE deleted_at IS NULL ORDER BY inspected_at DESC LIMIT 200');
        res.json(rows);
      }
    }
  } catch (err) { next(err); }
});

router.get('/:local_id', async (req, res, next) => {
  try {
    const row = await queryOne<Record<string, unknown>>('SELECT * FROM inspections WHERE local_id = $1 AND deleted_at IS NULL', [req.params.local_id]);
    if (!row) { res.status(404).json({ error: 'Inspeção não encontrada' }); return; }
    const scope = await resolveHiveScope(req);
    if (scope !== null && !scope.includes(row.hive_local_id as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }
    res.json(row);
  } catch (err) { next(err); }
});

router.post('/', validate(InspectionCreateSchema), async (req, res, next) => {
  try {
    // Tratador só pode inspecionar colmeias atribuídas
    if (req.user!.role === 'tratador' && !req.user!.hive_local_ids.includes(req.body.hive_local_id)) {
      res.status(403).json({ error: 'Colmeia não atribuída a este tratador' }); return;
    }
    const local_id = uuidv4();
    const { hive_local_id, inspected_at, inspector_name, checklist, weight_kg, temperature_c, weather, notes, photos, audio_notes, next_inspection_due } = req.body;
    const hive = await queryOne<{ server_id: number }>('SELECT server_id FROM hives WHERE local_id = $1', [hive_local_id]);
    const row = await queryOne(
      `INSERT INTO inspections (local_id,hive_id,hive_local_id,inspected_at,inspector_name,checklist,weight_kg,temperature_c,weather,notes,photos,audio_notes,next_inspection_due)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [local_id, hive?.server_id ?? null, hive_local_id, inspected_at, inspector_name, JSON.stringify(checklist), weight_kg, temperature_c, weather, notes, photos, audio_notes ?? [], next_inspection_due]
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.put('/:local_id', requireRole('socio', 'responsavel'), validate(InspectionUpdateSchema), async (req, res, next) => {
  try {
    const { inspected_at, inspector_name, checklist, weight_kg, temperature_c, weather, notes, photos, audio_notes, next_inspection_due } = req.body;
    const row = await queryOne(
      `UPDATE inspections SET
        inspected_at = COALESCE($1, inspected_at), inspector_name = COALESCE($2, inspector_name),
        checklist = COALESCE($3, checklist), weight_kg = COALESCE($4, weight_kg),
        temperature_c = COALESCE($5, temperature_c), weather = COALESCE($6, weather),
        notes = COALESCE($7, notes), photos = COALESCE($8, photos),
        audio_notes = COALESCE($9, audio_notes),
        next_inspection_due = COALESCE($10, next_inspection_due)
       WHERE local_id = $11 AND deleted_at IS NULL RETURNING *`,
      [inspected_at, inspector_name, checklist ? JSON.stringify(checklist) : null, weight_kg, temperature_c, weather, notes, photos, audio_notes ?? null, next_inspection_due, req.params.local_id as string]
    );
    if (!row) { res.status(404).json({ error: 'Inspeção não encontrada' }); return; }
    res.json(row);
  } catch (err) { next(err); }
});

router.delete('/:local_id', requireRole('socio', 'responsavel'), async (req, res, next) => {
  try {
    const row = await queryOne(
      'UPDATE inspections SET deleted_at = NOW() WHERE local_id = $1 AND deleted_at IS NULL RETURNING local_id',
      [req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Inspeção não encontrada' }); return; }
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
