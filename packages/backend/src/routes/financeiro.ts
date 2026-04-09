import { Router } from 'express';
import { query, queryOne } from '../db/connection';
import { requireRole } from '../middleware/requireRole';
import { z } from 'zod';
import { validate } from '../middleware/validate';

const router = Router();

// ── Zod schemas ───────────────────────────────────────────────────────────────

const ProducaoCreateSchema = z.object({
  hive_local_id:   z.string().uuid(),
  apiary_local_id: z.string().uuid(),
  data_colheita:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  volume_ml:       z.number().int().positive(),
  observacao:      z.string().optional().nullable(),
});

const CustoCreateSchema = z.object({
  apiary_local_id: z.string().uuid(),
  hive_local_id:   z.string().uuid().optional().nullable(),
  data:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  tipo:            z.enum(['alimentacao', 'medicamento', 'mao_de_obra', 'equipamento', 'outro']),
  valor_reais:     z.number().positive(),
  descricao:       z.string().optional().nullable(),
});

// ── Scope helper (same pattern as other routes) ───────────────────────────────

function apiaryScope(req: any): string[] | null {
  const { role, apiary_local_ids } = req.user!;
  if (role === 'master_admin' || role === 'socio') return null;
  return apiary_local_ids ?? [];
}

function buildDateFilter(
  date_from: string | undefined,
  date_to: string | undefined,
  col: string,
  params: unknown[],
  p: number
): { clause: string; p: number } {
  let clause = '';
  if (date_from) { clause += ` AND ${col} >= $${p++}`; params.push(date_from); }
  if (date_to)   { clause += ` AND ${col} <= $${p++}`; params.push(date_to); }
  return { clause, p };
}

// ── GET /api/financeiro/producao ─────────────────────────────────────────────

router.get('/producao', async (req, res, next) => {
  try {
    const { apiary_local_id, hive_local_id, date_from, date_to } = req.query as Record<string, string | undefined>;
    const scope = apiaryScope(req);
    const params: unknown[] = [];
    let p = 1;
    let sql = `
      SELECT p.*, h.code AS hive_code, u.name AS responsavel_nome
      FROM producao p
      JOIN hives h ON h.local_id = p.hive_local_id
      LEFT JOIN users u ON u.id = p.responsavel_id
      WHERE 1=1
    `;

    if (scope !== null) {
      if (scope.length === 0) { res.json([]); return; }
      sql += ` AND p.apiary_local_id = ANY($${p++}::varchar[])`;
      params.push(scope);
    }
    if (apiary_local_id) { sql += ` AND p.apiary_local_id = $${p++}`; params.push(apiary_local_id); }
    if (hive_local_id)   { sql += ` AND p.hive_local_id = $${p++}`;   params.push(hive_local_id); }

    const df = buildDateFilter(date_from, date_to, 'p.data_colheita', params, p);
    sql += df.clause; p = df.p;

    sql += ' ORDER BY p.data_colheita DESC, p.created_at DESC';
    res.json(await query(sql, params));
  } catch (err) { next(err); }
});

// ── POST /api/financeiro/producao ─────────────────────────────────────────────

