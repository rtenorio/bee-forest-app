import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, parseISO, isAfter, subDays } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import { useApiaries } from '@/hooks/useApiaries';
import { useHives } from '@/hooks/useHives';
import { useInspections } from '@/hooks/useInspections';
import { useProductions } from '@/hooks/useProductions';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { HiveCard } from '@/components/hive/HiveCard';
import { daysSince } from '@/utils/dates';

const PEST_LABELS: Record<string, string> = {
  small_hive_beetle: 'Besouro', phorid_flies: 'Moscas fóridas', ants: 'Formigas',
  wax_moth: 'Traça da cera', lizards: 'Lagartos', spiders: 'Aranhas',
};
const DISEASE_LABELS: Record<string, string> = {
  american_foulbrood: 'Loque americano', nosemosis: 'Nosemose',
  chalkbrood: 'Cria giz', sacbrood: 'Cria ensacada', stonebrood: 'Cria pedra',
};

export function ResponsavelDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;
  const { data: apiaries = [] } = useApiaries();
  const { data: hives = [] } = useHives();
  const { data: inspections = [] } = useInspections();
  const { data: productions = [] } = useProductions();

  const myApiaries = useMemo(
    () => apiaries.filter((a) => user.apiary_local_ids.includes(a.local_id)),
    [apiaries, user.apiary_local_ids]
  );
  const myHives = useMemo(
    () => hives.filter((h) => user.apiary_local_ids.includes(h.apiary_local_id)),
    [hives, user.apiary_local_ids]
  );
  const myActiveHives = useMemo(() => myHives.filter((h) => h.status === 'active'), [myHives]);

  // ── Latest inspection per hive ────────────────────────────────────────────
  const latestByHive = useMemo(() => {
    const map = new Map<string, typeof inspections[0]>();
    for (const i of inspections) {
      const existing = map.get(i.hive_local_id);
      if (!existing || i.inspected_at > existing.inspected_at) map.set(i.hive_local_id, i);
    }
    return map;
  }, [inspections]);

  // ── Hives needing attention (>14 days without inspection) ─────────────────
  const attentionHives = useMemo(() => {
    return myActiveHives
      .filter((h) => {
        const latest = latestByHive.get(h.local_id);
        if (!latest) return true;
        return (daysSince(latest.inspected_at) ?? 0) > 14;
      })
      .slice(0, 6);
  }, [myActiveHives, latestByHive]);

  // ── Upcoming inspections (due ≤ 14 days) ──────────────────────────────────
  const upcomingInspections = useMemo(() => {
    const today = new Date();
    const in14 = addDays(today, 14);
    return myActiveHives
      .flatMap((h) => {
        const latest = latestByHive.get(h.local_id);
        const due = latest?.next_inspection_due ?? null;
        if (!due) return [];
        const d = parseISO(due);
        if (isAfter(d, in14)) return [];
        return [{ hive: h, dueDate: due, isOverdue: d < today }];
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [myActiveHives, latestByHive]);

  // ── Health alerts (pests or diseases in last inspection) ──────────────────
  const healthAlerts = useMemo(() => {
    return myActiveHives.flatMap((h) => {
      const latest = latestByHive.get(h.local_id);
      if (!latest) return [];
      const { pests_observed, diseases_observed } = latest.checklist;
      if (pests_observed.length === 0 && diseases_observed.length === 0) return [];
      return [{ hive: h, pests: pests_observed, diseases: diseases_observed }];
    });
  }, [myActiveHives, latestByHive]);

  // ── Hives needing feeding or expansion ────────────────────────────────────
  const needsAction = useMemo(() => {
    return myActiveHives.flatMap((h) => {
      const latest = latestByHive.get(h.local_id);
      if (!latest) return [];
      const { needs_feeding, needs_space_expansion } = latest.checklist;
      if (!needs_feeding && !needs_space_expansion) return [];
      return [{ hive: h, needs_feeding, needs_space_expansion }];
    });
  }, [myActiveHives, latestByHive]);

  // ── Production (last 30 days) ─────────────────────────────────────────────
  const productionSummary = useMemo(() => {
    const myHiveIds = new Set(myHives.map((h) => h.local_id));
    const cutoff = subDays(new Date(), 30).toISOString().slice(0, 10);
    const recent = productions.filter(
      (p) => myHiveIds.has(p.hive_local_id) && p.harvested_at.slice(0, 10) >= cutoff
    );
    return {
      honey: recent.filter((p) => p.product_type === 'honey').reduce((s, p) => s + p.quantity_g, 0),
      propolis: recent.filter((p) => p.product_type === 'propolis').reduce((s, p) => s + p.quantity_g, 0),
      count: recent.length,
    };
  }, [productions, myHives]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Meu Meliponário</h1>
          <p className="text-stone-500 text-sm">Olá, {user.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/reports')}>
            📊 Relatórios
          </Button>
          <Button size="sm" onClick={() => navigate('/inspections/new')}>
            + Nova Inspeção
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Meliponários', value: myApiaries.length, icon: '🏡', color: 'text-blue-400' },
          { label: 'Colmeias', value: myHives.length, icon: '🏠', color: 'text-amber-400' },
          { label: 'Ativas', value: myActiveHives.length, icon: '✅', color: 'text-emerald-400' },
          {
            label: 'Alertas saúde',
            value: healthAlerts.length,
            icon: '🔬',
            color: healthAlerts.length > 0 ? 'text-red-400' : 'text-stone-500',
          },
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

      {/* Production last 30 days */}
      {productionSummary.count > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Produção (últimos 30 dias)</CardTitle>
            <button onClick={() => navigate('/reports')} className="text-xs text-amber-500 hover:text-amber-400">
              Ver relatório →
            </button>
          </CardHeader>
          <div className="grid grid-cols-3 gap-4 pt-1">
            {[
              {
                label: 'Mel', icon: '🍯', color: 'text-amber-400',
                value: productionSummary.honey >= 1000
                  ? `${(productionSummary.honey / 1000).toFixed(2)} kg`
                  : `${productionSummary.honey} g`,
              },
              {
                label: 'Própolis', icon: '🟫', color: 'text-amber-600',
                value: productionSummary.propolis >= 1000
                  ? `${(productionSummary.propolis / 1000).toFixed(2)} kg`
                  : `${productionSummary.propolis} g`,
              },
              { label: 'Colheitas', icon: '✂️', color: 'text-emerald-400', value: productionSummary.count },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl mb-1">{s.icon}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-stone-500">{s.label}</p>
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

      {/* Health alerts */}
      {healthAlerts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-stone-100 mb-3">🔬 Alertas de Saúde</h2>
          <div className="space-y-2">
            {healthAlerts.map(({ hive, pests, diseases }) => (
              <button
                key={hive.local_id}
                onClick={() => navigate(`/hives/${hive.local_id}`)}
                className="w-full text-left px-4 py-3 rounded-xl border border-red-800/50 bg-red-900/10 hover:bg-red-900/20 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-medium text-stone-100">🏠 {hive.code}</p>
                  <span className="text-xs text-red-400">Ver detalhes →</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pests.map((p) => (
                    <span key={p} className="px-2 py-0.5 rounded-full text-xs bg-orange-900/40 border border-orange-700/40 text-orange-300">
                      🪲 {PEST_LABELS[p] ?? p}
                    </span>
                  ))}
                  {diseases.map((d) => (
                    <span key={d} className="px-2 py-0.5 rounded-full text-xs bg-red-900/40 border border-red-700/40 text-red-300">
                      🦠 {DISEASE_LABELS[d] ?? d}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Needs feeding / expansion */}
      {needsAction.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Ações Pendentes</CardTitle></CardHeader>
          <div className="space-y-1 pt-1">
            {needsAction.map(({ hive, needs_feeding, needs_space_expansion }) => (
              <button
                key={hive.local_id}
                onClick={() => navigate(`/hives/${hive.local_id}`)}
                className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg hover:bg-stone-800 transition-colors"
              >
                <span className="text-sm text-stone-100">{hive.code}</span>
                <div className="flex gap-2">
                  {needs_feeding && <span className="text-xs text-orange-400">🌺 Alimentar</span>}
                  {needs_space_expansion && <span className="text-xs text-blue-400">📦 Expandir</span>}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* My apiaries */}
      {myApiaries.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Meliponários</CardTitle></CardHeader>
          <div className="space-y-1 pt-1">
            {myApiaries.map((apiary) => {
              const count = myHives.filter((h) => h.apiary_local_id === apiary.local_id).length;
              return (
                <button
                  key={apiary.local_id}
                  onClick={() => navigate(`/apiaries/${apiary.local_id}`)}
                  className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg hover:bg-stone-800 transition-colors"
                >
                  <span className="text-sm text-stone-100">{apiary.name}</span>
                  <span className="text-xs text-stone-500">{count} colmeia{count !== 1 ? 's' : ''}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Attention (no recent inspection) */}
      {attentionHives.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-stone-100">⚠️ Sem inspeção recente</h2>
            <span className="text-xs text-stone-500">({attentionHives.length})</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {attentionHives.map((hive) => {
              const latest = latestByHive.get(hive.local_id);
              return <HiveCard key={hive.local_id} hive={hive} lastInspectedAt={latest?.inspected_at} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
