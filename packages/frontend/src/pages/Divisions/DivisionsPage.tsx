import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDivisions } from '@/hooks/useDivisions';
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

// ── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'pendente' | 'realizada' | '';

export function DivisionsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('pendente');
  const { data: divisions = [], isLoading } = useDivisions({ status: tab || undefined });

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: 'pendente', label: 'Pendentes' },
    { value: 'realizada', label: 'Realizadas' },
    { value: '', label: 'Todas' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-stone-100">Divisões</h1>
        <p className="text-sm text-stone-400 mt-0.5">Gestão de divisão de caixas de abelha</p>
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
        <div className="text-center py-12 text-stone-500 text-sm">Carregando...</div>
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
    </div>
  );
}
