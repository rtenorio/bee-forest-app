-- Colheitas v2: volumes por caixa, status de maturação e observações de insumos

ALTER TABLE harvests
  ADD COLUMN IF NOT EXISTS hive_volumes       JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS maturation_status  VARCHAR(30)
    CHECK (maturation_status IN ('aguardando_maturacao', 'em_maturacao', 'concluido')),
  ADD COLUMN IF NOT EXISTS input_notes        TEXT NOT NULL DEFAULT '';
