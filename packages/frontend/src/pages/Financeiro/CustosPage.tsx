import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCustos, useCreateCusto, useDeleteCusto } from '@/hooks/useFinanceiro';
import { useApiaries } from '@/hooks/useApiaries';
import { useHives } from '@/hooks/useHives';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/store/authStore';

const TIPO_OPTIONS = [
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'medicamento', label: 'Medicamento' },
  { value: 'mao_de_obra', label: 'Mão de obra' },
  { value: 'equipamento', label: 'Equipamento' },
  { value: 'outro',       label: 'Outro' },
];

const TIPO_COLORS: Record<string, string> = {
  alimentacao: 'bg-green-900/40 text-green-300 border-green-700/40',
  medicamento: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
  mao_de_obra: 'bg-purple-900/40 text-purple-300 border-purple-700/40',
  equipamento: 'bg-amber-900/40 text-amber-300 border-amber-700/40',
  outro:       'bg-stone-700/60 text-stone-300 border-stone-600/40',
};

// ── Inline form ───────────────────────────────────────────────────────────────

function AddCustoForm({ onClose, apiaryFilter }: { onClose: () => void; apiaryFilter: string }) {
  const { data: apiaries } = useApiaries();
  const [apiaryId, setApiaryId] = useState(apiaryFilter || apiaries?.[0]?.local_id || '');
  const { data: hives = [] } = useHives(apiaryId || undefined);

  const [form, setForm] = useState({
    hive_local_id: '',
    data:          new Date().toISOString().slice(0, 10),
    tipo:          'alimentacao',
    valor_reais:   '',
    descricao:     '',
  });
  const [error, setError] = useState<string | null>(null);
  const create = useCreateCusto();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const valor = parseFloat(form.valor_reais);
    if (!apiaryId)          { setError('Selecione o meliponário'); return; }
    if (!valor || valor <= 0) { setError('Valor deve ser positivo'); return; }
    try {
      await create.mutateAsync({
        apiary_local_id: apiaryId,
        hive_local_id:   form.hive_local_id || undefined,
        data:            form.data,
        tipo:            form.tipo,
        valor_reais:     valor,
        descricao:       form.descricao || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar custo');
    }
  }

  const inputCls = 'w-full bg-stone-700 border border-stone-600 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500';

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="text-sm font-semibold text-stone-200">Novo custo</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-stone-400 mb-1 block">Meliponário</label>
            <select value={apiaryId} onChange={(e) => { setApiaryId(e.target.value); setForm((f) => ({ ...f, hive_local_id: '' })); }} className={inputCls}>
              <option value="">Selecione…</option>
              {apiaries?.map((a) => <option key={a.local_id} value={a.local_id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-400 mb-1 block">Caixa (opcional)</label>
            <select value={form.hive_local_id} onChange={(e) => setForm((f) => ({ ...f, hive_local_id: e.target.value }))} className={inputCls}>
              <option value="">Todo o meliponário</option>
              {hives.map((h) => <option key={h.local_id} value={h.local_id}>{h.code}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-400 mb-1 block">Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} className={inputCls}>
              {TIPO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-400 mb-1 block">Data</label>
            <input type="date" value={form.data}
              onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
              className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-stone-400 mb-1 block">Valor (R$)</label>
            <input type="number" min="0.01" step="0.01" placeholder="Ex: 125.00"
              value={form.valor_reais}
              onChange={(e) => setForm((f) => ({ ...f, valor_reais: e.target.value }))}
              className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-stone-400 mb-1 block">Descrição (opcional)</label>
            <input type="text" placeholder="Ex: Xarope de cana, 2L"
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
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
            {create.isPending ? 'Salvando…' : 'Salvar custo'}
          </button>
        </div>
      </form>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function CustosPage() {
  const role = useAuthStore((s) => s.user?.role);
  const { data: apiaries } = useApiaries();
  const [apiaryId, setApiaryId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const { data = [], isLoading } = useCustos({ apiary_local_id: apiaryId || undefined });
  const deleteMut = useDeleteCusto();

  const canEdit   = role === 'master_admin' || role === 'socio' || role === 'responsavel';
  const canDelete = role === 'master_admin';
  const selectCls = 'bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500';

  const totalReais = data.reduce((s, r) => s + Number(r.valor_reais), 0);

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Custos de Intervenção</h1>
          <p className="text-stone-500 text-sm">Alimentação, medicamentos, mão de obra e equipamentos</p>
        </div>
        {canEdit && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors"
          >
            + Registrar custo
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && <AddCustoForm onClose={() => setShowForm(false)} apiaryFilter={apiaryId} />}

      {/* Filtro */}
      <div className="flex gap-2">
        <select value={apiaryId} onChange={(e) => setApiaryId(e.target.value)} className={selectCls}>
          <option value="">Todos os meliponários</option>
          {apiaries?.map((a) => <option key={a.local_id} value={a.local_id}>{a.name}</option>)}
        </select>
      </div>

      {/* Totalizador */}
      {data.length > 0 && (
        <div className="bg-stone-800/60 border border-red-700/30 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-stone-400 text-sm">{data.length} registro{data.length !== 1 ? 's' : ''}</span>
          <span className="text-red-400 font-bold">Total: R$ {totalReais.toFixed(2)}</span>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <Card>
          <div className="overflow-x-auto -mx-4 -my-4 sm:-mx-6 sm:-my-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-700 text-left">
                  <th className="px-4 py-3 text-stone-400 font-medium">Tipo</th>
                  <th className="px-4 py-3 text-stone-400 font-medium hidden sm:table-cell">Data</th>
                  <th className="px-4 py-3 text-stone-400 font-medium hidden md:table-cell">Caixa</th>
                  <th className="px-4 py-3 text-stone-400 font-medium hidden md:table-cell">Descrição</th>
                  <th className="px-4 py-3 text-stone-400 font-medium text-right">Valor</th>
                  {canDelete && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-stone-500">
                      Nenhum custo registrado.
                    </td>
                  </tr>
                ) : data.map((r) => (
                  <tr key={r.local_id} className="border-b border-stone-800 hover:bg-stone-800/40">
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${TIPO_COLORS[r.tipo] ?? TIPO_COLORS.outro}`}>
                        {TIPO_OPTIONS.find((o) => o.value === r.tipo)?.label ?? r.tipo}
                      </span>
                      <span className="block sm:hidden text-xs text-stone-500 mt-0.5">
                        {format(new Date(r.data + 'T12:00:00'), "d MMM yyyy", { locale: ptBR })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-400 hidden sm:table-cell">
                      {format(new Date(r.data + 'T12:00:00'), "d MMM yyyy", { locale: ptBR })}
                    </td>
                    <td className="px-4 py-3 text-stone-400 hidden md:table-cell">{r.hive_code ?? '—'}</td>
                    <td className="px-4 py-3 text-stone-400 hidden md:table-cell">{r.descricao ?? '—'}</td>
                    <td className="px-4 py-3 text-red-400 text-right font-medium">R$ {Number(r.valor_reais).toFixed(2)}</td>
                    {canDelete && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { if (confirm('Remover este custo?')) deleteMut.mutate(r.local_id); }}
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
