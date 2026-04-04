import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, query, queryOne } from '../db/connection';
import { requireRole } from '../middleware/requireRole';
import { notifyUser } from '../services/notification.service';
import type { Request } from 'express';

const router = Router();

// ── Scope helpers ─────────────────────────────────────────────────────────────

function accessibleApiaryIds(req: Request): string[] | null {
  const { role, apiary_local_ids } = req.user!;
  if (role === 'master_admin' || role === 'socio') return null; // unrestricted
  if (role === 'responsavel') return apiary_local_ids;
  return apiary_local_ids; // tratador: assigned apiaries (will filter category too)
}

function apiaryClause(req: Request, paramIdx: number): { clause: string; param: string[] | null } {
  const ids = accessibleApiaryIds(req);
  if (!ids) return { clause: '', param: null };
  return { clause: `AND si.apiary_local_id = ANY($${paramIdx}::varchar[])`, param: ids };
}

// ── Alert helper ──────────────────────────────────────────────────────────────

async function checkAndCreateAlert(stockItemId: number, itemLocalId: string, apiaryLocalId: string): Promise<void> {
  const item = await queryOne<{
    name: string; current_quantity: number; min_quantity: number; unit: string;
  }>('SELECT name, current_quantity, min_quantity, unit FROM stock_items WHERE id = $1', [stockItemId]);
  if (!item) return;

  if (item.current_quantity > item.min_quantity) {
    // Resolve any existing unresolved alert
    await query(
      `UPDATE stock_alerts SET resolved_at = NOW()
       WHERE stock_item_id = $1 AND resolved_at IS NULL`,
      [stockItemId]
    );
    return;
  }

  // Check if there's already an unresolved alert
  const existing = await queryOne(
    'SELECT id FROM stock_alerts WHERE stock_item_id = $1 AND resolved_at IS NULL',
    [stockItemId]
  );
  if (existing) return; // already alerted

  const alertType = item.current_quantity <= 0 ? 'out_of_stock' : 'low_stock';
  await query(
    `INSERT INTO stock_alerts (stock_item_id, apiary_local_id, alert_type)
     VALUES ($1, $2, $3)`,
    [stockItemId, apiaryLocalId, alertType]
  );

  // Notify responsaveis and master_admin/socio
  const responsaveis = await query<{ user_id: number }>(
    'SELECT user_id FROM user_apiary_assignments WHERE apiary_local_id = $1',
    [apiaryLocalId]
  );
  const admins = await query<{ id: number }>(
    `SELECT id FROM users WHERE role IN ('master_admin','socio') AND active = true AND deleted_at IS NULL`
  );
  const recipients = [...new Set([...responsaveis.map(r => r.user_id), ...admins.map(a => a.id)])];

  const apiary = await queryOne<{ name: string }>('SELECT name FROM apiaries WHERE local_id = $1', [apiaryLocalId]);
  const title = alertType === 'out_of_stock'
    ? `Estoque zerado: ${item.name}`
    : `Estoque baixo: ${item.name}`;
  const body = `${item.name}${apiary?.name ? ` (${apiary.name})` : ''}: ${item.current_quantity} ${item.unit} restante(s). Mínimo definido: ${item.min_quantity} ${item.unit}.`;

  for (const uid of recipients) {
    await notifyUser(uid, 'stock_alert', title, body, 'stock_item', itemLocalId, `/stock/${apiaryLocalId}`);
  }
}

// ── Auto stock entry helper (called by other routes) ─────────────────────────

