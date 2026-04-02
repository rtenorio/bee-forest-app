-- Migration 0003: QR Code support for hives

ALTER TABLE hives
  ADD COLUMN IF NOT EXISTS qr_code VARCHAR(30);

CREATE INDEX IF NOT EXISTS hives_qr_code_idx ON hives(qr_code);

CREATE TABLE IF NOT EXISTS qr_scans (
  id            SERIAL PRIMARY KEY,
  hive_id       INTEGER REFERENCES hives(server_id) ON DELETE CASCADE,
  hive_local_id VARCHAR(36) NOT NULL,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  scanned_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qr_scans_hive_local_idx ON qr_scans(hive_local_id);
CREATE INDEX IF NOT EXISTS qr_scans_user_idx       ON qr_scans(user_id);
CREATE INDEX IF NOT EXISTS qr_scans_date_idx       ON qr_scans(scanned_at DESC);
