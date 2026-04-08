-- Instruction priority: add priority_days and due_date columns
ALTER TABLE hive_instructions
  ADD COLUMN IF NOT EXISTS priority_days INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT NULL;
