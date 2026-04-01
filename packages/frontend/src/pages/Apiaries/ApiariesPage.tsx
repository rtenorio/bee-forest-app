import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiaries, useDeleteApiary } from '@/hooks/useApiaries';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { ApiaryForm } from './ApiaryForm';
import type { Apiary } from '@bee-forest/shared';

export function ApiariesPage() {
  const navigate = useNavigate();
  const { data: apiaries = [], isLoading } = useApiaries();
  const deleteApiary = useDeleteApiary();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Apiary | null>(null);

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Meliponários</h1>
          <p className="text-stone-500 text-sm">{apiaries.length} apiário{apiaries.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          + Novo Meliponário
        </Button>
      </div>

      {apiaries.length === 0 ? (
        <EmptyState
          icon="🏡"
          title="Nenhum apiário cadastrado"
          description="Adicione seu primeiro apiário para começar a gerenciar suas colmeias."
          action={{ label: 'Adicionar Meliponário', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {apiaries.map((apiary) => (
            <Card key={apiary.local_id} hover onClick={() => navigate(`/apiaries/${apiary.local_id}`)}>
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-stone-100">{apiary.name}</h3>
                {apiary.is_dirty && <Badge variant="warning">Não sincronizado</Badge>}
              </div>
              {apiary.location && <p className="text-sm text-stone-400 mb-1">📍 {apiary.location}</p>}
              {apiary.owner_name && <p className="text-sm text-stone-500">👤 {apiary.owner_name}</p>}
              <div className="flex gap-2 mt-3 pt-3 border-t border-stone-800">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setEditing(apiary); setShowForm(true); }}
                >
                  Editar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Excluir "${apiary.name}"?`)) deleteApiary.mutate(apiary.local_id);
                  }}
                >
                  Excluir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Editar Meliponário' : 'Novo Meliponário'}
      >
        <ApiaryForm
          initial={editing ?? undefined}
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    </div>
  );
}
