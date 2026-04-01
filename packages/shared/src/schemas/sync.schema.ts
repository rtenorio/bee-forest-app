import { z } from 'zod';

export const SyncQueueItemSchema = z.object({
  id: z.string().uuid(),
  entity_type: z.enum(['apiary', 'hive', 'species', 'inspection', 'production', 'feeding']),
  entity_local_id: z.string().uuid(),
  operation: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  payload: z.record(z.unknown()),
  created_at: z.string(),
  attempts: z.number().int().min(0).default(0),
  last_error: z.string().nullable().default(null),
});

export const SyncPayloadSchema = z.object({
  client_id: z.string().uuid(),
  items: z.array(SyncQueueItemSchema),
  last_sync_at: z.string().nullable(),
});

export type SyncPayloadInput = z.infer<typeof SyncPayloadSchema>;
