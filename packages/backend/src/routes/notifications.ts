import { Router } from 'express';
import { query, queryOne } from '../db/connection';
import { markAsRead, markAllAsRead, webPushEnabled } from '../services/notification.service';
import { config } from '../config';

const router = Router();

// ── GET /vapid-public-key ─────────────────────────────────────────────────────

router.get('/vapid-public-key', (_req, res) => {
  if (!webPushEnabled) { res.json({ key: null }); return; }
  res.json({ key: config.vapidPublicKey });
});

// ── POST /subscribe ───────────────────────────────────────────────────────────

router.post('/subscribe', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: 'endpoint, keys.p256dh e keys.auth são obrigatórios' }); return;
    }

    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (endpoint) DO UPDATE SET p256dh = $3, auth = $4, updated_at = NOW()`,
      [userId, endpoint, keys.p256dh, keys.auth]
    );

    // Ensure settings row exists
    await query(
      `INSERT INTO notification_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

// ── DELETE /subscription ──────────────────────────────────────────────────────

router.delete('/subscription', async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await query(
        'DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2',
        [endpoint, req.user!.id]
      );
    } else {
      await query('DELETE FROM push_subscriptions WHERE user_id = $1', [req.user!.id]);
    }
    res.status(204).send();
  } catch (err) { next(err); }
});

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { type, unread_only, limit = '50', offset = '0' } = req.query;

    const conditions = ['user_id = $1'];
    const params: unknown[] = [userId];

    if (type) { params.push(type); conditions.push(`type = $${params.length}`); }
    if (unread_only === 'true') conditions.push('read_at IS NULL');

    const rows = await query(
      `SELECT * FROM notifications WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit as string, 10), parseInt(offset as string, 10)]
    );

    const unreadCount = await queryOne<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [userId]
    );

    res.json({ notifications: rows, unread_count: parseInt(unreadCount?.count ?? '0', 10) });
  } catch (err) { next(err); }
});

// ── PATCH /:id/read ───────────────────────────────────────────────────────────

router.patch('/:id/read', async (req, res, next) => {
  try {
    await markAsRead(parseInt(req.params.id, 10), req.user!.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── PATCH /read-all ───────────────────────────────────────────────────────────

router.patch('/read-all', async (req, res, next) => {
  try {
    await markAllAsRead(req.user!.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── GET /settings ─────────────────────────────────────────────────────────────

router.get('/settings', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    let settings = await queryOne(
      'SELECT * FROM notification_settings WHERE user_id = $1',
      [userId]
    );
    if (!settings) {
      await query('INSERT INTO notification_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
      settings = await queryOne('SELECT * FROM notification_settings WHERE user_id = $1', [userId]);
    }
    res.json(settings);
  } catch (err) { next(err); }
});

// ── PUT /settings ─────────────────────────────────────────────────────────────

router.put('/settings', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const {
      web_push_enabled, whatsapp_enabled, whatsapp_phone,
      inspection_overdue_days,
      notify_inspection_overdue, notify_task_overdue,
      notify_batch_risk, notify_batch_stalled,
    } = req.body;

    const row = await queryOne(
      `INSERT INTO notification_settings (
         user_id, web_push_enabled, whatsapp_enabled, whatsapp_phone,
         inspection_overdue_days, notify_inspection_overdue, notify_task_overdue,
         notify_batch_risk, notify_batch_stalled
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (user_id) DO UPDATE SET
         web_push_enabled          = COALESCE($2, notification_settings.web_push_enabled),
         whatsapp_enabled          = COALESCE($3, notification_settings.whatsapp_enabled),
         whatsapp_phone            = COALESCE($4, notification_settings.whatsapp_phone),
         inspection_overdue_days   = COALESCE($5, notification_settings.inspection_overdue_days),
         notify_inspection_overdue = COALESCE($6, notification_settings.notify_inspection_overdue),
         notify_task_overdue       = COALESCE($7, notification_settings.notify_task_overdue),
         notify_batch_risk         = COALESCE($8, notification_settings.notify_batch_risk),
         notify_batch_stalled      = COALESCE($9, notification_settings.notify_batch_stalled),
         updated_at                = NOW()
       RETURNING *`,
      [
        userId,
        web_push_enabled ?? null, whatsapp_enabled ?? null,
        whatsapp_phone ?? null, inspection_overdue_days ?? null,
        notify_inspection_overdue ?? null, notify_task_overdue ?? null,
        notify_batch_risk ?? null, notify_batch_stalled ?? null,
      ]
    );
    res.json(row);
  } catch (err) { next(err); }
});

export default router;
