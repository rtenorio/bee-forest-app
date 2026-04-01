import { useState } from 'react';
import { useFeedings } from '@/hooks/useFeedings';
import { useHives } from '@/hooks/useHives';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { FeedingForm } from './FeedingForm';
import { formatDate } from '@/utils/dates';
import { exportFeedingsCSV } from '@/utils/export';

const FEED_LABELS: Record<string, string> = {
  sugar_syrup: '🍬 Xarope de açúcar',
  honey: '🍯 Mel diluído',
  pollen_sub: '🌺 Substituto de pólen',
  other: '🌿 Outro',
};

export function FeedingsPage() {
  const { data: feedings = [], isLoading } = useFeedings();
  const { data: hives = [] } = useHives();
  const [showForm, setShowForm] = useState(false);

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Alimentações</h1>
          <p className="text-stone-500 text-sm">{feedings.length} registro{feedings.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportFeedingsCSV(feedings)}>Exportar CSV</Button>
          <Button size="sm" onClick={() => setShowForm(true)}>+ Registrar</Button>
        </div>
      </div>

      {feedings.length === 0 ? (
        <EmptyState
          icon="🌺"
          title="Nenhuma alimentação registrada"
          description="Registre as alimentações para acompanhar o manejo das colmeias."
          action={{ label: 'Registrar Alimentação', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="space-y-2">
          {feedings.map((f) => {
            const hive = hives.find((h) => h.local_id === f.hive_local_id);
            return (
              <Card key={f.local_id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-stone-100">
                      {FEED_LABELS[f.feed_type] ?? f.feed_type}
                      {f.quantity_ml && <span className="text-stone-400 font-normal"> — {f.quantity_ml}ml</span>}
                    </p>
                    <p className="text-xs text-stone-500">
                      {hive?.code ?? 'Colmeia desconhecida'} • {formatDate(f.fed_at)}
                    </p>
                  </div>
                </div>
                {f.notes && <p className="text-xs text-stone-500 italic mt-1">{f.notes}</p>}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Registrar Alimentação">
        <FeedingForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}
