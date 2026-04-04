import { useNavigate } from 'react-router-dom';
import { useQualitySummary } from '@/hooks/useBatches';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import type { HoneyBatch } from '@bee-forest/shared';
import type { QualitySummary } from '@/hooks/useBatches';

type AttentionBatch = QualitySummary['attention'][number];
type ProcessingBatch = QualitySummary['in_processing'][number];

const STATUS_LABEL: Record<string, { label: string; icon: string }> = {
  collected:           { label: 'Coletado',         icon: '🫙' },
  in_natura_ready:     { label: 'In natura pronto', icon: '✅' },
  in_dehumidification: { label: 'Desumidificando',  icon: '💨' },
  dehumidified:        { label: 'Desumidificado',   icon: '✅' },
  in_maturation:       { label: 'Maturando',        icon: '🔄' },
  matured:             { label: 'Maturado',         icon: '✨' },
  bottled:             { label: 'Envasado',         icon: '📦' },
  sold:                { label: 'Vendido',          icon: '💰' },
  rejected:            { label: 'Reprovado',        icon: '🚫' },
};

function BatchCard({ batch, alerts }: { batch: HoneyBatch & { apiary_name: string | null }; alerts?: React.ReactNode }) {
  const navigate = useNavigate();
  const cfg = STATUS_LABEL[batch.current_status] ?? { label: batch.current_status, icon: '•' };
  return (
    <div
      className="flex items-start justify-between py-2.5 px-3 bg-stone-800/50 rounded-xl cursor-pointer hover:bg-stone-800 transition-colors gap-3"
      onClick={() => navigate(`/batches/${batch.local_id}`)}
    >
      <div className="min-w-0">
        <p className="text-sm font-mono font-medium text-stone-100">{batch.code}</p>
        <p className="text-xs text-stone-500">{batch.apiary_name ?? '—'} · {new Date(batch.harvest_date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
        {alerts}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-base">{cfg.icon}</span>
        <span className="text-xs text-stone-400">{cfg.label}</span>
      </div>
    </div>
  );
}

function AttentionBatchCard({ batch }: { batch: AttentionBatch }) {
  return (
    <BatchCard
      batch={batch}
      alerts={
        <div className="flex flex-wrap gap-1.5 mt-1">
          {batch.has_fermentation_signs && (
            <span className="text-xs text-red-400 font-medium">🚨 Fermentação detectada</span>
          )}
          {batch.high_moisture && (
            <span className="text-xs text-amber-400">💧 Umidade alta ({batch.initial_moisture}%)</span>
          )}
          {batch.stale && (
            <span className="text-xs text-amber-400">⏰ Parado há mais de 7 dias</span>
          )}
        </div>
      }
    />
  );
}

export function BatchQualityPage() {
  const { data, isLoading } = useQualitySummary();

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!data) return null;

  const { attention, in_processing, ready_for_next, stats } = data;
  const criticalCount = attention.filter((b) => b.has_fermentation_signs).length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-stone-100">Painel de Qualidade</h1>
        <p className="text-stone-500 text-sm mt-1">Monitoramento em tempo real dos lotes de mel</p>
      </div>

      {/* Critical alert banner */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-red-700/40 bg-red-900/20 text-red-300">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="text-sm font-semibold">
              {criticalCount} lote{criticalCount > 1 ? 's' : ''} com sinais de fermentação
            </p>
            <p className="text-xs opacity-80 mt-0.5">Verifique imediatamente os lotes em atenção abaixo.</p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-stone-800/60 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{stats.active}</p>
          <p className="text-xs text-stone-500 mt-1">Lotes ativos</p>
        </div>
        <div className="bg-stone-800/60 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{in_processing.length}</p>
          <p className="text-xs text-stone-500 mt-1">Em processamento</p>
        </div>
        <div className="bg-stone-800/60 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{stats.sold}</p>
          <p className="text-xs text-stone-500 mt-1">Vendidos</p>
        </div>
        <div className={`bg-stone-800/60 rounded-xl p-4 text-center ${attention.length > 0 ? 'ring-1 ring-amber-500/50' : ''}`}>
          <p className={`text-2xl font-bold ${attention.length > 0 ? 'text-amber-400' : 'text-stone-400'}`}>
            {attention.length}
          </p>
          <p className="text-xs text-stone-500 mt-1">Em atenção</p>
        </div>
      </div>

      {/* Lotes em atenção */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <span>⚠️ Lotes em Atenção</span>
              {attention.length > 0 && <Badge variant={criticalCount > 0 ? 'danger' : 'warning'}>{attention.length}</Badge>}
            </span>
          </CardTitle>
        </CardHeader>
        {attention.length === 0 ? (
          <p className="text-stone-500 text-sm mt-2">Nenhum lote requer atenção</p>
        ) : (
          <div className="space-y-2 mt-2">
            {attention.map((b) => <AttentionBatchCard key={b.local_id} batch={b} />)}
          </div>
        )}
      </Card>

      {/* Em processamento */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <span>🔄 Em Processamento</span>
              {in_processing.length > 0 && <Badge variant="amber">{in_processing.length}</Badge>}
            </span>
          </CardTitle>
        </CardHeader>
        {in_processing.length === 0 ? (
          <p className="text-stone-500 text-sm mt-2">Nenhum lote em processamento ativo</p>
        ) : (
          <div className="space-y-2 mt-2">
            {in_processing.map((b) => <BatchCard key={b.local_id} batch={b} />)}
          </div>
        )}
      </Card>

      {/* Prontos para avançar */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <span>✅ Prontos para Avançar</span>
              {ready_for_next.length > 0 && <Badge variant="success">{ready_for_next.length}</Badge>}
            </span>
          </CardTitle>
        </CardHeader>
        {ready_for_next.length === 0 ? (
          <p className="text-stone-500 text-sm mt-2">Nenhum lote aguardando próxima etapa</p>
        ) : (
          <div className="space-y-2 mt-2">
            {ready_for_next.map((b) => <BatchCard key={b.local_id} batch={b} />)}
          </div>
        )}
      </Card>

      <p className="text-xs text-stone-600 text-center pb-4">Atualizado automaticamente a cada 60 segundos</p>
    </div>
  );
}
