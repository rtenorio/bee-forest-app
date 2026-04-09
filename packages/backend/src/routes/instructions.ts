import { Router } from 'express';
import { query, queryOne } from '../db/connection';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/requireRole';
import { auditLog } from '../middleware/auditLog';
import {
  InstructionCreateSchema,
  InstructionStatusSchema,
  InstructionResponseCreateSchema,
  type InstructionStatus,
} from '../shared';
import { getUploadUrl } from '../services/r2';
import { generateSignedUrl } from '../lib/r2';
import { validateUpload } from '../middleware/upload';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveAccessibleApiaryIds(req: any, contextHiveId?: string): Promise<string[] | null> {
  const role = req.user!.role;
  if (role === 'master_admin' || role === 'socio') return null;
  if (role === 'orientador' || role === 'responsavel') {
    return req.user!.apiary_local_ids;
  }
  if (role === 'tratador') {
    if (contextHiveId) {
      const hiveRow = await queryOne<{ apiary_local_id: string }>(
        'SELECT apiary_local_id FROM hives WHERE local_id = $1 AND deleted_at IS NULL',
        [contextHiveId]
      );
      return hiveRow ? [hiveRow.apiary_local_id] : [];
    }
    const hiveIds = req.user!.hive_local_ids;
    if (!hiveIds.length) return [];
    const rows = await query<{ apiary_local_id: string }>(
      'SELECT DISTINCT apiary_local_id FROM hives WHERE local_id = ANY($1::varchar[]) AND deleted_at IS NULL',
      [hiveIds]
    );
    return rows.map((r) => r.apiary_local_id);
  }
  return [];
}

// ── GET /api/instructions ─────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const { apiary_local_id, hive_local_id, status } = req.query as Record<string, string | undefined>;

    const accessibleApiaryIds = await resolveAccessibleApiaryIds(req, hive_local_id);

    let sql = `
      SELECT
        i.*,
        u.name AS author_name,
        u.role AS author_role,
        (SELECT COUNT(*) FROM hive_instruction_responses r
          WHERE r.instruction_local_id = i.local_id AND r.deleted_at IS NULL) AS response_count
      FROM hive_instructions i
      JOIN users u ON u.id = i.author_id
      WHERE i.deleted_at IS NULL
    `;
    const params: unknown[] = [];
    let p = 1;

    if (accessibleApiaryIds !== null) {
      if (accessibleApiaryIds.length === 0) { res.json([]); return; }
      sql += ` AND i.apiary_local_id = ANY($${p}::varchar[])`;
      params.push(accessibleApiaryIds);
      p++;
    }

    if (user.role === 'tratador' && !hive_local_id) {
      const hiveIds = user.hive_local_ids;
      sql += ` AND (i.hive_local_id IS NULL OR i.hive_local_id = ANY($${p}::varchar[]))`;
      params.push(hiveIds);
      p++;
    }

    if (apiary_local_id) { sql += ` AND i.apiary_local_id = $${p++}`; params.push(apiary_local_id); }
    if (hive_local_id)   { sql += ` AND i.hive_local_id = $${p++}`;   params.push(hive_local_id); }
    if (status)          { sql += ` AND i.status = $${p++}`;           params.push(status); }

    sql += ' ORDER BY (i.priority_days IS NULL) DESC, i.due_date ASC NULLS LAST, i.created_at DESC';

    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST /api/instructions ────────────────────────────────────────────────────

