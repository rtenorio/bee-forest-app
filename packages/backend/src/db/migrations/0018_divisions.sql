-- Bee Forest App - Migration 0018: Módulo de divisão de caixas

CREATE TABLE IF NOT EXISTS hive_divisions (
  id                          SERIAL PRIMARY KEY,
  local_id                    VARCHAR(36) UNIQUE NOT NULL,
  hive_origin_local_id        VARCHAR(36) NOT NULL,
  apiary_origin_local_id      VARCHAR(36) NOT NULL,
  hive_new_local_id           VARCHAR(36),
  apiary_destination_local_id VARCHAR(36),
  status                      VARCHAR(10) NOT NULL DEFAULT 'pendente'
                                CHECK (status IN ('pendente', 'realizada', 'cancelada')),
  identified_at               DATE NOT NULL,
  identified_by               VARCHAR(150) NOT NULL,
  divided_at                  DATE,
  divided_by                  VARCHAR(150),
  notes                       TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at                  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS hd_origin_idx   ON hive_divisions(hive_origin_local_id);
CREATE INDEX IF NOT EXISTS hd_apiary_idx   ON hive_divisions(apiary_origin_local_id);
CREATE INDEX IF NOT EXISTS hd_status_idx   ON hive_divisions(status);

CREATE TRIGGER hive_divisions_updated_at
  BEFORE UPDATE ON hive_divisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
