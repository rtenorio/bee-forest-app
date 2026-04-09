import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../db/connection';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { auditLog } from '../middleware/auditLog';
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

/**
 * @openapi
 * /api/apiaries:
 *   get:
 *     tags: [apiaries]
 *     summary: Listar meliponários
 *     description: Retorna todos os meliponários acessíveis ao usuário. Responsáveis veem apenas os seus; sócio/master veem todos. Tratadores não têm acesso.
 *     responses:
 *       200:
 *         description: Lista de meliponários
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Apiary'
 *       403:
 *         description: Sem permissão (tratador)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @openapi
 * /api/apiaries/{local_id}:
 *   get:
 *     tags: [apiaries]
 *     summary: Detalhe de um meliponário
 *     parameters:
 *       - in: path
 *         name: local_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID do meliponário
 *     responses:
 *       200:
 *         description: Meliponário encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Apiary'
 *       403:
 *         description: Sem permissão
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @openapi
 * /api/apiaries:
 *   post:
 *     tags: [apiaries]
 *     summary: Criar meliponário
 *     description: Cria um novo meliponário. Requer papel sócio ou responsável.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, location]
 *             properties:
 *               name:       { type: string, example: "Meliponário Serra Verde" }
 *               location:   { type: string, example: "Fazenda Boa Vista" }
 *               latitude:   { type: number, nullable: true }
 *               longitude:  { type: number, nullable: true }
 *               owner_name: { type: string, nullable: true }
 *               notes:      { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Meliponário criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Apiary'
 *       403:
 *         description: Sem permissão
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

router.put('/:local_id',
  requireRole('socio', 'responsavel'),
  validate(ApiaryUpdateSchema),
  auditLog('UPDATE', 'apiary', (req, body: any) => ({
    resource_id: req.params.local_id as string,
    resource_label: body?.name ?? req.body.name,
    payload: { name: req.body.name, location: req.body.location },
  })),
  async (req, res, next) => {
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
