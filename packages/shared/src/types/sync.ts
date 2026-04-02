export type EntityType =
  | 'apiary'
  | 'hive'
  | 'species'
  | 'inspection'
  | 'production'
  | 'feeding'
  | 'harvest';

export interface SyncMeta {
  local_id: string;
  server_id: number | null;
  updated_at: string;
  deleted_at: string | null;
  synced_at: string | null;
  is_dirty: boolean;
}

export interface SyncQueueItem {
  id: string;
  entity_type: EntityType;
  entity_local_id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  created_at: string;
  attempts: number;
  last_error: string | null;
}

export interface SyncPayload {
  client_id: string;
  items: SyncQueueItem[];
  last_sync_at: string | null;
}

export interface SyncResultItem {
  local_id: string;
  server_id: number;
  updated_at: string;
}

export interface SyncConflict {
  local_id: string;
  server_record: unknown;
  conflict_type: 'UPDATE_UPDATE' | 'DELETE_UPDATE';
}

export interface ServerChange {
  entity_type: EntityType;
  records: unknown[];
}

export interface SyncResult {
  resolved: SyncResultItem[];
  conflicts: SyncConflict[];
  server_changes: ServerChange[];
}
