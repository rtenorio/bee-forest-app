import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useApiaries } from '@/hooks/useApiaries';
import { useHives } from '@/hooks/useHives';
import { useInspections } from '@/hooks/useInspections';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { HiveCard } from '@/components/hive/HiveCard';
import { daysSince } from '@/utils/dates';

export function ResponsavelDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;
  const { data: apiaries = [] } = useApiaries();
  const { data: hives = [] } = useHives();
  const { data: inspections = [] } = useInspections();

  const myApiaries = useMemo(
    () => apiaries.filter((a) => user.apiary_local_ids.includes(a.local_id)),
    [apiaries, user.apiary_local_ids]
  );

  const myHives = useMemo(
    () => hives.filter((h) => user.apiary_local_ids.includes(h.apiary_local_id)),
    [hives, user.apiary_local_ids]
  );

  const attentionHives = useMemo(() => {
    return myHives
      .filter((h) => h.status === 'active')
      .filter((h) => {
        const hiveInspections = inspections.filter((i) => i.hive_local_id === h.local_id);
        if (hiveInspections.length === 0) return true;
        const latest = hiveInspections.sort((a, b) => b.inspected_at.localeCompare(a.inspected_at))[0];
        return (daysSince(latest.inspected_at) ?? 0) > 14;
      })
      .slice(0, 6);
  }, [myHives, inspections]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Meu Meliponário</h1>
          <p className="text-stone-500 text-sm">Olá, {user.name}</p>
        </div>
        <Button onClick={() => navigate('/inspections/new')} size="sm">
          + Nova Inspeção
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: 'Meliponários', value: myApiaries.length, icon: '🏡', color: 'text-blue-400' },
          { label: 'Colmeias', value: myHives.length, icon: '🏠', color: 'text-amber-400' },
          { label: 'Ativas', value: myHives.filter((h) => h.status === 'active').length, icon: '✅', color: 'text-emerald-400' },
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

      {myApiaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Meliponários</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {myApiaries.map((apiary) => {
              const count = myHives.filter((h) => h.apiary_local_id === apiary.local_id).length;
              return (
                <button
                  key={apiary.local_id}
                  onClick={() => navigate(`/hives?apiary=${apiary.local_id}`)}
                  className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg hover:bg-stone-800 transition-colors"
                >
                  <span className="text-stone-100 text-sm">{apiary.name}</span>
                  <span className="text-xs text-stone-500">{count} colmeia{count !== 1 ? 's' : ''}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {attentionHives.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-stone-100">⚠️ Precisam de atenção</h2>
            <span className="text-xs text-stone-500">({attentionHives.length})</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
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
