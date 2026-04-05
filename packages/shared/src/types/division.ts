export type DivisionStatus = 'pendente' | 'realizada' | 'cancelada';

export interface Division {
  id: number;
  local_id: string;
  hive_origin_local_id: string;
  apiary_origin_local_id: string;
  hive_new_local_id: string | null;
  apiary_destination_local_id: string | null;
  status: DivisionStatus;
  identified_at: string;    // DATE as ISO string
  identified_by: string;
  divided_at: string | null;
  divided_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  hive_origin_code?: string;
  apiary_origin_name?: string;
  hive_new_code?: string;
  apiary_destination_name?: string;
}

export interface DivisionCreate {
  local_id: string;
  hive_origin_local_id: string;
  apiary_origin_local_id: string;
  identified_at: string;
  identified_by: string;
  notes?: string | null;
}

export interface DivisionUpdate {
  status?: DivisionStatus;
  hive_new_local_id?: string | null;
  apiary_destination_local_id?: string | null;
  divided_at?: string | null;
  divided_by?: string | null;
  notes?: string | null;
}
