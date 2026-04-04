import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, query, queryOne } from '../db/connection';
import { requireRole } from '../middleware/requireRole';
import type { Request } from 'express';
import type { PoolClient } from 'pg';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function scopeClause(req: Request): { clause: string; params: unknown[] } {
  const { role, apiary_local_ids } = req.user!;
  if (role === 'responsavel') {
    if (apiary_local_ids.length === 0) return { clause: 'AND false', params: [] };
    return { clause: 'AND b.apiary_local_id = ANY($1::varchar[])', params: [apiary_local_ids] };
  }
  return { clause: '', params: [] };
}

async function generateBatchCode(client: PoolClient): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await client.query("SELECT nextval('honey_batch_seq') AS n");
  const n = String(seq.rows[0].n).padStart(3, '0');
  return `LOT-${year}-${n}`;
}

async function logBatchAudit(
  actorId: number,
  action: string,
  batchLocalId: string,
  metadata: Record<string, unknown> = {}
) {
  await queryOne(
    `INSERT INTO audit_logs (actor_user_id, action, metadata) VALUES ($1, $2, $3)`,
    [actorId, action, JSON.stringify({ batch_local_id: batchLocalId, ...metadata })]
  );
}

async function fetchBatchDetail(local_id: string) {
  const batch = await queryOne<Record<string, unknown>>(
    `SELECT b.*, a.name AS apiary_name
     FROM honey_batches b
     LEFT JOIN apiaries a ON a.local_id = b.apiary_local_id
     WHERE b.local_id = $1 AND b.deleted_at IS NULL`,
    [local_id]
  );
  if (!batch) return null;

  const dehumSessions = await query<Record<string, unknown>>(
    `SELECT * FROM dehumidification_sessions WHERE batch_local_id = $1 ORDER BY start_datetime`,
    [local_id]
  );

  for (const s of dehumSessions) {
    s.measurements = await query(
      `SELECT * FROM dehumidification_measurements WHERE dehumidification_session_id = $1 ORDER BY measured_at`,
      [s.id]
    );
  }

  const matSessions = await query<Record<string, unknown>>(
    `SELECT * FROM maturation_sessions WHERE batch_local_id = $1 ORDER BY start_datetime`,
    [local_id]
  );

  for (const s of matSessions) {
    s.observations = await query(
      `SELECT * FROM maturation_observations WHERE maturation_session_id = $1 ORDER BY observed_at`,
      [s.id]
    );
  }

  const bottlings = await query(
    `SELECT * FROM batch_bottlings WHERE batch_local_id = $1 ORDER BY bottled_at`,
    [local_id]
  );

  const sales = await query(
    `SELECT * FROM batch_sales WHERE batch_local_id = $1 ORDER BY sold_at`,
    [local_id]
  );

  const auditLogs = await query(
    `SELECT al.id, al.action, al.metadata, al.created_at, u.name AS actor_name
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.actor_user_id
     WHERE al.metadata->>'batch_local_id' = $1
     ORDER BY al.created_at DESC LIMIT 20`,
    [local_id]
  );

  return {
    ...batch,
    dehumidification_sessions: dehumSessions,
    maturation_sessions: matSessions,
    bottlings,
    sales,
    audit_logs: auditLogs,
  };
}

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const { apiary_local_id, status, route, period } = req.query;

    const conditions: string[] = ['b.deleted_at IS NULL'];
    const params: unknown[] = [];

    if (user.role === 'responsavel') {
      const ids = user.apiary_local_ids;
      if (ids.length === 0) { res.json([]); return; }
      params.push(ids);
      conditions.push(`b.apiary_local_id = ANY($${params.length}::varchar[])`);
    }

    if (apiary_local_id) {
      params.push(apiary_local_id);
      conditions.push(`b.apiary_local_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`b.current_status = $${params.length}::batch_status`);
    }

    if (route) {
      params.push(route);
      conditions.push(`b.processing_route = $${params.length}::processing_route`);
    }

    if (period) {
      const days = parseInt(period as string, 10);
      if (!isNaN(days)) {
        params.push(days);
        conditions.push(`b.harvest_date >= NOW() - ($${params.length} || ' days')::interval`);
      }
    }

    const rows = await query(
      `SELECT b.*, a.name AS apiary_name
       FROM honey_batches b
       LEFT JOIN apiaries a ON a.local_id = b.apiary_local_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY b.harvest_date DESC
       LIMIT 300`,
      params
    );

    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /quality-summary ─────────────────────────────────────────────────────

router.get('/quality-summary', async (req, res, next) => {
  try {
    const { clause: scopeFilter, params: scopeParams } = scopeClause(req);

    const [attention, inProcessing, readyForNext, stats] = await Promise.all([
      query(
        `SELECT b.*, a.name AS apiary_name,
          (b.initial_moisture > 30) AS high_moisture,
          (b.current_status = 'collected' AND b.created_at < NOW() - INTERVAL '7 days') AS stale,
          EXISTS (
            SELECT 1 FROM maturation_sessions ms
            JOIN maturation_observations mo ON mo.maturation_session_id = ms.id
            WHERE ms.batch_local_id = b.local_id AND mo.visible_fermentation_signs = TRUE
          ) AS has_fermentation_signs
         FROM honey_batches b
         LEFT JOIN apiaries a ON a.local_id = b.apiary_local_id
         WHERE b.deleted_at IS NULL AND b.current_status NOT IN ('sold', 'rejected')
           ${scopeFilter}
           AND (
             b.initial_moisture > 30
             OR (b.current_status = 'collected' AND b.created_at < NOW() - INTERVAL '7 days')
             OR EXISTS (
               SELECT 1 FROM maturation_sessions ms
               JOIN maturation_observations mo ON mo.maturation_session_id = ms.id
               WHERE ms.batch_local_id = b.local_id AND mo.visible_fermentation_signs = TRUE
             )
           )
         ORDER BY b.created_at DESC`,
        scopeParams
      ),
      query(
        `SELECT b.*, a.name AS apiary_name
         FROM honey_batches b
         LEFT JOIN apiaries a ON a.local_id = b.apiary_local_id
         WHERE b.deleted_at IS NULL AND b.current_status IN ('in_dehumidification', 'in_maturation')
           ${scopeFilter}
         ORDER BY b.updated_at DESC`,
        scopeParams
      ),
      query(
        `SELECT b.*, a.name AS apiary_name
         FROM honey_batches b
         LEFT JOIN apiaries a ON a.local_id = b.apiary_local_id
         WHERE b.deleted_at IS NULL AND b.current_status IN ('in_natura_ready', 'dehumidified', 'matured')
           ${scopeFilter}
         ORDER BY b.updated_at DESC`,
        scopeParams
      ),
      queryOne(
        `SELECT
          COUNT(*) FILTER (WHERE b.current_status NOT IN ('sold', 'rejected')) AS active,
          COUNT(*) FILTER (WHERE b.current_status = 'bottled') AS bottled,
          COUNT(*) FILTER (WHERE b.current_status = 'sold') AS sold,
          COUNT(*) FILTER (WHERE b.current_status = 'rejected') AS rejected,
          COUNT(*) AS total
         FROM honey_batches b WHERE b.deleted_at IS NULL ${scopeFilter}`,
        scopeParams
      ),
    ]);

    res.json({ attention, in_processing: inProcessing, ready_for_next: readyForNext, stats });
  } catch (err) { next(err); }
});

// ── GET /reports ──────────────────────────────────────────────────────────────

router.get('/reports', async (req, res, next) => {
  try {
    const { clause: scopeFilter, params: scopeParams } = scopeClause(req);
    const { period, apiary_local_id } = req.query;

    const extraParams: unknown[] = [...scopeParams];
    const extraConds: string[] = [];

    if (apiary_local_id) {
      extraParams.push(apiary_local_id);
      extraConds.push(`b.apiary_local_id = $${extraParams.length}`);
    }

    const days = period === 'year' ? 365 : period === 'quarter' ? 90 : period === 'week' ? 7 : 30;
    extraParams.push(days);
    extraConds.push(`b.harvest_date >= NOW() - ($${extraParams.length} || ' days')::interval`);

    const extraFilter = extraConds.length > 0 ? 'AND ' + extraConds.join(' AND ') : '';
    const baseWhere = `b.deleted_at IS NULL ${scopeFilter} ${extraFilter}`;

    const [byMonth, byRoute, byStatus, moistureStats, dehumStats, matStats, moistureEvolution] = await Promise.all([
      query(
        `SELECT TO_CHAR(b.harvest_date, 'YYYY-MM') AS month,
          COUNT(*) AS count,
          ROUND(SUM(b.net_weight_grams) / 1000, 2) AS total_kg
         FROM honey_batches b WHERE ${baseWhere}
         GROUP BY month ORDER BY month`,
        extraParams
      ),
      query(
        `SELECT b.processing_route, COUNT(*) AS count
         FROM honey_batches b WHERE ${baseWhere}
         GROUP BY b.processing_route`,
        extraParams
      ),
      query(
        `SELECT b.current_status, COUNT(*) AS count
         FROM honey_batches b WHERE ${baseWhere}
         GROUP BY b.current_status`,
        extraParams
      ),
      queryOne(
        `SELECT
          ROUND(AVG(b.initial_moisture)::numeric, 2) AS avg_moisture,
          ROUND(AVG(b.initial_brix)::numeric, 2) AS avg_brix,
          MIN(b.initial_moisture) AS min_moisture,
          MAX(b.initial_moisture) AS max_moisture
         FROM honey_batches b WHERE ${baseWhere} AND b.initial_moisture IS NOT NULL`,
        extraParams
      ),
      queryOne(
        `SELECT
          ROUND(AVG(ds.initial_moisture - ds.final_moisture)::numeric, 2) AS avg_moisture_reduction,
          ROUND(AVG(EXTRACT(EPOCH FROM (ds.end_datetime - ds.start_datetime)) / 3600)::numeric, 1) AS avg_duration_hours,
          COUNT(*) AS total_sessions
         FROM dehumidification_sessions ds
         JOIN honey_batches b ON b.local_id = ds.batch_local_id
         WHERE ${baseWhere} AND ds.result_status = 'completed' AND ds.end_datetime IS NOT NULL`,
        extraParams
      ),
      query(
        `SELECT ms.final_decision, COUNT(*) AS count
         FROM maturation_sessions ms
         JOIN honey_batches b ON b.local_id = ms.batch_local_id
         WHERE ${baseWhere} AND ms.final_decision IS NOT NULL
         GROUP BY ms.final_decision`,
        extraParams
      ),
      query(
        `SELECT TO_CHAR(DATE_TRUNC('day', dm.measured_at), 'DD/MM') AS day,
          ROUND(AVG(dm.moisture)::numeric, 2) AS avg_moisture,
          ROUND(AVG(dm.brix)::numeric, 2) AS avg_brix
         FROM dehumidification_measurements dm
         JOIN dehumidification_sessions ds ON ds.id = dm.dehumidification_session_id
         JOIN honey_batches b ON b.local_id = ds.batch_local_id
         WHERE ${baseWhere}
         GROUP BY DATE_TRUNC('day', dm.measured_at)
         ORDER BY DATE_TRUNC('day', dm.measured_at)`,
        extraParams
      ),
    ]);

    res.json({ by_month: byMonth, by_route: byRoute, by_status: byStatus, moisture_stats: moistureStats, dehum_stats: dehumStats, maturation_stats: matStats, moisture_evolution: moistureEvolution });
  } catch (err) { next(err); }
});

// ── GET /:local_id ────────────────────────────────────────────────────────────

router.get('/:local_id', async (req, res, next) => {
  try {
    const user = req.user!;
    const detail = await fetchBatchDetail(req.params.local_id);
    if (!detail) { res.status(404).json({ error: 'Lote não encontrado' }); return; }

    const detailRow = detail as Record<string, unknown>;
    if (user.role === 'responsavel' && !user.apiary_local_ids.includes(detailRow.apiary_local_id as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }

    res.json(detail);
  } catch (err) { next(err); }
});

// ── POST / — criar lote ───────────────────────────────────────────────────────

router.post('/', requireRole('responsavel', 'socio'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const user = req.user!;
    const {
      apiary_local_id, harvest_local_id, harvest_date, honey_type,
      bee_species, floral_context, gross_weight_grams, net_weight_grams,
      initial_moisture, initial_brix, processing_route, collection_responsible_local_id,
      notes,
    } = req.body;

    if (!apiary_local_id || !harvest_date || !honey_type) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Campos obrigatórios: apiary_local_id, harvest_date, honey_type' }); return;
    }

    if (user.role === 'responsavel' && !user.apiary_local_ids.includes(apiary_local_id)) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'Meliponário não atribuído a este responsável' }); return;
    }

    const local_id = uuidv4();
    const code = await generateBatchCode(client);

    const apiary = await client.query(
      'SELECT server_id FROM apiaries WHERE local_id = $1', [apiary_local_id]
    );

    const row = await client.query(
      `INSERT INTO honey_batches (
         local_id, code, apiary_id, apiary_local_id, harvest_local_id, harvest_date,
         honey_type, bee_species, floral_context, gross_weight_grams, net_weight_grams,
         initial_moisture, initial_brix, current_status, processing_route,
         collection_responsible_user_id, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'collected',$14,$15,$16)
       RETURNING *`,
      [
        local_id, code, apiary.rows[0]?.server_id ?? null, apiary_local_id,
        harvest_local_id ?? null, harvest_date, honey_type,
        bee_species ?? null, floral_context ?? null,
        gross_weight_grams ?? null, net_weight_grams ?? null,
        initial_moisture ?? null, initial_brix ?? null,
        processing_route ?? 'in_natura',
        collection_responsible_local_id ?? null,
        notes ?? '',
      ]
    );

    await client.query('COMMIT');
    await logBatchAudit(user.id, 'batch_created', local_id, { code });
    res.status(201).json(row.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ── PATCH /:local_id/status ───────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  collected:            ['in_natura_ready', 'rejected'],
  in_natura_ready:      ['in_dehumidification', 'in_maturation', 'bottled', 'rejected'],
  in_dehumidification:  ['dehumidified', 'rejected'],
  dehumidified:         ['in_maturation', 'bottled', 'rejected'],
  in_maturation:        ['matured', 'rejected'],
  matured:              ['bottled', 'sold', 'rejected'],
  bottled:              ['sold'],
  sold:                 [],
  rejected:             [],
};

router.patch('/:local_id/status', requireRole('responsavel', 'socio'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { status } = req.body;

    if (!status) { res.status(400).json({ error: 'status é obrigatório' }); return; }

    const batch = await queryOne<Record<string, unknown>>(
      'SELECT * FROM honey_batches WHERE local_id = $1 AND deleted_at IS NULL',
      [req.params.local_id]
    );
    if (!batch) { res.status(404).json({ error: 'Lote não encontrado' }); return; }

    if (user.role === 'responsavel' && !user.apiary_local_ids.includes(batch.apiary_local_id as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }

    const allowed = VALID_TRANSITIONS[batch.current_status as string] ?? [];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: `Transição inválida: ${batch.current_status} → ${status}` }); return;
    }

    const updates: Record<string, unknown> = { current_status: status };
    if (status === 'bottled') updates.is_bottled = true;
    if (status === 'sold') updates.is_sold = true;
    if (req.body.final_destination) updates.final_destination = req.body.final_destination;

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const row = await queryOne(
      `UPDATE honey_batches SET ${setClauses}, updated_at = NOW()
       WHERE local_id = $1 AND deleted_at IS NULL RETURNING *`,
      [req.params.local_id, ...Object.values(updates)]
    );

    await logBatchAudit(user.id, 'batch_status_changed', req.params.local_id as string, {
      from: batch.current_status, to: status,
    });

    res.json(row);
  } catch (err) { next(err); }
});

// ── POST /:local_id/dehumidification — iniciar sessão ────────────────────────

router.post('/:local_id/dehumidification', requireRole('responsavel', 'socio'), async (req, res, next) => {
  try {
    const user = req.user!;
    const batch = await queryOne<Record<string, unknown>>(
      'SELECT * FROM honey_batches WHERE local_id = $1 AND deleted_at IS NULL',
      [req.params.local_id]
    );
    if (!batch) { res.status(404).json({ error: 'Lote não encontrado' }); return; }
    if (batch.current_status === 'rejected') { res.status(400).json({ error: 'Lote reprovado' }); return; }

    if (user.role === 'responsavel' && !user.apiary_local_ids.includes(batch.apiary_local_id as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }

    const {
      method, equipment, room_name, ambient_temperature_start, ambient_humidity_start,
      initial_moisture, initial_brix, start_datetime,
    } = req.body;

    const local_id = uuidv4();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = await client.query(
        `INSERT INTO dehumidification_sessions
           (local_id, batch_local_id, start_datetime, method, equipment, room_name,
            ambient_temperature_start, ambient_humidity_start, initial_moisture, initial_brix,
            responsible_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          local_id, req.params.local_id,
          start_datetime ?? new Date().toISOString(),
          method ?? 'passive_controlled_room',
          equipment ?? null, room_name ?? null,
          ambient_temperature_start ?? null, ambient_humidity_start ?? null,
          initial_moisture ?? null, initial_brix ?? null,
          user.id,
        ]
      );
      await client.query(
        `UPDATE honey_batches SET current_status = 'in_dehumidification', updated_at = NOW()
         WHERE local_id = $1`,
        [req.params.local_id]
      );
      await client.query('COMMIT');
      res.status(201).json({ ...row.rows[0], measurements: [] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// ── POST /:local_id/dehumidification/:sessionId/measurements ─────────────────

router.post('/:local_id/dehumidification/:sessionId/measurements', async (req, res, next) => {
  try {
    const user = req.user!;
    const session = await queryOne<Record<string, unknown>>(
      `SELECT s.*, b.apiary_local_id
       FROM dehumidification_sessions s
       JOIN honey_batches b ON b.local_id = s.batch_local_id
       WHERE s.local_id = $1`,
      [req.params.sessionId]
    );
    if (!session) { res.status(404).json({ error: 'Sessão não encontrada' }); return; }
    if (session.result_status !== 'in_progress') { res.status(400).json({ error: 'Sessão já encerrada' }); return; }

    if (user.role === 'responsavel' && !user.apiary_local_ids.includes(session.apiary_local_id as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }
    if (user.role === 'tratador') {
      res.status(403).json({ error: 'Tratador não pode registrar medições de desumidificação' }); return;
    }

    const { moisture, brix, ambient_temperature, ambient_humidity, notes, measured_at } = req.body;
    if (moisture == null) { res.status(400).json({ error: 'moisture é obrigatório' }); return; }

    const local_id = uuidv4();
    const row = await queryOne(
      `INSERT INTO dehumidification_measurements
         (local_id, dehumidification_session_id, measured_at, moisture, brix,
          ambient_temperature, ambient_humidity, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        local_id, session.id,
        measured_at ?? new Date().toISOString(),
        moisture, brix ?? null, ambient_temperature ?? null, ambient_humidity ?? null,
        notes ?? null, user.id,
      ]
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

// ── PATCH /:local_id/dehumidification/:sessionId/complete ────────────────────

router.patch('/:local_id/dehumidification/:sessionId/complete', requireRole('responsavel', 'socio'), async (req, res, next) => {
  try {
    const user = req.user!;
    const session = await queryOne<Record<string, unknown>>(
      `SELECT s.*, b.apiary_local_id
       FROM dehumidification_sessions s
       JOIN honey_batches b ON b.local_id = s.batch_local_id
       WHERE s.local_id = $1`,
      [req.params.sessionId]
    );
    if (!session) { res.status(404).json({ error: 'Sessão não encontrada' }); return; }
    if (session.result_status !== 'in_progress') { res.status(400).json({ error: 'Sessão já encerrada' }); return; }

    if (user.role === 'responsavel' && !user.apiary_local_ids.includes(session.apiary_local_id as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }

    const { final_moisture, final_brix, result_status, notes, end_datetime } = req.body;
    if (final_moisture == null) { res.status(400).json({ error: 'final_moisture é obrigatório' }); return; }

    const status = result_status ?? 'completed';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = await client.query(
        `UPDATE dehumidification_sessions
         SET result_status = $1, final_moisture = $2, final_brix = $3,
             end_datetime = $4, notes = COALESCE($5, notes), updated_at = NOW()
         WHERE local_id = $6 RETURNING *`,
        [status, final_moisture, final_brix ?? null, end_datetime ?? new Date().toISOString(), notes ?? null, req.params.sessionId]
      );
      if (status === 'completed') {
        await client.query(
          `UPDATE honey_batches SET current_status = 'dehumidified', updated_at = NOW()
           WHERE local_id = $1`,
          [req.params.local_id]
        );
      }
      await client.query('COMMIT');
      res.json(row.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// ── POST /:local_id/maturation — iniciar maturação ───────────────────────────

router.post('/:local_id/maturation', requireRole('responsavel', 'socio'), async (req, res, next) => {
  try {
    const user = req.user!;
    const batch = await queryOne<Record<string, unknown>>(
      'SELECT * FROM honey_batches WHERE local_id = $1 AND deleted_at IS NULL',
      [req.params.local_id]
    );
    if (!batch) { res.status(404).json({ error: 'Lote não encontrado' }); return; }
    if (batch.current_status === 'rejected') { res.status(400).json({ error: 'Lote reprovado' }); return; }

    if (user.role === 'responsavel' && !user.apiary_local_ids.includes(batch.apiary_local_id as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }

    const {
      container_type, container_material, closure_type, has_airlock, maturation_location,
      ambient_temperature_start, ambient_humidity_start, sensory_notes_start,
      start_datetime, linked_dehumidification_session_id,
    } = req.body;

    const local_id = uuidv4();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = await client.query(
        `INSERT INTO maturation_sessions
           (local_id, batch_local_id, linked_dehumidification_session_id, start_datetime,
            container_type, container_material, closure_type, has_airlock, maturation_location,
            ambient_temperature_start, ambient_humidity_start, responsible_user_id, sensory_notes_start)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [
          local_id, req.params.local_id,
          linked_dehumidification_session_id ?? null,
          start_datetime ?? new Date().toISOString(),
          container_type ?? null, container_material ?? null,
          closure_type ?? 'loose_cap', has_airlock ?? false,
          maturation_location ?? null,
          ambient_temperature_start ?? null, ambient_humidity_start ?? null,
          user.id, sensory_notes_start ?? null,
        ]
      );
      await client.query(
        `UPDATE honey_batches SET current_status = 'in_maturation', updated_at = NOW()
         WHERE local_id = $1`,
        [req.params.local_id]
      );
      await client.query('COMMIT');
      res.status(201).json({ ...row.rows[0], observations: [] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// ── POST /:local_id/maturation/:sessionId/observations ───────────────────────

router.post('/:local_id/maturation/:sessionId/observations', async (req, res, next) => {
  try {
    const user = req.user!;
    if (user.role === 'tratador') { res.status(403).json({ error: 'Sem permissão' }); return; }

    const session = await queryOne<Record<string, unknown>>(
      `SELECT s.*, b.apiary_local_id FROM maturation_sessions s
       JOIN honey_batches b ON b.local_id = s.batch_local_id
       WHERE s.local_id = $1`,
      [req.params.sessionId]
    );
    if (!session) { res.status(404).json({ error: 'Sessão não encontrada' }); return; }
    if (session.maturation_status !== 'in_progress') { res.status(400).json({ error: 'Sessão já encerrada' }); return; }

    if (user.role === 'responsavel' && !user.apiary_local_ids.includes(session.apiary_local_id as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }

    const {
      ambient_temperature, ambient_humidity, bubbles_present, foam_present,
      pressure_signs, aroma_change, phase_separation, visible_fermentation_signs,
      observation_text, observed_at,
    } = req.body;

    const local_id = uuidv4();
    const row = await queryOne(
      `INSERT INTO maturation_observations
         (local_id, maturation_session_id, observed_at, ambient_temperature, ambient_humidity,
          bubbles_present, foam_present, pressure_signs, aroma_change, phase_separation,
          visible_fermentation_signs, observation_text, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        local_id, session.id,
        observed_at ?? new Date().toISOString(),
        ambient_temperature ?? null, ambient_humidity ?? null,
        bubbles_present ?? false, foam_present ?? false, pressure_signs ?? false,
        aroma_change ?? false, phase_separation ?? false,
        visible_fermentation_signs ?? false,
        observation_text ?? null, user.id,
      ]
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

// ── PATCH /:local_id/maturation/:sessionId/complete ──────────────────────────

router.patch('/:local_id/maturation/:sessionId/complete', requireRole('responsavel', 'socio'), async (req, res, next) => {
  try {
    const user = req.user!;
    const session = await queryOne<Record<string, unknown>>(
      `SELECT s.*, b.apiary_local_id FROM maturation_sessions s
       JOIN honey_batches b ON b.local_id = s.batch_local_id
       WHERE s.local_id = $1`,
      [req.params.sessionId]
    );
    if (!session) { res.status(404).json({ error: 'Sessão não encontrada' }); return; }
    if (session.maturation_status !== 'in_progress') { res.status(400).json({ error: 'Sessão já encerrada' }); return; }

    if (user.role === 'responsavel' && !user.apiary_local_ids.includes(session.apiary_local_id as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }

    const { final_decision, final_notes, maturation_status, end_datetime } = req.body;
    if (!final_decision) { res.status(400).json({ error: 'final_decision é obrigatório' }); return; }

    const status = maturation_status ?? 'completed';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = await client.query(
        `UPDATE maturation_sessions
         SET maturation_status = $1, final_decision = $2, final_notes = $3,
             end_datetime = $4, updated_at = NOW()
         WHERE local_id = $5 RETURNING *`,
        [status, final_decision, final_notes ?? null, end_datetime ?? new Date().toISOString(), req.params.sessionId]
      );
      if (status === 'completed' && final_decision !== 'rejected') {
        await client.query(
          `UPDATE honey_batches SET current_status = 'matured', updated_at = NOW()
           WHERE local_id = $1`,
          [req.params.local_id]
        );
      } else if (final_decision === 'rejected') {
        await client.query(
          `UPDATE honey_batches SET current_status = 'rejected', updated_at = NOW()
           WHERE local_id = $1`,
          [req.params.local_id]
        );
      }
      await client.query('COMMIT');
      res.json(row.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// ── POST /:local_id/bottle — registrar envase ────────────────────────────────

router.post('/:local_id/bottle', requireRole('responsavel', 'socio'), async (req, res, next) => {
  try {
    const user = req.user!;
    const batch = await queryOne<Record<string, unknown>>(
      'SELECT * FROM honey_batches WHERE local_id = $1 AND deleted_at IS NULL',
      [req.params.local_id]
    );
    if (!batch) { res.status(404).json({ error: 'Lote não encontrado' }); return; }
    if (batch.current_status === 'rejected') { res.status(400).json({ error: 'Lote reprovado não pode ser envasado' }); return; }

    if (user.role === 'responsavel' && !user.apiary_local_ids.includes(batch.apiary_local_id as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }

    const { container_type, package_size_ml, quantity_filled, total_volume_bottled_ml, notes, bottled_at } = req.body;
    const local_id = uuidv4();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = await client.query(
        `INSERT INTO batch_bottlings
           (local_id, batch_local_id, bottled_at, container_type, package_size_ml,
            quantity_filled, total_volume_bottled_ml, responsible_user_id, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          local_id, req.params.local_id,
          bottled_at ?? new Date().toISOString(),
          container_type ?? null, package_size_ml ?? null,
          quantity_filled ?? null, total_volume_bottled_ml ?? null,
          user.id, notes ?? null,
        ]
      );
      await client.query(
        `UPDATE honey_batches SET current_status = 'bottled', is_bottled = TRUE, updated_at = NOW()
         WHERE local_id = $1`,
        [req.params.local_id]
      );
      await client.query('COMMIT');
      await logBatchAudit(user.id, 'batch_bottled', req.params.local_id as string);
      res.status(201).json(row.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// ── POST /:local_id/sell — registrar venda ───────────────────────────────────

router.post('/:local_id/sell', requireRole('responsavel', 'socio'), async (req, res, next) => {
  try {
    const user = req.user!;
    const batch = await queryOne<Record<string, unknown>>(
      'SELECT * FROM honey_batches WHERE local_id = $1 AND deleted_at IS NULL',
      [req.params.local_id]
    );
    if (!batch) { res.status(404).json({ error: 'Lote não encontrado' }); return; }
    if (batch.current_status === 'rejected') { res.status(400).json({ error: 'Lote reprovado não pode ser vendido' }); return; }

    if (user.role === 'responsavel' && !user.apiary_local_ids.includes(batch.apiary_local_id as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }

    const { sale_type, destination, quantity_units, total_volume_ml, notes, sold_at } = req.body;
    const local_id = uuidv4();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = await client.query(
        `INSERT INTO batch_sales
           (local_id, batch_local_id, sold_at, sale_type, destination,
            quantity_units, total_volume_ml, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          local_id, req.params.local_id,
          sold_at ?? new Date().toISOString(),
          sale_type ?? 'retail', destination ?? null,
          quantity_units ?? null, total_volume_ml ?? null,
          notes ?? null,
        ]
      );
      await client.query(
        `UPDATE honey_batches SET current_status = 'sold', is_sold = TRUE, updated_at = NOW()
         WHERE local_id = $1`,
        [req.params.local_id]
      );
      await client.query('COMMIT');
      await logBatchAudit(user.id, 'batch_sold', req.params.local_id as string, { destination });
      res.status(201).json(row.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// ── PATCH /:local_id/reject ───────────────────────────────────────────────────

router.patch('/:local_id/reject', requireRole('responsavel', 'socio'), async (req, res, next) => {
  try {
    const user = req.user!;
    const batch = await queryOne<Record<string, unknown>>(
      'SELECT * FROM honey_batches WHERE local_id = $1 AND deleted_at IS NULL',
      [req.params.local_id]
    );
    if (!batch) { res.status(404).json({ error: 'Lote não encontrado' }); return; }
    if (batch.current_status === 'sold') { res.status(400).json({ error: 'Lote já vendido' }); return; }

    if (user.role === 'responsavel' && !user.apiary_local_ids.includes(batch.apiary_local_id as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }

    const row = await queryOne(
      `UPDATE honey_batches SET current_status = 'rejected', updated_at = NOW()
       WHERE local_id = $1 RETURNING *`,
      [req.params.local_id]
    );
    await logBatchAudit(user.id, 'batch_rejected', req.params.local_id as string, { reason: req.body.reason });
    res.json(row);
  } catch (err) { next(err); }
});

// ── DELETE /:local_id (soft delete) ──────────────────────────────────────────

router.delete('/:local_id', requireRole('socio'), async (req, res, next) => {
  try {
    const row = await queryOne(
      `UPDATE honey_batches SET deleted_at = NOW() WHERE local_id = $1 AND deleted_at IS NULL RETURNING local_id`,
      [req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Lote não encontrado' }); return; }
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
