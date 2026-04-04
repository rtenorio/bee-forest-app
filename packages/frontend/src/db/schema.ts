import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Apiary, Species, Hive, Inspection, Production, Feeding, Harvest, HoneyBatch } from '@bee-forest/shared';
import type { SyncQueueItem } from '@bee-forest/shared';

export interface PendingQRScan {
  id: string;
  hive_local_id: string;
  scanned_at: string;
}

export interface BeeForestDB extends DBSchema {
  apiaries: {
    key: string;
    value: Apiary;
    indexes: { 'by-updated': string; 'by-dirty': number };
  };
  species: {
    key: string;
    value: Species;
    indexes: { 'by-name': string };
  };
  hives: {
    key: string;
    value: Hive;
    indexes: { 'by-apiary': string; 'by-status': string; 'by-updated': string };
  };
  inspections: {
    key: string;
    value: Inspection;
    indexes: { 'by-hive': string; 'by-date': string };
  };
  productions: {
    key: string;
    value: Production;
    indexes: { 'by-hive': string; 'by-date': string; 'by-type': string };
  };
  feedings: {
    key: string;
    value: Feeding;
    indexes: { 'by-hive': string; 'by-date': string };
  };
  sync_queue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-entity': string; 'by-created': string };
  };
  qr_scans: {
    key: string;
    value: PendingQRScan;
    indexes: { 'by-hive': string; 'by-created': string };
  };
  harvests: {
    key: string;
    value: Harvest;
    indexes: { 'by-apiary': string; 'by-date': string };
  };
  honey_batches: {
    key: string;
    value: HoneyBatch;
    indexes: { 'by-apiary': string; 'by-status': string; 'by-date': string };
  };
}

const DB_NAME = 'bee-forest';
const DB_VERSION = 4;

let dbInstance: IDBPDatabase<BeeForestDB> | null = null;

export async function getDb(): Promise<IDBPDatabase<BeeForestDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<BeeForestDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // ── Version 1 stores ────────────────────────────────────────────────────
      if (oldVersion < 1) {
        const apiariesStore = db.createObjectStore('apiaries', { keyPath: 'local_id' });
        apiariesStore.createIndex('by-updated', 'updated_at');
        apiariesStore.createIndex('by-dirty', 'is_dirty');

        const speciesStore = db.createObjectStore('species', { keyPath: 'local_id' });
        speciesStore.createIndex('by-name', 'name');

        const hivesStore = db.createObjectStore('hives', { keyPath: 'local_id' });
        hivesStore.createIndex('by-apiary', 'apiary_local_id');
        hivesStore.createIndex('by-status', 'status');
        hivesStore.createIndex('by-updated', 'updated_at');

        const inspectionsStore = db.createObjectStore('inspections', { keyPath: 'local_id' });
        inspectionsStore.createIndex('by-hive', 'hive_local_id');
        inspectionsStore.createIndex('by-date', 'inspected_at');

        const productionsStore = db.createObjectStore('productions', { keyPath: 'local_id' });
        productionsStore.createIndex('by-hive', 'hive_local_id');
        productionsStore.createIndex('by-date', 'harvested_at');
        productionsStore.createIndex('by-type', 'product_type');

        const feedingsStore = db.createObjectStore('feedings', { keyPath: 'local_id' });
        feedingsStore.createIndex('by-hive', 'hive_local_id');
        feedingsStore.createIndex('by-date', 'fed_at');

        const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
        syncStore.createIndex('by-entity', 'entity_local_id');
        syncStore.createIndex('by-created', 'created_at');
      }

      // ── Version 2: QR scan offline queue ────────────────────────────────────
      if (oldVersion < 2) {
        const qrStore = db.createObjectStore('qr_scans', { keyPath: 'id' });
        qrStore.createIndex('by-hive', 'hive_local_id');
        qrStore.createIndex('by-created', 'scanned_at');
      }

      // ── Version 3: Colheitas ─────────────────────────────────────────────────
      if (oldVersion < 3) {
        const harvestsStore = db.createObjectStore('harvests', { keyPath: 'local_id' });
        harvestsStore.createIndex('by-apiary', 'apiary_local_id');
        harvestsStore.createIndex('by-date', 'harvested_at');
      }

      // ── Version 4: Lotes de mel ───────────────────────────────────────────────
      if (oldVersion < 4) {
        const batchesStore = db.createObjectStore('honey_batches', { keyPath: 'local_id' });
        batchesStore.createIndex('by-apiary', 'apiary_local_id');
        batchesStore.createIndex('by-status', 'current_status');
        batchesStore.createIndex('by-date', 'harvest_date');
      }
    },
  });

  return dbInstance;
}