export async function autoHarvestStockEntry(
  apiaryLocalId: string,
  honeyType: 'vivo' | 'maturado',
  totalVolumeMl: number | null,
  totalWeightKg: number | null,
  harvestLocalId: string,
  responsibleUserId: number | null
): Promise<void> {
  if (!totalVolumeMl && !totalWeightKg) return;

  // Find or auto-create the honey stock item for this apiary+honeyType
  const itemName = honeyType === 'vivo' ? 'Mel Vivo' : 'Mel Maturado';
  let item = await queryOne<{ id: number; local_id: string; current_quantity: number; current_weight_kg: number | null }>(
    `SELECT id, local_id, current_quantity, current_weight_kg
     FROM stock_items
     WHERE apiary_local_id = $1 AND category = 'honey' AND honey_type = $2 AND deleted_at IS NULL
     LIMIT 1`,
    [apiaryLocalId, honeyType]
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (!item) {
      const newLocalId = uuidv4();
      const created = await client.query(
        `INSERT INTO stock_items (local_id, apiary_local_id, category, name, honey_type, unit, current_quantity, current_weight_kg)
         VALUES ($1,$2,'honey',$3,$4,'ml',$5,$6)
         RETURNING id, local_id, current_quantity, current_weight_kg`,
        [newLocalId, apiaryLocalId, itemName, honeyType, totalVolumeMl ?? 0, totalWeightKg]
      );
      item = created.rows[0];
    } else {
      const newQty = (item.current_quantity) + (totalVolumeMl ?? 0);
      const newWkg = totalWeightKg != null ? (item.current_weight_kg ?? 0) + totalWeightKg : item.current_weight_kg;
      await client.query(
        'UPDATE stock_items SET current_quantity=$1, current_weight_kg=$2, updated_at=NOW() WHERE id=$3',
        [newQty, newWkg, item.id]
      );
      item = { ...item, current_quantity: newQty, current_weight_kg: newWkg };
    }

    // Register movement
    await client.query(
      `INSERT INTO stock_movements (stock_item_id, stock_item_local_id, apiary_local_id,
         movement_type, quantity, weight_kg, direction, origin_type, origin_id, responsible_user_id)
       VALUES ($1,$2,$3,'entry',$4,$5,'in','harvest',$6,$7)`,
      [item!.id, item!.local_id, apiaryLocalId, totalVolumeMl ?? 0, totalWeightKg, harvestLocalId, responsibleUserId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[stock] autoHarvestStockEntry error:', err);
  } finally {
    client.release();
  }
}

// ── GET / — list items ────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const { apiary_local_id, category, with_alerts } = req.query;

    const conditions: string[] = ['si.deleted_at IS NULL'];
    const params: unknown[] = [];

    // Role-based scope
    if (user.role === 'responsavel' || user.role === 'tratador') {
      if (user.apiary_local_ids.length === 0) { res.json([]); return; }
      params.push(user.apiary_local_ids);
      conditions.push(`si.apiary_local_id = ANY($${params.length}::varchar[])`);
    }

    // tratador: only inputs
    if (user.role === 'tratador') conditions.push(`si.category = 'input'`);

    if (apiary_local_id) { params.push(apiary_local_id); conditions.push(`si.apiary_local_id = $${params.length}`); }
    if (category && user.role !== 'tratador') { params.push(category); conditions.push(`si.category = $${params.length}`); }

    let rows;
    if (with_alerts === 'true') {
      rows = await query(
        `SELECT si.*, a.name AS apiary_name,
           EXISTS(SELECT 1 FROM stock_alerts sa WHERE sa.stock_item_id = si.id AND sa.resolved_at IS NULL) AS has_alert
         FROM stock_items si
         LEFT JOIN apiaries a ON a.local_id = si.apiary_local_id
         WHERE ${conditions.join(' AND ')}
           AND EXISTS(SELECT 1 FROM stock_alerts sa WHERE sa.stock_item_id = si.id AND sa.resolved_at IS NULL)
         ORDER BY a.name, si.category, si.name`,
        params
      );
    } else {
      rows = await query(
        `SELECT si.*, a.name AS apiary_name,
           EXISTS(SELECT 1 FROM stock_alerts sa WHERE sa.stock_item_id = si.id AND sa.resolved_at IS NULL) AS has_alert
         FROM stock_items si
         LEFT JOIN apiaries a ON a.local_id = si.apiary_local_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY a.name, si.category, si.name`,
        params
      );
    }

    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST /items ───────────────────────────────────────────────────────────────

router.post('/items', requireRole('master_admin', 'socio', 'responsavel'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { apiary_local_id, category, name, honey_type, unit, min_quantity, notes } = req.body;
    if (!apiary_local_id || !category || !name || !unit) {
      res.status(400).json({ error: 'apiary_local_id, category, name e unit são obrigatórios' }); return;
    }
    if (user.role === 'responsavel' && !user.apiary_local_ids.includes(apiary_local_id)) {
      res.status(403).json({ error: 'Sem permissão para este meliponário' }); return;
    }

    const local_id = uuidv4();
    const row = await queryOne(
      `INSERT INTO stock_items (local_id, apiary_local_id, category, name, honey_type, unit, min_quantity, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [local_id, apiary_local_id, category, name, honey_type ?? null, unit, min_quantity ?? 0, notes ?? null]
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

// ── PUT /items/:local_id ──────────────────────────────────────────────────────

router.put('/items/:local_id', requireRole('master_admin', 'socio', 'responsavel'), async (req, res, next) => {
  try {
    const { name, min_quantity, notes, unit } = req.body;
    const row = await queryOne(
      `UPDATE stock_items
       SET name        = COALESCE($2, name),
           min_quantity = COALESCE($3, min_quantity),
           notes       = COALESCE($4, notes),
           unit        = COALESCE($5, unit),
           updated_at  = NOW()
       WHERE local_id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [req.params.local_id, name ?? null, min_quantity ?? null, notes ?? null, unit ?? null]
    );
    if (!row) { res.status(404).json({ error: 'Item não encontrado' }); return; }
    res.json(row);
  } catch (err) { next(err); }
});

// ── DELETE /items/:local_id ───────────────────────────────────────────────────

router.delete('/items/:local_id', requireRole('master_admin', 'socio'), async (req, res, next) => {
  try {
    await query(
      'UPDATE stock_items SET deleted_at = NOW() WHERE local_id = $1',
      [req.params.local_id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

// ── POST /movements ───────────────────────────────────────────────────────────

router.post('/movements', requireRole('master_admin', 'socio', 'responsavel'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const user = req.user!;
    const {
      stock_item_local_id, movement_type, quantity, weight_kg,
      direction, origin_type, origin_id,
      destination_type, destination_apiary_id, destination_notes,
      unit_price, notes,
    } = req.body;

    if (!stock_item_local_id || !movement_type || quantity == null || !direction) {
      res.status(400).json({ error: 'stock_item_local_id, movement_type, quantity e direction são obrigatórios' });
      await client.query('ROLLBACK'); return;
    }

    const item = await client.query<{
      id: number; local_id: string; apiary_local_id: string;
      current_quantity: number; current_weight_kg: number | null;
    }>(
      'SELECT id, local_id, apiary_local_id, current_quantity, current_weight_kg FROM stock_items WHERE local_id = $1 AND deleted_at IS NULL',
      [stock_item_local_id]
    );
    if (!item.rows[0]) {
      res.status(404).json({ error: 'Item de estoque não encontrado' });
      await client.query('ROLLBACK'); return;
    }
    const si = item.rows[0];

    if (user.role === 'responsavel' && !user.apiary_local_ids.includes(si.apiary_local_id)) {
      res.status(403).json({ error: 'Sem permissão para este meliponário' });
      await client.query('ROLLBACK'); return;
    }

    const sign = direction === 'in' ? 1 : -1;
    const newQty = Math.max(0, si.current_quantity + sign * Number(quantity));
    const newWkg = weight_kg != null
      ? Math.max(0, (si.current_weight_kg ?? 0) + sign * Number(weight_kg))
      : si.current_weight_kg;

    await client.query(
      'UPDATE stock_items SET current_quantity=$1, current_weight_kg=$2, updated_at=NOW() WHERE id=$3',
      [newQty, newWkg, si.id]
    );

    const mov = await client.query(
      `INSERT INTO stock_movements (
         stock_item_id, stock_item_local_id, apiary_local_id,
         movement_type, quantity, weight_kg, direction,
         origin_type, origin_id, destination_type,
         destination_apiary_id, destination_notes,
         unit_price, responsible_user_id, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        si.id, si.local_id, si.apiary_local_id,
        movement_type, quantity, weight_kg ?? null, direction,
        origin_type ?? null, origin_id ?? null, destination_type ?? null,
        destination_apiary_id ?? null, destination_notes ?? null,
        unit_price ?? null, user.id, notes ?? null,
      ]
    );

    // For transfers: create paired entry in destination apiary
    if (movement_type === 'transfer' && destination_apiary_id) {
      // Find or create equivalent item in destination apiary
      const destItem = await client.query(
        `SELECT id, local_id, current_quantity, current_weight_kg
         FROM stock_items
         WHERE apiary_local_id = $1 AND category = (SELECT category FROM stock_items WHERE id = $2)
           AND name = (SELECT name FROM stock_items WHERE id = $2) AND deleted_at IS NULL
         LIMIT 1`,
        [destination_apiary_id, si.id]
      );

      let destId: number;
      let destLocalId: string;
      if (destItem.rows[0]) {
        destId = destItem.rows[0].id;
        destLocalId = destItem.rows[0].local_id;
        const dQty = (destItem.rows[0].current_quantity ?? 0) + Number(quantity);
        const dWkg = weight_kg != null ? (destItem.rows[0].current_weight_kg ?? 0) + Number(weight_kg) : destItem.rows[0].current_weight_kg;
        await client.query(
          'UPDATE stock_items SET current_quantity=$1, current_weight_kg=$2, updated_at=NOW() WHERE id=$3',
          [dQty, dWkg, destId]
        );
      } else {
        destLocalId = uuidv4();
        const srcItem = await client.query('SELECT * FROM stock_items WHERE id = $1', [si.id]);
        const src = srcItem.rows[0];
        const destCreated = await client.query(
          `INSERT INTO stock_items (local_id, apiary_local_id, category, name, honey_type, unit, current_quantity, current_weight_kg, min_quantity)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, local_id`,
          [destLocalId, destination_apiary_id, src.category, src.name, src.honey_type, src.unit, quantity, weight_kg ?? null, src.min_quantity]
        );
        destId = destCreated.rows[0].id;
      }

      await client.query(
        `INSERT INTO stock_movements (
           stock_item_id, stock_item_local_id, apiary_local_id,
           movement_type, quantity, weight_kg, direction,
           origin_type, origin_id, responsible_user_id, notes
         ) VALUES ($1,$2,$3,'transfer',$4,$5,'in','transfer',$6,$7,$8)`,
        [destId, destLocalId, destination_apiary_id, quantity, weight_kg ?? null, si.apiary_local_id, user.id, notes ?? null]
      );

      await checkAndCreateAlert(destId, destLocalId, destination_apiary_id);
    }

    await client.query('COMMIT');

    await checkAndCreateAlert(si.id, si.local_id, si.apiary_local_id);

    res.status(201).json(mov.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ── GET /movements ────────────────────────────────────────────────────────────

router.get('/movements', async (req, res, next) => {
  try {
    const user = req.user!;
    const { apiary_local_id, category, movement_type, date_from, date_to, limit = '50', offset = '0' } = req.query;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (user.role === 'tratador') { res.json([]); return; } // tratador cannot see movements
    if (user.role === 'responsavel') {
      if (user.apiary_local_ids.length === 0) { res.json([]); return; }
      params.push(user.apiary_local_ids);
      conditions.push(`sm.apiary_local_id = ANY($${params.length}::varchar[])`);
    }
    if (apiary_local_id) { params.push(apiary_local_id); conditions.push(`sm.apiary_local_id = $${params.length}`); }
    if (category) { params.push(category); conditions.push(`si.category = $${params.length}`); }
    if (movement_type) { params.push(movement_type); conditions.push(`sm.movement_type = $${params.length}`); }
    if (date_from) { params.push(date_from); conditions.push(`sm.created_at >= $${params.length}`); }
    if (date_to) { params.push(date_to); conditions.push(`sm.created_at <= $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const rows = await query(
      `SELECT sm.*,
         si.name AS item_name, si.category AS item_category, si.unit AS item_unit,
         a.name AS apiary_name,
         u.name AS responsible_name
       FROM stock_movements sm
       JOIN stock_items si ON si.id = sm.stock_item_id
       LEFT JOIN apiaries a ON a.local_id = sm.apiary_local_id
       LEFT JOIN users u ON u.id = sm.responsible_user_id
       ${where}
       ORDER BY sm.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit as string, 10), parseInt(offset as string, 10)]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /summary ──────────────────────────────────────────────────────────────

router.get('/summary', async (req, res, next) => {
  try {
    const user = req.user!;
    const { apiary_local_id } = req.query;

    // Build apiary scope
    const apiaryConditions: string[] = [];
    const params: unknown[] = [];

    if (user.role === 'responsavel' || user.role === 'tratador') {
      if (user.apiary_local_ids.length === 0) { res.json([]); return; }
      params.push(user.apiary_local_ids);
      apiaryConditions.push(`a.local_id = ANY($${params.length}::varchar[])`);
    }
    if (apiary_local_id) {
      params.push(apiary_local_id);
      apiaryConditions.push(`a.local_id = $${params.length}`);
    }

    const whereClause = apiaryConditions.length ? 'WHERE ' + apiaryConditions.join(' AND ') : '';

    const rows = await query(
      `SELECT
         a.local_id  AS apiary_local_id,
         a.name      AS apiary_name,
         COALESCE(SUM(CASE WHEN si.category='honey' AND si.honey_type='vivo'     THEN si.current_quantity   END),0)::float AS honey_vivo_volume_ml,
         COALESCE(SUM(CASE WHEN si.category='honey' AND si.honey_type='vivo'     THEN si.current_weight_kg  END),0)::float AS honey_vivo_weight_kg,
         COALESCE(SUM(CASE WHEN si.category='honey' AND si.honey_type='maturado' THEN si.current_quantity   END),0)::float AS honey_maturado_volume_ml,
         COALESCE(SUM(CASE WHEN si.category='honey' AND si.honey_type='maturado' THEN si.current_weight_kg  END),0)::float AS honey_maturado_weight_kg,
         COUNT(CASE WHEN si.category='input' AND (si.min_quantity=0 OR si.current_quantity>si.min_quantity) THEN 1 END)::int AS inputs_ok,
         COUNT(CASE WHEN si.category='input' AND si.current_quantity>0 AND si.current_quantity<=si.min_quantity THEN 1 END)::int AS inputs_low,
         COUNT(CASE WHEN si.category='input' AND si.current_quantity<=0 THEN 1 END)::int AS inputs_out,
         COALESCE(SUM(CASE WHEN si.category='packaging' THEN si.current_quantity END),0)::float AS packaging_total,
         COUNT(CASE WHEN sa.id IS NOT NULL THEN 1 END)::int AS alerts_count
       FROM apiaries a
       LEFT JOIN stock_items si ON si.apiary_local_id = a.local_id AND si.deleted_at IS NULL
       LEFT JOIN stock_alerts sa ON sa.stock_item_id = si.id AND sa.resolved_at IS NULL
       ${whereClause}
       GROUP BY a.local_id, a.name
       ORDER BY a.name`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /alerts ───────────────────────────────────────────────────────────────

router.get('/alerts', async (req, res, next) => {
  try {
    const user = req.user!;
    const conditions: string[] = ['sa.resolved_at IS NULL', 'si.deleted_at IS NULL'];
    const params: unknown[] = [];

    if (user.role === 'responsavel') {
      if (user.apiary_local_ids.length === 0) { res.json([]); return; }
      params.push(user.apiary_local_ids);
      conditions.push(`sa.apiary_local_id = ANY($${params.length}::varchar[])`);
    }
    if (user.role === 'tratador') { res.json([]); return; }

    const rows = await query(
      `SELECT sa.id, sa.stock_item_id, si.local_id AS stock_item_local_id,
         sa.apiary_local_id, si.name AS item_name, si.unit AS item_unit,
         a.name AS apiary_name,
         si.current_quantity, si.min_quantity,
         sa.alert_type, sa.triggered_at, sa.resolved_at
       FROM stock_alerts sa
       JOIN stock_items si ON si.id = sa.stock_item_id
       LEFT JOIN apiaries a ON a.local_id = sa.apiary_local_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY sa.triggered_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST /alerts/:id/resolve ──────────────────────────────────────────────────

router.post('/alerts/:id/resolve', requireRole('master_admin', 'socio', 'responsavel'), async (req, res, next) => {
  try {
    await query(
      'UPDATE stock_alerts SET resolved_at = NOW(), resolved_by = $1 WHERE id = $2',
      [req.user!.id, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
