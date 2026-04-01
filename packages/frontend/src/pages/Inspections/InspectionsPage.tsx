import { useNavigate } from 'react-router-dom';
import { useInspections } from '@/hooks/useInspections';
import { useHives } from '@/hooks/useHives';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime, formatDate } from '@/utils/dates';

const STRENGTH_LABELS = ['', 'Muito fraca', 'Fraca', 'Média', 'Forte', 'Muito forte'];

export function InspectionsPage() {
  const navigate = useNavigate();
  const { data: inspections = [], isLoading } = useInspections();
  const { data: hives = [] } = useHives();

  const sorted = [...inspections].sort((a, b) => b.inspected_at.localeCompare(a.inspected_at));

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Inspeções</h1>
          <p className="text-stone-500 text-sm">
            {inspections.length} inspeção{inspections.length !== 1 ? 'ões' : ''}
          </p>
        </div>
        <Button onClick={() => navigate('/inspections/new')}>+ Nova Inspeção</Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="Nenhuma inspeção registrada"
          description="Registre a primeira inspeção de uma caixa."
          action={{ label: 'Registrar Inspeção', onClick: () => navigate('/inspections/new') }}
        />
      ) : (
        <div className="space-y-3">
          {sorted.slice(0, 100).map((inspection) => {
            const hive = hives.find((h) => h.local_id === inspection.hive_local_id);
            const hasAlerts = inspection.checklist.pests_observed.length > 0
              || inspection.checklist.diseases_observed.length > 0;
            const hasMedia = inspection.photos.length > 0 || inspection.audio_notes?.length > 0;

            return (
              <Card
                key={inspection.local_id}
                hover
                onClick={() => hive && navigate(`/hives/${hive.local_id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-stone-100">
                        {hive?.code ?? '—'}
                      </p>
                      <span className="text-amber-400 text-sm" title={STRENGTH_LABELS[inspection.checklist.population_strength]}>
                        {'🐝'.repeat(inspection.checklist.population_strength)}
                      </span>
                      {hasAlerts && <span className="text-red-400 text-xs">⚠️ Alerta</span>}
                      {hasMedia && (
                        <span className="text-stone-500 text-xs flex gap-1">
                          {inspection.photos.length > 0 && `📷 ${inspection.photos.length}`}
                          {(inspection.audio_notes?.length ?? 0) > 0 && `🎙 ${inspection.audio_notes!.length}`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5">{formatDateTime(inspection.inspected_at)}</p>
                    {inspection.inspector_name && (
                      <p className="text-xs text-stone-500">por {inspection.inspector_name}</p>
                    )}
                  </div>
                  <div className="text-right text-xs text-stone-500 shrink-0 space-y-1">
                    {inspection.checklist.needs_feeding && (
                      <p className="text-orange-400">🌺 Alimentar</p>
                    )}
                    {inspection.checklist.needs_space_expansion && (
                      <p className="text-blue-400">📦 Expandir</p>
                    )}
                    {inspection.next_inspection_due && (
                      <p>Próxima: {formatDate(inspection.next_inspection_due)}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
