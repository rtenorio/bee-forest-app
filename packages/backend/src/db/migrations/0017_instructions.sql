-- Bee Forest App - Migration 0017: Módulo de instruções orientador ↔ tratador

-- 1. Adicionar role orientador ao enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'orientador';

-- 2. Tabela de instruções por caixa ou por meliponário
CREATE TABLE IF NOT EXISTS hive_instructions (
  id               SERIAL PRIMARY KEY,
  local_id         VARCHAR(36) UNIQUE NOT NULL,
  hive_local_id    VARCHAR(36),                        -- NULL = instrução por meliponário
  apiary_local_id  VARCHAR(36) NOT NULL,
  author_id        INTEGER NOT NULL REFERENCES users(id),
  text_content     TEXT,
  audio_url        TEXT,
  status           VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS hi_apiary_idx  ON hive_instructions(apiary_local_id);
CREATE INDEX IF NOT EXISTS hi_hive_idx    ON hive_instructions(hive_local_id);
CREATE INDEX IF NOT EXISTS hi_author_idx  ON hive_instructions(author_id);
CREATE INDEX IF NOT EXISTS hi_status_idx  ON hive_instructions(status);

CREATE TRIGGER hive_instructions_updated_at
  BEFORE UPDATE ON hive_instructions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Tabela de respostas do tratador
CREATE TABLE IF NOT EXISTS hive_instruction_responses (
  id                    SERIAL PRIMARY KEY,
  local_id              VARCHAR(36) UNIQUE NOT NULL,
  instruction_local_id  VARCHAR(36) NOT NULL,
  tratador_id           INTEGER NOT NULL REFERENCES users(id),
  text_content          TEXT,
  audio_url             TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS hir_instruction_idx ON hive_instruction_responses(instruction_local_id);
CREATE INDEX IF NOT EXISTS hir_tratador_idx    ON hive_instruction_responses(tratador_id);
