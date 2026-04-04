-- Migration 0009: Status de meliponários + novos campos de caixa

-- ── Apiários: adicionar campo status ─────────────────────────────────────────

ALTER TABLE apiaries ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'inactive'));

CREATE INDEX IF NOT EXISTS apiaries_status_idx ON apiaries(status);

-- ── Caixas: adicionar módulos e madeira ───────────────────────────────────────

ALTER TABLE hives ADD COLUMN IF NOT EXISTS modules_count INTEGER DEFAULT 1;
ALTER TABLE hives ADD COLUMN IF NOT EXISTS wood_type VARCHAR(50);
ALTER TABLE hives ADD COLUMN IF NOT EXISTS wood_type_other VARCHAR(100);
