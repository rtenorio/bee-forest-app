import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { useBatchReports } from '@/hooks/useBatches';
import { useApiaries } from '@/hooks/useApiaries';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';

const PERIOD_OPTIONS = [
  { value: 'week',    label: 'Últimos 7 dias' },
  { value: 'month',   label: 'Últimos 30 dias' },
  { value: 'quarter', label: 'Últimos 90 dias' },
  { value: 'year',    label: 'Último ano' },
];

const ROUTE_LABEL: Record<string, string> = {
  in_natura: 'In natura',
  dehumidified: 'Desumidificado',
  matured: 'Maturado',
  dehumidified_then_matured: 'Desumid. + Maturado',
};

const STATUS_LABEL: Record<string, string> = {
  collected: 'Coletado',
  in_natura_ready: 'In natura pronto',
  in_dehumidification: 'Desumidificando',
  dehumidified: 'Desumidificado',
  in_maturation: 'Maturando',
  matured: 'Maturado',
  bottled: 'Envasado',
  sold: 'Vendido',
  rejected: 'Reprovado',
};

const DECISION_LABEL: Record<string, string> = {
  approved: 'Aprovado',
  approved_with_observation: 'Aprov. c/ obs.',
  rejected: 'Reprovado',
  redirected_for_new_processing: 'Reencaminhado',
};

const CHART_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#f87171', '#a78bfa', '#fb923c'];

const CHART_THEME = {
  grid: '#292524',
  axis: '#78716c',
  tooltip: { contentStyle: { background: '#1c1917', border: '1px solid #292524', color: '#e7e5e4', borderRadius: 8 }, itemStyle: { color: '#e7e5e4' } },
};

function StatCard({ label, value, sub }: { label: string; value: string | number | null; sub?: string }) {
  return (
    <div className="bg-stone-800/60 rounded-xl p-4 text-center">
      <p className="text-2xl font-bold text-amber-400">{value ?? '—'}</p>
      <p className="text-xs text-stone-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-stone-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export function BatchReportsPage() {
  const [period, setPeriod] = useState('month');
  const [apiaryId, setApiaryId] = useState('');

  const { data: apiaries = [] } = useApiaries();
  const { data, isLoading } = useBatchReports(period, apiaryId || undefined);

  const apiaryOptions = [
    { value: '', label: 'Todos os meliponários' },
    ...apiaries.map((a) => ({ value: a.local_id, label: a.name })),
  ];

  const routeData = (data?.by_route ?? []).map((r) => ({
    name: ROUTE_LABEL[r.processing_route] ?? r.processing_route,
    value: Number(r.count),
  }));

  const statusData = (data?.by_status ?? []).map((s) => ({
    name: STATUS_LABEL[s.current_status] ?? s.current_status,
    value: Number(s.count),
  }));

  const monthData = (data?.by_month ?? []).map((m) => ({
    month: m.month,
    lotes: Number(m.count),
    kg: m.total_kg != null ? Number(m.total_kg) : 0,
  }));

  const matData = (data?.maturation_stats ?? []).map((m) => ({
    name: DECISION_LABEL[m.final_decision] ?? m.final_decision,
    value: Number(m.count),
  }));

  const moistureData = (data?.moisture_evolution ?? []).map((m) => ({
    day: m.day,
    'Umidade %': Number(m.avg_moisture),
    ...(m.avg_brix != null ? { 'Brix °Bx': Number(m.avg_brix) } : {}),
  }));

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-stone-100">Relatórios de Lotes</h1>
        <p className="text-stone-500 text-sm mt-1">Análise de produção e qualidade do mel</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="w-48">
          <Select
            options={PERIOD_OPTIONS}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
        <div className="w-56">
          <Select
            options={apiaryOptions}
            value={apiaryId}
            onChange={(e) => setApiaryId(e.target.value)}
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12"><Spinner /></div>
      )}

      {!isLoading && data && (
        <>
          {/* Stat summary */}
          {data.moisture_stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Umidade média" value={data.moisture_stats.avg_moisture != null ? `${data.moisture_stats.avg_moisture}%` : null} />
              <StatCard label="Brix médio" value={data.moisture_stats.avg_brix != null ? `${data.moisture_stats.avg_brix}°Bx` : null} />
              <StatCard
                label="Redução de umidade"
                value={data.dehum_stats?.avg_moisture_reduction != null ? `${data.dehum_stats.avg_moisture_reduction}%` : null}
                sub="média na desumidificação"
              />
              <StatCard
                label="Duração média"
                value={data.dehum_stats?.avg_duration_hours != null ? `${data.dehum_stats.avg_duration_hours}h` : null}
                sub="desumidificação"
              />
            </div>
          )}

          {/* Lotes por mês */}
          {monthData.length > 0 && (
            <Card>
              <CardHeader><CardTitle>📅 Lotes por Mês</CardTitle></CardHeader>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis dataKey="month" tick={{ fill: CHART_THEME.axis, fontSize: 11 }} />
                  <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 11 }} />
                  <Tooltip {...CHART_THEME.tooltip} />
                  <Legend wrapperStyle={{ fontSize: 12, color: CHART_THEME.axis }} />
                  <Bar dataKey="lotes" fill="#f59e0b" name="Nº de lotes" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Rotas de processamento + Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {routeData.length > 0 && (
              <Card>
                <CardHeader><CardTitle>🔀 Rotas de Processamento</CardTitle></CardHeader>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={routeData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {routeData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...CHART_THEME.tooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            )}

            {statusData.length > 0 && (
              <Card>
                <CardHeader><CardTitle>📊 Distribuição por Status</CardTitle></CardHeader>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={statusData} layout="vertical" margin={{ top: 0, right: 8, left: 80, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                    <XAxis type="number" tick={{ fill: CHART_THEME.axis, fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: CHART_THEME.axis, fontSize: 11 }} width={80} />
                    <Tooltip {...CHART_THEME.tooltip} />
                    <Bar dataKey="value" name="Lotes" radius={[0, 3, 3, 0]}>
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>

          {/* Evolução de umidade */}
          {moistureData.length > 1 && (
            <Card>
              <CardHeader><CardTitle>💧 Evolução de Umidade nas Desumidificações</CardTitle></CardHeader>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={moistureData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis dataKey="day" tick={{ fill: CHART_THEME.axis, fontSize: 11 }} />
                  <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 11 }} />
                  <Tooltip {...CHART_THEME.tooltip} />
                  <Legend wrapperStyle={{ fontSize: 12, color: CHART_THEME.axis }} />
                  <Line type="monotone" dataKey="Umidade %" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Brix °Bx" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Decisões de maturação */}
          {matData.length > 0 && (
            <Card>
              <CardHeader><CardTitle>✨ Resultados de Maturação</CardTitle></CardHeader>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={matData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis dataKey="name" tick={{ fill: CHART_THEME.axis, fontSize: 11 }} />
                  <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 11 }} />
                  <Tooltip {...CHART_THEME.tooltip} />
                  <Bar dataKey="value" name="Sessões" radius={[3, 3, 0, 0]}>
                    {matData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.name === 'Aprovado' ? '#10b981' :
                          entry.name === 'Reprovado' ? '#f87171' :
                          CHART_COLORS[i % CHART_COLORS.length]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {monthData.length === 0 && routeData.length === 0 && (
            <Card>
              <p className="text-stone-500 text-sm text-center py-8">
                Nenhum dado disponível para o período selecionado.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
