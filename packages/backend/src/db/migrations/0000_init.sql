-- Bee Forest App - Initial Migration

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Species (abelhas sem ferrão)
CREATE TABLE IF NOT EXISTS species (
  server_id       SERIAL PRIMARY KEY,
  local_id        VARCHAR(36) UNIQUE NOT NULL,
  name            VARCHAR(100) NOT NULL,
  scientific_name VARCHAR(150) DEFAULT '',
  description     TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE TRIGGER species_updated_at
  BEFORE UPDATE ON species
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Meliponários
CREATE TABLE IF NOT EXISTS apiaries (
  server_id   SERIAL PRIMARY KEY,
  local_id    VARCHAR(36) UNIQUE NOT NULL,
  name        VARCHAR(150) NOT NULL,
  location    VARCHAR(255) DEFAULT '',
  latitude    NUMERIC(10, 7),
  longitude   NUMERIC(10, 7),
  owner_name  VARCHAR(150) DEFAULT '',
  notes       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE TRIGGER apiaries_updated_at
  BEFORE UPDATE ON apiaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Colmeias
CREATE TABLE IF NOT EXISTS hives (
  server_id         SERIAL PRIMARY KEY,
  local_id          VARCHAR(36) UNIQUE NOT NULL,
  apiary_id         INTEGER REFERENCES apiaries(server_id) ON DELETE SET NULL,
  apiary_local_id   VARCHAR(36) NOT NULL,
  species_id        INTEGER REFERENCES species(server_id) ON DELETE SET NULL,
  species_local_id  VARCHAR(36),
  code              VARCHAR(50) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','dead','transferred')),
  installation_date DATE,
  box_type          VARCHAR(50) DEFAULT '',
  notes             TEXT DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS hives_apiary_idx ON hives(apiary_id);
CREATE INDEX IF NOT EXISTS hives_apiary_local_idx ON hives(apiary_local_id);
CREATE INDEX IF NOT EXISTS hives_status_idx ON hives(status);

CREATE TRIGGER hives_updated_at
  BEFORE UPDATE ON hives
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Inspeções
CREATE TABLE IF NOT EXISTS inspections (
  server_id             SERIAL PRIMARY KEY,
  local_id              VARCHAR(36) UNIQUE NOT NULL,
  hive_id               INTEGER REFERENCES hives(server_id) ON DELETE CASCADE,
  hive_local_id         VARCHAR(36) NOT NULL,
  inspected_at          TIMESTAMPTZ NOT NULL,
  inspector_name        VARCHAR(150) DEFAULT '',
  checklist             JSONB NOT NULL DEFAULT '{}',
  weight_kg             NUMERIC(6, 3),
  temperature_c         NUMERIC(4, 1),
  weather               VARCHAR(20) CHECK (weather IN ('sunny','cloudy','rainy')),
  notes                 TEXT DEFAULT '',
  photos                TEXT[] DEFAULT '{}',
  next_inspection_due   DATE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS inspections_hive_idx ON inspections(hive_id);
CREATE INDEX IF NOT EXISTS inspections_hive_local_idx ON inspections(hive_local_id);
CREATE INDEX IF NOT EXISTS inspections_date_idx ON inspections(inspected_at DESC);

CREATE TRIGGER inspections_updated_at
  BEFORE UPDATE ON inspections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Produções (colheitas)
CREATE TABLE IF NOT EXISTS productions (
  server_id     SERIAL PRIMARY KEY,
  local_id      VARCHAR(36) UNIQUE NOT NULL,
  hive_id       INTEGER REFERENCES hives(server_id) ON DELETE CASCADE,
  hive_local_id VARCHAR(36) NOT NULL,
  product_type  VARCHAR(30) NOT NULL
                CHECK (product_type IN ('honey','propolis','pollen','wax')),
  quantity_g    NUMERIC(10, 2) NOT NULL,
  harvested_at  DATE NOT NULL,
  quality_grade VARCHAR(10) CHECK (quality_grade IN ('A','B','C')),
  notes         TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS productions_hive_idx ON productions(hive_id);
CREATE INDEX IF NOT EXISTS productions_hive_local_idx ON productions(hive_local_id);
CREATE INDEX IF NOT EXISTS productions_date_idx ON productions(harvested_at DESC);

CREATE TRIGGER productions_updated_at
  BEFORE UPDATE ON productions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Alimentações
CREATE TABLE IF NOT EXISTS feedings (
  server_id     SERIAL PRIMARY KEY,
  local_id      VARCHAR(36) UNIQUE NOT NULL,
  hive_id       INTEGER REFERENCES hives(server_id) ON DELETE CASCADE,
  hive_local_id VARCHAR(36) NOT NULL,
  feed_type     VARCHAR(50) NOT NULL
                CHECK (feed_type IN ('sugar_syrup','honey','pollen_sub','other')),
  quantity_ml   NUMERIC(8, 2),
  fed_at        DATE NOT NULL,
  notes         TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS feedings_hive_idx ON feedings(hive_id);
CREATE INDEX IF NOT EXISTS feedings_hive_local_idx ON feedings(hive_local_id);
CREATE INDEX IF NOT EXISTS feedings_date_idx ON feedings(fed_at DESC);

CREATE TRIGGER feedings_updated_at
  BEFORE UPDATE ON feedings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Log de sincronização
CREATE TABLE IF NOT EXISTS sync_log (
  id           SERIAL PRIMARY KEY,
  client_id    VARCHAR(36) NOT NULL,
  synced_at    TIMESTAMPTZ DEFAULT NOW(),
  items_pushed INTEGER DEFAULT 0,
  items_pulled INTEGER DEFAULT 0,
  conflicts    INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS sync_log_client_idx ON sync_log(client_id);
CREATE INDEX IF NOT EXISTS sync_log_date_idx ON sync_log(synced_at DESC);

-- Espécies padrão do Brasil
INSERT INTO species (local_id, name, scientific_name, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Jataí', 'Tetragonisca angustula', 'Abelha muito dócil, mel de sabor suave, colmeias pequenas.'),
  ('00000000-0000-0000-0000-000000000002', 'Mandaçaia', 'Melipona quadrifasciata', 'Produção moderada de mel, boa para meliponicultura.'),
  ('00000000-0000-0000-0000-000000000003', 'Uruçu', 'Melipona scutellaris', 'Alta produção de mel, nativa do nordeste.'),
  ('00000000-0000-0000-0000-000000000004', 'Tiúba', 'Melipona compressipes', 'Popular no Maranhão, mel muito apreciado.'),
  ('00000000-0000-0000-0000-000000000005', 'Canudo', 'Scaptotrigona postica', 'Agressiva, boa produtora de mel e pólen.'),
  ('00000000-0000-0000-0000-000000000006', 'Iraí', 'Nannotrigona testaceicornis', 'Abelha pequena e dócil, mel aromático.'),
  ('00000000-0000-0000-0000-000000000007', 'Tubi', 'Frieseomelitta varia', 'Coleta muita resina e própolis.'),
  ('00000000-0000-0000-0000-000000000008', 'Mirim', 'Plebeia sp.', 'Muito pequena, mel ácido e aromático.')
ON CONFLICT (local_id) DO NOTHING;
