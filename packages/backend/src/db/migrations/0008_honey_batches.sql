-- Migration 0008: Módulo de Processamento Pós-Colheita

-- ── Tipos ENUM ────────────────────────────────────────────────────────────────

CREATE TYPE batch_status AS ENUM (
  'collected',
  'in_natura_ready',
  'in_dehumidification',
  'dehumidified',
  'in_maturation',
  'matured',
  'bottled',
  'sold',
  'rejected'
);

CREATE TYPE processing_route AS ENUM (
  'in_natura',
  'dehumidified',
  'matured',
  'dehumidified_then_matured'
);

CREATE TYPE dehumidification_method AS ENUM (
  'passive_controlled_room',
  'dehumidifier_room',
  'airflow_assisted',
  'other'
);

CREATE TYPE dehumidification_result AS ENUM (
  'in_progress',
  'completed',
  'interrupted',
  'failed'
);

CREATE TYPE maturation_status_enum AS ENUM (
  'in_progress',
  'completed',
  'interrupted',
  'spoiled'
);

CREATE TYPE maturation_decision AS ENUM (
  'approved',
  'approved_with_observation',
  'rejected',
  'redirected_for_new_processing'
);

CREATE TYPE closure_type AS ENUM (
  'loose_cap',
  'sealed_cap',
  'cork',
  'silicone_airlock',
  's_bubbler_airlock',
  'three_piece_airlock',
  'other'
);

CREATE TYPE sale_type AS ENUM (
  'retail',
  'wholesale',
  'internal_use',
  'sample',
  'discard',
  'other'
);

-- ── Sequência para código LOT-YYYY-NNN ────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS honey_batch_seq START 1;

