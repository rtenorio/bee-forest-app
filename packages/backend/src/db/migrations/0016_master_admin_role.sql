-- Bee Forest App - Migration 0016: Adiciona role master_admin ao enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'master_admin';
