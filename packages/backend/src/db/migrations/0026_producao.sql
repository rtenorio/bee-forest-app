-- Migration 0026: tabela de produção por colmeia

CREATE TABLE IF NOT EXISTS producao (
  id               SERIAL PRIMARY KEY,
  local_id         TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  hive_local_id    TEXT NOT NULL REFERENCES hives(local_id),
  apiary_local_id  TEXT NOT NULL,
  data_colheita    DATE NOT NULL,
  volume_ml        INTEGER NOT NULL CHECK (volume_ml > 0),
  responsavel_id   INTEGER REFERENCES users(id),
  observacao       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_producao_hive        ON producao(hive_local_id);
CREATE INDEX IF NOT EXISTS idx_producao_apiary      ON producao(apiary_local_id);
CREATE INDEX IF NOT EXISTS idx_producao_data        ON producao(data_colheita);