router.post('/producao',
  requireRole('master_admin', 'socio', 'responsavel'),
  validate(ProducaoCreateSchema),
  async (req, res, next) => {
    try {
      const { hive_local_id, apiary_local_id, data_colheita, volume_ml, observacao } = req.body;
      const scope = apiaryScope(req);
      if (scope !== null && !scope.includes(apiary_local_id)) {
        res.status(403).json({ error: 'Sem permissão para este meliponário' }); return;
      }
      const row = await queryOne(
        `INSERT INTO producao (hive_local_id, apiary_local_id, data_colheita, volume_ml, responsavel_id, observacao)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [hive_local_id, apiary_local_id, data_colheita, volume_ml, req.user!.id, observacao ?? null]
      );
      res.status(201).json(row);
    } catch (err) { next(err); }
  }
);

// ── DELETE /api/financeiro/producao/:local_id ─────────────────────────────────

router.delete('/producao/:local_id', requireRole('master_admin'), async (req, res, next) => {
  try {
    const row = await queryOne(
      'DELETE FROM producao WHERE local_id = $1 RETURNING local_id',
      [req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Registro não encontrado' }); return; }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── GET /api/financeiro/custos ────────────────────────────────────────────────

router.get('/custos', async (req, res, next) => {
  try {
    const { apiary_local_id, hive_local_id, date_from, date_to } = req.query as Record<string, string | undefined>;
    const scope = apiaryScope(req);
    const params: unknown[] = [];
    let p = 1;
    let sql = `
      SELECT c.*, h.code AS hive_code, u.name AS responsavel_nome
      FROM custos_intervencao c
      LEFT JOIN hives h ON h.local_id = c.hive_local_id
      LEFT JOIN users u ON u.id = c.responsavel_id
      WHERE 1=1
    `;

    if (scope !== null) {
      if (scope.length === 0) { res.json([]); return; }
      sql += ` AND c.apiary_local_id = ANY($${p++}::varchar[])`;
      params.push(scope);
    }
    if (apiary_local_id) { sql += ` AND c.apiary_local_id = $${p++}`; params.push(apiary_local_id); }
    if (hive_local_id)   { sql += ` AND c.hive_local_id = $${p++}`;   params.push(hive_local_id); }

    const df = buildDateFilter(date_from, date_to, 'c.data', params, p);
    sql += df.clause; p = df.p;

    sql += ' ORDER BY c.data DESC, c.created_at DESC';
    res.json(await query(sql, params));
  } catch (err) { next(err); }
});

// ── POST /api/financeiro/custos ───────────────────────────────────────────────

router.post('/custos',
  requireRole('master_admin', 'socio', 'responsavel'),
  validate(CustoCreateSchema),
  async (req, res, next) => {
    try {
      const { apiary_local_id, hive_local_id, data, tipo, valor_reais, descricao } = req.body;
      const scope = apiaryScope(req);
      if (scope !== null && !scope.includes(apiary_local_id)) {
        res.status(403).json({ error: 'Sem permissão para este meliponário' }); return;
      }
      const row = await queryOne(
        `INSERT INTO custos_intervencao (apiary_local_id, hive_local_id, data, tipo, valor_reais, descricao, responsavel_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [apiary_local_id, hive_local_id ?? null, data, tipo, valor_reais, descricao ?? null, req.user!.id]
      );
      res.status(201).json(row);
    } catch (err) { next(err); }
  }
);

// ── DELETE /api/financeiro/custos/:local_id ───────────────────────────────────

router.delete('/custos/:local_id', requireRole('master_admin'), async (req, res, next) => {
  try {
    const row = await queryOne(
      'DELETE FROM custos_intervencao WHERE local_id = $1 RETURNING local_id',
      [req.params.local_id]
    );
    if (!row) { res.status(404).json({ error: 'Registro não encontrado' }); return; }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── GET /api/financeiro/dashboard ────────────────────────────────────────────

router.get('/dashboard', async (req, res, next) => {
  try {
    const { date_from, date_to, apiary_local_id } = req.query as Record<string, string | undefined>;
    const scope = apiaryScope(req);

    if (scope !== null && scope.length === 0) {
      res.json({
        resumo_periodo: { producao_total_ml: 0, custo_total_reais: 0, custo_por_ml: 0, producao_media_por_colmeia: 0 },
        ranking_colmeias: [], producao_por_apiary: [], evolucao_mensal: [], taxa_perda: 0,
      });
      return;
    }

    // Each section uses its own independent param arrays — no cross-numbering issues.
    function pFilter(): { where: string; params: unknown[] } {
      const params: unknown[] = [];
      let p = 1, w = '';
      if (scope !== null) { w += ` AND apiary_local_id = ANY($${p++}::varchar[])`; params.push(scope); }
      if (apiary_local_id) { w += ` AND apiary_local_id = $${p++}`; params.push(apiary_local_id); }
      if (date_from) { w += ` AND data_colheita >= $${p++}`; params.push(date_from); }
      if (date_to)   { w += ` AND data_colheita <= $${p++}`; params.push(date_to); }
      return { where: w, params };
    }
    function cFilter(): { where: string; params: unknown[] } {
      const params: unknown[] = [];
      let p = 1, w = '';
      if (scope !== null) { w += ` AND apiary_local_id = ANY($${p++}::varchar[])`; params.push(scope); }
      if (apiary_local_id) { w += ` AND apiary_local_id = $${p++}`; params.push(apiary_local_id); }
      if (date_from) { w += ` AND data >= $${p++}`; params.push(date_from); }
      if (date_to)   { w += ` AND data <= $${p++}`; params.push(date_to); }
      return { where: w, params };
    }
    function hFilter(): { where: string; params: unknown[] } {
      const params: unknown[] = [];
      let p = 1, w = '';
      if (scope !== null) { w += ` AND apiary_local_id = ANY($${p++}::varchar[])`; params.push(scope); }
      if (apiary_local_id) { w += ` AND apiary_local_id = $${p++}`; params.push(apiary_local_id); }
      return { where: w, params };
    }

    const pf = pFilter(), cf = cFilter(), hf = hFilter();

    const [
      resumoProd, resumoCusto,
      rankingProd, rankingCust,
      apiaryProd, apiaryCust,
      evolProd, evolCust,
      totalHivesRow, hivesWithProdRow,
    ] = await Promise.all([
      // Resumo
      query<{ total_ml: string; hives_count: string }>(
        `SELECT COALESCE(SUM(volume_ml),0)::text AS total_ml,
                COUNT(DISTINCT hive_local_id)::text AS hives_count
         FROM producao WHERE 1=1 ${pf.where}`, pf.params),
      query<{ total_reais: string }>(
        `SELECT COALESCE(SUM(valor_reais),0)::text AS total_reais
         FROM custos_intervencao WHERE 1=1 ${cf.where}`, cf.params),

      // Ranking — producao aggregated by hive
      query<{ hive_local_id: string; hive_code: string; vol: string }>(
        `SELECT p.hive_local_id, h.code AS hive_code, SUM(p.volume_ml)::text AS vol
         FROM producao p JOIN hives h ON h.local_id = p.hive_local_id
         WHERE 1=1 ${pf.where}
         GROUP BY p.hive_local_id, h.code
         ORDER BY vol::int DESC LIMIT 10`, pf.params),
      query<{ hive_local_id: string; val: string }>(
        `SELECT hive_local_id, SUM(valor_reais)::text AS val
         FROM custos_intervencao WHERE hive_local_id IS NOT NULL ${cf.where}
         GROUP BY hive_local_id`, cf.params),

      // Por apiário
      query<{ apiary_local_id: string; vol: string }>(
        `SELECT p.apiary_local_id, SUM(p.volume_ml)::text AS vol
         FROM producao p WHERE 1=1 ${pf.where}
         GROUP BY p.apiary_local_id`, pf.params),
      query<{ apiary_local_id: string; apiary_nome: string; val: string }>(
        `SELECT c.apiary_local_id, a.name AS apiary_nome, SUM(c.valor_reais)::text AS val
         FROM custos_intervencao c JOIN apiaries a ON a.local_id = c.apiary_local_id
         WHERE 1=1 ${cf.where}
         GROUP BY c.apiary_local_id, a.name`, cf.params),

      // Evolução mensal (últimos 6 meses) — separate queries, merge in JS
      query<{ mes: string; vol: string }>(
        `SELECT to_char(date_trunc('month', data_colheita::timestamptz), 'YYYY-MM') AS mes,
                SUM(volume_ml)::text AS vol
         FROM producao WHERE 1=1 ${pf.where}
           AND data_colheita >= date_trunc('month', NOW() - interval '5 months')
         GROUP BY 1`, pf.params),
      query<{ mes: string; val: string }>(
        `SELECT to_char(date_trunc('month', data::timestamptz), 'YYYY-MM') AS mes,
                SUM(valor_reais)::text AS val
         FROM custos_intervencao WHERE 1=1 ${cf.where}
           AND data >= date_trunc('month', NOW() - interval '5 months')::date
         GROUP BY 1`, cf.params),

      // Taxa de perda
      query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM hives
         WHERE deleted_at IS NULL AND status = 'active' ${hf.where}`, hf.params),
      query<{ n: string }>(
        `SELECT COUNT(DISTINCT hive_local_id)::text AS n FROM producao
         WHERE data_colheita >= NOW() - interval '90 days' ${hf.where}`, hf.params),
    ]);

    // ── Merge resumo ──────────────────────────────────────────────────────────
    const producao_total_ml    = parseInt(resumoProd[0]?.total_ml ?? '0', 10);
    const hives_with_prod      = parseInt(resumoProd[0]?.hives_count ?? '0', 10);
    const custo_total_reais    = parseFloat(resumoCusto[0]?.total_reais ?? '0');
    const custo_por_ml         = producao_total_ml > 0 ? Math.round((custo_total_reais / producao_total_ml) * 1000) / 1000 : 0;
    const producao_media_por_colmeia = hives_with_prod > 0 ? Math.round(producao_total_ml / hives_with_prod) : 0;

    // ── Merge ranking ─────────────────────────────────────────────────────────
    const custByHive = new Map(rankingCust.map((r) => [r.hive_local_id, parseFloat(r.val)]));
    const ranking_colmeias = rankingProd.map((r) => {
      const prod = parseInt(r.vol, 10);
      const cust = custByHive.get(r.hive_local_id) ?? 0;
      return { hive_local_id: r.hive_local_id, hive_code: r.hive_code, producao_ml: prod, custos_reais: cust, saldo: prod - cust };
    });

    // ── Merge per-apiary ──────────────────────────────────────────────────────
    const prodByApiary = new Map(apiaryProd.map((r) => [r.apiary_local_id, parseInt(r.vol, 10)]));
    const apiary_nome_map  = new Map(apiaryCust.map((r) => [r.apiary_local_id, r.apiary_nome]));
    const custByApiary = new Map(apiaryCust.map((r) => [r.apiary_local_id, parseFloat(r.val)]));
    const allApiaryIds = [...new Set([...prodByApiary.keys(), ...custByApiary.keys()])];

    // Fetch names for apiaries that appear only in producao
    const missingIds = allApiaryIds.filter((id) => !apiary_nome_map.has(id));
    if (missingIds.length > 0) {
      const names = await query<{ local_id: string; name: string }>(
        'SELECT local_id, name FROM apiaries WHERE local_id = ANY($1::varchar[])', [missingIds]
      );
      names.forEach((r) => apiary_nome_map.set(r.local_id, r.name));
    }

    const producao_por_apiary = allApiaryIds
      .map((id) => ({
        apiary_local_id: id,
        apiary_nome:     apiary_nome_map.get(id) ?? id,
        producao_ml:     prodByApiary.get(id) ?? 0,
        custos_reais:    custByApiary.get(id) ?? 0,
      }))
      .sort((a, b) => b.producao_ml - a.producao_ml);

    // ── Merge evolução mensal ─────────────────────────────────────────────────
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const evolProdMap = new Map(evolProd.map((r) => [r.mes, parseInt(r.vol, 10)]));
    const evolCustMap = new Map(evolCust.map((r) => [r.mes, parseFloat(r.val)]));
    const evolucao_mensal = months.map((mes) => ({
      mes,
      producao_ml:  evolProdMap.get(mes) ?? 0,
      custos_reais: evolCustMap.get(mes) ?? 0,
    }));

    // ── Taxa de perda ─────────────────────────────────────────────────────────
    const totalHives      = parseInt(totalHivesRow[0]?.n ?? '0', 10);
    const hivesWithProd90 = parseInt(hivesWithProdRow[0]?.n ?? '0', 10);
    const taxa_perda      = totalHives > 0
      ? Math.round(((totalHives - hivesWithProd90) / totalHives) * 100)
      : 0;

    res.json({
      resumo_periodo: { producao_total_ml, custo_total_reais, custo_por_ml, producao_media_por_colmeia },
      ranking_colmeias,
      producao_por_apiary,
      evolucao_mensal,
      taxa_perda,
    });
  } catch (err) { next(err); }
});

export default router;
