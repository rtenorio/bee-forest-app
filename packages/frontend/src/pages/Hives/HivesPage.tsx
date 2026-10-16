import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHives, useDeleteHive } from '@/hooks/useHives';
import { useApiaries } from '@/hooks/useApiaries';
import { useInspections } from '@/hooks/useInspections';
import { useSpecies } from '@/hooks/useSpecies';
import { useAuthStore } from '@/store/authStore';
import { HiveCard } from '@/components/hive/HiveCard';
import { HiveBulkBar, HiveSelectOverlay, HiveSelectToolbar } from '@/components/hive/HiveBulkActions';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { HiveForm } from './HiveForm';
import type { Hive, HiveStatus } from '@bee-forest/shared';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'active', label: 'Ativas' },
  { value: 'inactive', label: 'Inativas' },
  { value: 'dead', label: 'Mortas' },
  { value: 'transferred', label: 'Transferidas' },
];

export function HivesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user)!;
  // master_admin gerencia caixas de qualquer meliponário (o backend já libera).
  const canManage = ['master_admin', 'socio', 'responsavel'].includes(user.role);

  const { data: hives = [], isLoading } = useHives();
  const { data: apiaries = [] } = useApiaries();
  const { data: inspections = [] } = useInspections();
  const { data: speciesList = [] } = useSpecies();
  const deleteHive = useDeleteHive();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Hive | null>(null);

  // Respect ?apiary= URL param (used by ResponsavelDashboard and ApiaryDetail)
  const [filterApiaryId, setFilterApiaryId] = useState(searchParams.get('apiary') ?? '');
  const [filterStatus, setFilterStatus] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const apiaryOptions = [
    { value: '', label: 'Todos os meliponários' },
    ...apiaries.map((a) => ({ value: a.local_id, label: a.name })),
  ];

  const filtered = hives
    .filter((h) => {
      if (filterApiaryId && h.apiary_local_id !== filterApiaryId) return false;
      if (filterStatus && h.status !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  // Ações em lote valem só para as caixas visíveis no filtro atual.
  const selectedVisible = filtered.filter((h) => selectedIds.includes(h.local_id));
  const toggleSelected = (id: string) =>
    setSelectedIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  const exitSelecting = () => { setSelecting(false); setSelectedIds([]); };

  function openNew() { setEditing(null); setShowForm(true); }
  function openEdit(h: Hive) { setEditing(h); setShowForm(true); }

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className={selecting ? 'space-y-6 pb-32' : 'space-y-6'}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Caixas</h1>
          <p className="text-stone-500 text-sm">
            {filtered.length} de {hives.length} caixa{hives.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {!selecting && hives.length > 0 && (
              <Button variant="secondary" onClick={() => setSelecting(true)}>Selecionar</Button>
            )}
            <Button onClick={openNew}>+ Nova Caixa</Button>
          </div>
        )}
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

      {selecting && (
        <HiveSelectToolbar
          total={filtered.length}
          selected={selectedVisible.length}
          onSelectAll={() => setSelectedIds(filtered.map((h) => h.local_id))}
          onClear={() => setSelectedIds([])}
          onExit={exitSelecting}
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon="🏠"
          title={hives.length === 0 ? 'Nenhuma caixa cadastrada' : 'Nenhuma caixa encontrada'}
          description={hives.length === 0 ? 'Adicione a primeira caixa.' : 'Tente outros filtros.'}
          action={canManage && hives.length === 0 ? { label: 'Adicionar Caixa', onClick: openNew } : undefined}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((hive) => {
            const hiveInspections = inspections.filter((i) => i.hive_local_id === hive.local_id);
            const latest = hiveInspections.sort((a, b) => b.inspected_at.localeCompare(a.inspected_at))[0];
            const species = speciesList.find((s) => s.local_id === hive.species_local_id);
            return (
              <div key={hive.local_id} className="relative group">
                <HiveCard
                  hive={hive}
                  lastInspectedAt={latest?.inspected_at}
                  speciesName={species?.name}
                />
                {selecting ? (
                  <HiveSelectOverlay
                    code={hive.code}
                    checked={selectedIds.includes(hive.local_id)}
                    onToggle={() => toggleSelected(hive.local_id)}
                  />
                ) : canManage && (
                  // Em tela de toque não há hover: os botões ficam sempre visíveis.
                  <div className="absolute top-2 right-2 flex gap-1 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(hive); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-stone-700/90 text-stone-300 hover:bg-stone-600 text-xs"
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Excluir caixa "${hive.code}"?`)) deleteHive.mutate(hive.local_id);
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-900/80 text-red-300 hover:bg-red-800 text-xs font-bold"
                      title="Excluir"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selecting && <HiveBulkBar selected={selectedVisible} onDone={exitSelecting} />}

      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        title={editing ? 'Editar Caixa' : 'Nova Caixa'}
        size="lg"
      >
        <HiveForm
          initial={editing ?? undefined}
          defaultApiaryId={filterApiaryId || undefined}
          onSuccess={() => { setShowForm(false); setEditing(null); }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      </Modal>
    </div>
  );
}
