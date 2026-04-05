export interface HiveTransfer {
  id: number;
  local_id: string;
  hive_local_id: string;
  apiary_origin_local_id: string;
  apiary_destination_local_id: string;
  transferred_at: string;
  transferred_by: string;
  reason: string | null;
  created_at: string;
  // Joined
  hive_code?: string;
  apiary_origin_name?: string;
  apiary_destination_name?: string;
}

export interface HiveTransferCreate {
  local_id: string;
  hive_local_id: string;
  apiary_origin_local_id: string;
  apiary_destination_local_id: string;
  transferred_at: string;
  transferred_by: string;
  reason?: string | null;
}
