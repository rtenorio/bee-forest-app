-- Migration 0021: adiciona secondary_role na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS secondary_role VARCHAR(50) DEFAULT NULL;
