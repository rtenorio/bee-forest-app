-- Migration 0029: adiciona suporte a fotos e metadados de IA nas inspeções

-- Tabela de fotos vinculadas à inspeção
CREATE TABLE IF NOT EXISTS inspection_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  tipo          VARCHAR(20) NOT NULL CHECK (tipo IN ('externa', 'interna')),
  storage_key   TEXT NOT NULL,         -- chave no storage (S3/Railway volume)
  content_type  VARCHAR(50) DEFAULT 'image/jpeg',
  tamanho_bytes INTEGER,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inspection_photos_inspection_id ON inspection_photos(inspection_id);

-- Coluna para armazenar o resultado bruto da análise de IA (JSONB)
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS ai_analysis   JSONB,
  ADD COLUMN IF NOT EXISTS ai_analisado_em TIMESTAMPTZ;

-- Comentários
COMMENT ON TABLE inspection_photos IS 'Fotos tiradas durante a inspeção (externa e interna da caixa)';
COMMENT ON COLUMN inspections.ai_analysis IS 'Resultado completo da análise por Claude Vision, incluindo campos sugeridos e confidence scores';
COMMENT ON COLUMN inspections.ai_analisado_em IS 'Timestamp da última análise de IA para esta inspeção';