router.post('/',
  validate(InstructionCreateSchema),
  auditLog('CREATE', 'instruction', (req, body: any) => ({
    resource_id: body?.local_id ?? req.body.local_id,
    resource_label: req.body.text_content?.slice(0, 60) ?? 'Orientação',
    payload: { apiary_local_id: req.body.apiary_local_id, hive_local_id: req.body.hive_local_id },
  })),
  async (req, res, next) => {
    try {
      const user = req.user!;
      if (user.role === 'tratador') {
        res.status(403).json({ error: 'Tratadores não podem criar instruções' });
        return;
      }

      const {
        local_id, apiary_local_id, hive_local_id,
        text_content, audio_url, audio_key,
        priority_days, due_date, prazo_conclusao,
      } = req.body;

      const row = await queryOne(
        `INSERT INTO hive_instructions
           (local_id, apiary_local_id, hive_local_id, author_id, text_content, audio_url, audio_key,
            priority_days, due_date, prazo_conclusao)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          local_id, apiary_local_id, hive_local_id ?? null, user.id,
          text_content ?? null, audio_url ?? null, audio_key ?? null,
          priority_days ?? null, due_date ?? null, prazo_conclusao ?? null,
        ]
      );

      res.status(201).json(row);
    } catch (err) { next(err); }
  }
);

// ── PATCH /api/instructions/:id/status ───────────────────────────────────────

router.patch('/:id/status',
  validate(InstructionStatusSchema),
  auditLog('UPDATE', 'instruction', (req) => ({
    resource_id: req.params.id as string,
    resource_label: `Status → ${req.body.status}`,
    payload: { status: req.body.status },
  })),
  async (req, res, next) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { status, evidencia_key, evidencia_url, motivo_rejeicao } = req.body as {
        status: InstructionStatus;
        evidencia_key?: string | null;
        evidencia_url?: string | null;
        motivo_rejeicao?: string | null;
      };

      const instruction = await queryOne<{
        author_id: number;
        apiary_local_id: string;
        hive_local_id: string | null;
        status: InstructionStatus;
      }>(
        'SELECT author_id, apiary_local_id, hive_local_id, status FROM hive_instructions WHERE local_id = $1 AND deleted_at IS NULL',
        [id]
      );
      if (!instruction) { res.status(404).json({ error: 'Instrução não encontrada' }); return; }

      // ── Access check ──────────────────────────────────────────────────────
      if ((user.role === 'responsavel' || user.role === 'orientador') &&
          !user.apiary_local_ids.includes(instruction.apiary_local_id)) {
        res.status(403).json({ error: 'Sem permissão para esta instrução' }); return;
      }
      if (user.role === 'tratador' && instruction.hive_local_id) {
        if (!user.hive_local_ids.includes(instruction.hive_local_id)) {
          res.status(403).json({ error: 'Sem permissão para esta instrução' }); return;
        }
      }

      // ── State machine ─────────────────────────────────────────────────────
      const role = user.role;

      if (role === 'tratador') {
        if (!['em_execucao', 'concluida'].includes(status)) {
          res.status(403).json({ error: 'Tratador só pode alterar para em_execucao ou concluida' }); return;
        }
        if (status === 'concluida' && !evidencia_key && !evidencia_url) {
          res.status(400).json({ error: 'Evidência obrigatória para concluir a tarefa' }); return;
        }
      } else if (role === 'responsavel' || role === 'orientador') {
        if (!['validada', 'rejeitada'].includes(status)) {
          res.status(403).json({ error: 'Responsável/orientador só pode validar ou rejeitar tarefas concluídas' }); return;
        }
        if (instruction.status !== 'concluida') {
          res.status(422).json({ error: 'Só é possível validar ou rejeitar tarefas com status concluida' }); return;
        }
        if (status === 'rejeitada' && !motivo_rejeicao?.trim()) {
          res.status(400).json({ error: 'Motivo de rejeição obrigatório' }); return;
        }
      }
      // socio / master_admin: any transition allowed

      // ── Build update ──────────────────────────────────────────────────────
      const isValidation = status === 'validada' || status === 'rejeitada';

      const updated = await queryOne(
        `UPDATE hive_instructions SET
           status           = $1,
           evidencia_key    = COALESCE($2, evidencia_key),
           evidencia_url    = COALESCE($3, evidencia_url),
           validado_por     = CASE WHEN $4 THEN $5 ELSE validado_por END,
           validado_em      = CASE WHEN $4 THEN NOW() ELSE validado_em END,
           motivo_rejeicao  = COALESCE($6, motivo_rejeicao)
         WHERE local_id = $7
         RETURNING *`,
        [
          status,
          evidencia_key ?? null,
          evidencia_url ?? null,
          isValidation,
          isValidation ? user.id : null,
          motivo_rejeicao ?? null,
          id,
        ]
      );
      res.json(updated);
    } catch (err) { next(err); }
  }
);

// ── DELETE /api/instructions/:id ─────────────────────────────────────────────

router.delete('/:id', async (req, res, next) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const instruction = await queryOne<{ author_id: number }>(
      'SELECT author_id FROM hive_instructions WHERE local_id = $1 AND deleted_at IS NULL', [id]
    );
    if (!instruction) { res.status(404).json({ error: 'Instrução não encontrada' }); return; }
    if (user.role !== 'master_admin' && instruction.author_id !== user.id) {
      res.status(403).json({ error: 'Sem permissão para excluir esta instrução' }); return;
    }
    await query('UPDATE hive_instructions SET deleted_at = NOW() WHERE local_id = $1', [id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── GET /api/instructions/:id/responses ──────────────────────────────────────

router.get('/:id/responses', async (req, res, next) => {
  try {
    const { id } = req.params;
    const rows = await query(
      `SELECT r.*, u.name AS tratador_name
       FROM hive_instruction_responses r
       JOIN users u ON u.id = r.tratador_id
       WHERE r.instruction_local_id = $1 AND r.deleted_at IS NULL
       ORDER BY r.created_at ASC`,
      [id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST /api/instructions/:id/responses ─────────────────────────────────────

router.post('/:id/responses', validate(InstructionResponseCreateSchema), async (req, res, next) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { local_id, text_content, audio_url, audio_key, evidencia_key } = req.body;

    const instruction = await queryOne<{ id: number }>(
      'SELECT id FROM hive_instructions WHERE local_id = $1 AND deleted_at IS NULL', [id]
    );
    if (!instruction) { res.status(404).json({ error: 'Instrução não encontrada' }); return; }

    const row = await queryOne(
      `INSERT INTO hive_instruction_responses
         (local_id, instruction_local_id, tratador_id, text_content, audio_url, audio_key, evidencia_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [local_id, id, user.id, text_content ?? null, audio_url ?? null, audio_key ?? null, evidencia_key ?? null]
    );

    if (user.role === 'tratador') {
      await query(
        "UPDATE hive_instructions SET status = 'concluida' WHERE local_id = $1",
        [id]
      );
    }

    res.status(201).json(row);
  } catch (err) { next(err); }
});

// ── GET /api/instructions/sla-report ─────────────────────────────────────────

router.get('/sla-report', requireRole('master_admin', 'responsavel', 'orientador'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { apiary_local_id, date_from, date_to } = req.query as Record<string, string | undefined>;

    const conditions: string[] = ["i.deleted_at IS NULL"];
    const params: unknown[] = [];
    let p = 1;

    // Scope: responsavel only sees their apiaries
    if (user.role === 'responsavel') {
      const ids = user.apiary_local_ids;
      if (ids.length === 0) { res.json([]); return; }
      conditions.push(`i.apiary_local_id = ANY($${p}::varchar[])`);
      params.push(ids); p++;
    }

    if (apiary_local_id) {
      conditions.push(`i.apiary_local_id = $${p++}`);
      params.push(apiary_local_id);
    }
    if (date_from) {
      conditions.push(`i.created_at >= $${p++}`);
      params.push(date_from);
    }
    if (date_to) {
      conditions.push(`i.created_at <= $${p++}`);
      params.push(date_to);
    }

    const where = conditions.join(' AND ');

    // Aggregate per tratador based on who responded (or who the hive is assigned to)
    const rows = await query<{
      user_id: number;
      user_name: string;
      total: string;
      concluidas_no_prazo: string;
      concluidas_atrasadas: string;
      pendentes: string;
    }>(`
      SELECT
        u.id                                            AS user_id,
        u.name                                          AS user_name,
        COUNT(DISTINCT i.local_id)::text                AS total,
        COUNT(DISTINCT CASE
          WHEN i.status IN ('concluida','validada')
           AND (i.prazo_conclusao IS NULL OR i.updated_at <= i.prazo_conclusao)
          THEN i.local_id END)::text                    AS concluidas_no_prazo,
        COUNT(DISTINCT CASE
          WHEN i.status IN ('concluida','validada')
           AND i.prazo_conclusao IS NOT NULL
           AND i.updated_at > i.prazo_conclusao
          THEN i.local_id END)::text                    AS concluidas_atrasadas,
        COUNT(DISTINCT CASE
          WHEN i.status IN ('pendente','em_execucao')
          THEN i.local_id END)::text                    AS pendentes
      FROM hive_instructions i
      JOIN hive_instruction_responses r ON r.instruction_local_id = i.local_id AND r.deleted_at IS NULL
      JOIN users u ON u.id = r.tratador_id
      WHERE ${where}
      GROUP BY u.id, u.name
      ORDER BY u.name
    `, params);

    const report = rows.map((r) => {
      const total              = parseInt(r.total, 10);
      const concluidas_no_prazo   = parseInt(r.concluidas_no_prazo, 10);
      const concluidas_atrasadas  = parseInt(r.concluidas_atrasadas, 10);
      const pendentes             = parseInt(r.pendentes, 10);
      const concluidas_total      = concluidas_no_prazo + concluidas_atrasadas;
      const taxa_cumprimento      = total > 0 ? Math.round((concluidas_total / total) * 100) : 0;
      return {
        user_id: r.user_id,
        user_name: r.user_name,
        total,
        concluidas_no_prazo,
        concluidas_atrasadas,
        pendentes,
        taxa_cumprimento,
      };
    });

    res.json(report);
  } catch (err) { next(err); }
});

// ── POST /api/instructions/upload-url ────────────────────────────────────────

router.post('/upload-url', validateUpload, async (req, res, next) => {
  try {
    const { filename, contentType } = req.body as { filename: string; contentType: string };
    if (!filename) { res.status(400).json({ error: 'filename é obrigatório' }); return; }
    const key = `instructions/${uuidv4()}-${filename}`;
    const [uploadUrl, readUrl] = await Promise.all([
      getUploadUrl(key, contentType),
      generateSignedUrl(key, 3600),
    ]);
    res.json({ uploadUrl, readUrl, key });
  } catch (err) { next(err); }
});

export default router;
