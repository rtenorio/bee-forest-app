-- Migration 0024: Extend audit_logs for comprehensive audit trail
-- The table already exists from migration 0007 with basic user-management columns.
-- We add columns to support full resource-level auditing across all modules.

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS user_name      TEXT,
  ADD COLUMN IF NOT EXISTS user_role      TEXT,
  ADD COLUMN IF NOT EXISTS resource_type  TEXT,
  ADD COLUMN IF NOT EXISTS resource_id    TEXT,
  ADD COLUMN IF NOT EXISTS resource_label TEXT,
  ADD COLUMN IF NOT EXISTS payload        JSONB,
  ADD COLUMN IF NOT EXISTS ip_address     TEXT;

CREATE INDEX IF NOT EXISTS audit_logs_resource_type_idx ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS audit_logs_resource_id_idx   ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx        ON audit_logs(action);
