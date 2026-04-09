import { useState } from 'react';
import { useSLAReport } from '@/hooks/useInstructions';
import { useApiaries } from '@/hooks/useApiaries';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';

// ── Period helpers ────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: '',   label: 'Todo o período' },
  { value: '7',  label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
];

function periodToDates(days: string): { date_from?: string; date_to?: string } {
  if (!days) return {};
  const to   = new Date();
  const from = new Date();
  from.setDate(from.getDate() - parseInt(days, 10));
  return { date_from: from.toISOString(), date_to: to.toISOString() };
}

// ── Rate badge ────────────────────────────────────────────────────────────────

function RateBadge({ rate }: { rate: number }) {
  const cls =
    rate >= 90 ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40' :
    rate >= 70 ? 'bg-amber-900/40 text-amber-300 border border-amber-700/40' :
                 'bg-red-900/40 text-red-300 border border-red-700/40';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>
      {rate}%
    </span>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCSV(rows: ReturnType<typeof useSLAReport>['data']) {
  if (!rows || rows.length === 0) return;
  const header = ['Tratador', 'Total', 'No prazo', 'Atrasadas', 'Pendentes', 'Taxa %'];
  const lines  = rows.map((r) =>
    [r.user_name, r.total, r.concluidas_no_prazo, r.concluidas_atrasadas, r.pendentes, r.taxa_cumprimento].join(',')
  );
  const csv  = [header.join(','), ...lines].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `sla-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SLAReportPage() {
  const { data: apiaries } = useApiaries();
  const [apiaryId, setApiaryId] = useState('');
  const [period, setPeriod]     = useState('30');

  const { date_from, date_to } = periodToDates(period);
  const { data, isLoading } = useSLAReport({
    apiary_local_id: apiaryId || undefined,
    date_from,
    date_to,
  });

  const selectCls = 'bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500';

  // Summary totals
  const totals = data?.reduce(
    (acc, r) => ({
      total:               acc.total + r.total,
      concluidas_no_prazo: acc.concluidas_no_prazo + r.concluidas_no_prazo,
      concluidas_atrasadas: acc.concluidas_atrasadas + r.concluidas_atrasadas,
      pendentes:           acc.pendentes + r.pendentes,
    }),
    { total: 0, concluidas_no_prazo: 0, concluidas_atrasadas: 0, pendentes: 0 }
  );

  const taxaGeral = totals && totals.total > 0
    ? Math.round(((totals.concluidas_no_prazo + totals.concluidas_atrasadas) / totals.total) * 100)
    : 0;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Relatório SLA</h1>
          <p className="text-stone-500 text-sm">Cumprimento de tarefas por tratador</p>
        </div>
        <button
          onClick={() => exportCSV(data)}
          disabled={!data || data.length === 0}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-800 border border-stone-700 text-stone-300 text-sm hover:bg-stone-700 transition-colors disabled:opacity-40"
        >
          ⬇ Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <select value={apiaryId} onChange={(e) => setApiaryId(e.target.value)} className={selectCls}>
          <option value="">Todos os meliponários</option>
          {apiaries?.map((a) => <option key={a.local_id} value={a.local_id}>{a.name}</option>)}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className={selectCls}>
          {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total de tarefas',  value: totals.total,               icon: '📋' },
            { label: 'Concluídas no prazo', value: totals.concluidas_no_prazo, icon: '✅' },
            { label: 'Atrasadas',          value: totals.concluidas_atrasadas, icon: '⏰' },
            { label: 'Pendentes',          value: totals.pendentes,            icon: '⏳' },
          ].map((s) => (
            <div key={s.label} className="bg-stone-800/60 border border-stone-700/50 rounded-xl p-3 text-center">
              <p className="text-xl mb-1">{s.icon}</p>
              <p className="text-2xl font-bold text-stone-100">{s.value}</p>
              <p className="text-xs text-stone-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <Card>
          <div className="overflow-x-auto -mx-4 -my-4 sm:-mx-6 sm:-my-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-700 text-left">
                  <th className="px-4 py-3 text-stone-400 font-medium">Tratador</th>
                  <th className="px-4 py-3 text-stone-400 font-medium text-right">Total</th>
                  <th className="px-4 py-3 text-stone-400 font-medium text-right hidden sm:table-cell">No prazo</th>
                  <th className="px-4 py-3 text-stone-400 font-medium text-right hidden sm:table-cell">Atrasadas</th>
                  <th className="px-4 py-3 text-stone-400 font-medium text-right hidden md:table-cell">Pendentes</th>
                  <th className="px-4 py-3 text-stone-400 font-medium text-right">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {!data || data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-stone-500">
                      Nenhum dado encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  <>
                    {data.map((r) => (
                      <tr key={r.user_id} className="border-b border-stone-800 hover:bg-stone-800/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-stone-700 flex items-center justify-center text-xs font-bold text-stone-300 shrink-0">
                              {r.user_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-stone-200">{r.user_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-stone-300 text-right font-medium">{r.total}</td>
                        <td className="px-4 py-3 text-emerald-400 text-right hidden sm:table-cell">{r.concluidas_no_prazo}</td>
                        <td className="px-4 py-3 text-amber-400 text-right hidden sm:table-cell">{r.concluidas_atrasadas}</td>
                        <td className="px-4 py-3 text-stone-400 text-right hidden md:table-cell">{r.pendentes}</td>
                        <td className="px-4 py-3 text-right">
                          <RateBadge rate={r.taxa_cumprimento} />
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    {data.length > 1 && totals && (
                      <tr className="border-t-2 border-stone-600 bg-stone-800/30">
                        <td className="px-4 py-3 text-stone-300 font-semibold">Total geral</td>
                        <td className="px-4 py-3 text-stone-200 text-right font-bold">{totals.total}</td>
                        <td className="px-4 py-3 text-emerald-400 text-right hidden sm:table-cell font-semibold">{totals.concluidas_no_prazo}</td>
                        <td className="px-4 py-3 text-amber-400 text-right hidden sm:table-cell font-semibold">{totals.concluidas_atrasadas}</td>
                        <td className="px-4 py-3 text-stone-400 text-right hidden md:table-cell font-semibold">{totals.pendentes}</td>
                        <td className="px-4 py-3 text-right">
                          <RateBadge rate={taxaGeral} />
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
