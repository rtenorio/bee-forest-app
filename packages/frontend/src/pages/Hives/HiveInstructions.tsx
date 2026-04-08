import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useInstructions,
  useUpdateInstructionStatus,
  useCreateInstructionResponse,
  requestAudioUploadUrl,
  uploadAudioToR2,
} from '@/hooks/useInstructions';
import { AudioRecorder } from '@/pages/Instructions/AudioRecorder';
import type { Instruction } from '@bee-forest/shared';

function PriorityBadge({ priorityDays, dueDate }: { priorityDays: number | null | undefined; dueDate?: string | null }) {
  if (priorityDays === undefined) return null;
  if (priorityDays === null) {
    return (
      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-900/50 text-red-300 border border-red-700/50">
        🔴 Urgente
      </span>
    );
  }
  const dueDateLabel = dueDate
    ? ` · Prazo: ${format(new Date(dueDate + 'T12:00:00'), "d MMM", { locale: ptBR })}`
    : '';
  if (priorityDays <= 7) {
    return (
      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-900/50 text-orange-300 border border-orange-700/50">
        🟠 {priorityDays} dias{dueDateLabel}
      </span>
    );
  }
  if (priorityDays <= 15) {
    return (
      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-900/50 text-yellow-300 border border-yellow-700/50">
        🟡 {priorityDays} dias{dueDateLabel}
      </span>
    );
  }
  return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-900/50 text-blue-300 border border-blue-700/50">
      🔵 {priorityDays} dias{dueDateLabel}
    </span>
  );
}

interface Props {
  hiveLocalId: string;
  apiaryLocalId: string;
}

function InstructionItem({ instruction, hiveLocalId }: { instruction: Instruction; hiveLocalId: string }) {
  const [open, setOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);

  const markDone = useUpdateInstructionStatus();
  const createResponse = useCreateInstructionResponse(instruction.local_id);

  async function handleReply() {
    if (!replyText.trim() && !audioBlob) return;
    setUploading(true);
    try {
      let audioUrl: string | null = null;
      if (audioBlob) {
        const mimeType = audioBlob.type || 'audio/webm';
        const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        const { uploadUrl, publicUrl } = await requestAudioUploadUrl(
          `response-${Date.now()}.${ext}`,
          mimeType
        );
        await uploadAudioToR2(uploadUrl, audioBlob, mimeType);
        audioUrl = publicUrl;
      }
      await createResponse.mutateAsync({
        local_id: uuidv4(),
        text_content: replyText.trim() || null,
        audio_url: audioUrl,
      });
      setReplyText('');
      setAudioBlob(null);
      setOpen(false);
    } catch (err) {
      console.error('Erro no upload:', err);
      alert('Erro detalhado: ' + JSON.stringify(err, Object.getOwnPropertyNames(err)));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-stone-800 border border-amber-700/40 rounded-2xl overflow-hidden">
      {/* Conteúdo da instrução */}
      <div className="p-4 space-y-3">
        <PriorityBadge priorityDays={instruction.priority_days} dueDate={instruction.due_date} />
        {instruction.text_content && (
          <p className="text-base text-stone-100 leading-relaxed">{instruction.text_content}</p>
        )}

        {instruction.audio_url && (
          <div className="space-y-1">
            <p className="text-xs text-stone-400 uppercase tracking-wide">Orientação em áudio</p>
            <audio
              controls
              src={instruction.audio_url}
              className="w-full"
              style={{ height: '48px' }}
            />
          </div>
        )}

        <p className="text-xs text-stone-500">
          De: {instruction.author_name} •{' '}
          {instruction.hive_local_id ? 'Esta caixa' : 'Todo o meliponário'}
        </p>
      </div>

      {/* Ações */}
      {!open ? (
        <div className="px-4 pb-4 flex flex-col gap-2">
          <button
            onClick={() => setOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-base font-semibold rounded-xl py-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2z"/>
            </svg>
            Gravar resposta
          </button>
          <button
            onClick={() => markDone.mutate({ localId: instruction.local_id, status: 'done' })}
            disabled={markDone.isPending}
            className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 disabled:opacity-50 text-white text-base font-semibold rounded-xl py-4 transition-colors"
          >
            ✅ Marcar como concluído
          </button>
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-3 border-t border-stone-700 pt-3">
          <textarea
            rows={3}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Escreva uma resposta (opcional)..."
            className="w-full bg-stone-900 border border-stone-600 text-stone-100 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-amber-500 resize-none"
          />
          <AudioRecorder
            recorded={audioBlob}
            onRecorded={setAudioBlob}
            onClear={() => setAudioBlob(null)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setOpen(false); setReplyText(''); setAudioBlob(null); }}
              className="flex-1 py-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-300 text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleReply}
              disabled={uploading || (!replyText.trim() && !audioBlob)}
              className="flex-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {uploading ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function HiveInstructions({ hiveLocalId, apiaryLocalId }: Props) {
  // Busca instruções desta caixa + instruções do meliponário (sem hive_local_id específico)
  const { data: hiveInstructions = [] } = useInstructions({
    hive_local_id: hiveLocalId,
    status: 'pending',
  });
  const { data: apiaryInstructions = [] } = useInstructions({
    apiary_local_id: apiaryLocalId,
    status: 'pending',
  });

  // Instruções do meliponário que são para todo o apiário (sem caixa específica)
  const apiaryLevel = apiaryInstructions.filter((i) => !i.hive_local_id);

  const allPending = [
    ...hiveInstructions,
    ...apiaryLevel.filter((a) => !hiveInstructions.find((h) => h.local_id === a.local_id)),
  ];

  if (allPending.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
        <h2 className="text-base font-bold text-amber-400">
          Instruções pendentes ({allPending.length})
        </h2>
      </div>

      {allPending.map((instruction) => (
        <InstructionItem
          key={instruction.local_id}
          instruction={instruction}
          hiveLocalId={hiveLocalId}
        />
      ))}
    </div>
  );
}
