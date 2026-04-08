import { Request, Response, NextFunction } from 'express';
import { query, queryOne } from '../db/connection';

export type ResourceType =
  | 'hive'
  | 'inspection'
  | 'harvest'
  | 'feeding'
  | 'production'
  | 'division'
  | 'instruction'
  | 'stock_item'
  | 'melgueira';

interface Config {
  table: string;
  idColumn: string;
  paramName: string;
  /**
   * 'apiary' — resource has a direct apiary_local_id column.
   * 'hive'   — resource has a hive_local_id column; apiary is resolved on-demand.
   */
  ownerType: 'apiary' | 'hive';
  ownerColumn: string;
}

const CONFIGS: Record<ResourceType, Config> = {
  hive:        { table: 'hives',             idColumn: 'local_id', paramName: 'local_id', ownerType: 'apiary', ownerColumn: 'apiary_local_id' },
  inspection:  { table: 'inspections',       idColumn: 'local_id', paramName: 'local_id', ownerType: 'hive',   ownerColumn: 'hive_local_id' },
  harvest:     { table: 'harvests',          idColumn: 'local_id', paramName: 'local_id', ownerType: 'apiary', ownerColumn: 'apiary_local_id' },
  feeding:     { table: 'feedings',          idColumn: 'local_id', paramName: 'local_id', ownerType: 'hive',   ownerColumn: 'hive_local_id' },
  production:  { table: 'productions',       idColumn: 'local_id', paramName: 'local_id', ownerType: 'hive',   ownerColumn: 'hive_local_id' },
  division:    { table: 'hive_divisions',    idColumn: 'local_id', paramName: 'id',       ownerType: 'apiary', ownerColumn: 'apiary_origin_local_id' },
  instruction: { table: 'hive_instructions', idColumn: 'local_id', paramName: 'id',       ownerType: 'apiary', ownerColumn: 'apiary_local_id' },
  stock_item:  { table: 'stock_items',       idColumn: 'local_id', paramName: 'local_id', ownerType: 'apiary', ownerColumn: 'apiary_local_id' },
  melgueira:   { table: 'melgueiras',        idColumn: 'local_id', paramName: 'local_id', ownerType: 'apiary', ownerColumn: 'apiary_local_id' },
};

/**
 * Middleware factory that enforces object-level authorization.
 *
 * - master_admin / socio: always pass (unrestricted access).
 * - responsavel / orientador: resource must belong to one of their apiary_local_ids.
 * - tratador: resource must belong to one of their hive_local_ids (or an apiary
 *   derived from those hives, for apiary-typed resources).
 *
 * If the owner column is NULL (e.g. unassigned melgueira), the check is skipped
 * and the route handler resolves the request normally.
 *
 * Resources not found (null row) are passed to next() so the route handler
 * returns its own 404.
 */
export function checkResourceOwnership(resource: ResourceType) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;

      if (user.role === 'master_admin' || user.role === 'socio') {
        next(); return;
      }

      const cfg = CONFIGS[resource];
      const paramId = req.params[cfg.paramName] as string;
      if (!paramId) { next(); return; }

      const row = await queryOne<Record<string, string | null>>(
        `SELECT ${cfg.ownerColumn} FROM ${cfg.table} WHERE ${cfg.idColumn} = $1 AND deleted_at IS NULL`,
        [paramId]
      );

      if (!row) { next(); return; } // resource not found — route handles 404

      const ownerId = row[cfg.ownerColumn];
      if (!ownerId) { next(); return; } // null owner → no meaningful check possible

      if (cfg.ownerType === 'apiary') {
        if (user.role === 'responsavel' || user.role === 'orientador') {
          if (!user.apiary_local_ids.includes(ownerId)) {
            res.status(403).json({ error: 'Sem permissão para este recurso' }); return;
          }
        }

        if (user.role === 'tratador') {
          if (resource === 'hive') {
            // For the hive resource itself, paramId IS the hive_local_id
            if (!user.hive_local_ids.includes(paramId)) {
              res.status(403).json({ error: 'Sem permissão para este recurso' }); return;
            }
          } else {
            // Resolve accessible apiaries from assigned hives
            if (user.hive_local_ids.length === 0) {
              res.status(403).json({ error: 'Sem permissão para este recurso' }); return;
            }
            const hiveRows = await query<{ apiary_local_id: string }>(
              'SELECT DISTINCT apiary_local_id FROM hives WHERE local_id = ANY($1::varchar[]) AND deleted_at IS NULL',
              [user.hive_local_ids]
            );
            const tratadorApiaries = hiveRows.map((r) => r.apiary_local_id);
            if (!tratadorApiaries.includes(ownerId)) {
              res.status(403).json({ error: 'Sem permissão para este recurso' }); return;
            }
          }
        }
      } else {
        // ownerType === 'hive': resource owns a hive_local_id
        const hiveId = ownerId;

        if (user.role === 'tratador') {
          if (!user.hive_local_ids.includes(hiveId)) {
            res.status(403).json({ error: 'Sem permissão para este recurso' }); return;
          }
        }

        if (user.role === 'responsavel' || user.role === 'orientador') {
          const hive = await queryOne<{ apiary_local_id: string }>(
            'SELECT apiary_local_id FROM hives WHERE local_id = $1 AND deleted_at IS NULL',
            [hiveId]
          );
          if (!hive || !user.apiary_local_ids.includes(hive.apiary_local_id)) {
            res.status(403).json({ error: 'Sem permissão para este recurso' }); return;
          }
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
