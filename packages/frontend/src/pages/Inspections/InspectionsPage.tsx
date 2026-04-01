import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspections } from '@/hooks/useInspections';
import { useHives } from '@/hooks/useHives';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { InspectionForm } from './InspectionForm';
import { formatDateTime, formatDate } from '@/utils/dates';

export function InspectionsPage() {
  const navigate = useNavigate();
  const { data: inspections = [], isLoading } = useInspections();
  const { data: hives = [] } = useHives();
  const [showForm, setShowForm] = useState(false);

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Inspeções</h1>
          <p className="text-stone-500 text-sm">{inspections.length} inspeção{inspections.length !== 1 ? 'ões' : ''}</p>
        </div>
        <Button onClick={() => setShowForm(true)}>+ Nova Inspeção</Button>
      </div>

      {inspections.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="Nenhuma inspeção registrada"
          description="Registre a primeira inspeção de uma colmeia."
          action={{ label: 'Registrar Inspeção', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="space-y-3">
          {inspections.slice(0, 50).map((inspection) => {
            const hive = hives.find((h) => h.local_id === inspection.hive_local_id);
            return (
              <Card
                key={inspection.local_id}
                hover
                onClick={() => hive && navigate(`/hives/${hive.local_id}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-stone-100">
                        {hive?.code ?? 'Colmeia desconhecida'}
                      </p>
                      <span className="text-amber-400 text-sm">
                        {'🐝'.repeat(inspection.checklist.population_strength)}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500">{formatDateTime(inspection.inspected_at)}</p>
                    {inspection.inspector_name && (
                      <p className="text-xs text-stone-500">por {inspection.inspector_name}</p>
                    )}
                  </div>
                  <div className="text-right text-xs space-y-1">
                    {inspection.checklist.needs_feeding && (
                      <p className="text-orange-400">🌺 Precisa alimentar</p>
                    )}
                    {inspection.checklist.pests_observed.length > 0 && (
                      <p className="text-red-400">⚠️ Pragas detectadas</p>
                    )}
                    {inspection.next_inspection_due && (
                      <p className="text-stone-400">Próxima: {formatDate(inspection.next_inspection_due)}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nova Inspeção" size="lg">
        <InspectionForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}
