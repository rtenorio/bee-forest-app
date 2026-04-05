import { Router } from 'express';
import { query, queryOne } from '../db/connection';
import { validate } from '../middleware/validate';
import {
  InstructionCreateSchema,
  InstructionStatusSchema,
  InstructionResponseCreateSchema,
} from '../shared';
import { getUploadUrl, getPublicUrl } from '../services/r2';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the apiary_local_ids accessible to the current user.
 * master_admin and socio see all (returns null = no filter).
 */
async function resolveAccessibleApiaryIds(req: any): Promise<string[] | null> {
  const role = req.user!.role;
  if (role === 'master_admin' || role === 'socio') return null;
  if (role === 'orientador' || role === 'responsavel') {
    return req.user!.apiary_local_ids;
  }
  if (role === 'tratador') {
    // Tratador vê instruções das caixas atribuídas a ele — resolve os apiários dessas caixas
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

    const accessibleApiaryIds = await resolveAccessibleApiaryIds(req);

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
      if (accessibleApiaryIds.length === 0) {
        res.json([]);
        return;
      }
      sql += ` AND i.apiary_local_id = ANY($${p}::varchar[])`;
      params.push(accessibleApiaryIds);
      p++;
    }

    // Tratador só vê instruções das suas caixas (ou meliponário-level)
    if (user.role === 'tratador') {
      const hiveIds = user.hive_local_ids;
      sql += ` AND (i.hive_local_id IS NULL OR i.hive_local_id = ANY($${p}::varchar[]))`;
      params.push(hiveIds);
      p++;
    }

    if (apiary_local_id) {
      sql += ` AND i.apiary_local_id = $${p}`;
      params.push(apiary_local_id);
      p++;
    }

    if (hive_local_id) {
      sql += ` AND i.hive_local_id = $${p}`;
      params.push(hive_local_id);
      p++;
    }

    if (status) {
      sql += ` AND i.status = $${p}`;
      params.push(status);
      p++;
    }

    sql += ' ORDER BY i.created_at DESC';

    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/instructions ────────────────────────────────────────────────────

router.post('/', validate(InstructionCreateSchema), async (req, res, next) => {
  try {
    const user = req.user!;
    if (user.role === 'tratador') {
      res.status(403).json({ error: 'Tratadores não podem criar instruções' });
      return;
    }

    const { local_id, apiary_local_id, hive_local_id, text_content, audio_url } = req.body;

    const row = await queryOne<{ id: number; local_id: string; status: string; created_at: string }>(
      `INSERT INTO hive_instructions
         (local_id, apiary_local_id, hive_local_id, author_id, text_content, audio_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [local_id, apiary_local_id, hive_local_id ?? null, user.id, text_content ?? null, audio_url ?? null]
    );

    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/instructions/:id/status ───────────────────────────────────────

router.patch('/:id/status', validate(InstructionStatusSchema), async (req, res, next) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { status } = req.body;

    const instruction = await queryOne<{ author_id: number; apiary_local_id: string; hive_local_id: string | null }>(
      'SELECT author_id, apiary_local_id, hive_local_id FROM hive_instructions WHERE local_id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (!instruction) { res.status(404).json({ error: 'Instrução não encontrada' }); return; }

    // Tratador só pode marcar done suas próprias caixas
    if (user.role === 'tratador' && instruction.hive_local_id) {
      if (!user.hive_local_ids.includes(instruction.hive_local_id)) {
        res.status(403).json({ error: 'Sem permissão para esta instrução' });
        return;
      }
    }

    const updated = await queryOne(
      'UPDATE hive_instructions SET status = $1 WHERE local_id = $2 RETURNING *',
      [status, id]
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/instructions/:id ─────────────────────────────────────────────

router.delete('/:id', async (req, res, next) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const instruction = await queryOne<{ author_id: number }>(
      'SELECT author_id FROM hive_instructions WHERE local_id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (!instruction) { res.status(404).json({ error: 'Instrução não encontrada' }); return; }

    if (user.role !== 'master_admin' && instruction.author_id !== user.id) {
      res.status(403).json({ error: 'Sem permissão para excluir esta instrução' });
      return;
    }

    await query('UPDATE hive_instructions SET deleted_at = NOW() WHERE local_id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
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
  } catch (err) {
    next(err);
  }
});

// ── POST /api/instructions/:id/responses ─────────────────────────────────────

router.post('/:id/responses', validate(InstructionResponseCreateSchema), async (req, res, next) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { local_id, text_content, audio_url } = req.body;

    const instruction = await queryOne<{ id: number }>(
      'SELECT id FROM hive_instructions WHERE local_id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (!instruction) { res.status(404).json({ error: 'Instrução não encontrada' }); return; }

    const row = await queryOne(
      `INSERT INTO hive_instruction_responses
         (local_id, instruction_local_id, tratador_id, text_content, audio_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [local_id, id, user.id, text_content ?? null, audio_url ?? null]
    );

    // Auto-mark instruction as done when tratador responds
    if (user.role === 'tratador') {
      await query(
        "UPDATE hive_instructions SET status = 'done' WHERE local_id = $1",
        [id]
      );
    }

    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/instructions/upload-url ────────────────────────────────────────
// Frontend solicita URL pré-assinada para fazer upload de áudio direto ao R2

router.post('/upload-url', async (req, res, next) => {
  try {
    const { filename, contentType } = req.body as { filename: string; contentType: string };
    if (!filename || !contentType) {
      res.status(400).json({ error: 'filename e contentType são obrigatórios' });
      return;
    }
    const key = `instructions/${uuidv4()}-${filename}`;
    const uploadUrl = await getUploadUrl(key, contentType);
    const publicUrl = getPublicUrl(key);
    res.json({ uploadUrl, publicUrl, key });
  } catch (err) {
    next(err);
  }
});

export default router;
