import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBatches } from '@/hooks/useBatches';
import { useApiaries } from '@/hooks/useApiaries';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import type { HoneyBatch, BatchStatus } from '@bee-forest/shared';

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BatchStatus, { label: string; icon: string; variant: 'default' | 'warning' | 'success' | 'danger' | 'amber' }> = {
  collected:           { label: 'Coletado',          icon: '🫙', variant: 'default' },
  in_natura_ready:     { label: 'In natura pronto',  icon: '✅', variant: 'success' },
  in_dehumidification: { label: 'Desumidificando',   icon: '💨', variant: 'amber' },
  dehumidified:        { label: 'Desumidificado',    icon: '✅', variant: 'success' },
  in_maturation:       { label: 'Maturando',         icon: '🔄', variant: 'warning' },
  matured:             { label: 'Maturado',           icon: '✨', variant: 'success' },
  bottled:             { label: 'Envasado',           icon: '📦', variant: 'success' },
  sold:                { label: 'Vendido',            icon: '💰', variant: 'default' },
  rejected:            { label: 'Reprovado',          icon: '🚫', variant: 'danger' },
};

const ROUTE_LABEL: Record<string, string> = {
  in_natura:              '🌿 In natura',
  dehumidified:           '💨 Desumidificado',
  matured:                '✨ Maturado',
  dehumidified_then_matured: '💨✨ Desumid. + Maturado',
};

function alertLevel(batch: HoneyBatch): 'critical' | 'attention' | 'ok' {
  if (batch.initial_moisture != null && batch.initial_moisture > 30) return 'critical';
  if (batch.current_status === 'rejected') return 'critical';
  const updatedDaysAgo = (Date.now() - new Date(batch.updated_at).getTime()) / 86400000;
  const activeStatuses: BatchStatus[] = ['collected', 'in_natura_ready', 'in_dehumidification', 'dehumidified', 'in_maturation'];
  if (activeStatuses.includes(batch.current_status) && updatedDaysAgo > 7) return 'attention';
  return 'ok';
}

// ── BatchCard ─────────────────────────────────────────────────────────────────

function BatchCard({ batch, apiaryName }: { batch: HoneyBatch; apiaryName: string }) {
  const navigate = useNavigate();
  const cfg = STATUS_CONFIG[batch.current_status];
  const alert = alertLevel(batch);

  return (
    <button type="button" onClick={() => navigate(`/batches/${batch.local_id}`)} className="w-full text-left">
      <Card className="hover:border-amber-600/40 transition-colors group">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {alert === 'critical' && <span className="text-red-400 text-sm">🔴</span>}
              {alert === 'attention' && <span className="text-yellow-400 text-sm">🟡</span>}
              <p className="font-bold text-stone-100 font-mono text-sm">{batch.code}</p>
              <Badge variant={cfg.variant}>{cfg.icon} {cfg.label}</Badge>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              {apiaryName} · {new Date(batch.harvest_date).toLocaleDateString('pt-BR')}
              {batch.honey_type === 'maturado' ? ' · ✨ Maturado' : ' · 🌿 Vivo'}
            </p>
          </div>
          <span className="text-stone-600 group-hover:text-stone-400 transition-colors text-sm flex-shrink-0 mt-0.5">→</span>
        </div>

        <div className="flex flex-wrap gap-3 mt-2">
          {batch.net_weight_grams != null && (
            <span className="text-xs text-amber-400">⚖️ {(batch.net_weight_grams / 1000).toFixed(2)} kg</span>
          )}
          {batch.initial_moisture != null && (
            <span className={`text-xs font-medium ${batch.initial_moisture > 30 ? 'text-red-400' : batch.initial_moisture > 25 ? 'text-amber-400' : 'text-emerald-400'}`}>
              💧 {batch.initial_moisture}% umidade
            </span>
          )}
          {batch.initial_brix != null && (
            <span className="text-xs text-stone-400">{batch.initial_brix}°Bx</span>
          )}
          <span className="text-xs text-stone-500">{ROUTE_LABEL[batch.processing_route]}</span>
        </div>

        {alert === 'critical' && batch.initial_moisture != null && batch.initial_moisture > 30 && (
          <p className="text-xs text-red-400 mt-1.5">⚠️ Umidade crítica ({batch.initial_moisture}%) — risco de fermentação</p>
        )}
        {alert === 'attention' && (
          <p className="text-xs text-yellow-400 mt-1.5">⏳ Lote parado há mais de 7 dias sem ação</p>
        )}
      </Card>
    </button>
  );
}

