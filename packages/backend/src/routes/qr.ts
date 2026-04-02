import { Router } from 'express';
import { queryOne } from '../db/connection';
import { z } from 'zod';

const router = Router();

const ScanSchema = z.object({
  hive_local_id: z.string().uuid(),
  scanned_at: z.string().datetime({ offset: true }).optional(),
});

router.post('/scan', async (req, res, next) => {
  try {
    const parsed = ScanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
      return;
    }

    const { hive_local_id, scanned_at } = parsed.data;
    const scannedAt = scanned_at ?? new Date().toISOString();

    const hive = await queryOne<{ server_id: number }>(
      'SELECT server_id FROM hives WHERE local_id = $1 AND deleted_at IS NULL',
      [hive_local_id]
    );

    const scan = await queryOne(
      `INSERT INTO qr_scans (hive_id, hive_local_id, user_id, scanned_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [hive?.server_id ?? null, hive_local_id, req.user!.id, scannedAt]
    );

    res.status(201).json(scan);
  } catch (err) {
    next(err);
  }
});

// GET /api/qr/scans/:hive_local_id — rastreabilidade para sócio/responsável
router.get('/scans/:hive_local_id', async (req, res, next) => {
  try {
    const role = req.user!.role;
    if (role === 'tratador') {
      res.status(403).json({ error: 'Sem permissão' });
      return;
    }

    const rows = await queryOne(
      `SELECT qs.id, qs.hive_local_id, qs.scanned_at, qs.created_at,
              u.name AS user_name, u.email AS user_email, u.role AS user_role
       FROM qr_scans qs
       LEFT JOIN users u ON qs.user_id = u.id
       WHERE qs.hive_local_id = $1
       ORDER BY qs.scanned_at DESC
       LIMIT 100`,
      [req.params.hive_local_id]
    );

    res.json(rows ?? []);
  } catch (err) {
    next(err);
  }
});

export default router;
