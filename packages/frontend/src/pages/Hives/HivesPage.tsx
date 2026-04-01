import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHives, useDeleteHive } from '@/hooks/useHives';
import { useApiaries } from '@/hooks/useApiaries';
import { useInspections } from '@/hooks/useInspections';
import { useSpecies } from '@/hooks/useSpecies';
import { HiveCard } from '@/components/hive/HiveCard';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { HiveForm } from './HiveForm';
import type { HiveStatus } from '@bee-forest/shared';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'active', label: 'Ativas' },
  { value: 'inactive', label: 'Inativas' },
  { value: 'dead', label: 'Mortas' },
  { value: 'transferred', label: 'Transferidas' },
];

export function HivesPage() {
  const navigate = useNavigate();
  const { data: hives = [], isLoading } = useHives();
  const { data: apiaries = [] } = useApiaries();
  const { data: inspections = [] } = useInspections();
  const { data: speciesList = [] } = useSpecies();
  const [showForm, setShowForm] = useState(false);
  const [filterApiaryId, setFilterApiaryId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const apiaryOptions = [
    { value: '', label: 'Todos os meliponários' },
    ...apiaries.map((a) => ({ value: a.local_id, label: a.name })),
  ];

  const filtered = hives.filter((h) => {
    if (filterApiaryId && h.apiary_local_id !== filterApiaryId) return false;
    if (filterStatus && h.status !== filterStatus) return false;
    return true;
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Colmeias</h1>
          <p className="text-stone-500 text-sm">{filtered.length} de {hives.length} colmeia{hives.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowForm(true)}>+ Nova Colmeia</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select
          options={apiaryOptions}
          value={filterApiaryId}
          onChange={(e) => setFilterApiaryId(e.target.value)}
          className="flex-1 min-w-[160px]"
        />
        <Select
          options={STATUS_OPTIONS}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as HiveStatus | '')}
          className="flex-1 min-w-[140px]"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🏠"
          title={hives.length === 0 ? 'Nenhuma colmeia cadastrada' : 'Nenhuma colmeia encontrada'}
          description={hives.length === 0 ? 'Adicione a primeira colmeia.' : 'Tente outros filtros.'}
          action={hives.length === 0 ? { label: 'Adicionar Colmeia', onClick: () => setShowForm(true) } : undefined}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((hive) => {
            const hiveInspections = inspections.filter((i) => i.hive_local_id === hive.local_id);
            const latest = hiveInspections.sort((a, b) => b.inspected_at.localeCompare(a.inspected_at))[0];
            const species = speciesList.find((s) => s.local_id === hive.species_local_id);
            return (
              <HiveCard
                key={hive.local_id}
                hive={hive}
                lastInspectedAt={latest?.inspected_at}
                speciesName={species?.name}
              />
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nova Colmeia" size="lg">
        <HiveForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}
