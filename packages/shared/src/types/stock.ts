import type { SyncMeta } from './sync';

export type StockCategory = 'honey' | 'input' | 'packaging';
export type HoneyStockType = 'vivo' | 'maturado';
export type StockUnit = 'ml' | 'g' | 'kg' | 'l' | 'units';
export type StockMovementType = 'entry' | 'exit' | 'transfer';
export type StockMovementDirection = 'in' | 'out';
export type StockOriginType = 'harvest' | 'batch' | 'purchase' | 'transfer' | 'manual';
export type StockDestinationType = 'sale' | 'transfer' | 'internal_use' | 'processing' | 'manual';
export type StockAlertType = 'low_stock' | 'out_of_stock';

// ── Main entity (stored in IDB) ───────────────────────────────────────────────

export interface StockItem extends SyncMeta {
  apiary_local_id: string;
  category: StockCategory;
  name: string;
  honey_type: HoneyStockType | null;
  unit: StockUnit;
  current_quantity: number;
  current_weight_kg: number | null;
  min_quantity: number;
  notes: string | null;
  created_at: string;
}

export type StockItemCreate = Omit<StockItem, keyof SyncMeta | 'created_at' | 'current_quantity' | 'current_weight_kg'>;
export type StockItemUpdate = Partial<Pick<StockItem, 'name' | 'min_quantity' | 'notes' | 'unit'>>;

// ── Movements (API-only) ──────────────────────────────────────────────────────

export interface StockMovement {
  id: number;
  stock_item_id: number;
  stock_item_local_id: string;
  apiary_local_id: string;
  movement_type: StockMovementType;
  quantity: number;
  weight_kg: number | null;
  direction: StockMovementDirection;
  origin_type: StockOriginType | null;
  origin_id: string | null;
  destination_type: StockDestinationType | null;
  destination_apiary_id: string | null;
  destination_notes: string | null;
  unit_price: number | null;
  responsible_user_id: number | null;
  responsible_name: string | null;
  notes: string | null;
  created_at: string;
  // Joined
  item_name?: string;
  item_category?: string;
  item_unit?: string;
  apiary_name?: string;
}

export interface StockMovementCreate {
  stock_item_local_id: string;
  movement_type: StockMovementType;
  quantity: number;
  weight_kg?: number | null;
  direction: StockMovementDirection;
  origin_type?: StockOriginType | null;
  origin_id?: string | null;
  destination_type?: StockDestinationType | null;
  destination_apiary_id?: string | null;
  destination_notes?: string | null;
  unit_price?: number | null;
  notes?: string | null;
}

// ── Alerts (API-only) ─────────────────────────────────────────────────────────

export interface StockAlert {
  id: number;
  stock_item_id: number;
  stock_item_local_id: string;
  apiary_local_id: string;
  item_name: string;
  item_unit: string;
  apiary_name: string | null;
  current_quantity: number;
  min_quantity: number;
  alert_type: StockAlertType;
  triggered_at: string;
  resolved_at: string | null;
}

// ── Summary (API-only) ────────────────────────────────────────────────────────

export interface StockApiarySummary {
  apiary_local_id: string;
  apiary_name: string | null;
  honey_vivo_volume_ml: number;
  honey_vivo_weight_kg: number;
  honey_maturado_volume_ml: number;
  honey_maturado_weight_kg: number;
  inputs_ok: number;
  inputs_low: number;
  inputs_out: number;
  packaging_total: number;
  alerts_count: number;
}
