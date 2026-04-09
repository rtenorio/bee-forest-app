import { Router } from 'express';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { query, pool } from '../db/connection';
import { r2, R2_BUCKET } from '../services/r2';
import { requireRole } from '../middleware/requireRole';

const R2_BUCKET_BACKUP = process.env.R2_BUCKET_BACKUP ?? 'bee-forest-backup';

// Build a dedicated S3 client for the backup bucket.
// Uses R2_BACKUP_ACCESS_KEY_ID / R2_BACKUP_SECRET_ACCESS_KEY when available;
// falls back to the standard R2 credentials so the same Cloudflare account
// can still reach the backup bucket if separate keys were not provisioned.
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? '';
const r2Backup = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_BACKUP_ACCESS_KEY_ID     ?? process.env.R2_ACCESS_KEY_ID     ?? '',
    secretAccessKey: process.env.R2_BACKUP_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
});

const router = Router();

// ── GET /api/admin/audit-logs ─────────────────────────────────────────────────
// Only master_admin can access. Supports pagination and filters.

/**
 * @openapi
 * /api/admin/audit-logs:
 *   get:
 *     tags: [admin]
 *     summary: Trilha de auditoria
 *     description: Lista todas as ações registradas no sistema. Apenas master_admin. Suporta paginação e filtros.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *       - in: query
 *         name: user_id
 *         schema: { type: integer }
 *         description: Filtrar por ID do usuário
 *       - in: query
 *         name: resource_type
 *         schema: { type: string }
 *         description: Tipo de recurso (instruction, hive, apiary, inspection, etc.)
 *       - in: query
 *         name: action
 *         schema: { type: string, enum: [CREATE, UPDATE, DELETE] }
 *       - in: query
 *         name: date_from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: date_to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Logs de auditoria paginados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuditLog'
 *                 total:      { type: integer }
 *                 page:       { type: integer }
 *                 totalPages: { type: integer }
 *       403:
 *         description: Sem permissão (apenas master_admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

// ── GET /api/admin/system-health ─────────────────────────────────────────────
// Only master_admin. All checks run concurrently; individual failures are
// captured so a partial outage never breaks the entire response.

/**
 * @openapi
 * /api/admin/system-health:
 *   get:
 *     tags: [admin]
 *     summary: Saúde do sistema
 *     description: |
 *       Verifica o status de todos os serviços em paralelo. Falhas individuais são capturadas
 *       e não interrompem o endpoint. Apenas master_admin.
 *     responses:
 *       200:
 *         description: Status dos serviços
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 database:
 *                   type: string
 *                   enum: [ok, error]
 *                 r2:
 *                   type: string
 *                   enum: [ok, error]
 *                 backup:
 *                   type: object
 *                   properties:
 *                     timestamp: { type: string, format: date-time, nullable: true }
 *                     status:    { type: string, enum: [ok, old, unknown, error] }
 *                 stats:
 *                   type: object
 *                   properties:
 *                     total_hives:              { type: integer }
 *                     total_inspections:        { type: integer }
 *                     total_users:              { type: integer }
 *                     inspections_last_7_days:  { type: integer }
 *                 sync_pending:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                 media_errors_24h:
 *                   type: integer
 *                   description: Erros de mídia nas últimas 24 horas
 *                 uptime_seconds:
 *                   type: number
 *       403:
 *         description: Sem permissão (apenas master_admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/system-health', requireRole('master_admin'), async (req, res, next) => {
  try {
    const [
      dbResult,
      r2Result,
      backupResult,
      statsResult,
      syncResult,
      mediaErrorsResult,
    ] = await Promise.allSettled([
      checkDatabase(),
      checkR2(),
      checkLastBackup(),
      fetchStats(),
      fetchSyncPending(),
      fetchMediaErrors24h(),
    ]);

    const dbStatus   = dbResult.status   === 'fulfilled' ? dbResult.value   : 'error';
    const r2Status   = r2Result.status   === 'fulfilled' ? r2Result.value   : 'error';
    const backup     = backupResult.status === 'fulfilled' ? backupResult.value : { timestamp: null, status: 'unknown' };
    const stats      = statsResult.status === 'fulfilled' ? statsResult.value : { total_hives: 0, total_inspections: 0, total_users: 0, inspections_last_7_days: 0 };
    const syncPending = syncResult.status === 'fulfilled' ? syncResult.value : { total: 0, by_user: [] };
    const mediaErrors = mediaErrorsResult.status === 'fulfilled' ? mediaErrorsResult.value : 0;

    res.json({
      services: {
        database: dbStatus,
        r2: r2Status,
        uptime_seconds: Math.floor(process.uptime()),
      },
      sync_pending: syncPending,
      media_errors_24h: mediaErrors,
      recent_errors: [],          // Sentry integration not wired — placeholder
      last_backup: backup,
      stats,
    });
  } catch (err) { next(err); }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function checkDatabase(): Promise<'ok' | 'error'> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    return 'ok';
  } finally {
    client.release();
  }
}

async function checkR2(): Promise<'ok' | 'error'> {
  await r2.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, MaxKeys: 1 }));
  return 'ok';
}

async function checkLastBackup(): Promise<{ timestamp: string | null; status: string }> {
  const result = await r2Backup.send(
    new ListObjectsV2Command({ Bucket: R2_BUCKET_BACKUP, Prefix: 'backup-', MaxKeys: 100 })
  );

  const objects = result.Contents ?? [];
  if (objects.length === 0) return { timestamp: null, status: 'not_found' };

  // Find the most recent backup by LastModified
  const latest = objects.reduce((best, obj) =>
    (obj.LastModified ?? 0) > (best.LastModified ?? 0) ? obj : best
  );

  return {
    timestamp: latest.LastModified?.toISOString() ?? null,
    status: 'ok',
  };
}

async function fetchStats(): Promise<{
  total_hives: number;
  total_inspections: number;
  total_users: number;
  inspections_last_7_days: number;
}> {
  const rows = await query<{ key: string; value: string }>(`
    SELECT 'total_hives'              AS key, COUNT(*)::text AS value FROM hives       WHERE deleted_at IS NULL
    UNION ALL
    SELECT 'total_inspections',               COUNT(*)::text          FROM inspections  WHERE deleted_at IS NULL
    UNION ALL
    SELECT 'total_users',                     COUNT(*)::text          FROM users        WHERE deleted_at IS NULL AND active = true
    UNION ALL
    SELECT 'inspections_last_7_days',         COUNT(*)::text          FROM inspections
      WHERE deleted_at IS NULL AND inspected_at >= NOW() - INTERVAL '7 days'
  `);

  const map = Object.fromEntries(rows.map((r) => [r.key, parseInt(r.value, 10)]));
  return {
    total_hives:              map.total_hives              ?? 0,
    total_inspections:        map.total_inspections        ?? 0,
    total_users:              map.total_users              ?? 0,
    inspections_last_7_days:  map.inspections_last_7_days  ?? 0,
  };
}

async function fetchSyncPending(): Promise<{
  total: number;
  by_user: Array<{ user_id: number; user_name: string; count: number }>;
}> {
  // Approximation: count audit_log entries per user in the last 24 h.
  // The sync_log table does not store user_id, so this gives the nearest
  // meaningful per-user activity signal available.
  const rows = await query<{ user_id: number; user_name: string; count: string }>(`
    SELECT actor_user_id AS user_id,
           COALESCE(user_name, 'Desconhecido') AS user_name,
           COUNT(*)::text AS count
    FROM audit_logs
    WHERE created_at >= NOW() - INTERVAL '24 hours'
      AND actor_user_id IS NOT NULL
    GROUP BY actor_user_id, user_name
    ORDER BY count DESC
    LIMIT 20
  `);

  const by_user = rows.map((r) => ({
    user_id:   r.user_id,
    user_name: r.user_name,
    count:     parseInt(r.count, 10),
  }));

  return {
    total: by_user.reduce((sum, u) => sum + u.count, 0),
    by_user,
  };
}

async function fetchMediaErrors24h(): Promise<number> {
  const rows = await query<{ n: string }>(`
    SELECT COUNT(*)::text AS n
    FROM audit_logs
    WHERE action LIKE 'upload_error%'
      AND created_at >= NOW() - INTERVAL '24 hours'
  `);
  return parseInt(rows[0]?.n ?? '0', 10);
}

export default router;
