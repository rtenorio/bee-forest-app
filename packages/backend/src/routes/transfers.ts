import { Router } from 'express';
import { query, queryOne } from '../db/connection';
import { validate } from '../middleware/validate';
import { HiveTransferCreateSchema } from '../shared';
import type { HiveTransfer } from '@bee-forest/shared';

const router = Router();

const SELECT_BASE = `
  SELECT
    t.*,
    h.code  AS hive_code,
    ao.name AS apiary_origin_name,
    ad.name AS apiary_destination_name
  FROM hive_transfers t
  LEFT JOIN hives h   ON h.local_id   = t.hive_local_id
  LEFT JOIN apiaries ao ON ao.local_id = t.apiary_origin_local_id
  LEFT JOIN apiaries ad ON ad.local_id = t.apiary_destination_local_id
  WHERE 1=1
`;

// ── GET /api/transfers ────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const { hive_local_id, apiary_local_id } = req.query as Record<string, string | undefined>;
    let sql = SELECT_BASE;
    const params: unknown[] = [];
    let p = 1;

    if (hive_local_id) { sql += ` AND t.hive_local_id = $${p}`; params.push(hive_local_id); p++; }
    if (apiary_local_id) {
      sql += ` AND (t.apiary_origin_local_id = $${p} OR t.apiary_destination_local_id = $${p})`;
      params.push(apiary_local_id); p++;
    }

    sql += ' ORDER BY t.transferred_at DESC, t.created_at DESC';
    res.json(await query<HiveTransfer>(sql, params));
  } catch (err) { next(err); }
});

// ── POST /api/transfers ───────────────────────────────────────────────────────

router.post('/', validate(HiveTransferCreateSchema), async (req, res, next) => {
  try {
    const role = req.user!.role;
    if (!['master_admin', 'socio', 'responsavel'].includes(role)) {
      res.status(403).json({ error: 'Sem permissão para transferir caixas' });
      return;
    }

    const {
      local_id, hive_local_id, apiary_origin_local_id,
      apiary_destination_local_id, transferred_at, transferred_by, reason,
    } = req.body;

    // Verify hive exists and belongs to origin apiary
    const hive = await queryOne<{ local_id: string; apiary_local_id: string }>(
      'SELECT local_id, apiary_local_id FROM hives WHERE local_id = $1 AND deleted_at IS NULL',
      [hive_local_id]
    );
    if (!hive) { res.status(404).json({ error: 'Caixa não encontrada' }); return; }
    if (hive.apiary_local_id !== apiary_origin_local_id) {
      res.status(400).json({ error: 'Meliponário de origem não corresponde ao meliponário atual da caixa' });
      return;
    }
    if (apiary_origin_local_id === apiary_destination_local_id) {
      res.status(400).json({ error: 'Meliponário de destino deve ser diferente do de origem' });
      return;
    }

    // Insert transfer record
    const transfer = await queryOne<HiveTransfer>(
      `INSERT INTO hive_transfers
         (local_id, hive_local_id, apiary_origin_local_id, apiary_destination_local_id,
          transferred_at, transferred_by, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [local_id, hive_local_id, apiary_origin_local_id, apiary_destination_local_id,
       transferred_at, transferred_by, reason ?? null]
    );

    // Update hive's current apiary (origin stays in apiary_origin_local_id)
    await query(
      `UPDATE hives SET
         apiary_local_id = $1,
         apiary_origin_local_id = COALESCE(apiary_origin_local_id, $2)
       WHERE local_id = $3`,
      [apiary_destination_local_id, apiary_origin_local_id, hive_local_id]
    );

    res.status(201).json(transfer);
  } catch (err) { next(err); }
});

export default router;
