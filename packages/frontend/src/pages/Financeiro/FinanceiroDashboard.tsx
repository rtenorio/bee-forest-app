import { useState } from 'react';
import { useFinanceiroDashboard } from '@/hooks/useFinanceiro';
import { useApiaries } from '@/hooks/useApiaries';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';

// ── Period helpers ────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: '30',  label: 'Últimos 30 dias' },
  { value: '90',  label: 'Últimos 90 dias' },
  { value: '180', label: 'Últimos 180 dias' },
  { value: '365', label: 'Último ano' },
];

function periodToDates(days: string): { date_from?: string; date_to?: string } {
  const to   = new Date();
  const from = new Date();
  from.setDate(from.getDate() - parseInt(days, 10));
  return { date_from: from.toISOString().slice(0, 10), date_to: to.toISOString().slice(0, 10) };
}

// ── Bar chart (no external lib) ───────────────────────────────────────────────

function BarChart({ data }: { data: Array<{ mes: string; producao_ml: number; custos_reais: number }> }) {
  const maxProd = Math.max(...data.map((d) => d.producao_ml), 1);
  const maxCust = Math.max(...data.map((d) => d.custos_reais), 1);
  const max     = Math.max(maxProd, maxCust, 1);

  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((d) => {
        const hProd = Math.round((d.producao_ml  / max) * 100);
        const hCust = Math.round((d.custos_reais / max) * 100);
        const label = d.mes.slice(0, 7); // YYYY-MM
        return (
          <div key={d.mes} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="w-full flex items-end gap-0.5 h-32">
              <div
                className="flex-1 bg-amber-500/70 rounded-t transition-all"
                style={{ height: `${hProd}%` }}
                title={`Produção: ${d.producao_ml} ml`}
              />
              <div
                className="flex-1 bg-red-500/60 rounded-t transition-all"
                style={{ height: `${hCust}%` }}
                title={`Custo: R$ ${d.custos_reais.toFixed(2)}`}
              />
            </div>
            <span className="text-[10px] text-stone-500 truncate w-full text-center">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string; icon: string; color: string;
}) {
  return (
    <div className={`bg-stone-800/60 border ${color} rounded-xl p-4`}>
      <p className="text-2xl mb-1">{icon}</p>
      <p className="text-2xl font-bold text-stone-100 leading-tight">{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
      <p className="text-xs text-stone-500 mt-1">{label}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function FinanceiroDashboard() {
  const { data: apiaries } = useApiaries();
  const [apiaryId, setApiaryId] = useState('');
  const [period, setPeriod]     = useState('90');

  const { date_from, date_to } = periodToDates(period);
  const { data, isLoading } = useFinanceiroDashboard({
    apiary_local_id: apiaryId || undefined,
    date_from,
    date_to,
  });

  const selectCls = 'bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500';

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-100">Dashboard Financeiro</h1>
        <p className="text-stone-500 text-sm">Produção e custos de intervenção</p>
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

      {isLoading && <div className="flex justify-center py-16"><Spinner /></div>}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard
              icon="🍯" label="Produção total"
              value={`${(data.resumo_periodo.producao_total_ml / 1000).toFixed(2)} L`}
              sub={`${data.resumo_periodo.producao_total_ml} ml`}
              color="border-amber-700/40"
            />
            <SummaryCard
              icon="💰" label="Custo total"
              value={`R$ ${data.resumo_periodo.custo_total_reais.toFixed(2)}`}
              color="border-red-700/40"
            />
            <SummaryCard
              icon="⚖️" label="Custo por ml"
              value={`R$ ${data.resumo_periodo.custo_por_ml.toFixed(3)}`}
              color="border-stone-700/50"
            />
            <SummaryCard
              icon="📉" label="Taxa de perda"
              value={`${data.taxa_perda}%`}
              sub="Caixas sem produção (90d)"
              color={data.taxa_perda > 30 ? 'border-red-700/40' : 'border-stone-700/50'}
            />
          </div>

          {/* Bar chart */}
          <Card>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-semibold text-stone-300">Evolução mensal</h2>
                <div className="flex items-center gap-3 ml-auto">
                  <span className="flex items-center gap-1 text-xs text-stone-400">
                    <span className="w-3 h-3 rounded-sm bg-amber-500/70 inline-block" /> Produção (ml)
                  </span>
                  <span className="flex items-center gap-1 text-xs text-stone-400">
                    <span className="w-3 h-3 rounded-sm bg-red-500/60 inline-block" /> Custo (R$)
                  </span>
                </div>
              </div>
              {data.evolucao_mensal.length > 0
                ? <BarChart data={data.evolucao_mensal} />
                : <p className="text-stone-500 text-sm py-8 text-center">Sem dados no período</p>
              }
            </div>
          </Card>

          {/* Ranking colmeias */}
          <Card>
            <h2 className="text-sm font-semibold text-stone-300 mb-3">Top 10 colmeias mais produtivas</h2>
            {data.ranking_colmeias.length === 0 ? (
              <p className="text-stone-500 text-sm py-6 text-center">Sem dados no período</p>
            ) : (
              <div className="overflow-x-auto -mx-4 -my-4 sm:-mx-6 sm:-my-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-700 text-left">
                      <th className="px-4 py-2.5 text-stone-400 font-medium">#</th>
                      <th className="px-4 py-2.5 text-stone-400 font-medium">Caixa</th>
                      <th className="px-4 py-2.5 text-stone-400 font-medium text-right">Produção</th>
                      <th className="px-4 py-2.5 text-stone-400 font-medium text-right hidden sm:table-cell">Custos</th>
                      <th className="px-4 py-2.5 text-stone-400 font-medium text-right hidden sm:table-cell">Saldo est.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ranking_colmeias.map((r, i) => (
                      <tr key={r.hive_local_id} className="border-b border-stone-800 hover:bg-stone-800/40">
                        <td className="px-4 py-2.5 text-stone-500 text-xs">{i + 1}</td>
                        <td className="px-4 py-2.5 text-stone-200 font-medium">{r.hive_code}</td>
                        <td className="px-4 py-2.5 text-amber-400 text-right">{r.producao_ml} ml</td>
                        <td className="px-4 py-2.5 text-red-400 text-right hidden sm:table-cell">R$ {r.custos_reais.toFixed(2)}</td>
                        <td className={`px-4 py-2.5 text-right hidden sm:table-cell ${r.saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          R$ {r.saldo.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Produção por apiário */}
          {data.producao_por_apiary.length > 1 && (
            <Card>
              <h2 className="text-sm font-semibold text-stone-300 mb-3">Por meliponário</h2>
              <div className="space-y-2">
                {data.producao_por_apiary.map((a) => {
                  const maxProd = Math.max(...data.producao_por_apiary.map((x) => x.producao_ml), 1);
                  const pct = Math.round((a.producao_ml / maxProd) * 100);
                  return (
                    <div key={a.apiary_local_id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-stone-300 truncate max-w-[60%]">{a.apiary_nome}</span>
                        <span className="text-amber-400">{a.producao_ml} ml</span>
                      </div>
                      <div className="h-2 bg-stone-700 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
