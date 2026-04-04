import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiaries, useDeleteApiary, useToggleApiaryStatus } from '@/hooks/useApiaries';
import { useHives } from '@/hooks/useHives';
import { useAuthStore } from '@/store/authStore';
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
  const user = useAuthStore((s) => s.user)!;
  const canManage = user.role === 'socio' || user.role === 'responsavel';

  const { data: apiaries = [], isLoading } = useApiaries();
  const { data: hives = [] } = useHives();
  const deleteApiary = useDeleteApiary();
  const toggleStatus = useToggleApiaryStatus();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Apiary | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  function openNew() { setEditing(null); setShowForm(true); }
  function openEdit(a: Apiary) { setEditing(a); setShowForm(true); }

  const filtered = apiaries.filter((a) =>
    statusFilter === 'all' ? true : (a.status ?? 'active') === statusFilter
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Meliponários</h1>
          <p className="text-stone-500 text-sm">
            {filtered.length} de {apiaries.length} meliponário{apiaries.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status filter */}
          <div className="flex gap-1">
            {(['active', 'inactive', 'all'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  statusFilter === s
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'border-stone-700 text-stone-400 hover:text-stone-200'
                }`}
              >
                {s === 'active' ? 'Ativos' : s === 'inactive' ? 'Inativos' : 'Todos'}
              </button>
            ))}
          </div>
          {canManage && (
            <Button onClick={openNew}>+ Novo Meliponário</Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🏡"
          title={statusFilter === 'inactive' ? 'Nenhum meliponário inativo' : 'Nenhum meliponário cadastrado'}
          description={statusFilter === 'inactive' ? 'Todos os meliponários estão ativos.' : 'Adicione o primeiro meliponário para começar a gerenciar suas caixas.'}
          action={canManage && statusFilter !== 'inactive' ? { label: 'Adicionar Meliponário', onClick: openNew } : undefined}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((apiary) => {
            const apiaryHives = hives.filter((h) => h.apiary_local_id === apiary.local_id);
            const activeCount = apiaryHives.filter((h) => h.status === 'active').length;
            const isInactive = (apiary.status ?? 'active') === 'inactive';

            return (
              <Card
                key={apiary.local_id}
                hover
                onClick={() => navigate(`/apiaries/${apiary.local_id}`)}
                className={isInactive ? 'opacity-60' : ''}
              >
                <div className="flex items-start justify-between mb-2 gap-2">
                  <h3 className="font-semibold text-stone-100 leading-snug">{apiary.name}</h3>
                  <div className="flex gap-1.5 shrink-0">
                    {isInactive && <Badge variant="default">Inativo</Badge>}
                    {apiary.is_dirty && <Badge variant="warning">Não sincronizado</Badge>}
                  </div>
                </div>

                {apiary.location && (
                  <p className="text-sm text-stone-400 mb-1">📍 {apiary.location}</p>
                )}
                {apiary.owner_name && (
                  <p className="text-sm text-stone-500 mb-3">👤 {apiary.owner_name}</p>
                )}

                {/* Hive count summary */}
                <div className="flex items-center gap-3 py-2 border-t border-stone-800 mb-2">
                  <div className="text-center flex-1">
                    <p className="text-lg font-bold text-amber-400">{apiaryHives.length}</p>
                    <p className="text-xs text-stone-500">caixas</p>
                  </div>
                  <div className="w-px h-8 bg-stone-800" />
                  <div className="text-center flex-1">
                    <p className="text-lg font-bold text-emerald-400">{activeCount}</p>
                    <p className="text-xs text-stone-500">ativas</p>
                  </div>
                  <div className="w-px h-8 bg-stone-800" />
                  <div className="text-center flex-1">
                    <p className="text-lg font-bold text-stone-400">{apiaryHives.length - activeCount}</p>
                    <p className="text-xs text-stone-500">inativas</p>
                  </div>
                </div>

                {canManage && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); openEdit(apiary); }}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStatus.mutate({ local_id: apiary.local_id, status: isInactive ? 'active' : 'inactive' });
                      }}
                    >
                      {isInactive ? 'Reativar' : 'Desativar'}
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
                )}
              </Card>
            );
          })}
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
