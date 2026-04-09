-- Migration 0025: Sistema formal de tarefas com SLA nas instruções
-- Expande hive_instructions e hive_instruction_responses com campos de SLA,
-- evidência e validação. Migra status legados (pending→pendente, done→concluida).

-- ── hive_instructions ─────────────────────────────────────────────────────────

-- 1. Remover constraint de status antiga
ALTER TABLE hive_instructions DROP CONSTRAINT IF EXISTS hive_instructions_status_check;

-- 2. Alterar coluna status para TEXT (era VARCHAR(10), precisa de mais espaço)
ALTER TABLE hive_instructions ALTER COLUMN status TYPE TEXT;

-- 3. Migrar valores antigos
UPDATE hive_instructions SET status = 'pendente'  WHERE status = 'pending';
UPDATE hive_instructions SET status = 'concluida' WHERE status = 'done';

-- 4. Aplicar novo CHECK
ALTER TABLE hive_instructions
  ADD CONSTRAINT hive_instructions_status_check
  CHECK (status IN ('pendente', 'em_execucao', 'concluida', 'validada', 'rejeitada'));

-- 5. Novos campos SLA
ALTER TABLE hive_instructions
  ADD COLUMN IF NOT EXISTS prazo_conclusao  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS evidencia_url    TEXT,
  ADD COLUMN IF NOT EXISTS evidencia_key    TEXT,
  ADD COLUMN IF NOT EXISTS validado_por     INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS validado_em      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao  TEXT;

CREATE INDEX IF NOT EXISTS hi_prazo_idx   ON hive_instructions(prazo_conclusao);
CREATE INDEX IF NOT EXISTS hi_status2_idx ON hive_instructions(status);

-- ── hive_instruction_responses ────────────────────────────────────────────────

-- 1. Adicionar coluna status (não existia antes)
ALTER TABLE hive_instruction_responses
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'em_execucao', 'concluida', 'validada', 'rejeitada'));

-- 2. Novos campos
ALTER TABLE hive_instruction_responses
  ADD COLUMN IF NOT EXISTS prazo_conclusao  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS evidencia_url    TEXT,
  ADD COLUMN IF NOT EXISTS evidencia_key    TEXT,
  ADD COLUMN IF NOT EXISTS validado_por     INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS validado_em      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao  TEXT;
