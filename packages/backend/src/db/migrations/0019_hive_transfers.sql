-- Bee Forest App - Migration 0019: Transferência de caixas entre meliponários

-- 1. Tabela de transferências
CREATE TABLE IF NOT EXISTS hive_transfers (
  id                          SERIAL PRIMARY KEY,
  local_id                    VARCHAR(36) UNIQUE NOT NULL,
  hive_local_id               VARCHAR(36) NOT NULL,
  apiary_origin_local_id      VARCHAR(36) NOT NULL,
  apiary_destination_local_id VARCHAR(36) NOT NULL,
  transferred_at              DATE NOT NULL,
  transferred_by              VARCHAR(150) NOT NULL,
  reason                      TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ht_hive_idx    ON hive_transfers(hive_local_id);
CREATE INDEX IF NOT EXISTS ht_origin_idx  ON hive_transfers(apiary_origin_local_id);
CREATE INDEX IF NOT EXISTS ht_dest_idx    ON hive_transfers(apiary_destination_local_id);

-- 2. Adicionar apiary_origin_local_id à tabela hives
-- (registra o meliponário de nascimento/instalação original — nunca muda)
ALTER TABLE hives ADD COLUMN IF NOT EXISTS apiary_origin_local_id VARCHAR(36);

-- Preenche retroativamente: para caixas existentes, a origem é o apiary atual
UPDATE hives SET apiary_origin_local_id = apiary_local_id WHERE apiary_origin_local_id IS NULL;
