export type EquipmentItemType = 'modulo_ninho' | 'modulo_sobreninho' | 'caixa_vazia';
export type MelgueiraStatus  = 'disponivel' | 'em_uso' | 'manutencao';
export type EquipmentMovementType = 'entrada' | 'saida' | 'instalacao' | 'retirada' | 'desmontagem';

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentItemType, string> = {
  modulo_ninho:      'Módulo Ninho',
  modulo_sobreninho: 'Módulo Sobreninho',
  caixa_vazia:       'Caixa Vazia',
};

export const MELGUEIRA_STATUS_LABELS: Record<MelgueiraStatus, string> = {
  disponivel:  'Disponível',
  em_uso:      'Em Uso',
  manutencao:  'Manutenção',
};

// ── Equipment items (modules + boxes) ────────────────────────────────────────

export interface EquipmentItem {
  id: number;
  local_id: string;
  type: EquipmentItemType;
  quantity: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Melgueiras (individual honey supers) ─────────────────────────────────────

export interface Melgueira {
  id: number;
  local_id: string;
  code: string;
  qr_code_data: string | null;
  status: MelgueiraStatus;
  hive_local_id: string | null;
  apiary_local_id: string | null;
  installed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Joined fields
  hive_code?: string | null;
  apiary_name?: string | null;
}

export type MelgueiraCreate = {
  local_id: string;
  code: string;
  apiary_local_id?: string | null;
  notes?: string | null;
};

export type MelgueiraUpdate = Partial<{
  code: string;
  status: MelgueiraStatus;
  notes: string | null;
  apiary_local_id: string | null;
}>;

// ── Equipment movements ───────────────────────────────────────────────────────

export interface EquipmentMovement {
  id: number;
  local_id: string;
  item_type: EquipmentItemType | 'melgueira';
  item_local_id: string;
  movement_type: EquipmentMovementType;
  quantity: number;
  hive_local_id: string | null;
  reason: string | null;
  performed_by: string | null;
  created_at: string;
  // Joined
  hive_code?: string | null;
}

export type EquipmentAdjust = {
  type: EquipmentItemType;
  delta: number;          // positive = entrada, negative = saida/desmontagem
  movement_type: EquipmentMovementType;
  reason?: string | null;
  performed_by?: string | null;
  hive_local_id?: string | null;
};
