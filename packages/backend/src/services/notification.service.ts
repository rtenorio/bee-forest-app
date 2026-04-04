import webpush from 'web-push';
import { query, queryOne } from '../db/connection';
import { config } from '../config';

// ── Web Push setup ────────────────────────────────────────────────────────────

export const webPushEnabled = !!(config.vapidPublicKey && config.vapidPrivateKey);

if (webPushEnabled) {
  webpush.setVapidDetails(config.vapidEmail, config.vapidPublicKey, config.vapidPrivateKey);
  console.log('[notifications] Web Push enabled');
} else {
  console.log('[notifications] Web Push disabled (VAPID keys not configured)');
}

// ── Twilio / WhatsApp setup ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let twilioClient: any = null;
const whatsAppEnabled = !!(config.twilioAccountSid && config.twilioAuthToken);

if (whatsAppEnabled) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Twilio = require('twilio');
    twilioClient = Twilio(config.twilioAccountSid, config.twilioAuthToken);
    console.log('[notifications] WhatsApp (Twilio) enabled');
  } catch (err) {
    console.warn('[notifications] Twilio init failed:', err);
  }
} else {
  console.log('[notifications] WhatsApp disabled (Twilio not configured)');
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'inspection_overdue'
  | 'task_overdue'
  | 'batch_fermentation_risk'
  | 'batch_stalled'
  | 'stock_alert';

export type NotificationChannel = 'web_push' | 'whatsapp' | 'both';

// ── Core functions ────────────────────────────────────────────────────────────

export async function sendWebPush(
  userId: number,
  title: string,
  body: string,
  url = '/'
): Promise<void> {
  if (!webPushEnabled) return;

  const subs = await query<{ endpoint: string; p256dh: string; auth: string }>(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
    [userId]
  );

  const payload = JSON.stringify({ title, body, url });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err: unknown) {
        // Remove expired/invalid subscriptions (410 Gone or 404 Not Found)
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
        }
      }
    })
  );
}

export async function sendWhatsApp(phone: string, message: string): Promise<void> {
  if (!twilioClient) return;
  try {
    await twilioClient.messages.create({
      from: config.twilioWhatsAppFrom,
      to: `whatsapp:${phone}`,
      body: message,
    });
  } catch (err) {
    console.error('[notifications] WhatsApp send failed:', err);
  }
}

export async function createNotification(
  userId: number,
  type: NotificationType,
  title: string,
  body: string,
  entityType?: string,
  entityId?: string,
  url?: string
): Promise<number | null> {
  // Dedup: skip if same type+entity+user in last 24h
  const existing = await queryOne<{ id: number }>(
    `SELECT id FROM notifications
     WHERE type = $1 AND entity_id = $2 AND user_id = $3
       AND created_at > NOW() - INTERVAL '24 hours'`,
    [type, entityId ?? null, userId]
  );
  if (existing) return null;

  const row = await queryOne<{ id: number }>(
    `INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id, url)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [userId, type, title, body, entityType ?? null, entityId ?? null, url ?? null]
  );
  return row?.id ?? null;
}

export async function markNotificationSent(notificationId: number): Promise<void> {
  await query('UPDATE notifications SET sent_at = NOW() WHERE id = $1', [notificationId]);
}

export async function markAsRead(notificationId: number, userId: number): Promise<void> {
  await query(
    'UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2',
    [notificationId, userId]
  );
}

export async function markAllAsRead(userId: number): Promise<void> {
  await query(
    'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL',
    [userId]
  );
}

// ── Send to user (respects their settings) ───────────────────────────────────

export async function notifyUser(
  userId: number,
  type: NotificationType,
  title: string,
  body: string,
  entityType?: string,
  entityId?: string,
  url?: string
): Promise<void> {
  const notifId = await createNotification(userId, type, title, body, entityType, entityId, url);
  if (!notifId) return; // duplicate, skip

  const settings = await queryOne<{
    web_push_enabled: boolean;
    whatsapp_enabled: boolean;
    whatsapp_phone: string | null;
  }>(
    'SELECT web_push_enabled, whatsapp_enabled, whatsapp_phone FROM notification_settings WHERE user_id = $1',
    [userId]
  );

  const webPushOn = settings?.web_push_enabled ?? true;
  const waOn = settings?.whatsapp_enabled ?? false;

  const sends: Promise<void>[] = [];

  if (webPushOn && webPushEnabled) {
    sends.push(sendWebPush(userId, title, body, url ?? '/'));
  }

  if (waOn && settings?.whatsapp_phone) {
    const msg = `🐝 *${title}*\n${body}`;
    sends.push(sendWhatsApp(settings.whatsapp_phone, msg));
  }

  await Promise.allSettled(sends);
  await markNotificationSent(notifId);
}
