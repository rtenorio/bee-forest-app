import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
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

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() && !audioBlob) return;
    setUploading(true);
    try {
      let audioUrl: string | null = null;
      if (audioBlob) {
        const { uploadUrl, publicUrl } = await requestAudioUploadUrl(
          `response-${Date.now()}.webm`,
          'audio/webm'
        );
        await uploadAudioToR2(uploadUrl, audioBlob);
        audioUrl = publicUrl;
      }
      await createResponse.mutateAsync({
        local_id: uuidv4(),
        text_content: replyText.trim() || null,
        audio_url: audioUrl,
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
            {instruction.audio_url && !instruction.text_content && (
              <p className="text-sm text-amber-400 italic">Instrução em áudio</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-xs text-stone-500">
              {format(new Date(instruction.created_at), "d MMM, HH:mm", { locale: ptBR })}
            </span>
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
          {instruction.audio_url && (
            <div>
              <p className="text-xs text-stone-500 mb-1">Orientação em áudio:</p>
              <audio controls src={instruction.audio_url} className="w-full h-10" />
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
                  {r.audio_url && <audio controls src={r.audio_url} className="w-full h-8 mt-1" />}
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
  const { data: hives } = useHives(selectedApiary || undefined);
  const createInstruction = useCreateInstruction();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedApiary) return;
    if (!textContent.trim() && !audioBlob) return;
    setUploading(true);
    try {
      let audioUrl: string | null = null;
      if (audioBlob) {
        const { uploadUrl, publicUrl } = await requestAudioUploadUrl(
          `instruction-${Date.now()}.webm`,
          'audio/webm'
        );
        await uploadAudioToR2(uploadUrl, audioBlob);
        audioUrl = publicUrl;
      }
      await createInstruction.mutateAsync({
        local_id: uuidv4(),
        apiary_local_id: selectedApiary,
        hive_local_id: selectedHive || null,
        text_content: textContent.trim() || null,
        audio_url: audioUrl,
      });
      onClose();
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-stone-200">Nova instrução</h3>

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

      {createInstruction.error && (
        <p className="text-xs text-red-400">{createInstruction.error.message}</p>
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
          <h1 className="text-xl font-bold text-stone-100">Instruções</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            {isTratador ? 'Orientações recebidas' : 'Orientações enviadas aos tratadores'}
          </p>
        </div>
        {canCreate && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Nova instrução
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
                if (confirm('Excluir esta instrução?')) deleteInstruction.mutate(instruction.local_id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
