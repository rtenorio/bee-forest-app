-- Migration 0027: tabela de custos de intervenção

CREATE TABLE IF NOT EXISTS custos_intervencao (
  id               SERIAL PRIMARY KEY,
  local_id         TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  hive_local_id    TEXT REFERENCES hives(local_id),
  apiary_local_id  TEXT NOT NULL,
  data             DATE NOT NULL,
  tipo             TEXT NOT NULL CHECK (tipo IN ('alimentacao','medicamento','mao_de_obra','equipamento','outro')),
  valor_reais      NUMERIC(10,2) NOT NULL CHECK (valor_reais >= 0),
  descricao        TEXT,
  responsavel_id   INTEGER REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custos_apiary ON custos_intervencao(apiary_local_id);
CREATE INDEX IF NOT EXISTS idx_custos_hive   ON custos_intervencao(hive_local_id);
CREATE INDEX IF NOT EXISTS idx_custos_data   ON custos_intervencao(data);