// ── BatchesPage ───────────────────────────────────────────────────────────────

export function BatchesPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;
  const canCreate = user.role === 'socio' || user.role === 'responsavel' || user.role === 'master_admin';

  const { data: batches = [], isLoading } = useBatches();
  const { data: apiaries = [] } = useApiaries();

  const [filterApiary, setFilterApiary] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRoute, setFilterRoute] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('all');

  const apiaryOptions = [
    { value: '', label: 'Todos os meliponários' },
    ...apiaries.map((a) => ({ value: a.local_id, label: a.name })),
  ];

  const statusOptions = [
    { value: '', label: 'Qualquer status' },
    ...Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: `${c.icon} ${c.label}` })),
  ];

  const routeOptions = [
    { value: '', label: 'Qualquer rota' },
    { value: 'in_natura', label: '🌿 In natura' },
    { value: 'dehumidified', label: '💨 Desumidificado' },
    { value: 'matured', label: '✨ Maturado' },
    { value: 'dehumidified_then_matured', label: '💨✨ Desumid. + Maturado' },
  ];

  const periodOptions = [
    { value: 'all', label: 'Todos os períodos' },
    { value: '30', label: 'Últimos 30 dias' },
    { value: '90', label: 'Últimos 90 dias' },
    { value: '365', label: 'Este ano' },
  ];

  const filtered = batches.filter((b) => {
    if (filterApiary && b.apiary_local_id !== filterApiary) return false;
    if (filterStatus && b.current_status !== filterStatus) return false;
    if (filterRoute && b.processing_route !== filterRoute) return false;
    if (filterPeriod !== 'all') {
      const days = parseInt(filterPeriod, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      if (new Date(b.harvest_date) < cutoff) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => b.harvest_date.localeCompare(a.harvest_date));

  const activeCount = batches.filter((b) => !['sold', 'rejected'].includes(b.current_status)).length;
  const criticalCount = batches.filter((b) => alertLevel(b) === 'critical').length;
  const attentionCount = batches.filter((b) => alertLevel(b) === 'attention').length;

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Lotes de Mel</h1>
          <p className="text-stone-500 text-sm">
            {batches.length} lote{batches.length !== 1 ? 's' : ''} · {activeCount} ativo{activeCount !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => navigate('/batches/new')}>+ Novo Lote</Button>
        )}
      </div>

      {/* Alertas globais */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-900/30 border border-red-700/40 rounded-xl text-red-300 text-sm">
          🔴 {criticalCount} lote{criticalCount > 1 ? 's' : ''} com situação crítica
        </div>
      )}
      {attentionCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-900/20 border border-yellow-800/40 rounded-xl text-yellow-300 text-sm">
          🟡 {attentionCount} lote{attentionCount > 1 ? 's' : ''} parado{attentionCount > 1 ? 's' : ''} há mais de 7 dias
        </div>
      )}

      {/* Filtros */}
      {batches.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Select options={apiaryOptions} value={filterApiary} onChange={(e) => setFilterApiary(e.target.value)} />
          <Select options={statusOptions} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} />
          <Select options={routeOptions} value={filterRoute} onChange={(e) => setFilterRoute(e.target.value)} />
          <Select options={periodOptions} value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} />
        </div>
      )}

      {/* Lista */}
      {sorted.length === 0 ? (
        batches.length === 0 ? (
          <EmptyState
            icon="🍯"
            title="Nenhum lote de mel registrado"
            description="Registre um lote para acompanhar todo o processamento pós-colheita."
            action={canCreate ? { label: 'Novo Lote', onClick: () => navigate('/batches/new') } : undefined}
          />
        ) : (
          <EmptyState icon="🔍" title="Nenhum lote neste filtro" description="Tente ampliar os filtros." />
        )
      ) : (
        <div className="space-y-3">
          {sorted.map((batch) => {
            const apiary = apiaries.find((a) => a.local_id === batch.apiary_local_id);
            return (
              <BatchCard key={batch.local_id} batch={batch} apiaryName={apiary?.name ?? '—'} />
            );
          })}
        </div>
      )}
    </div>
  );
}
