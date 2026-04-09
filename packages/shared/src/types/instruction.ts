export type InstructionStatus = 'pending' | 'done';

export interface Instruction {
  id: number;
  local_id: string;
  apiary_local_id: string;
  hive_local_id: string | null;
  author_id: number;
  author_name: string;
  author_role: string;
  text_content: string | null;
  audio_url: string | null;
  audio_key: string | null;
  status: InstructionStatus;
  priority_days: number | null;
  due_date: string | null;
  response_count: number;
  created_at: string;
  updated_at: string;
}

export interface InstructionResponse {
  id: number;
  local_id: string;
  instruction_local_id: string;
  tratador_id: number;
  tratador_name: string;
  text_content: string | null;
  audio_url: string | null;
  audio_key: string | null;
  created_at: string;
}

export interface InstructionCreate {
  local_id: string;
  apiary_local_id: string;
  hive_local_id?: string | null;
  text_content?: string | null;
  audio_url?: string | null;
  audio_key?: string | null;
  priority_days?: number | null;
  due_date?: string | null;
}

export interface InstructionResponseCreate {
  local_id: string;
  text_content?: string | null;
  audio_url?: string | null;
  audio_key?: string | null;
}