-- ── honey_batches ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS honey_batches (
  id                             SERIAL PRIMARY KEY,
  local_id                       VARCHAR(36) NOT NULL UNIQUE,
  code                           VARCHAR(20) NOT NULL UNIQUE,  -- LOT-YYYY-NNN
  apiary_id                      INTEGER REFERENCES apiaries(server_id) ON DELETE SET NULL,
  apiary_local_id                VARCHAR(36) NOT NULL,
  harvest_local_id               VARCHAR(36),
  harvest_date                   DATE NOT NULL,
  honey_type                     VARCHAR(20) NOT NULL CHECK (honey_type IN ('vivo', 'maturado')),
  bee_species                    VARCHAR(120),
  floral_context                 TEXT,
  gross_weight_grams             NUMERIC(10,2),
  net_weight_grams               NUMERIC(10,2),
  initial_moisture               NUMERIC(5,2),
  initial_brix                   NUMERIC(5,2),
  current_status                 batch_status NOT NULL DEFAULT 'collected',
  processing_route               processing_route NOT NULL DEFAULT 'in_natura',
  is_bottled                     BOOLEAN NOT NULL DEFAULT FALSE,
  is_sold                        BOOLEAN NOT NULL DEFAULT FALSE,
  final_destination              TEXT,
  collection_responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes                          TEXT NOT NULL DEFAULT '',
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                     TIMESTAMPTZ,
  server_id                      INTEGER,
  synced_at                      TIMESTAMPTZ,
  is_dirty                       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS honey_batches_apiary_idx    ON honey_batches(apiary_local_id);
CREATE INDEX IF NOT EXISTS honey_batches_status_idx    ON honey_batches(current_status);
CREATE INDEX IF NOT EXISTS honey_batches_date_idx      ON honey_batches(harvest_date DESC);
CREATE INDEX IF NOT EXISTS honey_batches_deleted_idx   ON honey_batches(deleted_at);

-- ── dehumidification_sessions ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dehumidification_sessions (
  id                         SERIAL PRIMARY KEY,
  local_id                   VARCHAR(36) NOT NULL UNIQUE,
  batch_local_id             VARCHAR(36) NOT NULL REFERENCES honey_batches(local_id) ON DELETE CASCADE,
  start_datetime             TIMESTAMPTZ NOT NULL,
  end_datetime               TIMESTAMPTZ,
  method                     dehumidification_method NOT NULL DEFAULT 'passive_controlled_room',
  equipment                  VARCHAR(200),
  room_name                  VARCHAR(200),
  ambient_temperature_start  NUMERIC(5,2),
  ambient_humidity_start     NUMERIC(5,2),
  initial_moisture           NUMERIC(5,2),
  initial_brix               NUMERIC(5,2),
  final_moisture             NUMERIC(5,2),
  final_brix                 NUMERIC(5,2),
  responsible_user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  result_status              dehumidification_result NOT NULL DEFAULT 'in_progress',
  notes                      TEXT NOT NULL DEFAULT '',
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dehum_sessions_batch_idx ON dehumidification_sessions(batch_local_id);

-- ── dehumidification_measurements ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dehumidification_measurements (
  id                            SERIAL PRIMARY KEY,
  local_id                      VARCHAR(36) NOT NULL UNIQUE,
  dehumidification_session_id   INTEGER NOT NULL REFERENCES dehumidification_sessions(id) ON DELETE CASCADE,
  measured_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  moisture                      NUMERIC(5,2) NOT NULL,
  brix                          NUMERIC(5,2),
  ambient_temperature           NUMERIC(5,2),
  ambient_humidity              NUMERIC(5,2),
  notes                         TEXT,
  created_by                    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dehum_measurements_session_idx ON dehumidification_measurements(dehumidification_session_id);

-- ── maturation_sessions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS maturation_sessions (
  id                                   SERIAL PRIMARY KEY,
  local_id                             VARCHAR(36) NOT NULL UNIQUE,
  batch_local_id                       VARCHAR(36) NOT NULL REFERENCES honey_batches(local_id) ON DELETE CASCADE,
  linked_dehumidification_session_id   INTEGER REFERENCES dehumidification_sessions(id) ON DELETE SET NULL,
  start_datetime                       TIMESTAMPTZ NOT NULL,
  end_datetime                         TIMESTAMPTZ,
  container_type                       VARCHAR(100),
  container_material                   VARCHAR(100),
  closure_type                         closure_type NOT NULL DEFAULT 'loose_cap',
  has_airlock                          BOOLEAN NOT NULL DEFAULT FALSE,
  maturation_location                  VARCHAR(200),
  ambient_temperature_start            NUMERIC(5,2),
  ambient_humidity_start               NUMERIC(5,2),
  responsible_user_id                  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  maturation_status                    maturation_status_enum NOT NULL DEFAULT 'in_progress',
  sensory_notes_start                  TEXT,
  final_decision                       maturation_decision,
  final_notes                          TEXT,
  created_at                           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS maturation_sessions_batch_idx ON maturation_sessions(batch_local_id);

-- ── maturation_observations ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS maturation_observations (
  id                       SERIAL PRIMARY KEY,
  local_id                 VARCHAR(36) NOT NULL UNIQUE,
  maturation_session_id    INTEGER NOT NULL REFERENCES maturation_sessions(id) ON DELETE CASCADE,
  observed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ambient_temperature      NUMERIC(5,2),
  ambient_humidity         NUMERIC(5,2),
  bubbles_present          BOOLEAN NOT NULL DEFAULT FALSE,
  foam_present             BOOLEAN NOT NULL DEFAULT FALSE,
  pressure_signs           BOOLEAN NOT NULL DEFAULT FALSE,
  aroma_change             BOOLEAN NOT NULL DEFAULT FALSE,
  phase_separation         BOOLEAN NOT NULL DEFAULT FALSE,
  visible_fermentation_signs BOOLEAN NOT NULL DEFAULT FALSE,
  observation_text         TEXT,
  created_by               INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS maturation_obs_session_idx ON maturation_observations(maturation_session_id);

-- ── batch_bottlings ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS batch_bottlings (
  id                       SERIAL PRIMARY KEY,
  local_id                 VARCHAR(36) NOT NULL UNIQUE,
  batch_local_id           VARCHAR(36) NOT NULL REFERENCES honey_batches(local_id) ON DELETE CASCADE,
  bottled_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  container_type           VARCHAR(100),
  package_size_ml          NUMERIC(8,2),
  quantity_filled          INTEGER,
  total_volume_bottled_ml  NUMERIC(10,2),
  responsible_user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS batch_bottlings_batch_idx ON batch_bottlings(batch_local_id);

-- ── batch_sales ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS batch_sales (
  id                 SERIAL PRIMARY KEY,
  local_id           VARCHAR(36) NOT NULL UNIQUE,
  batch_local_id     VARCHAR(36) NOT NULL REFERENCES honey_batches(local_id) ON DELETE CASCADE,
  sold_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sale_type          sale_type NOT NULL DEFAULT 'retail',
  destination        VARCHAR(200),
  quantity_units     INTEGER,
  total_volume_ml    NUMERIC(10,2),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS batch_sales_batch_idx ON batch_sales(batch_local_id);
