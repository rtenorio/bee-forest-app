import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../db/connection';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import {
  MelgueiraCreateSchema,
  MelgueiraUpdateSchema,
  MelgueiraInstallSchema,
  MelgueiraRemoveSchema,
} from '../shared';
import type { Melgueira } from '@bee-forest/shared';

const router = Router();

const SELECT_BASE = `
  SELECT
    m.*,
    h.code  AS hive_code,
    a.name  AS apiary_name
  FROM melgueiras m
  LEFT JOIN hives h    ON h.local_id    = m.hive_local_id
  LEFT JOIN apiaries a ON a.local_id    = m.apiary_local_id
  WHERE m.deleted_at IS NULL
`;

// ── GET /api/melgueiras ───────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const { status, hive_local_id, apiary_local_id, code } = req.query as Record<string, string | undefined>;
    let sql = SELECT_BASE;
    const params: unknown[] = [];
    let p = 1;

    if (status)          { sql += ` AND m.status = $${p}`; params.push(status); p++; }
    if (hive_local_id)   { sql += ` AND m.hive_local_id = $${p}`; params.push(hive_local_id); p++; }
    if (apiary_local_id) { sql += ` AND m.apiary_local_id = $${p}`; params.push(apiary_local_id); p++; }
    if (code)            { sql += ` AND m.code = $${p}`; params.push(code); p++; }

    sql += ' ORDER BY m.code ASC';
    res.json(await query<Melgueira>(sql, params));
  } catch (err) { next(err); }
});

// ── GET /api/melgueiras/:local_id ─────────────────────────────────────────────

router.get('/:local_id', async (req, res, next) => {
  try {
    const row = await queryOne<Melgueira>(
      SELECT_BASE + ' AND m.local_id = $1',
      [req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Melgueira não encontrada' }); return; }
    res.json(row);
  } catch (err) { next(err); }
});

// ── POST /api/melgueiras ──────────────────────────────────────────────────────

router.post(
  '/',
  requireRole('master_admin', 'socio', 'responsavel'),
  validate(MelgueiraCreateSchema),
  async (req, res, next) => {
    try {
      const { local_id, code, apiary_local_id, notes } = req.body;

      const existing = await queryOne<{ local_id: string }>(
        "SELECT local_id FROM melgueiras WHERE code = $1 AND deleted_at IS NULL",
        [code]
      );
      if (existing) {
        res.status(409).json({ error: `Código "${code}" já está em uso` });
        return;
      }

      const appUrl = process.env.VITE_APP_URL ?? process.env.APP_URL ?? '';
      const qr_code_data = code;

      const row = await queryOne<Melgueira>(
        `INSERT INTO melgueiras
           (local_id, code, qr_code_data, apiary_local_id, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [local_id, code, qr_code_data, apiary_local_id ?? null, notes ?? null]
      );
      res.status(201).json(row);
    } catch (err) { next(err); }
  }
);

// ── PATCH /api/melgueiras/:local_id ──────────────────────────────────────────

router.patch(
  '/:local_id',
  requireRole('master_admin', 'socio', 'responsavel'),
  validate(MelgueiraUpdateSchema),
  async (req, res, next) => {
    try {
      const { code, status, notes, apiary_local_id } = req.body;

      if (code) {
        const conflict = await queryOne<{ local_id: string }>(
          "SELECT local_id FROM melgueiras WHERE code = $1 AND local_id != $2 AND deleted_at IS NULL",
          [code, req.params.local_id]
        );
        if (conflict) {
          res.status(409).json({ error: `Código "${code}" já está em uso por outra melgueira` });
          return;
        }
      }

      const row = await queryOne<Melgueira>(
        `UPDATE melgueiras SET
           code            = COALESCE($2, code),
           status          = COALESCE($3, status),
           notes           = COALESCE($4, notes),
           apiary_local_id = COALESCE($5, apiary_local_id)
         WHERE local_id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [req.params.local_id, code ?? null, status ?? null, notes ?? null, apiary_local_id ?? null]
      );
      if (!row) { res.status(404).json({ error: 'Melgueira não encontrada' }); return; }
      res.json(row);
    } catch (err) { next(err); }
  }
);

// ── PATCH /api/melgueiras/:local_id/instalar ──────────────────────────────────

router.patch(
  '/:local_id/instalar',
  requireRole('master_admin', 'socio', 'responsavel'),
  validate(MelgueiraInstallSchema),
  async (req, res, next) => {
    try {
      const { hive_local_id, installed_at, performed_by } = req.body;

      const melg = await queryOne<{ local_id: string; status: string }>(
        'SELECT local_id, status FROM melgueiras WHERE local_id = $1 AND deleted_at IS NULL',
        [req.params.local_id]
      );
      if (!melg) { res.status(404).json({ error: 'Melgueira não encontrada' }); return; }
      if (melg.status === 'em_uso') {
        res.status(400).json({ error: 'Melgueira já está instalada em uma caixa' });
        return;
      }

      const row = await queryOne<Melgueira>(
        `UPDATE melgueiras SET
           status        = 'em_uso',
           hive_local_id = $2,
           installed_at  = $3
         WHERE local_id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [req.params.local_id, hive_local_id, installed_at]
      );

      await query(
        `INSERT INTO equipment_movements
           (local_id, item_type, item_local_id, movement_type, quantity, hive_local_id, performed_by)
         VALUES ($1, 'melgueira', $2, 'instalacao', 1, $3, $4)`,
        [uuidv4(), req.params.local_id, hive_local_id, performed_by ?? null]
      );

      res.json(row);
    } catch (err) { next(err); }
  }
);

// ── PATCH /api/melgueiras/:local_id/retirar ───────────────────────────────────

router.patch(
  '/:local_id/retirar',
  requireRole('master_admin', 'socio', 'responsavel'),
  validate(MelgueiraRemoveSchema),
  async (req, res, next) => {
    try {
      const { performed_by, reason } = req.body;

      const melg = await queryOne<{ local_id: string; status: string; hive_local_id: string | null }>(
        'SELECT local_id, status, hive_local_id FROM melgueiras WHERE local_id = $1 AND deleted_at IS NULL',
        [req.params.local_id]
      );
      if (!melg) { res.status(404).json({ error: 'Melgueira não encontrada' }); return; }
      if (melg.status !== 'em_uso') {
        res.status(400).json({ error: 'Melgueira não está instalada em nenhuma caixa' });
        return;
      }

      const hiveId = melg.hive_local_id;

      const row = await queryOne<Melgueira>(
        `UPDATE melgueiras SET
           status        = 'disponivel',
           hive_local_id = NULL,
           installed_at  = NULL
         WHERE local_id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [req.params.local_id]
      );

      await query(
        `INSERT INTO equipment_movements
           (local_id, item_type, item_local_id, movement_type, quantity, hive_local_id, reason, performed_by)
         VALUES ($1, 'melgueira', $2, 'retirada', 1, $3, $4, $5)`,
        [uuidv4(), req.params.local_id, hiveId, reason ?? null, performed_by ?? null]
      );

      res.json(row);
    } catch (err) { next(err); }
  }
);

// ── DELETE /api/melgueiras/:local_id ─────────────────────────────────────────

router.delete(
  '/:local_id',
  requireRole('master_admin', 'socio'),
  async (req, res, next) => {
    try {
      await query(
        'UPDATE melgueiras SET deleted_at = NOW() WHERE local_id = $1 AND deleted_at IS NULL',
        [req.params.local_id]
      );
      res.status(204).send();
    } catch (err) { next(err); }
  }
);

export default router;
