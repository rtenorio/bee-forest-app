import { z } from 'zod';

export const SyncQueueItemSchema = z.object({
  id: z.string().uuid(),
  entity_type: z.enum(['apiary', 'hive', 'species', 'inspection', 'production', 'feeding', 'harvest', 'batch', 'stock_item']),
  entity_local_id: z.string().uuid(),
  operation: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  payload: z.record(z.unknown()),
  created_at: z.string(),
  attempts: z.number().int().min(0).default(0),
  last_error: z.string().nullable().default(null),
  // optional: clientes antigos, já instalados, não enviam este campo
  base_updated_at: z.string().nullable().optional(),
});

export const SyncPayloadSchema = z.object({
  client_id: z.string().uuid(),
  items: z.array(SyncQueueItemSchema),
  last_sync_at: z.string().nullable(),
});

export type SyncPayloadInput = z.infer<typeof SyncPayloadSchema>;
