import { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useInstructions,
  useUpdateInstructionStatus,
  useCreateInstructionResponse,
  requestAudioUploadUrl,
  requestImageUploadUrl,
  uploadAudioToR2,
} from '@/hooks/useInstructions';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { AudioRecorder } from '@/pages/Instructions/AudioRecorder';
import type { Instruction, InstructionStatus } from '@bee-forest/shared';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<InstructionStatus, string> = {
  pendente:    'Pendente',
  em_execucao: 'Em execução',
  concluida:   'Concluída',
  validada:    'Validada',
  rejeitada:   'Rejeitada',
};

function PriorityBadge({ priorityDays, dueDate }: { priorityDays: number | null | undefined; dueDate?: string | null }) {
  if (priorityDays === undefined) return null;
  const dueDateLabel = dueDate ? ` · Prazo: ${format(new Date(dueDate + 'T12:00:00'), "d MMM", { locale: ptBR })}` : '';
  if (priorityDays === null) return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-900/50 text-red-300 border border-red-700/50">
      🔴 Urgente
    </span>
  );
  if (priorityDays <= 7) return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-900/50 text-orange-300 border border-orange-700/50">
      🟠 {priorityDays} dias{dueDateLabel}
    </span>
  );
  if (priorityDays <= 15) return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-900/50 text-yellow-300 border border-yellow-700/50">
      🟡 {priorityDays} dias{dueDateLabel}
    </span>
  );
  return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-900/50 text-blue-300 border border-blue-700/50">
      🔵 {priorityDays} dias{dueDateLabel}
    </span>
  );
}

// ── Evidence modal ────────────────────────────────────────────────────────────

function EvidenceModal({
  instruction,
  onClose,
}: {
  instruction: Instruction;
  onClose: () => void;
}) {
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateStatus = useUpdateInstructionStatus();
  const createResponse = useCreateInstructionResponse(instruction.local_id);

  async function handleConclude() {
    if (!audioBlob && !photoFile) { setError('Adicione uma evidência (áudio ou foto) para concluir.'); return; }
    setUploading(true);
    setError(null);
    try {
      let evidencia_key: string | null = null;

      if (audioBlob) {
        const mimeType = audioBlob.type || 'audio/webm';
        const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        const { uploadUrl, key } = await requestAudioUploadUrl(`evidencia-${Date.now()}.${ext}`, mimeType);
        await uploadAudioToR2(uploadUrl, audioBlob, mimeType);
        evidencia_key = key;
      } else if (photoFile) {
        const ext = photoFile.name.split('.').pop() ?? 'jpg';
        const { uploadUrl, key } = await requestImageUploadUrl(`evidencia-${Date.now()}.${ext}`, photoFile.type);
        const res = await fetch(uploadUrl, { method: 'PUT', body: photoFile, headers: { 'Content-Type': photoFile.type } });
        if (!res.ok) throw new Error(`Upload foto falhou: HTTP ${res.status}`);
        evidencia_key = key;
      }

      // Create a response with the evidence
      await createResponse.mutateAsync({
        local_id: uuidv4(),
        text_content: 'Tarefa concluída com evidência.',
        evidencia_key,
      });

      // Mark as concluida with evidence
      await updateStatus.mutateAsync({
        localId: instruction.local_id,
        status: 'concluida',
        evidencia_key,
      });

      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar evidência');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 pb-safe">
      <div className="bg-stone-900 border-t border-stone-700 rounded-t-3xl w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-stone-100">Evidência de conclusão</h3>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300 text-xl leading-none">✕</button>
        </div>
        <p className="text-sm text-stone-400">
          Registre um áudio ou tire uma foto para comprovar a conclusão da tarefa.
        </p>

        {/* Áudio */}
        <div>
          <p className="text-xs text-stone-500 mb-2 uppercase tracking-wide">Áudio</p>
          <AudioRecorder recorded={audioBlob} onRecorded={setAudioBlob} onClear={() => setAudioBlob(null)} />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-stone-800" />
          <span className="text-xs text-stone-600">ou</span>
          <div className="flex-1 h-px bg-stone-800" />
        </div>

        {/* Foto */}
        <div>
          <p className="text-xs text-stone-500 mb-2 uppercase tracking-wide">Foto</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPhotoFile(f); setAudioBlob(null); } }}
          />
          {photoFile ? (
            <div className="flex items-center gap-2 bg-stone-800 rounded-xl p-3">
              <span className="text-emerald-400 text-lg">📷</span>
              <span className="text-sm text-stone-200 flex-1 truncate">{photoFile.name}</span>
              <button onClick={() => setPhotoFile(null)} className="text-stone-500 hover:text-red-400 text-xs">✕</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-stone-800 border border-stone-700 hover:bg-stone-700 text-stone-300 rounded-xl py-4 text-sm font-medium transition-colors"
            >
              📷 Tirar foto / selecionar imagem
            </button>
          )}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          onClick={handleConclude}
          disabled={uploading || (!audioBlob && !photoFile)}
          className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-base font-bold rounded-xl py-4 transition-colors"
        >
          {uploading ? 'Enviando evidência...' : '✅ Concluir tarefa'}
        </button>
      </div>
    </div>
  );
}

