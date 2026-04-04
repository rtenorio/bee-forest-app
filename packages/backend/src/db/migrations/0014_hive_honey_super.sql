-- Migration 0014: melgueira (honey super) fields on hives

ALTER TABLE hives
  ADD COLUMN IF NOT EXISTS has_honey_super    BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS honey_super_placed_at  DATE,
  ADD COLUMN IF NOT EXISTS honey_super_removed_at DATE;
