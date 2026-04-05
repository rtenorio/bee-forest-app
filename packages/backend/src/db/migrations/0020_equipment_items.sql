-- Equipment items: general stock by quantity (modules + empty boxes)
CREATE TABLE IF NOT EXISTS equipment_items (
  id          SERIAL PRIMARY KEY,
  local_id    VARCHAR(36)  UNIQUE NOT NULL,
  type        VARCHAR(30)  NOT NULL
              CHECK (type IN ('modulo_ninho','modulo_sobreninho','caixa_vazia')),
  quantity    INTEGER      NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Seed one row per type (fixed UUIDs for idempotency)
INSERT INTO equipment_items (local_id, type, quantity)
VALUES
  ('eeee0001-0000-0000-0000-000000000001', 'modulo_ninho',      0),
  ('eeee0001-0000-0000-0000-000000000002', 'modulo_sobreninho', 0),
  ('eeee0001-0000-0000-0000-000000000003', 'caixa_vazia',       0)
ON CONFLICT (local_id) DO NOTHING;

CREATE OR REPLACE FUNCTION update_equipment_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_equipment_items_updated_at ON equipment_items;
CREATE TRIGGER trg_equipment_items_updated_at
  BEFORE UPDATE ON equipment_items
  FOR EACH ROW EXECUTE FUNCTION update_equipment_items_updated_at();

-- Individual honey supers (melgueiras) — tracked one-by-one with QR code
CREATE TABLE IF NOT EXISTS melgueiras (
  id              SERIAL PRIMARY KEY,
  local_id        VARCHAR(36)  UNIQUE NOT NULL,
  code            VARCHAR(50)  UNIQUE NOT NULL,
  qr_code_data    VARCHAR(100),
  status          VARCHAR(20)  NOT NULL DEFAULT 'disponivel'
                  CHECK (status IN ('disponivel','em_uso','manutencao')),
  hive_local_id   VARCHAR(36),
  apiary_local_id VARCHAR(36),
  installed_at    DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_melgueiras_status ON melgueiras(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_melgueiras_hive   ON melgueiras(hive_local_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION update_melgueiras_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_melgueiras_updated_at ON melgueiras;
CREATE TRIGGER trg_melgueiras_updated_at
  BEFORE UPDATE ON melgueiras
  FOR EACH ROW EXECUTE FUNCTION update_melgueiras_updated_at();

-- Equipment movements: history for both equipment_items and melgueiras
CREATE TABLE IF NOT EXISTS equipment_movements (
  id            SERIAL PRIMARY KEY,
  local_id      VARCHAR(36)  UNIQUE NOT NULL,
  item_type     VARCHAR(30)  NOT NULL
                CHECK (item_type IN ('melgueira','modulo_ninho','modulo_sobreninho','caixa_vazia')),
  item_local_id VARCHAR(36)  NOT NULL,
  movement_type VARCHAR(20)  NOT NULL
                CHECK (movement_type IN ('entrada','saida','instalacao','retirada','desmontagem')),
  quantity      INTEGER      NOT NULL DEFAULT 1,
  hive_local_id VARCHAR(36),
  reason        TEXT,
  performed_by  VARCHAR(150),
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_movements_item ON equipment_movements(item_local_id);
CREATE INDEX IF NOT EXISTS idx_equipment_movements_type ON equipment_movements(item_type);
