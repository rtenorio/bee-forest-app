import { Router } from 'express';
import { query, queryOne } from '../db/connection';
import { requireRole } from '../middleware/requireRole';
import { authenticate } from '../middleware/authenticate';
import { z } from 'zod';
import { validate } from '../middleware/validate';

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const LoteCreateSchema = z.object({
  apiary_local_id: z.string().uuid(),
  colheitas_ids:   z.array(z.number().int()).default([]),
  data_colheita:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  volume_total_ml: z.number().int().positive(),
  umidade:         z.number().min(0).max(100).nullable().optional(),
  brix:            z.number().min(0).max(100).nullable().optional(),
  observacao:      z.string().optional().nullable(),
});

const StatusUpdateSchema = z.object({
  status:    z.enum(['coletado','desumidificando','maturando','envasado','vendido']),
  observacao: z.string().optional().nullable(),
});

const EtapaCreateSchema = z.object({
  tipo:        z.enum(['desumidificacao','maturacao','envase','analise','outro']),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  data_fim:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  observacao:  z.string().optional().nullable(),
});

const FrascoCreateSchema = z.object({
  quantidade:  z.number().int().positive(),
  volume_ml:   z.number().int().positive(),
  destino:     z.enum(['consumo_proprio','venda_direta','bee_forest_luxe','exportacao']).optional().nullable(),
  data_envase: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function apiaryScope(req: any): string[] | null {
  const { role, apiary_local_ids } = req.user!;
  if (role === 'master_admin' || role === 'socio') return null;
  return apiary_local_ids ?? [];
}

async function generateLoteCodigo(): Promise<string> {
  const year = new Date().getFullYear();
  const res  = await queryOne<{ n: string }>("SELECT nextval('lote_mel_seq')::text AS n");
  const n    = String(res?.n ?? '1').padStart(3, '0');
  return `LOTE-${year}-${n}`;
}

// ── Status → etapa automática ─────────────────────────────────────────────────

const STATUS_TO_ETAPA: Record<string, string | null> = {
  desumidificando: 'desumidificacao',
  maturando:       'maturacao',
  envasado:        'envase',
  vendido:         null,
  coletado:        null,
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLIC endpoint — no authenticate middleware
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/lotes/:local_id/public
 * Dados de rastreabilidade para o consumidor — sem autenticação.
 */
router.get('/:local_id/public', async (req, res, next) => {
  try {
    const lote = await queryOne<{
      local_id: string; codigo: string; colheitas_ids: number[];
      apiary_local_id: string; data_colheita: string;
      volume_total_ml: number; umidade: string | null; brix: string | null;
      status: string; apiary_nome: string; apiary_localizacao: string;
    }>(
      `SELECT l.*,
              a.name     AS apiary_nome,
              a.location AS apiary_localizacao
       FROM lotes_mel l
       JOIN apiaries a ON a.local_id = l.apiary_local_id
       WHERE l.local_id = $1`,
      [req.params.local_id]
    );

    if (!lote) { res.status(404).json({ error: 'Lote não encontrado' }); return; }

    const etapas = await query<{
      tipo: string; data_inicio: string; data_fim: string | null;
      observacao: string | null; responsavel_nome: string | null;
    }>(
      `SELECT e.tipo, e.data_inicio, e.data_fim, e.observacao,
              u.name AS responsavel_nome
       FROM etapas_lote e
       LEFT JOIN users u ON u.id = e.responsavel_id
       WHERE e.lote_local_id = $1
       ORDER BY e.data_inicio, e.created_at`,
      [lote.local_id]
    );

    // Hives that contributed to this lote via producao records
    const colmeias_origem = await query<{ codigo_qr: string | null; hive_code: string; especie: string | null }>(
      `SELECT DISTINCT h.qr_code AS codigo_qr, h.code AS hive_code, s.name AS especie
       FROM producao p
       JOIN hives h       ON h.local_id = p.hive_local_id
       LEFT JOIN species s ON s.server_id = h.species_id
       WHERE p.apiary_local_id = $1
         AND p.data_colheita   = $2`,
      [lote.apiary_local_id, lote.data_colheita]
    );

    res.json({
      codigo:            lote.codigo,
      data_colheita:     lote.data_colheita,
      apiary_nome:       lote.apiary_nome,
      apiary_localizacao: lote.apiary_localizacao,
      colmeias_origem,
      etapas,
      umidade:           lote.umidade ? parseFloat(lote.umidade) : null,
      brix:              lote.brix    ? parseFloat(lote.brix)    : null,
      status:            lote.status,
      volume_total_ml:   lote.volume_total_ml,
    });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  All routes below require authentication
// ═══════════════════════════════════════════════════════════════════════════════

router.use(authenticate);

// ── GET /api/lotes ────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const { apiary_local_id, status, date_from, date_to } = req.query as Record<string, string | undefined>;
    const scope = apiaryScope(req);
    const params: unknown[] = [];
    let p = 1, sql = `
      SELECT l.*, a.name AS apiary_nome,
             u.name AS responsavel_nome,
             (SELECT COUNT(*) FROM etapas_lote WHERE lote_local_id = l.local_id)::int AS etapas_count,
             (SELECT COALESCE(SUM(quantidade * volume_ml), 0) FROM frascos_lote WHERE lote_local_id = l.local_id)::int AS volume_envasado_ml
      FROM lotes_mel l
      JOIN apiaries a ON a.local_id = l.apiary_local_id
      LEFT JOIN users u ON u.id = l.responsavel_id
      WHERE 1=1
    `;

    if (scope !== null) {
      if (scope.length === 0) { res.json([]); return; }
      sql += ` AND l.apiary_local_id = ANY($${p++}::varchar[])`; params.push(scope);
    }
    if (apiary_local_id) { sql += ` AND l.apiary_local_id = $${p++}`; params.push(apiary_local_id); }
    if (status)           { sql += ` AND l.status = $${p++}`;          params.push(status); }
    if (date_from)        { sql += ` AND l.data_colheita >= $${p++}`;  params.push(date_from); }
    if (date_to)          { sql += ` AND l.data_colheita <= $${p++}`;  params.push(date_to); }

    sql += ' ORDER BY l.data_colheita DESC, l.created_at DESC';
    res.json(await query(sql, params));
  } catch (err) { next(err); }
});

// ── POST /api/lotes ───────────────────────────────────────────────────────────

router.post('/',
  requireRole('master_admin', 'socio', 'responsavel'),
  validate(LoteCreateSchema),
  async (req, res, next) => {
    try {
      const { apiary_local_id, colheitas_ids, data_colheita, volume_total_ml, umidade, brix, observacao } = req.body;
      const scope = apiaryScope(req);
      if (scope !== null && !scope.includes(apiary_local_id)) {
        res.status(403).json({ error: 'Sem permissão para este meliponário' }); return;
      }
      const codigo = await generateLoteCodigo();
      const row = await queryOne(
        `INSERT INTO lotes_mel (codigo, apiary_local_id, colheitas_ids, data_colheita, volume_total_ml, umidade, brix, observacao, responsavel_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [codigo, apiary_local_id, colheitas_ids, data_colheita, volume_total_ml, umidade ?? null, brix ?? null, observacao ?? null, req.user!.id]
      );
      res.status(201).json(row);
    } catch (err) { next(err); }
  }
);

// ── GET /api/lotes/:local_id ──────────────────────────────────────────────────

router.get('/:local_id', async (req, res, next) => {
  try {
    const lote = await queryOne<Record<string, unknown>>(
      `SELECT l.*, a.name AS apiary_nome, a.location AS apiary_localizacao,
              u.name AS responsavel_nome
       FROM lotes_mel l
       JOIN apiaries a ON a.local_id = l.apiary_local_id
       LEFT JOIN users u ON u.id = l.responsavel_id
       WHERE l.local_id = $1`,
      [req.params.local_id]
    );
    if (!lote) { res.status(404).json({ error: 'Lote não encontrado' }); return; }

    const scope = apiaryScope(req);
    if (scope !== null && !scope.includes(lote.apiary_local_id as string)) {
      res.status(403).json({ error: 'Sem permissão' }); return;
    }

    const [etapas, frascos] = await Promise.all([
      query(
        `SELECT e.*, u.name AS responsavel_nome
         FROM etapas_lote e LEFT JOIN users u ON u.id = e.responsavel_id
         WHERE e.lote_local_id = $1 ORDER BY e.data_inicio, e.created_at`,
        [req.params.local_id]
      ),
      query(
        'SELECT * FROM frascos_lote WHERE lote_local_id = $1 ORDER BY created_at',
        [req.params.local_id]
      ),
    ]);

    res.json({ ...lote, etapas, frascos });
  } catch (err) { next(err); }
});

// ── PATCH /api/lotes/:local_id/status ─────────────────────────────────────────

router.patch('/:local_id/status',
  requireRole('master_admin', 'socio', 'responsavel'),
  validate(StatusUpdateSchema),
  async (req, res, next) => {
    try {
      const { status, observacao } = req.body;
      const lote = await queryOne<{ apiary_local_id: string; status: string }>(
        'SELECT apiary_local_id, status FROM lotes_mel WHERE local_id = $1', [req.params.local_id]
      );
      if (!lote) { res.status(404).json({ error: 'Lote não encontrado' }); return; }
      const scope = apiaryScope(req);
      if (scope !== null && !scope.includes(lote.apiary_local_id)) {
        res.status(403).json({ error: 'Sem permissão' }); return;
      }

      const updated = await queryOne(
        'UPDATE lotes_mel SET status = $1 WHERE local_id = $2 RETURNING *',
        [status, req.params.local_id]
      );

      // Auto-create etapa when advancing to certain statuses
      const tipoEtapa = STATUS_TO_ETAPA[status];
      if (tipoEtapa) {
        await queryOne(
          `INSERT INTO etapas_lote (lote_local_id, tipo, data_inicio, observacao, responsavel_id)
           VALUES ($1,$2,CURRENT_DATE,$3,$4) RETURNING id`,
          [req.params.local_id, tipoEtapa, observacao ?? null, req.user!.id]
        );
      }

      res.json(updated);
    } catch (err) { next(err); }
  }
);

// ── POST /api/lotes/:local_id/etapas ──────────────────────────────────────────

router.post('/:local_id/etapas',
  requireRole('master_admin', 'socio', 'responsavel'),
  validate(EtapaCreateSchema),
  async (req, res, next) => {
    try {
      const exists = await queryOne('SELECT local_id FROM lotes_mel WHERE local_id = $1', [req.params.local_id]);
      if (!exists) { res.status(404).json({ error: 'Lote não encontrado' }); return; }
      const { tipo, data_inicio, data_fim, observacao } = req.body;
      const row = await queryOne(
        `INSERT INTO etapas_lote (lote_local_id, tipo, data_inicio, data_fim, observacao, responsavel_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [req.params.local_id, tipo, data_inicio, data_fim ?? null, observacao ?? null, req.user!.id]
      );
      res.status(201).json(row);
    } catch (err) { next(err); }
  }
);

// ── POST /api/lotes/:local_id/frascos ─────────────────────────────────────────

router.post('/:local_id/frascos',
  requireRole('master_admin', 'socio', 'responsavel'),
  validate(FrascoCreateSchema),
  async (req, res, next) => {
    try {
      const exists = await queryOne('SELECT local_id FROM lotes_mel WHERE local_id = $1', [req.params.local_id]);
      if (!exists) { res.status(404).json({ error: 'Lote não encontrado' }); return; }
      const { quantidade, volume_ml, destino, data_envase } = req.body;
      const row = await queryOne(
        `INSERT INTO frascos_lote (lote_local_id, quantidade, volume_ml, destino, data_envase)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [req.params.local_id, quantidade, volume_ml, destino ?? null, data_envase ?? null]
      );
      res.status(201).json(row);
    } catch (err) { next(err); }
  }
);

export default router;
