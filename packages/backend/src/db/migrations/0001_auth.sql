-- Bee Forest App - Migration 0001: Autenticação e Controle de Acesso

CREATE TYPE user_role AS ENUM ('socio', 'responsavel', 'tratador');

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          user_role NOT NULL DEFAULT 'tratador',
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Associa Responsável a um ou mais meliponários
CREATE TABLE IF NOT EXISTS user_apiary_assignments (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  apiary_local_id VARCHAR(36) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, apiary_local_id)
);

CREATE INDEX IF NOT EXISTS uaa_user_idx ON user_apiary_assignments(user_id);

-- Associa Tratador a colmeias específicas
CREATE TABLE IF NOT EXISTS user_hive_assignments (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hive_local_id   VARCHAR(36) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, hive_local_id)
);

CREATE INDEX IF NOT EXISTS uha_user_idx ON user_hive_assignments(user_id);
