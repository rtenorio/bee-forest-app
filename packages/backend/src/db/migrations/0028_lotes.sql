-- Migration 0028: rastreabilidade de lotes de mel

CREATE SEQUENCE IF NOT EXISTS lote_mel_seq START 1;

CREATE TABLE IF NOT EXISTS lotes_mel (
  id               SERIAL PRIMARY KEY,
  local_id         TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  codigo           TEXT UNIQUE NOT NULL,
  colheitas_ids    INTEGER[] NOT NULL DEFAULT '{}',
  apiary_local_id  TEXT NOT NULL,
  data_colheita    DATE NOT NULL,
  volume_total_ml  INTEGER NOT NULL CHECK (volume_total_ml > 0),
  umidade          NUMERIC(5,2),
  brix             NUMERIC(5,2),
  responsavel_id   INTEGER REFERENCES users(id),
  status           TEXT NOT NULL DEFAULT 'coletado'
                     CHECK (status IN ('coletado','desumidificando','maturando','envasado','vendido')),
  observacao       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS etapas_lote (
  id               SERIAL PRIMARY KEY,
  lote_local_id    TEXT NOT NULL REFERENCES lotes_mel(local_id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL CHECK (tipo IN ('desumidificacao','maturacao','envase','analise','outro')),
  data_inicio      DATE NOT NULL,
  data_fim         DATE,
  responsavel_id   INTEGER REFERENCES users(id),
  observacao       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS frascos_lote (
  id               SERIAL PRIMARY KEY,
  lote_local_id    TEXT NOT NULL REFERENCES lotes_mel(local_id) ON DELETE CASCADE,
  quantidade       INTEGER NOT NULL CHECK (quantidade > 0),
  volume_ml        INTEGER NOT NULL CHECK (volume_ml > 0),
  destino          TEXT CHECK (destino IN ('consumo_proprio','venda_direta','bee_forest_luxe','exportacao')),
  data_envase      DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lotes_apiary  ON lotes_mel(apiary_local_id);
CREATE INDEX IF NOT EXISTS idx_lotes_status  ON lotes_mel(status);
CREATE INDEX IF NOT EXISTS idx_lotes_data    ON lotes_mel(data_colheita);
CREATE INDEX IF NOT EXISTS idx_etapas_lote   ON etapas_lote(lote_local_id);
CREATE INDEX IF NOT EXISTS idx_frascos_lote  ON frascos_lote(lote_local_id);
