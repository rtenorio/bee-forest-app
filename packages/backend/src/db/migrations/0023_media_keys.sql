-- Migration 0023: Armazenar object keys do R2 em vez de URLs permanentes
-- As colunas _url existentes são mantidas para rollback seguro.
-- Após validar a migration em produção, elas podem ser removidas numa migration futura.

-- ── hive_instructions ─────────────────────────────────────────────────────────

ALTER TABLE hive_instructions
  ADD COLUMN IF NOT EXISTS audio_key TEXT;

-- Popula audio_key extraindo o path após o domínio da URL pública armazenada
-- Ex: "https://pub-xxx.r2.dev/instructions/uuid-file.webm"
--  →  "instructions/uuid-file.webm"
UPDATE hive_instructions
SET audio_key = regexp_replace(audio_url, '^https?://[^/]+/', '')
WHERE audio_url IS NOT NULL AND audio_url <> '';

-- ── hive_instruction_responses ────────────────────────────────────────────────

ALTER TABLE hive_instruction_responses
  ADD COLUMN IF NOT EXISTS audio_key TEXT;

UPDATE hive_instruction_responses
SET audio_key = regexp_replace(audio_url, '^https?://[^/]+/', '')
WHERE audio_url IS NOT NULL AND audio_url <> '';

-- ── inspections ───────────────────────────────────────────────────────────────

ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS photo_keys  TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS audio_keys  TEXT[] DEFAULT '{}';

-- Popula photo_keys a partir do array photos (extrai path de cada URL)
UPDATE inspections
SET photo_keys = ARRAY(
  SELECT regexp_replace(url, '^https?://[^/]+/', '')
  FROM unnest(photos) AS url
  WHERE url IS NOT NULL AND url <> ''
)
WHERE array_length(photos, 1) > 0;

-- Popula audio_keys a partir do array audio_notes
UPDATE inspections
SET audio_keys = ARRAY(
  SELECT regexp_replace(url, '^https?://[^/]+/', '')
  FROM unnest(audio_notes) AS url
  WHERE url IS NOT NULL AND url <> ''
)
WHERE array_length(audio_notes, 1) > 0;
