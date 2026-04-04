import { useState } from 'react';
import { useProductions } from '@/hooks/useProductions';
import { useHives } from '@/hooks/useHives';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { ProductionForm } from './ProductionForm';
import { formatDate } from '@/utils/dates';
import { exportProductionsCSV } from '@/utils/export';

const PRODUCT_LABELS: Record<string, string> = {
  honey: '🍯 Mel',
  propolis: '🟫 Própolis',
  pollen: '🌼 Pólen',
  wax: '🕯️ Cera',
};

export function ProductionsPage() {
  const { data: productions = [], isLoading } = useProductions();
  const { data: hives = [] } = useHives();
  const [showForm, setShowForm] = useState(false);

  const totalHoney = productions.filter((p) => p.product_type === 'honey').reduce((a, p) => a + p.quantity_g, 0);
  const totalPropolis = productions.filter((p) => p.product_type === 'propolis').reduce((a, p) => a + p.quantity_g, 0);

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Produções</h1>
          <p className="text-stone-500 text-sm">{productions.length} registro{productions.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportProductionsCSV(productions)}>
            Exportar CSV
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>+ Registrar</Button>
        </div>
      </div>

      {/* Summary */}
      {productions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="text-center">
            <p className="text-2xl font-bold text-amber-400">{(totalHoney / 1000).toFixed(2)}kg</p>
            <p className="text-xs text-stone-500">Total de Mel</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl font-bold text-purple-400">{(totalPropolis / 1000).toFixed(2)}kg</p>
            <p className="text-xs text-stone-500">Total de Própolis</p>
          </Card>
        </div>
      )}

      {productions.length === 0 ? (
        <EmptyState
          icon="🍯"
          title="Nenhuma produção registrada"
          description="Registre as colheitas de mel, própolis, pólen e cera."
          action={{ label: 'Registrar Produção', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="space-y-2">
          {productions.map((p) => {
            const hive = hives.find((h) => h.local_id === p.hive_local_id);
            return (
              <Card key={p.local_id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-stone-100">
                      {PRODUCT_LABELS[p.product_type] ?? p.product_type} — {p.quantity_g}g
                    </p>
                    <p className="text-xs text-stone-500">
                      {hive?.code ?? 'Caixa de abelha desconhecida'} • {formatDate(p.harvested_at)}
                    </p>
                  </div>
                  {p.quality_grade && <Badge variant="amber">{p.quality_grade}</Badge>}
                </div>
                {p.notes && <p className="text-xs text-stone-500 italic mt-1">{p.notes}</p>}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Registrar Produção">
        <ProductionForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}
