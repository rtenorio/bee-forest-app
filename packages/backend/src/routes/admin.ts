import { Router } from 'express';
import { query } from '../db/connection';
import { requireRole } from '../middleware/requireRole';

const router = Router();

// ── GET /api/admin/audit-logs ─────────────────────────────────────────────────
// Only master_admin can access. Supports pagination and filters.

router.get('/audit-logs', requireRole('master_admin'), async (req, res, next) => {
  try {
    const page      = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit     = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset    = (page - 1) * limit;

    const { user_id, resource_type, action, date_from, date_to } = req.query as Record<string, string | undefined>;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (user_id) {
      conditions.push(`actor_user_id = $${p++}`);
      params.push(parseInt(user_id, 10));
    }
    if (resource_type) {
      conditions.push(`resource_type = $${p++}`);
      params.push(resource_type);
    }
    if (action) {
      conditions.push(`action = $${p++}`);
      params.push(action);
    }
    if (date_from) {
      conditions.push(`created_at >= $${p++}`);
      params.push(date_from);
    }
    if (date_to) {
      conditions.push(`created_at <= $${p++}`);
      params.push(date_to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRow, logs] = await Promise.all([
      query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM audit_logs ${where}`,
        params
      ),
      query(
        `SELECT
           id,
           actor_user_id AS user_id,
           user_name,
           user_role,
           action,
           resource_type,
           resource_id,
           resource_label,
           payload,
           ip_address,
           created_at AS timestamp
         FROM audit_logs
         ${where}
         ORDER BY created_at DESC
         LIMIT $${p} OFFSET $${p + 1}`,
        [...params, limit, offset]
      ),
    ]);

    const total = parseInt(countRow[0]?.total ?? '0', 10);

    res.json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
});

export default router;
