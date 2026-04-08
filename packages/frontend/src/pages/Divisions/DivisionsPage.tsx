import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { useDivisions, useCreateDivision } from '@/hooks/useDivisions';
import { useHives } from '@/hooks/useHives';
import { useApiaries } from '@/hooks/useApiaries';
import { useAuthStore } from '@/store/authStore';
import type { Division, DivisionStatus } from '@bee-forest/shared';

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DivisionStatus }) {
  const cls =
    status === 'realizada'
      ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/40'
      : status === 'cancelada'
      ? 'bg-stone-800 text-stone-500 border border-stone-700'
      : 'bg-amber-900/40 text-amber-400 border border-amber-700/40 animate-pulse';
  const label =
    status === 'realizada' ? '✅ Realizada' : status === 'cancelada' ? 'Cancelada' : '⏳ Pendente';
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

// ── Card ──────────────────────────────────────────────────────────────────────

function DivisionCard({ division, onClick }: { division: Division; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-stone-900 border border-stone-800 rounded-xl p-4 hover:bg-stone-800/60 transition-colors space-y-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="font-semibold text-stone-100 text-sm">
            {division.hive_origin_code ?? division.hive_origin_local_id}
          </p>
          <p className="text-xs text-stone-500">
            {division.apiary_origin_name ?? '—'}
          </p>
        </div>
        <StatusBadge status={division.status} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
        <span>Identificado em: {format(new Date(division.identified_at), 'd MMM yyyy', { locale: ptBR })}</span>
        <span>Por: {division.identified_by}</span>
        {division.status === 'realizada' && division.divided_at && (
          <span>Realizada em: {format(new Date(division.divided_at), 'd MMM yyyy', { locale: ptBR })}</span>
        )}
      </div>
      {division.hive_new_code && (
        <p className="text-xs text-emerald-400">
          Nova caixa: {division.hive_new_code}
          {division.apiary_destination_name ? ` → ${division.apiary_destination_name}` : ''}
        </p>
      )}
      {division.notes && (
        <p className="text-xs text-stone-500 italic line-clamp-1">{division.notes}</p>
      )}
    </button>
  );
}

// ── Nova Divisão modal ────────────────────────────────────────────────────────

function NovaDivisaoModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const { data: hives = [] } = useHives();
  const { data: apiaries = [] } = useApiaries();
  const createDivision = useCreateDivision();

  const activeHives = hives.filter((h) => h.status === 'active');

  const today = new Date().toISOString().slice(0, 10);
  const [hiveId, setHiveId] = useState('');
  const [identifiedAt, setIdentifiedAt] = useState(today);
  const [identifiedBy, setIdentifiedBy] = useState(user?.name ?? '');
  const [notes, setNotes] = useState('');

  const selectedHive = activeHives.find((h) => h.local_id === hiveId);
  const apiary = selectedHive
    ? apiaries.find((a) => a.local_id === selectedHive.apiary_local_id)
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedHive) return;
    await createDivision.mutateAsync({
      local_id: uuidv4(),
      hive_origin_local_id: selectedHive.local_id,
      apiary_origin_local_id: selectedHive.apiary_local_id,
      identified_at: identifiedAt,
      identified_by: identifiedBy,
      notes: notes || null,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-stone-100">Nova Divisão</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Hive selector */}
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Caixa de origem *</label>
            <select
              required
              value={hiveId}
              onChange={(e) => setHiveId(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Selecionar caixa…</option>
              {activeHives.map((h) => {
                const ap = apiaries.find((a) => a.local_id === h.apiary_local_id);
                return (
                  <option key={h.local_id} value={h.local_id}>
                    {h.code}{ap ? ` — ${ap.name}` : ''}
                  </option>
                );
              })}
            </select>
            {apiary && (
              <p className="text-xs text-stone-500 mt-1">Meliponário: {apiary.name}</p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Data de identificação *</label>
            <input
              type="date"
              required
              value={identifiedAt}
              onChange={(e) => setIdentifiedAt(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Identified by */}
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Identificado por *</label>
            <input
              type="text"
              required
              value={identifiedBy}
              onChange={(e) => setIdentifiedBy(e.target.value)}
              placeholder="Nome do responsável"
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Opcional…"
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-stone-700 text-stone-400 text-sm font-medium hover:text-stone-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!hiveId || createDivision.isPending}
              className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {createDivision.isPending ? 'Salvando…' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'pendente' | 'realizada' | '';

export function DivisionsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('pendente');
  const [showModal, setShowModal] = useState(false);
  const { data: divisions = [], isLoading } = useDivisions({ status: tab || undefined });

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: 'pendente', label: 'Pendentes' },
    { value: 'realizada', label: 'Realizadas' },
    { value: '', label: 'Todas' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-100">Divisões</h1>
          <p className="text-sm text-stone-400 mt-0.5">Gestão de divisão de caixas de abelha</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="shrink-0 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors"
        >
          + Nova Divisão
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-900 border border-stone-800 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.value
                ? 'bg-amber-600 text-white'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-stone-500 text-sm">Carregando…</div>
      ) : divisions.length === 0 ? (
        <div className="text-center py-12 text-stone-600 text-sm">
          {tab === 'pendente' ? 'Nenhuma divisão pendente 🎉' : 'Nenhuma divisão encontrada'}
        </div>
      ) : (
        <div className="space-y-2">
          {divisions.map((d) => (
            <DivisionCard
              key={d.local_id}
              division={d}
              onClick={() => navigate(`/divisions/${d.local_id}`)}
            />
          ))}
        </div>
      )}

      {showModal && <NovaDivisaoModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
