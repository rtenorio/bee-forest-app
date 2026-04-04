-- Migration 0007: User Management — perfil master_admin + auditoria

-- 1. Adicionar master_admin ao ENUM de roles
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'master_admin';

-- 2. Novos campos na tabela users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone        VARCHAR(30),
  ADD COLUMN IF NOT EXISTS created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS observations TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS users_created_by_idx ON users(created_by);

-- 3. Tabela de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
  id              SERIAL PRIMARY KEY,
  actor_user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action          VARCHAR(50) NOT NULL,
  target_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_idx  ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS audit_logs_target_idx ON audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS audit_logs_date_idx   ON audit_logs(created_at DESC);
