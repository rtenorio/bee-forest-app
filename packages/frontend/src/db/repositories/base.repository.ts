import { v4 as uuidv4 } from 'uuid';
import { getDb, BeeForestDB } from '../schema';
import type { SyncMeta, SyncQueueItem, EntityType } from '@bee-forest/shared';

type StoreName = keyof BeeForestDB;

export abstract class BaseRepository<T extends SyncMeta> {
  abstract readonly storeName: Exclude<StoreName, 'sync_queue'>;
  abstract readonly entityType: EntityType;

  protected async getDb() {
    return getDb();
  }

  protected makeSyncMeta(): SyncMeta {
    const now = new Date().toISOString();
    return {
      local_id: uuidv4(),
      server_id: null,
      updated_at: now,
      deleted_at: null,
      synced_at: null,
      is_dirty: true,
    };
  }

  async create(data: Omit<T, keyof SyncMeta | 'created_at'>): Promise<T> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const meta = { ...this.makeSyncMeta(), created_at: now };
    const entity = { ...data, ...meta } as unknown as T;
    // @ts-expect-error dynamic store
    await db.put(this.storeName, entity);
    await this.enqueueSync('CREATE', entity);
    return entity;
  }

  async update(local_id: string, data: Partial<Omit<T, keyof SyncMeta>>): Promise<T | null> {
    const db = await this.getDb();
    // @ts-expect-error dynamic store
    const existing = await db.get(this.storeName, local_id) as T | undefined;
    if (!existing) return null;
    const updated: T = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
      is_dirty: true,
    };
    // @ts-expect-error dynamic store
    await db.put(this.storeName, updated);
    await this.enqueueSync('UPDATE', updated);
    return updated;
  }

  async softDelete(local_id: string): Promise<void> {
    const db = await this.getDb();
    // @ts-expect-error dynamic store
    const existing = await db.get(this.storeName, local_id) as T | undefined;
    if (!existing) return;
    const deleted: T = {
      ...existing,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_dirty: true,
    };
    // @ts-expect-error dynamic store
    await db.put(this.storeName, deleted);
    await this.enqueueSync('DELETE', deleted);
  }

  async getAll(): Promise<T[]> {
    const db = await this.getDb();
    // @ts-expect-error dynamic store
    const all = await db.getAll(this.storeName) as T[];
    return all.filter((item) => !item.deleted_at);
  }

  async getById(local_id: string): Promise<T | null> {
    const db = await this.getDb();
    // @ts-expect-error dynamic store
    const item = await db.get(this.storeName, local_id) as T | undefined;
    if (!item || item.deleted_at) return null;
    return item;
  }

  async upsertFromServer(data: T): Promise<void> {
    const db = await this.getDb();
    const record = { ...data, is_dirty: false, synced_at: new Date().toISOString() };
    // @ts-expect-error dynamic store
    await db.put(this.storeName, record);
  }

  private async enqueueSync(operation: 'CREATE' | 'UPDATE' | 'DELETE', entity: T): Promise<void> {
    const db = await this.getDb();
    const queueItem: SyncQueueItem = {
      id: uuidv4(),
      entity_type: this.entityType,
      entity_local_id: entity.local_id,
      operation,
      payload: entity as unknown as Record<string, unknown>,
      created_at: new Date().toISOString(),
      attempts: 0,
      last_error: null,
    };
    await db.put('sync_queue', queueItem);
  }
}
