import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useHives } from '@/hooks/useHives';
import { useInspections } from '@/hooks/useInspections';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { HiveCard } from '@/components/hive/HiveCard';
import { daysSince } from '@/utils/dates';

export function TratadorDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;
  const { data: hives = [] } = useHives();
  const { data: inspections = [] } = useInspections();

  const myHives = useMemo(
    () => hives.filter((h) => user.hive_local_ids.includes(h.local_id)),
    [hives, user.hive_local_ids]
  );

  const attentionHives = useMemo(() => {
    return myHives
      .filter((h) => h.status === 'active')
      .filter((h) => {
        const hiveInspections = inspections.filter((i) => i.hive_local_id === h.local_id);
        if (hiveInspections.length === 0) return true;
        const latest = hiveInspections.sort((a, b) => b.inspected_at.localeCompare(a.inspected_at))[0];
        return (daysSince(latest.inspected_at) ?? 0) > 14;
      });
  }, [myHives, inspections]);

  const recentInspections = useMemo(() => {
    return inspections
      .filter((i) => user.hive_local_ids.includes(i.hive_local_id))
      .sort((a, b) => b.inspected_at.localeCompare(a.inspected_at))
      .slice(0, 5);
  }, [inspections, user.hive_local_ids]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Minhas Colmeias</h1>
          <p className="text-stone-500 text-sm">Olá, {user.name}</p>
        </div>
        <Button onClick={() => navigate('/inspections/new')} size="sm">
          + Inspecionar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Colmeias', value: myHives.length, icon: '🏠', color: 'text-amber-400' },
          { label: 'Atenção', value: attentionHives.length, icon: '⚠️', color: 'text-red-400' },
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

      {attentionHives.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-stone-100">⚠️ Precisam de atenção</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {attentionHives.map((hive) => {
              const hiveInspections = inspections.filter((i) => i.hive_local_id === hive.local_id);
              const latest = hiveInspections.sort((a, b) => b.inspected_at.localeCompare(a.inspected_at))[0];
              return (
                <div key={hive.local_id} className="relative">
                  <HiveCard hive={hive} lastInspectedAt={latest?.inspected_at} />
                  <button
                    onClick={() => navigate(`/inspections/new?hive=${hive.local_id}`)}
                    className="absolute top-2 right-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-2 py-1 rounded-lg transition-colors"
                  >
                    Inspecionar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recentInspections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Últimas Inspeções</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {recentInspections.map((insp) => {
              const hive = myHives.find((h) => h.local_id === insp.hive_local_id);
              return (
                <button
                  key={insp.local_id}
                  onClick={() => navigate(`/inspections/${insp.local_id}`)}
                  className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg hover:bg-stone-800 transition-colors"
                >
                  <div>
                    <p className="text-stone-100 text-sm">{hive?.code ?? insp.hive_local_id}</p>
                    <p className="text-stone-500 text-xs">{insp.inspector_name}</p>
                  </div>
                  <span className="text-xs text-stone-500">
                    {new Date(insp.inspected_at).toLocaleDateString('pt-BR')}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Todas as Colmeias</CardTitle>
        </CardHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          {myHives.map((hive) => {
            const hiveInspections = inspections.filter((i) => i.hive_local_id === hive.local_id);
            const latest = hiveInspections.sort((a, b) => b.inspected_at.localeCompare(a.inspected_at))[0];
            return <HiveCard key={hive.local_id} hive={hive} lastInspectedAt={latest?.inspected_at} />;
          })}
        </div>
        {myHives.length === 0 && (
          <p className="text-stone-500 text-sm text-center py-4">Nenhuma colmeia atribuída</p>
        )}
      </Card>
    </div>
  );
}
