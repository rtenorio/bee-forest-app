import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { useAuthStore } from '@/store/authStore';
import { useApiaries } from '@/hooks/useApiaries';
import { useHives } from '@/hooks/useHives';
import {
  useInstructions,
  useCreateInstruction,
  useUpdateInstructionStatus,
  useDeleteInstruction,
  useInstructionResponses,
  useCreateInstructionResponse,
  requestAudioUploadUrl,
  uploadAudioToR2,
} from '@/hooks/useInstructions';
import type { Instruction } from '@bee-forest/shared';
import { AudioRecorder } from './AudioRecorder';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Helpers ───────────────────────────────────────────────────────────────────

type PriorityOption = 'urgent' | '7' | '15' | 'custom';

function calcDueDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function PriorityBadge({ priorityDays }: { priorityDays: number | null | undefined }) {
  if (priorityDays === undefined) return null;
  if (priorityDays === null) {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-700/40">
        🔴 Urgente
      </span>
    );
  }
  if (priorityDays <= 7) {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-900/40 text-orange-400 border border-orange-700/40">
        🟠 {priorityDays}d
      </span>
    );
  }
  if (priorityDays <= 15) {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-700/40">
        🟡 {priorityDays}d
      </span>
    );
  }
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400 border border-blue-700/40">
      🔵 {priorityDays}d
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
      status === 'done'
        ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/40'
        : 'bg-amber-900/40 text-amber-400 border border-amber-700/40'
    }`}>
      {status === 'done' ? 'Concluída' : 'Pendente'}
    </span>
  );
}

// ── Signed audio player (for use inside .map()) ───────────────────────────────

function ResponseAudio({ audioKey, audioUrl }: { audioKey: string | null; audioUrl: string | null }) {
  const { url: signedSrc } = useSignedUrl(audioKey);
  const src = signedSrc ?? audioUrl;
  if (!src) return null;
  return <audio controls src={src} className="w-full h-8 mt-1" />;
}

// ── Instruction Card ──────────────────────────────────────────────────────────

function InstructionCard({
  instruction,
  onMarkDone,
  onDelete,
  isTratador,
  isAuthor,
}: {
  instruction: Instruction;
  onMarkDone: () => void;
  onDelete: () => void;
  isTratador: boolean;
  isAuthor: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { data: responses } = useInstructionResponses(open ? instruction.local_id : '');
  const createResponse = useCreateInstructionResponse(instruction.local_id);
  const [replyText, setReplyText] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const { url: instructionAudioSrc } = useSignedUrl(instruction.audio_key);
  const audioSrc = instructionAudioSrc ?? instruction.audio_url;

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() && !audioBlob) return;
    setUploading(true);
    try {
      let audioKey: string | null = null;
      if (audioBlob) {
        const { uploadUrl, key } = await requestAudioUploadUrl(
          `response-${Date.now()}.webm`,
          'audio/webm'
        );
        await uploadAudioToR2(uploadUrl, audioBlob);
        audioKey = key;
      }
      await createResponse.mutateAsync({
        local_id: uuidv4(),
        text_content: replyText.trim() || null,
        audio_key: audioKey,
      });
      setReplyText('');
      setAudioBlob(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-stone-800/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <StatusBadge status={instruction.status} />
              <PriorityBadge priorityDays={instruction.priority_days} />
              <span className="text-xs text-stone-500">
                {instruction.hive_local_id ? 'Por caixa' : 'Por meliponário'}
              </span>
              {instruction.response_count > 0 && (
                <span className="text-xs text-stone-500">
                  {instruction.response_count} resposta{instruction.response_count > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {instruction.text_content && (
              <p className="text-sm text-stone-200 line-clamp-2">{instruction.text_content}</p>
            )}
            {(instruction.audio_key || instruction.audio_url) && !instruction.text_content && (
              <p className="text-sm text-amber-400 italic">Orientação em áudio</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-xs text-stone-500">
              {format(new Date(instruction.created_at), "d MMM, HH:mm", { locale: ptBR })}
            </span>
            {instruction.due_date && (
              <span className="text-xs text-orange-400">
                Prazo: {format(new Date(instruction.due_date + 'T12:00:00'), "d MMM", { locale: ptBR })}
              </span>
            )}
            <span className="text-xs text-stone-600">{instruction.author_name}</span>
          </div>
        </div>
      </div>

      {open && (
        <div className="border-t border-stone-800 p-4 space-y-4">
          {/* Conteúdo completo */}
          {instruction.text_content && (
            <p className="text-sm text-stone-200">{instruction.text_content}</p>
          )}
          {audioSrc && (
            <div>
              <p className="text-xs text-stone-500 mb-1">Orientação em áudio:</p>
              <audio controls src={audioSrc} className="w-full h-10" />
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 flex-wrap">
            {instruction.status === 'pending' && (isTratador || isAuthor) && (
              <button
                onClick={onMarkDone}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs rounded-lg transition-colors"
              >
                ✓ Marcar como concluída
              </button>
            )}
            {isAuthor && (
              <button
                onClick={onDelete}
                className="px-3 py-1.5 bg-red-900/40 hover:bg-red-800/60 text-red-400 text-xs rounded-lg border border-red-700/40 transition-colors"
              >
                Excluir
              </button>
            )}
          </div>

          {/* Respostas */}
          {responses && responses.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Respostas</p>
              {responses.map((r) => (
                <div key={r.local_id} className="bg-stone-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-amber-400">{r.tratador_name}</span>
                    <span className="text-xs text-stone-500">
                      {format(new Date(r.created_at), "d MMM, HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {r.text_content && <p className="text-sm text-stone-200">{r.text_content}</p>}
                  <ResponseAudio audioKey={r.audio_key} audioUrl={r.audio_url} />
                </div>
              ))}
            </div>
          )}

          {/* Formulário de resposta — apenas tratador e se pendente */}
          {isTratador && instruction.status === 'pending' && (
            <form onSubmit={handleReply} className="space-y-2 border-t border-stone-800 pt-3">
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Responder</p>
              <textarea
                rows={2}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Digite sua resposta..."
                className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none"
              />
              <AudioRecorder
                recorded={audioBlob}
                onRecorded={setAudioBlob}
                onClear={() => setAudioBlob(null)}
              />
              <button
                type="submit"
                disabled={uploading || (!replyText.trim() && !audioBlob)}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors"
              >
                {uploading ? 'Enviando...' : 'Enviar resposta'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ── Create Form ───────────────────────────────────────────────────────────────

function CreateInstructionForm({ onClose }: { onClose: () => void }) {
  const { data: apiaries } = useApiaries();
  const [selectedApiary, setSelectedApiary] = useState('');
  const [selectedHive, setSelectedHive] = useState('');
  const [textContent, setTextContent] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [priority, setPriority] = useState<PriorityOption>('urgent');
  const [customDays, setCustomDays] = useState('');
  const { data: hives } = useHives(selectedApiary || undefined);
  const createInstruction = useCreateInstruction();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedApiary) return;
    if (!textContent.trim() && !audioBlob) return;
    setUploading(true);
    setUploadError(null);
    try {
      let audioKey: string | null = null;
      if (audioBlob) {
        const { uploadUrl, key } = await requestAudioUploadUrl(
          `instruction-${Date.now()}.webm`,
          'audio/webm'
        );
        await uploadAudioToR2(uploadUrl, audioBlob);
        audioKey = key;
      }
      let priority_days: number | null = null;
      let due_date: string | null = null;
      if (priority === '7') { priority_days = 7; due_date = calcDueDate(7); }
      else if (priority === '15') { priority_days = 15; due_date = calcDueDate(15); }
      else if (priority === 'custom') {
        const d = parseInt(customDays, 10);
        if (d > 0) { priority_days = d; due_date = calcDueDate(d); }
      }

      await createInstruction.mutateAsync({
        local_id: uuidv4(),
        apiary_local_id: selectedApiary,
        hive_local_id: selectedHive || null,
        text_content: textContent.trim() || null,
        audio_key: audioKey,
        priority_days,
        due_date,
      });
      onClose();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Erro ao enviar instrução');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-stone-200">Nova orientação</h3>

      <div>
        <label className="text-xs text-stone-400 block mb-1">Meliponário *</label>
        <select
          required
          value={selectedApiary}
          onChange={(e) => { setSelectedApiary(e.target.value); setSelectedHive(''); }}
          className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
        >
          <option value="">Selecione...</option>
          {apiaries?.map((a) => (
            <option key={a.local_id} value={a.local_id}>{a.name}</option>
          ))}
        </select>
      </div>

      {selectedApiary && (
        <div>
          <label className="text-xs text-stone-400 block mb-1">Caixa (opcional — deixe vazio para todo o meliponário)</label>
          <select
            value={selectedHive}
            onChange={(e) => setSelectedHive(e.target.value)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">Todo o meliponário</option>
            {[...(hives ?? [])].sort((a, b) => {
              const numA = parseInt(a.code.split('-')[1] ?? '0', 10);
              const numB = parseInt(b.code.split('-')[1] ?? '0', 10);
              return numA - numB;
            }).map((h) => (
              <option key={h.local_id} value={h.local_id}>{h.code}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="text-xs text-stone-400 block mb-2">Prioridade</label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'urgent', label: '🔴 Urgente' },
            { value: '7',      label: '🟠 7 dias' },
            { value: '15',     label: '🟡 15 dias' },
            { value: 'custom', label: '🔵 Personalizado' },
          ] as { value: PriorityOption; label: string }[]).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPriority(opt.value)}
              className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                priority === opt.value
                  ? 'bg-amber-600 border-amber-500 text-white font-medium'
                  : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {priority === 'custom' && (
          <input
            type="number"
            min="1"
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value)}
            placeholder="Número de dias"
            className="mt-2 w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
        )}
      </div>

      <div>
        <label className="text-xs text-stone-400 block mb-1">Texto (opcional se houver áudio)</label>
        <textarea
          rows={3}
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          placeholder="Descreva a instrução..."
          className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none"
        />
      </div>

      <div>
        <label className="text-xs text-stone-400 block mb-1">Áudio (opcional)</label>
        <AudioRecorder
          recorded={audioBlob}
          onRecorded={setAudioBlob}
          onClear={() => setAudioBlob(null)}
        />
      </div>

      {(uploadError || createInstruction.error) && (
        <p className="text-xs text-red-400">
          {uploadError ?? createInstruction.error?.message}
        </p>
      )}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={uploading || (!textContent.trim() && !audioBlob) || !selectedApiary}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {uploading ? 'Enviando...' : 'Criar instrução'}
        </button>
      </div>
    </form>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function InstructionsPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? 'tratador';
  const isTratador = role === 'tratador';
  const canCreate = ['master_admin', 'socio', 'orientador', 'responsavel'].includes(role);

  const [filterApiary, setFilterApiary] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data: apiaries } = useApiaries();
  const { data: instructions, isLoading } = useInstructions({
    apiary_local_id: filterApiary || undefined,
    status: filterStatus || undefined,
  });

  const markDone = useUpdateInstructionStatus();
  const deleteInstruction = useDeleteInstruction();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-100">Orientações</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            {isTratador ? 'Orientações recebidas' : 'Orientações enviadas aos tratadores'}
          </p>
        </div>
        {canCreate && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Nova orientação
          </button>
        )}
      </div>

      {showCreate && (
        <CreateInstructionForm onClose={() => setShowCreate(false)} />
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {!isTratador && (
          <select
            value={filterApiary}
            onChange={(e) => setFilterApiary(e.target.value)}
            className="bg-stone-800 border border-stone-700 text-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">Todos os meliponários</option>
            {apiaries?.map((a) => (
              <option key={a.local_id} value={a.local_id}>{a.name}</option>
            ))}
          </select>
        )}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-stone-800 border border-stone-700 text-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500"
        >
          <option value="">Todos os status</option>
          <option value="pending">Pendentes</option>
          <option value="done">Concluídas</option>
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-10 text-stone-500 text-sm">Carregando...</div>
      ) : !instructions?.length ? (
        <div className="text-center py-10 text-stone-600 text-sm">
          {filterStatus === 'pending' ? 'Nenhuma instrução pendente' : 'Nenhuma instrução encontrada'}
        </div>
      ) : (
        <div className="space-y-3">
          {instructions.map((instruction) => (
            <InstructionCard
              key={instruction.local_id}
              instruction={instruction}
              isTratador={isTratador}
              isAuthor={instruction.author_id === user?.id}
              onMarkDone={() => markDone.mutate({ localId: instruction.local_id, status: 'done' })}
              onDelete={() => {
                if (confirm('Excluir esta orientação?')) deleteInstruction.mutate(instruction.local_id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
