import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { format, subMonths, startOfMonth, addDays, parseISO, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApiaries } from '@/hooks/useApiaries';
import { useHives } from '@/hooks/useHives';
import { useInspections } from '@/hooks/useInspections';
import { useProductions } from '@/hooks/useProductions';
import { useStockAlerts } from '@/hooks/useStock';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { HiveCard } from '@/components/hive/HiveCard';
import { daysSince } from '@/utils/dates';
import { normalizeChecklistHealth } from '@/utils/inspectionUtils';

const PIE_COLORS = { active: '#10b981', inactive: '#f59e0b', dead: '#ef4444', transferred: '#6b7280' };
const STATUS_LABELS: Record<string, string> = {
  active: 'Ativas', inactive: 'Inativas', dead: 'Mortas', transferred: 'Transferidas',
};

export function Dashboard() {
  const navigate = useNavigate();
  const { data: apiaries = [] } = useApiaries();
  const { data: hives = [] } = useHives();
  const { data: inspections = [] } = useInspections();
  const { data: productions = [] } = useProductions();
  const { data: stockAlerts = [] } = useStockAlerts();

  // ── Summary stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    totalApiaries: apiaries.length,
    totalHives: hives.length,
    activeHives: hives.filter((h) => h.status === 'active').length,
    totalInspections: inspections.length,
  }), [apiaries, hives, inspections]);

  // ── Production totals ─────────────────────────────────────────────────────
  const productionTotals = useMemo(() => {
    const thisYear = new Date().getFullYear().toString();
    const yearProds = productions.filter((p) => p.harvested_at.startsWith(thisYear));
    return {
      honeyAllTime: productions.filter((p) => p.product_type === 'honey').reduce((s, p) => s + p.quantity_g, 0),
      honeyThisYear: yearProds.filter((p) => p.product_type === 'honey').reduce((s, p) => s + p.quantity_g, 0),
      propolisThisYear: yearProds.filter((p) => p.product_type === 'propolis').reduce((s, p) => s + p.quantity_g, 0),
      harvestCount: yearProds.length,
    };
  }, [productions]);

  // ── Colony health (latest inspection per active hive) ─────────────────────
  const healthSummary = useMemo(() => {
    const activeIds = new Set(hives.filter((h) => h.status === 'active').map((h) => h.local_id));
    const latestByHive = new Map<string, typeof inspections[0]>();
    for (const i of inspections) {
      if (!activeIds.has(i.hive_local_id)) continue;
      const existing = latestByHive.get(i.hive_local_id);
      if (!existing || i.inspected_at > existing.inspected_at) latestByHive.set(i.hive_local_id, i);
    }
    const latest = Array.from(latestByHive.values());
    if (latest.length === 0) return null;
    const normalized = latest.map((i) => normalizeChecklistHealth(i.checklist));
    return {
      avgStrength: normalized.reduce((s, n) => s + n.strength, 0) / normalized.length,
      withAlerts: normalized.filter((n) => n.hasAlerts).length,
      needsFeeding: normalized.filter((n) => n.needsFeeding).length,
      needsExpansion: normalized.filter((n) => n.needsExpansion).length,
    };
  }, [hives, inspections]);

  // ── Upcoming inspections (due ≤ 14 days from now) ─────────────────────────
  const upcomingInspections = useMemo(() => {
    const today = new Date();
    const in14 = addDays(today, 14);
    return hives
      .filter((h) => h.status === 'active')
      .flatMap((h) => {
        const latest = inspections
          .filter((i) => i.hive_local_id === h.local_id)
          .sort((a, b) => b.inspected_at.localeCompare(a.inspected_at))[0];
        const due = latest?.next_inspection_due ?? null;
        if (!due) return [];
        const d = parseISO(due);
        if (isAfter(d, in14)) return [];
        return [{ hive: h, dueDate: due, isOverdue: d < today }];
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 8);
  }, [hives, inspections]);

  // ── Hives needing attention (>14 days without inspection) ─────────────────
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

  // ── Production chart (last 6 months) ─────────────────────────────────────
  const productionData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const month = subMonths(new Date(), 5 - i);
      const key = format(startOfMonth(month), 'yyyy-MM');
      const monthProds = productions.filter((p) => p.harvested_at.startsWith(key));
      return {
        month: format(month, 'MMM', { locale: ptBR }),
        mel: Math.round(monthProds.filter((p) => p.product_type === 'honey').reduce((a, p) => a + p.quantity_g, 0)),
        própolis: Math.round(monthProds.filter((p) => p.product_type === 'propolis').reduce((a, p) => a + p.quantity_g, 0)),
      };
    });
  }, [productions]);

  // ── Status distribution ───────────────────────────────────────────────────
  const statusData = useMemo(() => {
    const counts = hives.reduce((acc, h) => {
      acc[h.status] = (acc[h.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [hives]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Dashboard</h1>
          <p className="text-stone-500 text-sm">Visão geral do meliponário</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {stockAlerts.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => navigate('/stock/alerts')}>
              ⚠️ {stockAlerts.length} alerta{stockAlerts.length !== 1 ? 's' : ''} estoque
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => navigate('/reports')}>
            📊 Relatórios
          </Button>
          <Button size="sm" onClick={() => navigate('/inspections/new')}>
            + Nova Inspeção
          </Button>
        </div>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Meliponários', value: stats.totalApiaries, icon: '🏡', color: 'text-blue-400' },
          { label: 'Caixas de abelha', value: stats.totalHives, icon: '🏠', color: 'text-amber-400' },
          { label: 'Ativas', value: stats.activeHives, icon: '✅', color: 'text-emerald-400' },
          { label: 'Inspeções', value: stats.totalInspections, icon: '🔍', color: 'text-purple-400' },
        ].map((s) => (
          <Card key={s.label}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{s.icon}</span>
              <div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-stone-500">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Production totals (current year) */}
      {productionTotals.harvestCount > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Mel (ano atual)',
              value: productionTotals.honeyThisYear >= 1000
                ? `${(productionTotals.honeyThisYear / 1000).toFixed(2)} kg`
                : `${productionTotals.honeyThisYear} g`,
              icon: '🍯', color: 'text-amber-400',
            },
            {
              label: 'Própolis (ano)',
              value: productionTotals.propolisThisYear >= 1000
                ? `${(productionTotals.propolisThisYear / 1000).toFixed(2)} kg`
                : `${productionTotals.propolisThisYear} g`,
              icon: '🟫', color: 'text-amber-600',
            },
            {
              label: 'Mel (histórico)',
              value: productionTotals.honeyAllTime >= 1000
                ? `${(productionTotals.honeyAllTime / 1000).toFixed(2)} kg`
                : `${productionTotals.honeyAllTime} g`,
              icon: '📦', color: 'text-stone-300',
            },
            { label: 'Colheitas (ano)', value: productionTotals.harvestCount, icon: '✂️', color: 'text-emerald-400' },
          ].map((s) => (
            <Card key={s.label}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-stone-500">{s.label}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
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

        <Card>
          <CardHeader><CardTitle>Status das Caixas de abelha</CardTitle></CardHeader>
          {statusData.length > 0 ? (
            <>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" cx="50%" cy="50%" outerRadius={56} label={({ value }) => value}>
                      {statusData.map((entry) => (
                        <Cell key={entry.name} fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS] ?? '#78716c'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #292524', borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
                {statusData.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5 text-xs text-stone-400">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PIE_COLORS[s.name as keyof typeof PIE_COLORS] ?? '#78716c' }} />
                    {STATUS_LABELS[s.name] ?? s.name} ({s.value})
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-stone-500 text-sm text-center py-8">Nenhuma caixa de abelha</p>
          )}
        </Card>
      </div>

      {/* Colony health */}
      {healthSummary && (
        <Card>
          <CardHeader><CardTitle>Saúde das Colônias</CardTitle></CardHeader>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
            {[
              {
                label: 'Força média',
                value: healthSummary.avgStrength.toFixed(1),
                sub: '🐝'.repeat(Math.round(healthSummary.avgStrength)),
                color: 'text-amber-400',
              },
              {
                label: 'Com alertas',
                value: healthSummary.withAlerts,
                sub: healthSummary.withAlerts > 0 ? '⚠️ pragas/doenças' : '✅ sem alertas',
                color: healthSummary.withAlerts > 0 ? 'text-red-400' : 'text-emerald-400',
              },
              {
                label: 'Precisam alimentar',
                value: healthSummary.needsFeeding,
                sub: '🌺',
                color: healthSummary.needsFeeding > 0 ? 'text-orange-400' : 'text-stone-500',
              },
              {
                label: 'Precisam expandir',
                value: healthSummary.needsExpansion,
                sub: '📦',
                color: healthSummary.needsExpansion > 0 ? 'text-blue-400' : 'text-stone-500',
              },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-stone-500 mt-0.5">{s.label}</p>
                <p className="text-xs text-stone-600 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Upcoming inspections */}
      {upcomingInspections.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-stone-100 mb-3">📅 Próximas Inspeções</h2>
          <div className="space-y-2">
            {upcomingInspections.map(({ hive, dueDate, isOverdue }) => (
              <button
                key={hive.local_id}
                onClick={() => navigate(`/hives/${hive.local_id}`)}
                className="w-full text-left flex items-center justify-between px-4 py-3 rounded-xl border border-stone-800 bg-stone-900/40 hover:bg-stone-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🏠</span>
                  <div>
                    <p className="text-sm font-medium text-stone-100">{hive.code}</p>
                    <p className="text-xs text-stone-500">
                      Prevista para {dueDate.split('-').reverse().join('/')}
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                  isOverdue
                    ? 'bg-red-900/40 border-red-700/40 text-red-300'
                    : 'bg-amber-500/10 border-amber-600/30 text-amber-400'
                }`}>
                  {isOverdue ? '⚠️ Atrasada' : '🗓 Em breve'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Attention needed (no inspection in >14 days) */}
      {attentionHives.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-stone-100">⚠️ Sem inspeção recente</h2>
            <span className="text-xs text-stone-500">({attentionHives.length})</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {attentionHives.map((hive) => {
              const latest = inspections
                .filter((i) => i.hive_local_id === hive.local_id)
                .sort((a, b) => b.inspected_at.localeCompare(a.inspected_at))[0];
              return <HiveCard key={hive.local_id} hive={hive} lastInspectedAt={latest?.inspected_at} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
