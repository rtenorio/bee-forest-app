-- ── Partners (Meliponicultores externos) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS partners (
  id                    SERIAL PRIMARY KEY,
  local_id              VARCHAR(36) UNIQUE NOT NULL,
  full_name             VARCHAR(200) NOT NULL,
  document              VARCHAR(20),
  address               TEXT,
  city                  VARCHAR(100),
  state                 VARCHAR(2),
  phone                 VARCHAR(20),
  whatsapp              VARCHAR(20),
  email                 VARCHAR(255),
  bank_name             VARCHAR(100),
  bank_agency           VARCHAR(20),
  bank_account          VARCHAR(30),
  pix_key               VARCHAR(100),
  partnership_start_date DATE,
  status                VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  max_purchase_pct      DECIMAL(5,2) NOT NULL DEFAULT 70,
  notes                 TEXT,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_partners_city   ON partners(city)   WHERE deleted_at IS NULL;

-- ── Partner Apiaries (Meliponários do parceiro) ────────────────────────────────

CREATE TABLE IF NOT EXISTS partner_apiaries (
  id                   SERIAL PRIMARY KEY,
  local_id             VARCHAR(36) UNIQUE NOT NULL,
  partner_id           INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name                 VARCHAR(200) NOT NULL,
  city                 VARCHAR(100),
  state                VARCHAR(2),
  latitude             DECIMAL(10,7),
  longitude            DECIMAL(10,7),
  bee_species          VARCHAR(100),
  active_hives_count   INTEGER DEFAULT 0,
  management_type      VARCHAR(20) CHECK (management_type IN ('rational','semi_rational')),
  technical_responsible VARCHAR(150),
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_apiaries_partner ON partner_apiaries(partner_id);

-- ── Partner Equipment Loans (Comodato) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS partner_equipment_loans (
  id                   SERIAL PRIMARY KEY,
  local_id             VARCHAR(36) UNIQUE NOT NULL,
  partner_id           INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  item_name            VARCHAR(200) NOT NULL,
  item_type            VARCHAR(20) NOT NULL CHECK (item_type IN ('bombona','caixa','equipamento','outro')),
  quantity             INTEGER NOT NULL DEFAULT 1,
  unit                 VARCHAR(30) NOT NULL DEFAULT 'unidade',
  delivery_date        DATE NOT NULL,
  expected_return_date DATE,
  actual_return_date   DATE,
  delivery_condition   TEXT,
  return_condition     TEXT,
  contract_url         TEXT,
  status               VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','returned','lost')),
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_loans_partner ON partner_equipment_loans(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_loans_status  ON partner_equipment_loans(status);

-- ── Partner Deliveries (Entregas de mel) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS partner_deliveries (
  id                   SERIAL PRIMARY KEY,
  local_id             VARCHAR(36) UNIQUE NOT NULL,
  partner_id           INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  partner_apiary_id    INTEGER REFERENCES partner_apiaries(id) ON DELETE SET NULL,
  delivery_date        DATE NOT NULL,
  honey_type           VARCHAR(20) NOT NULL CHECK (honey_type IN ('vivo','maturado')),
  bee_species          VARCHAR(100),
  volume_ml            DECIMAL(10,2),
  weight_kg            DECIMAL(10,3),
  purchase_pct         DECIMAL(5,2) NOT NULL DEFAULT 70,
  accepted_volume_ml   DECIMAL(10,2),
  accepted_weight_kg   DECIMAL(10,3),
  price_per_kg         DECIMAL(10,2),
  total_value          DECIMAL(10,2),
  quality_status       VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (quality_status IN ('pending','approved','approved_with_observation','rejected')),
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_deliveries_partner ON partner_deliveries(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_deliveries_status  ON partner_deliveries(quality_status);
CREATE INDEX IF NOT EXISTS idx_partner_deliveries_date    ON partner_deliveries(delivery_date);

-- ── Partner Quality Tests ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS partner_quality_tests (
  id                   SERIAL PRIMARY KEY,
  delivery_id          INTEGER NOT NULL REFERENCES partner_deliveries(id) ON DELETE CASCADE,
  tested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tested_by            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  hmf                  DECIMAL(6,2),
  hmf_approved         BOOLEAN,
  moisture_pct         DECIMAL(4,1),
  moisture_approved    BOOLEAN,
  brix                 DECIMAL(4,1),
  visual_aspect        VARCHAR(30) CHECK (visual_aspect IN ('limpido','levemente_turvo','turvo')),
  aroma                VARCHAR(100),
  overall_result       VARCHAR(30) NOT NULL CHECK (overall_result IN ('approved','approved_with_observation','rejected')),
  observations         TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_quality_delivery ON partner_quality_tests(delivery_id);

-- ── Partner Payments ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS partner_payments (
  id                   SERIAL PRIMARY KEY,
  local_id             VARCHAR(36) UNIQUE NOT NULL,
  delivery_id          INTEGER NOT NULL REFERENCES partner_deliveries(id) ON DELETE CASCADE,
  partner_id           INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  installment          INTEGER NOT NULL CHECK (installment IN (1,2)),
  amount               DECIMAL(10,2) NOT NULL,
  due_date             DATE,
  paid_date            DATE,
  status               VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','cancelled')),
  payment_method       VARCHAR(50),
  receipt_url          TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_payments_partner  ON partner_payments(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_payments_delivery ON partner_payments(delivery_id);
CREATE INDEX IF NOT EXISTS idx_partner_payments_status   ON partner_payments(status);
