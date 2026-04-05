import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../db/connection';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { EquipmentAdjustSchema } from '../shared';
import type { EquipmentItem, EquipmentMovement } from '@bee-forest/shared';

const router = Router();

// ── GET /api/equipment ────────────────────────────────────────────────────────

router.get('/', async (_req, res, next) => {
  try {
    const rows = await query<EquipmentItem>(
      'SELECT * FROM equipment_items ORDER BY id',
      []
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST /api/equipment/adjust ────────────────────────────────────────────────

router.post(
  '/adjust',
  requireRole('master_admin', 'socio', 'responsavel'),
  validate(EquipmentAdjustSchema),
  async (req, res, next) => {
    try {
      const { type, delta, movement_type, reason, performed_by, hive_local_id } = req.body;

      const item = await queryOne<{ id: number; local_id: string; quantity: number }>(
        'SELECT id, local_id, quantity FROM equipment_items WHERE type = $1',
        [type]
      );
      if (!item) { res.status(404).json({ error: 'Tipo de equipamento não encontrado' }); return; }

      const newQty = Math.max(0, item.quantity + delta);
      await query('UPDATE equipment_items SET quantity = $1 WHERE id = $2', [newQty, item.id]);

      await query(
        `INSERT INTO equipment_movements
           (local_id, item_type, item_local_id, movement_type, quantity, hive_local_id, reason, performed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [uuidv4(), type, item.local_id, movement_type, Math.abs(delta),
         hive_local_id ?? null, reason ?? null, performed_by ?? null]
      );

      const updated = await queryOne<EquipmentItem>(
        'SELECT * FROM equipment_items WHERE id = $1',
        [item.id]
      );
      res.json(updated);
    } catch (err) { next(err); }
  }
);

// ── GET /api/equipment/movements ──────────────────────────────────────────────

router.get('/movements', async (req, res, next) => {
  try {
    const { item_type, limit = '100', offset = '0' } = req.query;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (item_type) {
      params.push(item_type);
      conditions.push(`em.item_type = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const rows = await query<EquipmentMovement>(
      `SELECT em.*,
         h.code AS hive_code
       FROM equipment_movements em
       LEFT JOIN hives h ON h.local_id = em.hive_local_id
       ${where}
       ORDER BY em.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit as string, 10), parseInt(offset as string, 10)]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
