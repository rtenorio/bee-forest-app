import { Request, Response, NextFunction } from 'express';
import { query } from '../db/connection';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type AuditResourceType =
  | 'hive'
  | 'inspection'
  | 'instruction'
  | 'harvest'
  | 'feeding'
  | 'production'
  | 'division'
  | 'stock_item'
  | 'melgueira'
  | 'apiary'
  | 'user';

export interface ResourceInfo {
  resource_id?: string | null;
  resource_label?: string | null;
  payload?: Record<string, unknown> | null;
}

/**
 * Factory middleware that writes an audit log entry after a successful
 * response (HTTP 200, 201, or 204).
 *
 * Runs fire-and-forget after res.finish — never blocks the request.
 *
 * @param action         CREATE | UPDATE | DELETE
 * @param resourceType   The type of resource being mutated
 * @param getResourceInfo  Extracts resource_id, resource_label, and optional
 *                       payload from (req, responseBody). The responseBody is
 *                       the JSON value passed to res.json(), or undefined for
 *                       204 responses.
 */
export function auditLog(
  action: AuditAction,
  resourceType: AuditResourceType,
  getResourceInfo: (req: Request, resBody: unknown) => ResourceInfo
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Intercept res.json to capture the response body
    let capturedBody: unknown;
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      capturedBody = body;
      return originalJson(body);
    };

    res.on('finish', () => {
      if (res.statusCode !== 200 && res.statusCode !== 201 && res.statusCode !== 204) return;
      const user = req.user;
      if (!user) return;

      const ip =
        (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
        req.socket?.remoteAddress ??
        null;

      let info: ResourceInfo = {};
      try {
        info = getResourceInfo(req, capturedBody);
      } catch (err) {
        console.error('[audit] getResourceInfo threw:', err);
      }

      query(
        `INSERT INTO audit_logs
           (actor_user_id, user_name, user_role, action, resource_type, resource_id, resource_label, payload, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          user.id,
          user.name,
          user.role,
          action,
          resourceType,
          info.resource_id ?? null,
          info.resource_label ?? null,
          info.payload != null ? JSON.stringify(info.payload) : null,
          ip,
        ]
      ).catch((err) => console.error('[audit] insert failed:', err));
    });

    next();
  };
}
