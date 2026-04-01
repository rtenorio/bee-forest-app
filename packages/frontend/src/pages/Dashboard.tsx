import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { useApiaries } from '@/hooks/useApiaries';
import { useHives } from '@/hooks/useHives';
import { useInspections } from '@/hooks/useInspections';
import { useProductions } from '@/hooks/useProductions';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { HiveCard } from '@/components/hive/HiveCard';
import { daysSince, formatDate } from '@/utils/dates';
import { format, subMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PIE_COLORS = { active: '#10b981', inactive: '#f59e0b', dead: '#ef4444', transferred: '#6b7280' };

export function Dashboard() {
  const navigate = useNavigate();
  const { data: apiaries = [] } = useApiaries();
  const { data: hives = [] } = useHives();
  const { data: inspections = [] } = useInspections();
  const { data: productions = [] } = useProductions();

  // Stats
  const stats = useMemo(() => ({
    totalApiaries: apiaries.length,
    totalHives: hives.length,
    activeHives: hives.filter((h) => h.status === 'active').length,
    totalInspections: inspections.length,
  }), [apiaries, hives, inspections]);

  // Hives needing attention (no inspection in >14 days or never inspected)
  const attentionHives = useMemo(() => {
    return hives
      .filter((h) => h.status === 'active')
      .filter((h) => {
        const hiveInspections = inspections.filter((i) => i.hive_local_id === h.local_id);
        if (hiveInspections.length === 0) return true;
        const latest = hiveInspections.sort((a, b) => b.inspected_at.localeCompare(a.inspected_at))[0];
        return (daysSince(latest.inspected_at) ?? 0) > 14;
      })
      .slice(0, 6);
  }, [hives, inspections]);

  // Production chart (last 6 months)
  const productionData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const month = subMonths(new Date(), 5 - i);
      const key = format(startOfMonth(month), 'yyyy-MM');
      const monthProds = productions.filter((p) => p.harvested_at.startsWith(key));
      const honey = monthProds.filter((p) => p.product_type === 'honey').reduce((a, p) => a + p.quantity_g, 0);
      const propolis = monthProds.filter((p) => p.product_type === 'propolis').reduce((a, p) => a + p.quantity_g, 0);
      return {
        month: format(month, 'MMM', { locale: ptBR }),
        mel: Math.round(honey),
        própolis: Math.round(propolis),
      };
    });
  }, [productions]);

  // Hive status distribution
  const statusData = useMemo(() => {
    const counts = hives.reduce((acc, h) => {
      acc[h.status] = (acc[h.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [hives]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Dashboard</h1>
          <p className="text-stone-500 text-sm">Visão geral do meliponário</p>
        </div>
        <Button onClick={() => navigate('/inspections/new')} size="sm">
          + Nova Inspeção
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Meliponários', value: stats.totalApiaries, icon: '🏡', color: 'text-blue-400' },
          { label: 'Colmeias', value: stats.totalHives, icon: '🏠', color: 'text-amber-400' },
          { label: 'Ativas', value: stats.activeHives, icon: '✅', color: 'text-emerald-400' },
          { label: 'Inspeções', value: stats.totalInspections, icon: '🔍', color: 'text-purple-400' },
        ].map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{stat.icon}</span>
              <div>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-stone-500">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Production chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Produção (últimos 6 meses)</CardTitle>
          </CardHeader>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={productionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#292524" />
                <XAxis dataKey="month" tick={{ fill: '#78716c', fontSize: 12 }} />
                <YAxis tick={{ fill: '#78716c', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #292524', borderRadius: 8 }}
                  labelStyle={{ color: '#d6d3d1' }}
                />
                <Area type="monotone" dataKey="mel" stroke="#f59e0b" fill="#f59e0b20" name="Mel (g)" />
                <Area type="monotone" dataKey="própolis" stroke="#a78bfa" fill="#a78bfa20" name="Própolis (g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Status pie */}
        <Card>
          <CardHeader>
            <CardTitle>Status das Colmeias</CardTitle>
          </CardHeader>
          {statusData.length > 0 ? (
            <div className="h-40 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" cx="50%" cy="50%" outerRadius={60} label={({ name, value }) => `${value}`}>
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS] ?? '#78716c'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #292524', borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-stone-500 text-sm text-center py-8">Nenhuma colmeia</p>
          )}
        </Card>
      </div>

      {/* Attention needed */}
      {attentionHives.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-stone-100">⚠️ Precisam de atenção</h2>
            <span className="text-xs text-stone-500">({attentionHives.length} colmeia{attentionHives.length > 1 ? 's' : ''})</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {attentionHives.map((hive) => {
              const hiveInspections = inspections.filter((i) => i.hive_local_id === hive.local_id);
              const latest = hiveInspections.sort((a, b) => b.inspected_at.localeCompare(a.inspected_at))[0];
              return <HiveCard key={hive.local_id} hive={hive} lastInspectedAt={latest?.inspected_at} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
