import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSpecies, useCreateSpecies, useDeleteSpecies } from '@/hooks/useSpecies';
import { useUIStore } from '@/store/uiStore';
import { useSyncStore } from '@/store/syncStore';
import { useSync } from '@/hooks/useSync';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatDateTime } from '@/utils/dates';
import { SpeciesCreateSchema } from '@bee-forest/shared';
import { apiaryRepo } from '@/db/repositories/apiary.repository';
import { hiveRepo } from '@/db/repositories/hive.repository';
import { speciesRepo } from '@/db/repositories/species.repository';
import { inspectionRepo } from '@/db/repositories/inspection.repository';
import { productionRepo } from '@/db/repositories/production.repository';
import { feedingRepo } from '@/db/repositories/feeding.repository';
import { harvestRepo } from '@/db/repositories/harvest.repository';
import { batchRepo } from '@/db/repositories/batch.repository';
import { stockRepo } from '@/db/repositories/stock.repository';

function SpeciesManager() {
  const { data: speciesList = [] } = useSpecies();
  const createSpecies = useCreateSpecies();
  const deleteSpecies = useDeleteSpecies();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', scientific_name: '', description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const result = SpeciesCreateSchema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => { errs[e.path[0]] = e.message; });
      setErrors(errs);
      return;
    }
    await createSpecies.mutateAsync(result.data);
    setForm({ name: '', scientific_name: '', description: '' });
    setShowAdd(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Espécies de Abelhas</CardTitle>
        <Button size="sm" onClick={() => setShowAdd(true)}>+ Adicionar</Button>
      </CardHeader>
      <div className="space-y-2">
        {speciesList.map((s) => (
          <div key={s.local_id} className="flex items-center justify-between py-2 border-b border-stone-800 last:border-0">
            <div>
              <p className="font-medium text-stone-200">{s.name}</p>
              {s.scientific_name && <p className="text-xs text-stone-500 italic">{s.scientific_name}</p>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => {
              if (confirm(`Excluir espécie "${s.name}"?`)) deleteSpecies.mutate(s.local_id);
            }}>×</Button>
          </div>
        ))}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Nova Espécie">
        <form onSubmit={handleAdd} className="space-y-4">
          <Input label="Nome Popular *" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} error={errors.name} placeholder="ex: Jataí" />
          <Input label="Nome Científico" value={form.scientific_name} onChange={(e) => setForm(f => ({ ...f, scientific_name: e.target.value }))} placeholder="ex: Tetragonisca angustula" />
          <Textarea label="Descrição" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="flex gap-3">
            <Button type="submit" loading={createSpecies.isPending} className="flex-1">Adicionar Espécie</Button>
            <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

async function clearAllLocalDirty() {
  await Promise.all([
    apiaryRepo.clearAllDirty(),
    hiveRepo.clearAllDirty(),
    speciesRepo.clearAllDirty(),
    inspectionRepo.clearAllDirty(),
    productionRepo.clearAllDirty(),
    feedingRepo.clearAllDirty(),
    harvestRepo.clearAllDirty(),
    batchRepo.clearAllDirty(),
    stockRepo.clearAllDirty(),
  ]);
}

function SyncSettings() {
  const { isSyncing, pendingCount, lastSyncAt, lastError } = useSyncStore();
  const { triggerSync } = useSync();
  const isOnline = useOnlineStatus();
  const qc = useQueryClient();
  const [clearing, setClearing] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sincronização</CardTitle>
      </CardHeader>
      <div className="space-y-3">
        <div className="flex items-center justify-between py-2">
          <span className="text-stone-400 text-sm">Status</span>
          <Badge variant={isOnline ? 'success' : 'default'}>{isOnline ? 'Online' : 'Offline'}</Badge>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-stone-400 text-sm">Alterações pendentes</span>
          <Badge variant={pendingCount > 0 ? 'warning' : 'success'}>{pendingCount}</Badge>
        </div>
        {lastSyncAt && (
          <div className="flex items-center justify-between py-2">
            <span className="text-stone-400 text-sm">Última sincronização</span>
            <span className="text-stone-300 text-sm">{formatDateTime(lastSyncAt)}</span>
          </div>
        )}
        {lastError && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-sm text-red-300">
            {lastError}
          </div>
        )}
        <Button
          onClick={triggerSync}
          loading={isSyncing}
          disabled={!isOnline || isSyncing}
          className="w-full"
        >
          Sincronizar Agora
        </Button>
        <Button
          variant="secondary"
          loading={clearing}
          className="w-full"
          onClick={async () => {
            setClearing(true);
            try {
              await clearAllLocalDirty();
              qc.invalidateQueries();
            } finally {
              setClearing(false);
            }
          }}
        >
          Limpar badges "Não sincronizado"
        </Button>
      </div>
    </Card>
  );
}

function ProfileSettings() {
  const { inspectorName, setInspectorName } = useUIStore();
  return (
    <Card>
      <CardHeader><CardTitle>Perfil</CardTitle></CardHeader>
      <Input
        label="Nome do Inspetor"
        value={inspectorName}
        onChange={(e) => setInspectorName(e.target.value)}
        placeholder="Seu nome para inspeções"
        hint="Preenchido automaticamente nos formulários de inspeção"
      />
    </Card>
  );
}

export function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-stone-100">Configurações</h1>
        <p className="text-stone-500 text-sm">Gerencie espécies, sincronização e preferências</p>
      </div>

      <ProfileSettings />
      <SyncSettings />

      <Card>
        <CardHeader><CardTitle>Notificações</CardTitle></CardHeader>
        <p className="text-sm text-stone-400 mb-3">Configure alertas push e WhatsApp para eventos do meliponário.</p>
        <Link
          to="/settings/notifications"
          className="inline-flex items-center gap-2 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm rounded-lg transition-colors"
        >
          🔔 Configurar notificações →
        </Link>
      </Card>

      <SpeciesManager />

      <Card>
        <CardHeader><CardTitle>Sobre o App</CardTitle></CardHeader>
        <div className="space-y-1 text-sm text-stone-400">
          <p className="flex items-center gap-1.5"><img src="/bee-icon.png" alt="" style={{ width: '16px', height: '16px', objectFit: 'contain' }} /> Bee Forest - Sistema de Gestão de Meliponários</p>
          <p>Versão 1.0.0</p>
          <p className="text-stone-600 text-xs mt-2">
            Funciona 100% offline. Dados sincronizados automaticamente quando online.
          </p>
        </div>
      </Card>
    </div>
  );
}
