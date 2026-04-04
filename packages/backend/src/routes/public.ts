import { Router } from 'express';
import { queryOne, query } from '../db/connection';

const router = Router();

/**
 * GET /api/public/hives/:codigo
 * Rastreabilidade pública — sem autenticação
 * Retorna dados da caixa, última inspeção e histórico de colheitas
 */
router.get('/hives/:codigo', async (req, res, next) => {
  try {
    const { codigo } = req.params;

    const hiveRow = await queryOne<Record<string, unknown>>(
      `SELECT h.local_id, h.code, h.status, h.box_type, h.qr_code,
              h.installation_date,
              a.name AS apiary_name, a.location AS apiary_location,
              s.name AS species_name, s.scientific_name AS species_scientific_name
       FROM hives h
       LEFT JOIN apiaries a ON h.apiary_local_id = a.local_id
       LEFT JOIN species s  ON h.species_id = s.server_id
       WHERE (LOWER(h.qr_code) = LOWER($1) OR LOWER(h.code) = LOWER($1))
         AND h.deleted_at IS NULL`,
      [codigo]
    );

    if (!hiveRow) {
      res.status(404).json({ error: 'Caixa não encontrada' });
      return;
    }

    const hiveLocalId = hiveRow.local_id as string;

    const lastInspection = await queryOne<Record<string, unknown>>(
      `SELECT inspected_at, inspector_name,
              checklist->>'overall_status' AS overall_status
       FROM inspections
       WHERE hive_local_id = $1 AND deleted_at IS NULL
       ORDER BY inspected_at DESC
       LIMIT 1`,
      [hiveLocalId]
    );

    const harvests = await query<Record<string, unknown>>(
      `SELECT h.harvested_at, h.honey_type, h.brix, h.humidity_pct,
              h.total_volume_ml, h.maturation_status
       FROM harvests h
       JOIN harvest_hives hh ON hh.harvest_local_id = h.local_id
       WHERE hh.hive_local_id = $1 AND h.deleted_at IS NULL
       ORDER BY h.harvested_at DESC
       LIMIT 10`,
      [hiveLocalId]
    );

    res.json({
      local_id: hiveLocalId,
      code: hiveRow.code,
      status: hiveRow.status,
      box_type: hiveRow.box_type,
      qr_code: hiveRow.qr_code,
      installation_date: hiveRow.installation_date,
      apiary_name: hiveRow.apiary_name,
      apiary_location: hiveRow.apiary_location,
      species_name: hiveRow.species_name,
      species_scientific_name: hiveRow.species_scientific_name,
      last_inspection: lastInspection ?? null,
      harvests: harvests ?? [],
    });
  } catch (err) {
    next(err);
  }
});

export default router;
