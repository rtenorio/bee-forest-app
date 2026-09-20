import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiaries } from '@/hooks/useApiaries';
import { useHives } from '@/hooks/useHives';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { getManejoTask } from './manejoTasks';
import { useManejoPendencias } from './useManejoPendencias';

export function ManejoPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [apiaryId, setApiaryId] = useState('');

  const { data: apiaries = [] } = useApiaries();
  const { data: hives = [] } = useHives();
  const { grupos, pendencias, isLoading } = useManejoPendencias(apiaryId || undefined);

  // Só meliponários com caixas que o usuário enxerga — mesmo critério das
  // outras telas.
  const apiariesWithAccess = useMemo(() => {
    if (!user) return [];
    const accessible = user.role === 'tratador'
      ? hives.filter((h) => user.hive_local_ids.includes(h.local_id) && h.status === 'active' && !h.deleted_at)
      : hives.filter((h) => h.status === 'active' && !h.deleted_at);
    const ids = new Set(accessible.map((h) => h.apiary_local_id));
    return apiaries.filter((a) => ids.has(a.local_id) && !a.deleted_at);
  }, [apiaries, hives, user]);

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  const totalCaixas = new Set(pendencias.map((p) => p.colonyId)).size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-100">Painel de Manejo</h1>
        <p className="text-stone-500 text-sm">
          {grupos.length === 0
            ? 'Nenhum manejo pendente'
            : `${pendencias.length} pendência${pendencias.length !== 1 ? 's' : ''} em ${totalCaixas} caixa${totalCaixas !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Filtro de meliponário */}
      {apiariesWithAccess.length > 1 && (
        <div>
          <label className="block text-xs font-medium text-stone-400 mb-1">Meliponário</label>
          <select
            value={apiaryId}
            onChange={(e) => setApiaryId(e.target.value)}
            className="w-full sm:w-72 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">Todos os meliponários</option>
            {apiariesWithAccess.map((a) => (
              <option key={a.local_id} value={a.local_id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      {grupos.length === 0 ? (
        <EmptyState
          icon="🛠️"
          title="Nenhum manejo pendente"
          description="Este painel se alimenta do bloco “Manejo pendente” das inspeções. As caixas aparecem aqui conforme as inspeções forem registradas com o que ficou pendente — inspeções antigas, feitas antes dessa separação, não entram."
          action={{ label: 'Registrar inspeção', onClick: () => navigate('/inspections/new') }}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {grupos.map((grupo) => {
            const task = getManejoTask(grupo.taskKey);
            if (!task) return null;
            const count = grupo.pendencias.length;

            return (
              <Card
                key={grupo.taskKey}
                hover
                onClick={() => navigate(`/manejo/${grupo.taskKey}`)}
              >
                <div className="flex items-start gap-3">
                  <span className={`text-2xl shrink-0 ${task.colorClass}`}>{task.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-100 truncate">{task.labelPendente}</p>
                    <p className="text-sm text-stone-400 mt-0.5">
                      {count} caixa{count !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-stone-500 mt-1">
                      mais antiga: {grupo.oldestDays} dia{grupo.oldestDays !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="text-stone-600 shrink-0">›</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
