import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApiary, useDeleteApiary, useToggleApiaryStatus } from '@/hooks/useApiaries';
import { useHives, useDeleteHive } from '@/hooks/useHives';
import { useInspections } from '@/hooks/useInspections';
import { useSpecies } from '@/hooks/useSpecies';
import { useAuthStore } from '@/store/authStore';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { HiveCard } from '@/components/hive/HiveCard';
import { HiveForm } from '../Hives/HiveForm';
import { ApiaryForm } from './ApiaryForm';
import { daysSince } from '@/utils/dates';

export function ApiaryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;
  const canManage = user.role === 'socio' || user.role === 'responsavel' || user.role === 'master_admin';

  const { data: apiary, isLoading } = useApiary(id!);
  const { data: hives = [] } = useHives(id);
  const { data: inspections = [] } = useInspections();
  const { data: speciesList = [] } = useSpecies();
  const deleteApiary = useDeleteApiary();
  const deleteHive = useDeleteHive();
  const toggleStatus = useToggleApiaryStatus();

  const canToggleStatus = user.role === 'master_admin' || user.role === 'socio';

  const [editApiary, setEditApiary] = useState(false);
  const [addHive, setAddHive] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!apiary) return <div className="text-stone-400 text-center py-16">Meliponário não encontrado</div>;

  const activeHives = hives.filter((h) => h.status === 'active');
  const filtered = filterStatus ? hives.filter((h) => h.status === filterStatus) : hives;

  function handleDeleteApiary() {
    if (!confirm(`Excluir meliponário "${apiary!.name}"? Isso não apagará as caixas já registradas.`)) return;
    deleteApiary.mutate(apiary!.local_id, { onSuccess: () => navigate('/apiaries') });
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/apiaries')}
            className="text-stone-400 hover:text-stone-100 transition-colors text-sm"
          >
            ← Meliponários
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-stone-100">{apiary.name}</h1>
              {(apiary.status ?? 'active') === 'inactive' && <Badge variant="default">Inativo</Badge>}
              {apiary.is_dirty && <Badge variant="warning">Não sincronizado</Badge>}
            </div>
            {apiary.location && (
              <p className="text-stone-500 text-sm mt-0.5">📍 {apiary.location}</p>
            )}
          </div>
        </div>

        {canManage && (
          <div className="flex gap-2 flex-wrap">
            {apiary.status !== 'inactive' && (
              <Button size="sm" onClick={() => setAddHive(true)}>+ Nova Caixa</Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setEditApiary(true)}>Editar</Button>
            {canToggleStatus && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const action = apiary.status === 'inactive' ? 'reativar' : 'desativar';
                  if (confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} "${apiary.name}"?`)) {
                    toggleStatus.mutate({ local_id: apiary.local_id, status: apiary.status === 'inactive' ? 'active' : 'inactive' });
                  }
                }}
              >
                {apiary.status === 'inactive' ? 'Reativar' : 'Desativar'}
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={handleDeleteApiary}>Excluir</Button>
          </div>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total de Caixas', value: hives.length, color: 'text-amber-400' },
          { label: 'Ativas', value: activeHives.length, color: 'text-emerald-400' },
          { label: 'Inativas', value: hives.filter((h) => h.status === 'inactive').length, color: 'text-stone-400' },
          { label: 'Mortas', value: hives.filter((h) => h.status === 'dead').length, color: 'text-red-400' },
        ].map((s) => (
          <Card key={s.label} className="text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-stone-500">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Details */}
      {(apiary.owner_name || apiary.latitude || apiary.notes) && (
        <Card>
          <CardHeader><CardTitle>Informações</CardTitle></CardHeader>
          <dl className="grid sm:grid-cols-2 gap-3 text-sm">
            {apiary.owner_name && (
              <div>
                <dt className="text-stone-500 text-xs">Proprietário</dt>
                <dd className="text-stone-200">{apiary.owner_name}</dd>
              </div>
            )}
            {apiary.latitude != null && apiary.longitude != null && (
              <div>
                <dt className="text-stone-500 text-xs">Coordenadas</dt>
                <dd className="text-stone-200 font-mono text-xs">
                  {apiary.latitude.toFixed(6)}, {apiary.longitude.toFixed(6)}
                </dd>
              </div>
            )}
            {apiary.notes && (
              <div className="sm:col-span-2">
                <dt className="text-stone-500 text-xs">Observações</dt>
                <dd className="text-stone-300 mt-0.5">{apiary.notes}</dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      {/* Hive list */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="font-semibold text-stone-100">
            Caixas
            <span className="ml-2 text-stone-500 font-normal text-sm">({filtered.length})</span>
          </h2>
          <div className="flex gap-2">
            {(['', 'active', 'inactive', 'dead', 'transferred'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filterStatus === s
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'border-stone-700 text-stone-400 hover:text-stone-200'
                }`}
              >
                {s === '' ? 'Todas' : s === 'active' ? 'Ativas' : s === 'inactive' ? 'Inativas' : s === 'dead' ? 'Mortas' : 'Transferidas'}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-stone-500">
            <p className="text-4xl mb-2">🏠</p>
            <p className="font-medium">
              {hives.length === 0 ? 'Nenhuma caixa cadastrada' : 'Nenhuma caixa neste filtro'}
            </p>
            {canManage && hives.length === 0 && (
              <button
                onClick={() => setAddHive(true)}
                className="mt-3 text-amber-400 hover:text-amber-300 text-sm underline"
              >
                Adicionar a primeira caixa
              </button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((hive) => {
              const hiveInspections = inspections.filter((i) => i.hive_local_id === hive.local_id);
              const latest = hiveInspections.sort((a, b) => b.inspected_at.localeCompare(a.inspected_at))[0];
              const species = speciesList.find((s) => s.local_id === hive.species_local_id);
              return (
                <div key={hive.local_id} className="relative group">
                  <HiveCard hive={hive} lastInspectedAt={latest?.inspected_at} speciesName={species?.name} />
                  {canManage && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Excluir caixa "${hive.code}"?`)) deleteHive.mutate(hive.local_id);
                      }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-full bg-red-900/80 text-red-300 hover:bg-red-800 transition-all text-xs font-bold"
                      title="Excluir caixa"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal open={editApiary} onClose={() => setEditApiary(false)} title="Editar Meliponário">
        <ApiaryForm initial={apiary} onSuccess={() => setEditApiary(false)} onCancel={() => setEditApiary(false)} />
      </Modal>

      <Modal open={addHive} onClose={() => setAddHive(false)} title="Nova Caixa" size="lg">
        <HiveForm defaultApiaryId={id} onSuccess={() => setAddHive(false)} onCancel={() => setAddHive(false)} />
      </Modal>
    </div>
  );
}
