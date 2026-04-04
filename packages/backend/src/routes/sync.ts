import { Router } from 'express';
import { pool, query } from '../db/connection';
import { validate } from '../middleware/validate';
import { SyncPayloadSchema, SyncQueueItem } from '@bee-forest/shared';
import type { Request } from 'express';

const router = Router();

const TABLE_MAP: Record<string, string> = {
  apiary: 'apiaries',
  hive: 'hives',
  species: 'species',
  inspection: 'inspections',
  production: 'productions',
  feeding: 'feedings',
  harvest: 'harvests',
  batch: 'honey_batches',
};

// Retorna os hive_local_ids acessíveis para o usuário atual
async function resolveAccessibleHiveIds(req: Request): Promise<string[] | null> {
  const role = req.user!.role;
  if (role === 'socio') return null;
  if (role === 'tratador') return req.user!.hive_local_ids;
  if (role === 'responsavel') {
    const ids = req.user!.apiary_local_ids;
    if (ids.length === 0) return [];
    const rows = await query<{ local_id: string }>(
      'SELECT local_id FROM hives WHERE apiary_local_id = ANY($1::varchar[]) AND deleted_at IS NULL', [ids]
    );
    return rows.map((r) => r.local_id);
  }
  return [];
}

router.post('/', validate(SyncPayloadSchema), async (req, res, next) => {
  const { client_id, items, last_sync_at } = req.body;
  const client = await pool.connect();
  const user = req.user!;

  try {
    await client.query('BEGIN');

    const resolved: Array<{ local_id: string; server_id: number; updated_at: string }> = [];
    const conflicts: Array<{ local_id: string; server_record: unknown; conflict_type: string }> = [];

    for (const item of items as SyncQueueItem[]) {
      const table = TABLE_MAP[item.entity_type];
      if (!table) continue;

      // Tratador só pode push de inspeções das suas caixas de abelha
      if (user.role === 'tratador') {
        if (!['inspection'].includes(item.entity_type)) continue;
        const payload = item.payload as Record<string, unknown>;
        if (!user.hive_local_ids.includes(payload.hive_local_id as string)) continue;
      }

      if (item.operation === 'DELETE') {
        await client.query(`UPDATE ${table} SET deleted_at = NOW() WHERE local_id = $1 AND deleted_at IS NULL`, [item.entity_local_id]);
        continue;
      }

      const payload = item.payload as Record<string, unknown>;
      const existing = await client.query(`SELECT server_id, updated_at FROM ${table} WHERE local_id = $1`, [item.entity_local_id]);

      // Fields that exist only on the client and must never be written to the DB
      const CLIENT_ONLY = new Set(['local_id', 'server_id', 'is_dirty', 'synced_at', 'species_name']);
      const dbPayload = Object.fromEntries(
        Object.entries(payload).filter(([k]) => !CLIENT_ONLY.has(k))
      );

      if (existing.rows.length === 0) {
        const cols = ['local_id', ...Object.keys(dbPayload)];
        const vals = [item.entity_local_id, ...Object.values(dbPayload)];
        const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
        const result = await client.query(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})
           ON CONFLICT (local_id) DO UPDATE SET ${cols.slice(1).map((c, i) => `${c} = $${i + 2}`).join(', ')}
           RETURNING server_id, updated_at`,
          vals
        );
        if (result.rows[0]) {
          resolved.push({ local_id: item.entity_local_id, server_id: result.rows[0].server_id, updated_at: result.rows[0].updated_at });
        }
      } else {
        const serverUpdatedAt = new Date(existing.rows[0].updated_at).getTime();
        const clientUpdatedAt = payload.updated_at ? new Date(payload.updated_at as string).getTime() : 0;

        if (clientUpdatedAt >= serverUpdatedAt) {
          const setClauses = Object.keys(dbPayload).map((k, i) => `${k} = $${i + 2}`).join(', ');
          const vals = [item.entity_local_id, ...Object.values(dbPayload)];
          if (setClauses) {
            const result = await client.query(
              `UPDATE ${table} SET ${setClauses} WHERE local_id = $1 RETURNING server_id, updated_at`, vals
            );
            if (result.rows[0]) {
              resolved.push({ local_id: item.entity_local_id, server_id: result.rows[0].server_id, updated_at: result.rows[0].updated_at });
            }
          }
        } else {
          const serverRecord = await client.query(`SELECT * FROM ${table} WHERE local_id = $1`, [item.entity_local_id]);
          conflicts.push({ local_id: item.entity_local_id, server_record: serverRecord.rows[0], conflict_type: 'UPDATE_UPDATE' });
        }
      }
    }

    // Pull: retorna apenas dados acessíveis ao usuário
    // Quando last_sync_at é null (primeiro acesso), faz pull total desde a época
    const server_changes: Array<{ entity_type: string; records: unknown[] }> = [];
    const accessibleHiveIds = await resolveAccessibleHiveIds(req);
    const since = last_sync_at ?? '1970-01-01T00:00:00.000Z';

    for (const [entity_type, table] of Object.entries(TABLE_MAP)) {
      // Tratador não recebe produções/alimentações/colheitas/lotes
      if (user.role === 'tratador' && ['production', 'feeding', 'harvest', 'batch'].includes(entity_type)) continue;

      let rows;
      if (accessibleHiveIds === null) {
        rows = await client.query(
          `SELECT * FROM ${table} WHERE updated_at > $1 AND deleted_at IS NULL`,
          [since]
        );
      } else if (entity_type === 'apiary') {
        if (user.role === 'tratador') continue;
        const ids = user.apiary_local_ids;
        if (ids.length === 0) continue;
        rows = await client.query(
          `SELECT * FROM ${table} WHERE updated_at > $1 AND local_id = ANY($2::varchar[]) AND deleted_at IS NULL`,
          [since, ids]
        );
      } else if (['hive', 'inspection', 'production', 'feeding'].includes(entity_type)) {
        if (accessibleHiveIds.length === 0) continue;
        const col = entity_type === 'hive' ? 'local_id' : 'hive_local_id';
        rows = await client.query(
          `SELECT * FROM ${table} WHERE updated_at > $1 AND ${col} = ANY($2::varchar[]) AND deleted_at IS NULL`,
          [since, accessibleHiveIds]
        );
      } else if (entity_type === 'harvest' || entity_type === 'batch') {
        if (user.role === 'responsavel') {
          const ids = user.apiary_local_ids;
          if (ids.length === 0) continue;
          rows = await client.query(
            `SELECT * FROM ${table} WHERE updated_at > $1 AND apiary_local_id = ANY($2::varchar[]) AND deleted_at IS NULL`,
            [since, ids]
          );
        } else {
          rows = await client.query(
            `SELECT * FROM ${table} WHERE updated_at > $1 AND deleted_at IS NULL`,
            [since]
          );
        }
      } else {
        rows = await client.query(
          `SELECT * FROM ${table} WHERE updated_at > $1 AND deleted_at IS NULL`,
          [since]
        );
      }

      if (rows && rows.rows.length > 0) {
        server_changes.push({ entity_type, records: rows.rows });
      }
    }

    await client.query(
      'INSERT INTO sync_log (client_id, items_pushed, items_pulled, conflicts) VALUES ($1,$2,$3,$4)',
      [client_id, items.length, server_changes.reduce((a, s) => a + s.records.length, 0), conflicts.length]
    );

    await client.query('COMMIT');
    res.json({ resolved, conflicts, server_changes });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

export default router;
