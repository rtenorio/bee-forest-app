-- Migration 0010: Sistema de Notificações Push

-- ── push_subscriptions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subs_user_idx ON push_subscriptions(user_id);

-- ── notifications ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(40) NOT NULL
    CHECK (type IN ('inspection_overdue','task_overdue','batch_fermentation_risk','batch_stalled')),
  title       VARCHAR(255) NOT NULL,
  body        TEXT NOT NULL,
  entity_type VARCHAR(40),
  entity_id   VARCHAR(36),
  url         VARCHAR(255),
  channel     VARCHAR(20) NOT NULL DEFAULT 'web_push'
    CHECK (channel IN ('web_push','whatsapp','both')),
  sent_at     TIMESTAMPTZ,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx   ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_dedup_idx  ON notifications(type, entity_id, user_id, created_at DESC);

-- ── notification_settings ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_settings (
  id                        SERIAL PRIMARY KEY,
  user_id                   INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  web_push_enabled          BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled          BOOLEAN NOT NULL DEFAULT false,
  whatsapp_phone            VARCHAR(20),
  inspection_overdue_days   INTEGER NOT NULL DEFAULT 14,
  notify_inspection_overdue BOOLEAN NOT NULL DEFAULT true,
  notify_task_overdue       BOOLEAN NOT NULL DEFAULT true,
  notify_batch_risk         BOOLEAN NOT NULL DEFAULT true,
  notify_batch_stalled      BOOLEAN NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
