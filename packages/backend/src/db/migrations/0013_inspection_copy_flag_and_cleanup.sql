-- Migration 0013: copied_from_previous flag + limpeza de meliponários vazios

-- ── Inspections: flag de inspeção repetida ────────────────────────────────────

ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS copied_from_previous BOOLEAN NOT NULL DEFAULT false;

-- ── Deletar meliponários sem dados vinculados ─────────────────────────────────
-- Verifica hives, harvests e honey_batches (incluindo soft-deletados).
-- Se houver qualquer vínculo: desativa. Se não houver: deleta permanentemente.

DO $$
DECLARE
  v_names  TEXT[] := ARRAY['Boca da Mata', 'Canhotinho', 'Marechal'];
  v_name   TEXT;
  v_local  TEXT;
  v_count  INTEGER;
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    SELECT local_id INTO v_local
      FROM apiaries
      WHERE name ILIKE v_name AND deleted_at IS NULL
      LIMIT 1;

    IF v_local IS NULL THEN
      RAISE NOTICE 'Meliponário "%" não encontrado ou já removido — ignorado.', v_name;
      CONTINUE;
    END IF;

    SELECT COUNT(*) INTO v_count FROM (
      SELECT 1 FROM hives         WHERE apiary_local_id = v_local
      UNION ALL
      SELECT 1 FROM harvests      WHERE apiary_local_id = v_local
      UNION ALL
      SELECT 1 FROM honey_batches WHERE apiary_local_id = v_local
    ) t;

    IF v_count > 0 THEN
      UPDATE apiaries
        SET status = 'inactive', updated_at = NOW()
        WHERE local_id = v_local;
      RAISE NOTICE 'Meliponário "%" tem % registro(s) vinculado(s) — desativado (não deletado).', v_name, v_count;
    ELSE
      DELETE FROM apiaries WHERE local_id = v_local;
      RAISE NOTICE 'Meliponário "%" deletado permanentemente (sem vínculos).', v_name;
    END IF;
  END LOOP;
END $$;
