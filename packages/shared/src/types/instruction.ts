export type InstructionStatus =
  | 'pendente'
  | 'em_execucao'
  | 'concluida'
  | 'validada'
  | 'rejeitada';

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
  prazo_conclusao: string | null;
  evidencia_url: string | null;
  evidencia_key: string | null;
  validado_por: number | null;
  validado_em: string | null;
  motivo_rejeicao: string | null;
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
  status: InstructionStatus;
  evidencia_url: string | null;
  evidencia_key: string | null;
  validado_por: number | null;
  validado_em: string | null;
  motivo_rejeicao: string | null;
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
  prazo_conclusao?: string | null;
}

export interface InstructionResponseCreate {
  local_id: string;
  text_content?: string | null;
  audio_url?: string | null;
  audio_key?: string | null;
  evidencia_key?: string | null;
}
