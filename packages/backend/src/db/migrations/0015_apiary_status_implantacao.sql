-- Migration 0015: add 'implantacao' to apiaries status constraint

ALTER TABLE apiaries
  DROP CONSTRAINT IF EXISTS apiaries_status_check;

ALTER TABLE apiaries
  ADD CONSTRAINT apiaries_status_check
    CHECK (status IN ('active', 'inactive', 'implantacao'));
