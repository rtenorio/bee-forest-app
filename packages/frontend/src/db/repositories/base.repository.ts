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
    // Registro novo: não existe versão no servidor para servir de base
    await this.enqueueSync('CREATE', entity, null);
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
    // existing.updated_at é a versão do servidor enquanto o registro não estiver sujo
    await this.enqueueSync('UPDATE', updated, existing.updated_at);
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
    await this.enqueueSync('DELETE', deleted, existing.updated_at);
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

  async clearDirty(local_id: string): Promise<void> {
    const db = await this.getDb();
    // @ts-expect-error dynamic store
    const existing = await db.get(this.storeName, local_id) as T | undefined;
    if (!existing) return;
    // @ts-expect-error dynamic store
    await db.put(this.storeName, { ...existing, is_dirty: false, synced_at: new Date().toISOString() });
  }

  async clearAllDirty(): Promise<void> {
    const db = await this.getDb();
    // @ts-expect-error dynamic store
    const all = await db.getAll(this.storeName) as T[];
    const dirty = all.filter((r) => r.is_dirty);
    if (dirty.length === 0) return;

    // Only clear records that have no pending sync queue item
    const queue = await db.getAll('sync_queue');
    const queuedIds = new Set(queue.map((q) => q.entity_local_id));
    const stale = dirty.filter((r) => !queuedIds.has(r.local_id));
    const now = new Date().toISOString();
    await Promise.all(
      stale.map((r) =>
        // @ts-expect-error dynamic store
        db.put(this.storeName, { ...r, is_dirty: false, synced_at: now })
      )
    );
  }

  private async enqueueSync(
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    entity: T,
    baseUpdatedAt: string | null
  ): Promise<void> {
    const db = await this.getDb();

    // Edições encadeadas offline: o item pendente já carrega a versão do servidor.
    // Herdar dele — senão a base viraria o timestamp da edição local anterior.
    const pending = (await db.getAll('sync_queue'))
      .filter((q) => q.entity_local_id === entity.local_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];

    const queueItem: SyncQueueItem = {
      id: uuidv4(),
      entity_type: this.entityType,
      entity_local_id: entity.local_id,
      operation,
      payload: entity as unknown as Record<string, unknown>,
      created_at: new Date().toISOString(),
      attempts: 0,
      last_error: null,
      base_updated_at: pending ? pending.base_updated_at ?? null : baseUpdatedAt,
    };
    await db.put('sync_queue', queueItem);
  }
}
