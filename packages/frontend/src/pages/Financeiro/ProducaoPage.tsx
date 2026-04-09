import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useProducao, useCreateProducao, useDeleteProducao } from '@/hooks/useFinanceiro';
import { useApiaries } from '@/hooks/useApiaries';
import { useHives } from '@/hooks/useHives';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/store/authStore';

const TIPO_LABELS: Record<string, string> = {
  alimentacao: 'Alimentação',
  medicamento: 'Medicamento',
  mao_de_obra: 'Mão de obra',
  equipamento: 'Equipamento',
  outro:       'Outro',
};

// ── Inline form ───────────────────────────────────────────────────────────────

function AddProducaoForm({ onClose, apiaryFilter }: { onClose: () => void; apiaryFilter: string }) {
  const { data: apiaries } = useApiaries();
  const [apiaryId, setApiaryId] = useState(apiaryFilter || apiaries?.[0]?.local_id || '');
  const { data: hives = [] } = useHives(apiaryId || undefined);

  const [form, setForm] = useState({
    hive_local_id: '',
    data_colheita: new Date().toISOString().slice(0, 10),
    volume_ml: '',
    observacao: '',
  });
  const [error, setError] = useState<string | null>(null);
  const create = useCreateProducao();

  // Sync default hive when apiary changes
  const hiveId = form.hive_local_id || hives[0]?.local_id || '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const vol = parseInt(form.volume_ml, 10);
    if (!apiaryId) { setError('Selecione o meliponário'); return; }
    if (!hiveId)   { setError('Selecione a caixa'); return; }
    if (!vol || vol <= 0) { setError('Volume deve ser positivo'); return; }
    try {
      await create.mutateAsync({
        hive_local_id:   hiveId,
        apiary_local_id: apiaryId,
        data_colheita:   form.data_colheita,
        volume_ml:       vol,
        observacao:      form.observacao || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar colheita');
    }
  }

  const inputCls = 'w-full bg-stone-700 border border-stone-600 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500';

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="text-sm font-semibold text-stone-200">Nova colheita</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-stone-400 mb-1 block">Meliponário</label>
            <select value={apiaryId} onChange={(e) => { setApiaryId(e.target.value); setForm((f) => ({ ...f, hive_local_id: '' })); }} className={inputCls}>
              <option value="">Selecione…</option>
              {apiaries?.map((a) => <option key={a.local_id} value={a.local_id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-400 mb-1 block">Caixa</label>
            <select
              value={hiveId}
              onChange={(e) => setForm((f) => ({ ...f, hive_local_id: e.target.value }))}
              className={inputCls}
            >
              <option value="">Selecione…</option>
              {hives.map((h) => <option key={h.local_id} value={h.local_id}>{h.code}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-400 mb-1 block">Data da colheita</label>
            <input type="date" value={form.data_colheita}
              onChange={(e) => setForm((f) => ({ ...f, data_colheita: e.target.value }))}
              className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-stone-400 mb-1 block">Volume (ml)</label>
            <input type="number" min="1" placeholder="Ex: 500"
              value={form.volume_ml}
              onChange={(e) => setForm((f) => ({ ...f, volume_ml: e.target.value }))}
              className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-stone-400 mb-1 block">Observação (opcional)</label>
            <input type="text" placeholder="Ex: Mel claro, boa consistência"
              value={form.observacao}
              onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              className={inputCls} />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 text-sm text-stone-400 hover:text-stone-200 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={create.isPending}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
            {create.isPending ? 'Salvando…' : 'Salvar colheita'}
          </button>
        </div>
      </form>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ProducaoPage() {
  const role = useAuthStore((s) => s.user?.role);
  const { data: apiaries } = useApiaries();
  const [apiaryId, setApiaryId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const { data = [], isLoading } = useProducao({ apiary_local_id: apiaryId || undefined });
  const deleteMut = useDeleteProducao();

  const canEdit  = role === 'master_admin' || role === 'socio' || role === 'responsavel';
  const canDelete = role === 'master_admin';
  const selectCls = 'bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500';

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Produções</h1>
          <p className="text-stone-500 text-sm">Registro de colheitas por colmeia</p>
        </div>
        {canEdit && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors"
          >
            + Registrar colheita
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && <AddProducaoForm onClose={() => setShowForm(false)} apiaryFilter={apiaryId} />}

      {/* Filtro */}
      <div className="flex gap-2">
        <select value={apiaryId} onChange={(e) => setApiaryId(e.target.value)} className={selectCls}>
          <option value="">Todos os meliponários</option>
          {apiaries?.map((a) => <option key={a.local_id} value={a.local_id}>{a.name}</option>)}
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <Card>
          <div className="overflow-x-auto -mx-4 -my-4 sm:-mx-6 sm:-my-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-700 text-left">
                  <th className="px-4 py-3 text-stone-400 font-medium">Caixa</th>
                  <th className="px-4 py-3 text-stone-400 font-medium hidden sm:table-cell">Data</th>
                  <th className="px-4 py-3 text-stone-400 font-medium text-right">Volume</th>
                  <th className="px-4 py-3 text-stone-400 font-medium hidden md:table-cell">Observação</th>
                  {canDelete && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-stone-500">
                      Nenhuma colheita registrada.
                    </td>
                  </tr>
                ) : data.map((r) => (
                  <tr key={r.local_id} className="border-b border-stone-800 hover:bg-stone-800/40">
                    <td className="px-4 py-3">
                      <span className="font-medium text-stone-200">{r.hive_code}</span>
                      <span className="block sm:hidden text-xs text-stone-500 mt-0.5">
                        {format(new Date(r.data_colheita + 'T12:00:00'), "d MMM yyyy", { locale: ptBR })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-400 hidden sm:table-cell">
                      {format(new Date(r.data_colheita + 'T12:00:00'), "d MMM yyyy", { locale: ptBR })}
                    </td>
                    <td className="px-4 py-3 text-amber-400 text-right font-medium">{r.volume_ml} ml</td>
                    <td className="px-4 py-3 text-stone-400 hidden md:table-cell">{r.observacao ?? '—'}</td>
                    {canDelete && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { if (confirm('Remover esta colheita?')) deleteMut.mutate(r.local_id); }}
                          disabled={deleteMut.isPending}
                          className="text-stone-500 hover:text-red-400 text-xs transition-colors"
                        >
                          Remover
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
