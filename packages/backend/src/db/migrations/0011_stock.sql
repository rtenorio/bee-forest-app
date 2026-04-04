-- ── Stock Items ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_items (
  id            SERIAL PRIMARY KEY,
  local_id      VARCHAR(36) UNIQUE NOT NULL,
  apiary_local_id VARCHAR(36) NOT NULL REFERENCES apiaries(local_id) ON DELETE CASCADE,
  category      VARCHAR(20) NOT NULL CHECK (category IN ('honey','input','packaging')),
  name          VARCHAR(100) NOT NULL,
  honey_type    VARCHAR(20) CHECK (honey_type IN ('vivo','maturado')),
  unit          VARCHAR(10) NOT NULL CHECK (unit IN ('ml','g','kg','l','units')),
  current_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  current_weight_kg DECIMAL(10,3),
  min_quantity  DECIMAL(12,3) NOT NULL DEFAULT 0,
  notes         TEXT,
  deleted_at    TIMESTAMPTZ,
  server_id     INTEGER GENERATED ALWAYS AS (id) STORED,
  synced_at     TIMESTAMPTZ,
  is_dirty      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_items_apiary   ON stock_items(apiary_local_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_items_category ON stock_items(category)        WHERE deleted_at IS NULL;

-- ── Stock Movements ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_movements (
  id                    SERIAL PRIMARY KEY,
  stock_item_id         INTEGER NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  stock_item_local_id   VARCHAR(36) NOT NULL,
  apiary_local_id       VARCHAR(36) NOT NULL,
  movement_type         VARCHAR(20) NOT NULL CHECK (movement_type IN ('entry','exit','transfer')),
  quantity              DECIMAL(12,3) NOT NULL,
  weight_kg             DECIMAL(10,3),
  direction             VARCHAR(5)  NOT NULL CHECK (direction IN ('in','out')),
  origin_type           VARCHAR(30) CHECK (origin_type IN ('harvest','batch','purchase','transfer','manual')),
  origin_id             VARCHAR(36),
  destination_type      VARCHAR(30) CHECK (destination_type IN ('sale','transfer','internal_use','processing','manual')),
  destination_apiary_id VARCHAR(36),
  destination_notes     VARCHAR(200),
  unit_price            DECIMAL(10,2),
  responsible_user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item   ON stock_movements(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_apiary ON stock_movements(apiary_local_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date   ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type   ON stock_movements(movement_type);

-- ── Stock Alerts ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_alerts (
  id              SERIAL PRIMARY KEY,
  stock_item_id   INTEGER NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  apiary_local_id VARCHAR(36) NOT NULL,
  alert_type      VARCHAR(20) NOT NULL CHECK (alert_type IN ('low_stock','out_of_stock')),
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_item     ON stock_alerts(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_apiary   ON stock_alerts(apiary_local_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_resolved ON stock_alerts(resolved_at) WHERE resolved_at IS NULL;

-- ── Extend notifications type constraint ──────────────────────────────────────

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('inspection_overdue','task_overdue','batch_fermentation_risk','batch_stalled','stock_alert'));
