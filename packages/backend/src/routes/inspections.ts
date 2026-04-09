import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, query, queryOne } from '../db/connection';
import type { PoolClient } from 'pg';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { checkResourceOwnership } from '../middleware/ownership';
import { auditLog } from '../middleware/auditLog';
import { InspectionCreateSchema, InspectionUpdateSchema } from '../shared';
import type { Request } from 'express';

const router = Router();

async function resolveHiveScope(req: Request): Promise<string[] | null> {
  const role = req.user!.role;
  if (role === 'socio' || role === 'master_admin' || role === 'orientador') return null;
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

/**
 * @openapi
 * /api/inspections:
 *   get:
 *     tags: [inspections]
 *     summary: Listar inspeções
 *     description: Retorna inspeções filtradas pelo escopo do usuário. Aceita filtro por colmeia.
 *     parameters:
 *       - in: query
 *         name: hive_local_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por colmeia específica
 *     responses:
 *       200:
 *         description: Lista de inspeções
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Inspection'
 */
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
    } else if (scope !== null) {
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
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/inspections/{local_id}:
 *   get:
 *     tags: [inspections]
 *     summary: Detalhe de uma inspeção
 *     parameters:
 *       - in: path
 *         name: local_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Inspeção encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Inspection'
 *       403:
 *         description: Sem permissão
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:local_id', async (req, res, next) => {
  try {
    const row = await queryOne<Record<string, unknown>>(
      'SELECT * FROM inspections WHERE local_id = $1 AND deleted_at IS NULL',
      [req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Inspeção não encontrada' }); return; }
    const scope = await resolveHiveScope(req);
    if (scope !== null && !scope.includes(row.hive_local_id as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }
    res.json(row);
  } catch (err) { next(err); }
});

// Helpers para manter inspection_tasks sincronizado
async function upsertTasks(
  client: PoolClient,
  inspection_local_id: string,
  tasks: Array<{ label: string; custom_text?: string; due_date?: string | null; assignee_name?: string; priority?: string }>
) {
  await client.query('DELETE FROM inspection_tasks WHERE inspection_local_id = $1', [inspection_local_id]);
  for (const t of tasks) {
    await client.query(
      `INSERT INTO inspection_tasks
         (inspection_local_id, task_label, custom_text, due_date, assignee_name, priority)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        inspection_local_id,
        t.label,
        t.custom_text ?? '',
        t.due_date ?? null,
        t.assignee_name ?? '',
        t.priority ?? 'normal',
      ]
    );
  }
}

/**
 * @openapi
 * /api/inspections:
 *   post:
 *     tags: [inspections]
 *     summary: Criar inspeção
 *     description: Registra uma nova inspeção de colmeia com checklist completo e dados climáticos opcionais.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hive_local_id, inspected_at, inspector_name, checklist]
 *             properties:
 *               hive_local_id:        { type: string, format: uuid }
 *               inspected_at:         { type: string, format: date-time }
 *               inspector_name:       { type: string }
 *               checklist:            { type: object, description: "Checklist completo da inspeção" }
 *               weight_kg:            { type: number, nullable: true }
 *               temperature_c:        { type: number, nullable: true }
 *               humidity_pct:         { type: number, nullable: true }
 *               precipitation_mm:     { type: number, nullable: true }
 *               sky_condition:        { type: string, nullable: true }
 *               notes:                { type: string, nullable: true }
 *               next_inspection_due:  { type: string, format: date, nullable: true }
 *               copied_from_previous: { type: boolean, nullable: true }
 *     responses:
 *       201:
 *         description: Inspeção criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Inspection'
 *       403:
 *         description: Sem permissão
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/',
  validate(InspectionCreateSchema),
  auditLog('CREATE', 'inspection', (req, body: any) => ({
    resource_id: body?.local_id,
    resource_label: `Inspeção em ${req.body.hive_local_id}`,
    payload: { hive_local_id: req.body.hive_local_id, inspected_at: req.body.inspected_at, inspector_name: req.body.inspector_name },
  })),
  async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (req.user!.role === 'tratador' && !req.user!.hive_local_ids.includes(req.body.hive_local_id)) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'Caixa de abelha não atribuída a este tratador' }); return;
    }

    const local_id = uuidv4();
    const {
      hive_local_id, inspected_at, inspector_name, checklist,
      weight_kg, temperature_c, humidity_pct, precipitation_mm, sky_condition,
      notes, photos, audio_notes, next_inspection_due, copied_from_previous,
    } = req.body;

    const hive = await client.query(
      'SELECT server_id FROM hives WHERE local_id = $1', [hive_local_id]
    );

    const row = await client.query(
      `INSERT INTO inspections (
         local_id, hive_id, hive_local_id, inspected_at, inspector_name, checklist,
         weight_kg, temperature_c, humidity_pct, precipitation_mm, sky_condition,
         notes, photos, audio_notes, next_inspection_due, tasks, copied_from_previous
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        local_id, hive.rows[0]?.server_id ?? null, hive_local_id,
        inspected_at, inspector_name, JSON.stringify(checklist),
        weight_kg, temperature_c, humidity_pct, precipitation_mm, sky_condition,
        notes, photos, audio_notes ?? [], next_inspection_due,
        JSON.stringify(checklist.tasks ?? []),
        copied_from_previous ?? false,
      ]
    );

    // Mantém tabela normalizada de tarefas
    if (checklist.tasks?.length > 0) {
      await upsertTasks(client, local_id, checklist.tasks);
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

router.put('/:local_id',
  requireRole('socio', 'responsavel'),
  checkResourceOwnership('inspection'),
  validate(InspectionUpdateSchema),
  auditLog('UPDATE', 'inspection', (req) => ({
    resource_id: req.params.local_id as string,
    resource_label: `Inspeção ${(req.params.local_id as string).slice(0, 8)}`,
    payload: { inspected_at: req.body.inspected_at, inspector_name: req.body.inspector_name },
  })),
  async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      inspected_at, inspector_name, checklist,
      weight_kg, temperature_c, humidity_pct, precipitation_mm, sky_condition,
      notes, photos, audio_notes, next_inspection_due,
    } = req.body;

    const row = await client.query(
      `UPDATE inspections SET
         inspected_at       = COALESCE($1,  inspected_at),
         inspector_name     = COALESCE($2,  inspector_name),
         checklist          = COALESCE($3,  checklist),
         weight_kg          = COALESCE($4,  weight_kg),
         temperature_c      = COALESCE($5,  temperature_c),
         humidity_pct       = COALESCE($6,  humidity_pct),
         precipitation_mm   = COALESCE($7,  precipitation_mm),
         sky_condition      = COALESCE($8,  sky_condition),
         notes              = COALESCE($9,  notes),
         photos             = COALESCE($10, photos),
         audio_notes        = COALESCE($11, audio_notes),
         next_inspection_due = COALESCE($12, next_inspection_due),
         tasks              = COALESCE($13, tasks)
       WHERE local_id = $14 AND deleted_at IS NULL
       RETURNING *`,
      [
        inspected_at, inspector_name,
        checklist ? JSON.stringify(checklist) : null,
        weight_kg, temperature_c, humidity_pct, precipitation_mm, sky_condition,
        notes, photos, audio_notes ?? null, next_inspection_due,
        checklist?.tasks ? JSON.stringify(checklist.tasks) : null,
        req.params.local_id,
      ]
    );

    if (!row.rows[0]) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Inspeção não encontrada' }); return;
    }

    if (checklist?.tasks) {
      await upsertTasks(client, req.params.local_id as string, checklist.tasks);
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

router.delete('/:local_id',
  requireRole('socio', 'responsavel'),
  checkResourceOwnership('inspection'),
  auditLog('DELETE', 'inspection', (req) => ({
    resource_id: req.params.local_id as string,
  })),
  async (req, res, next) => {
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
