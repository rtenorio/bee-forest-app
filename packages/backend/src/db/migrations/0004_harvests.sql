-- Módulo de Colheitas (Harvests)

CREATE TABLE IF NOT EXISTS harvests (
  server_id             SERIAL PRIMARY KEY,
  local_id              VARCHAR(36) UNIQUE NOT NULL,
  apiary_id             INTEGER REFERENCES apiaries(server_id) ON DELETE SET NULL,
  apiary_local_id       VARCHAR(36) NOT NULL,
  harvested_at          DATE NOT NULL,
  responsible_name      VARCHAR(150) DEFAULT '',

  -- Caixas colhidas (desnormalizado para sync offline)
  hive_local_ids        TEXT[] DEFAULT '{}',

  -- Parâmetros de qualidade
  honey_type            VARCHAR(20) NOT NULL DEFAULT 'maturado'
                          CHECK (honey_type IN ('vivo', 'maturado')),
  total_volume_ml       NUMERIC(10, 2),
  total_weight_kg       NUMERIC(8, 3),
  humidity_pct          NUMERIC(5, 2),
  brix                  NUMERIC(5, 2),
  visual_aspect         VARCHAR(20) CHECK (visual_aspect IN ('clear', 'cloudy', 'crystallized')),
  bubbles               VARCHAR(10) CHECK (bubbles IN ('none', 'few', 'many')),
  paper_test            VARCHAR(10) CHECK (paper_test IN ('pass', 'fail')),
  viscosity             SMALLINT CHECK (viscosity BETWEEN 1 AND 5),

  -- Insumos fornecidos
  syrup_provided        BOOLEAN NOT NULL DEFAULT false,
  pollen_ball_provided  BOOLEAN NOT NULL DEFAULT false,
  wax_provided          BOOLEAN NOT NULL DEFAULT false,

  notes                 TEXT DEFAULT '',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS harvests_apiary_idx      ON harvests(apiary_id);
CREATE INDEX IF NOT EXISTS harvests_apiary_local_idx ON harvests(apiary_local_id);
CREATE INDEX IF NOT EXISTS harvests_date_idx        ON harvests(harvested_at DESC);

CREATE TRIGGER harvests_updated_at
  BEFORE UPDATE ON harvests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Tabela normalizada de vínculo colheita ↔ caixa (para consultas relacionais)
CREATE TABLE IF NOT EXISTS harvest_hives (
  id                SERIAL PRIMARY KEY,
  harvest_local_id  VARCHAR(36) NOT NULL REFERENCES harvests(local_id) ON DELETE CASCADE,
  hive_local_id     VARCHAR(36) NOT NULL,
  UNIQUE (harvest_local_id, hive_local_id)
);

CREATE INDEX IF NOT EXISTS harvest_hives_harvest_idx ON harvest_hives(harvest_local_id);
CREATE INDEX IF NOT EXISTS harvest_hives_hive_idx    ON harvest_hives(hive_local_id);
