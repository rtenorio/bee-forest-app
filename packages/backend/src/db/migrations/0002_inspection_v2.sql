-- Inspection v2: add audio_notes column
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS audio_notes TEXT[] DEFAULT '{}';
