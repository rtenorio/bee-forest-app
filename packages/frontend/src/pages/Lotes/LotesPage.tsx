import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLotes, useCreateLote, type LoteStatus } from '@/hooks/useLotes';
import { useApiaries } from '@/hooks/useApiaries';
import { useProducao } from '@/hooks/useFinanceiro';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<LoteStatus, { label: string; cls: string }> = {
  coletado:       { label: 'Coletado',       cls: 'bg-stone-700/60 text-stone-300 border-stone-600/40' },
  desumidificando:{ label: 'Desumidificando', cls: 'bg-blue-900/40 text-blue-300 border-blue-700/40' },
  maturando:      { label: 'Maturando',      cls: 'bg-amber-900/40 text-amber-300 border-amber-700/40' },
  envasado:       { label: 'Envasado',       cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40' },
  vendido:        { label: 'Vendido',        cls: 'bg-purple-900/40 text-purple-300 border-purple-700/40' },
};

const STATUS_OPTIONS: LoteStatus[] = ['coletado','desumidificando','maturando','envasado','vendido'];

// ── Create form ───────────────────────────────────────────────────────────────

function CreateLoteForm({ onClose }: { onClose: () => void }) {
  const { data: apiaries = [] } = useApiaries();
  const [apiaryId, setApiaryId] = useState(apiaries[0]?.local_id ?? '');
  const { data: colheitas = [] } = useProducao({ apiary_local_id: apiaryId || undefined });

  const [form, setForm] = useState({
    data_colheita:   new Date().toISOString().slice(0, 10),
    volume_total_ml: '',
    umidade:         '',
    brix:            '',
    observacao:      '',
  });
  const [selectedColheitas, setSelectedColheitas] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateLote();

  function toggleColheita(id: number) {
    setSelectedColheitas((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const vol = parseInt(form.volume_total_ml, 10);
    if (!apiaryId)    { setError('Selecione o meliponário'); return; }
    if (!vol || vol <= 0) { setError('Volume deve ser positivo'); return; }
    try {
      await create.mutateAsync({
        apiary_local_id: apiaryId,
        colheitas_ids:   selectedColheitas,
        data_colheita:   form.data_colheita,
        volume_total_ml: vol,
        umidade:  form.umidade  ? parseFloat(form.umidade)  : undefined,
        brix:     form.brix     ? parseFloat(form.brix)     : undefined,
        observacao: form.observacao || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar lote');
    }
  }

  const inputCls = 'w-full bg-stone-700 border border-stone-600 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500';

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-sm font-semibold text-stone-200">Novo lote de mel</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-stone-400 mb-1 block">Meliponário</label>
            <select value={apiaryId} onChange={(e) => { setApiaryId(e.target.value); setSelectedColheitas([]); }} className={inputCls}>
              <option value="">Selecione…</option>
              {apiaries.map((a) => <option key={a.local_id} value={a.local_id}>{a.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-stone-400 mb-1 block">Data da colheita</label>
            <input type="date" value={form.data_colheita}
              onChange={(e) => setForm((f) => ({ ...f, data_colheita: e.target.value }))}
              className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-stone-400 mb-1 block">Volume total (ml)</label>
            <input type="number" min="1" placeholder="Ex: 2000"
              value={form.volume_total_ml}
              onChange={(e) => setForm((f) => ({ ...f, volume_total_ml: e.target.value }))}
              className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-stone-400 mb-1 block">Umidade % (opcional)</label>
            <input type="number" min="0" max="100" step="0.1" placeholder="Ex: 18.5"
              value={form.umidade}
              onChange={(e) => setForm((f) => ({ ...f, umidade: e.target.value }))}
              className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-stone-400 mb-1 block">Brix % (opcional)</label>
            <input type="number" min="0" max="100" step="0.1" placeholder="Ex: 78.0"
              value={form.brix}
              onChange={(e) => setForm((f) => ({ ...f, brix: e.target.value }))}
              className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-stone-400 mb-1 block">Observação (opcional)</label>
            <input type="text" placeholder="Ex: Mel de jataí, safra de verão"
              value={form.observacao}
              onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              className={inputCls} />
          </div>
        </div>

        {/* Colheitas de origem */}
        {colheitas.length > 0 && (
          <div>
            <label className="text-xs text-stone-400 mb-2 block">
              Colheitas de origem ({selectedColheitas.length} selecionadas)
            </label>
            <div className="max-h-40 overflow-y-auto space-y-1 border border-stone-700 rounded-lg p-2 bg-stone-900/50">
              {colheitas.map((c) => (
                <label key={c.local_id} className="flex items-center gap-2 cursor-pointer hover:bg-stone-800/60 px-2 py-1 rounded">
                  <input
                    type="checkbox"
                    checked={selectedColheitas.includes(c.local_id as unknown as number)}
                    onChange={() => toggleColheita(c.local_id as unknown as number)}
                    className="accent-amber-500"
                  />
                  <span className="text-sm text-stone-300">
                    {c.hive_code} — {format(new Date(c.data_colheita + 'T12:00:00'), "d MMM yyyy", { locale: ptBR })} — {c.volume_ml} ml
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-stone-400 hover:text-stone-200">Cancelar</button>
          <button type="submit" disabled={create.isPending}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
            {create.isPending ? 'Criando…' : 'Criar lote'}
          </button>
        </div>
      </form>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function LotesPage() {
  const navigate    = useNavigate();
  const { data: apiaries } = useApiaries();
  const [apiaryId, setApiaryId]   = useState('');
  const [statusF, setStatusF]     = useState('');
  const [showForm, setShowForm]   = useState(false);
  const { data = [], isLoading }  = useLotes({ apiary_local_id: apiaryId || undefined, status: statusF || undefined });

  const selectCls = 'bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500';

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Lotes de Mel</h1>
          <p className="text-stone-500 text-sm">Rastreabilidade da produção</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors">
            + Novo lote
          </button>
        )}
      </div>

      {showForm && <CreateLoteForm onClose={() => setShowForm(false)} />}

      <div className="flex flex-wrap gap-2">
        <select value={apiaryId} onChange={(e) => setApiaryId(e.target.value)} className={selectCls}>
          <option value="">Todos os meliponários</option>
          {apiaries?.map((a) => <option key={a.local_id} value={a.local_id}>{a.name}</option>)}
        </select>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className={selectCls}>
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <Card>
          <div className="overflow-x-auto -mx-4 -my-4 sm:-mx-6 sm:-my-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-700 text-left">
                  <th className="px-4 py-3 text-stone-400 font-medium">Código</th>
                  <th className="px-4 py-3 text-stone-400 font-medium hidden sm:table-cell">Meliponário</th>
                  <th className="px-4 py-3 text-stone-400 font-medium hidden sm:table-cell">Data</th>
                  <th className="px-4 py-3 text-stone-400 font-medium text-right">Volume</th>
                  <th className="px-4 py-3 text-stone-400 font-medium hidden md:table-cell text-right">Umidade</th>
                  <th className="px-4 py-3 text-stone-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-500">Nenhum lote registrado.</td></tr>
                ) : data.map((l) => {
                  const cfg = STATUS_CFG[l.status] ?? STATUS_CFG.coletado;
                  return (
                    <tr
                      key={l.local_id}
                      className="border-b border-stone-800 hover:bg-stone-800/40 cursor-pointer"
                      onClick={() => navigate(`/lotes/${l.local_id}`)}
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-amber-400">{l.codigo}</td>
                      <td className="px-4 py-3 text-stone-300 hidden sm:table-cell">{l.apiary_nome}</td>
                      <td className="px-4 py-3 text-stone-400 hidden sm:table-cell">
                        {format(new Date(l.data_colheita + 'T12:00:00'), "d MMM yyyy", { locale: ptBR })}
                      </td>
                      <td className="px-4 py-3 text-amber-400 text-right font-medium">{l.volume_total_ml} ml</td>
                      <td className="px-4 py-3 text-stone-400 text-right hidden md:table-cell">
                        {l.umidade != null ? `${l.umidade}%` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