// ── Instruction item ──────────────────────────────────────────────────────────

interface Props {
  hiveLocalId: string;
  apiaryLocalId: string;
}

function InstructionItem({ instruction }: { instruction: Instruction }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const updateStatus = useUpdateInstructionStatus();
  const { url: instructionAudioSrc } = useSignedUrl(instruction.audio_key);
  const audioSrc = instructionAudioSrc ?? instruction.audio_url;

  const isPrazoPassado =
    instruction.prazo_conclusao &&
    new Date(instruction.prazo_conclusao) < new Date() &&
    ['pendente', 'em_execucao'].includes(instruction.status);

  const statusLabel = STATUS_LABELS[instruction.status as InstructionStatus] ?? instruction.status;

  return (
    <>
      {showEvidence && (
        <EvidenceModal instruction={instruction} onClose={() => setShowEvidence(false)} />
      )}

      <div className="bg-stone-800 border border-amber-700/40 rounded-2xl overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge priorityDays={instruction.priority_days} dueDate={instruction.due_date} />
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              instruction.status === 'em_execucao' ? 'bg-blue-900/40 text-blue-300 border border-blue-700/40' :
              instruction.status === 'concluida'   ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40' :
              instruction.status === 'validada'    ? 'bg-amber-900/40 text-amber-300 border border-amber-700/40' :
              instruction.status === 'rejeitada'   ? 'bg-red-900/40 text-red-300 border border-red-700/40' :
              'bg-stone-700 text-stone-400'
            }`}>
              {statusLabel}
            </span>
            {isPrazoPassado && <span className="text-xs text-red-400 font-semibold">⚠️ Atrasada</span>}
          </div>

          {instruction.text_content && (
            <p className="text-base text-stone-100 leading-relaxed">{instruction.text_content}</p>
          )}

          {audioSrc && (
            <div className="space-y-1">
              <p className="text-xs text-stone-400 uppercase tracking-wide">Orientação em áudio</p>
              <audio controls src={audioSrc} className="w-full" style={{ height: '48px' }} />
            </div>
          )}

          {instruction.prazo_conclusao && (
            <p className={`text-xs ${isPrazoPassado ? 'text-red-400 font-semibold' : 'text-orange-400'}`}>
              Prazo: {format(new Date(instruction.prazo_conclusao), "d MMM 'às' HH:mm", { locale: ptBR })}
            </p>
          )}

          {instruction.status === 'rejeitada' && instruction.motivo_rejeicao && (
            <p className="text-xs text-red-400">↩ Rejeitada: {instruction.motivo_rejeicao}</p>
          )}

          <p className="text-xs text-stone-500">
            De: {instruction.author_name} · {instruction.hive_local_id ? 'Esta caixa' : 'Todo o meliponário'}
          </p>
        </div>

        {/* Actions — only for active tasks */}
        {['pendente', 'em_execucao'].includes(instruction.status) && (
          <div className="px-4 pb-4 flex flex-col gap-2">
            {instruction.status === 'pendente' && (
              <button
                onClick={() => updateStatus.mutate({ localId: instruction.local_id, status: 'em_execucao' })}
                disabled={updateStatus.isPending}
                className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-600 active:bg-blue-800 disabled:opacity-50 text-white text-base font-semibold rounded-xl py-4 transition-colors"
              >
                ▶ Iniciar tarefa
              </button>
            )}
            <button
              onClick={() => setShowEvidence(true)}
              className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white text-base font-semibold rounded-xl py-4 transition-colors"
            >
              📎 Concluir com evidência
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export function HiveInstructions({ hiveLocalId, apiaryLocalId }: Props) {
  const { data: hiveInstructions = [] } = useInstructions({ hive_local_id: hiveLocalId, status: 'pendente' });
  const { data: hiveExec = [] }         = useInstructions({ hive_local_id: hiveLocalId, status: 'em_execucao' });
  const { data: apiaryInstructions = [] } = useInstructions({ apiary_local_id: apiaryLocalId, status: 'pendente' });
  const { data: apiaryExec = [] }         = useInstructions({ apiary_local_id: apiaryLocalId, status: 'em_execucao' });

  const apiaryLevel     = apiaryInstructions.filter((i) => !i.hive_local_id);
  const apiaryLevelExec = apiaryExec.filter((i) => !i.hive_local_id);

  const allActive = [
    ...hiveInstructions,
    ...hiveExec,
    ...apiaryLevel.filter((a) => !hiveInstructions.find((h) => h.local_id === a.local_id)),
    ...apiaryLevelExec.filter((a) => !hiveExec.find((h) => h.local_id === a.local_id)),
  ];

  if (allActive.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
        <h2 className="text-base font-bold text-amber-400">
          Tarefas ativas ({allActive.length})
        </h2>
      </div>

      {allActive.map((instruction) => (
        <InstructionItem key={instruction.local_id} instruction={instruction} />
      ))}
    </div>
  );
}
