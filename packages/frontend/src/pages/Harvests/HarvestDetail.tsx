import { useParams, useNavigate } from 'react-router-dom';
import { useHarvest, useDeleteHarvest } from '@/hooks/useHarvests';
import { useHives } from '@/hooks/useHives';
import { useApiaries } from '@/hooks/useApiaries';
import { useAuthStore } from '@/store/authStore';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/utils/dates';

// ─── Labels ──────────────────────────────────────────────────────────────────

const HONEY_LABEL: Record<string, { icon: string; label: string }> = {
  vivo:     { icon: '🌿', label: 'Mel vivo' },
  maturado: { icon: '✨', label: 'Mel maturado' },
};

const MATURATION_CONFIG: Record<string, { icon: string; label: string; className: string }> = {
  aguardando_maturacao: { icon: '⏳', label: 'Aguardando maturação', className: 'border-amber-700/40 bg-amber-900/20 text-amber-300' },
  em_maturacao:         { icon: '🔄', label: 'Em maturação',         className: 'border-blue-700/40 bg-blue-900/20 text-blue-300' },
  concluido:            { icon: '✅', label: 'Maturação concluída',  className: 'border-emerald-700/40 bg-emerald-900/20 text-emerald-300' },
};

const VISUAL_LABEL: Record<string, string> = {
  clear: '💎 Límpido', cloudy: '🌫️ Turvo', crystallized: '❄️ Cristalizado',
};
const BUBBLES_LABEL: Record<string, string> = {
  none: '✅ Sem bolhas', few: '🟡 Poucas bolhas', many: '🔴 Muitas bolhas',
};
const PAPER_LABEL: Record<string, string> = {
  pass: '✅ Aprovado', fail: '❌ Reprovado',
};
const VISCOSITY_ICON: Record<number, string> = {
  1: '💧', 2: '🫗', 3: '🍯', 4: '🫙', 5: '🧱',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function HarvestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;
  const canManage = user.role === 'socio' || user.role === 'responsavel';

  const { data: harvest, isLoading } = useHarvest(id!);
  const { data: hives = [] } = useHives();
  const { data: apiaries = [] } = useApiaries();
  const deleteHarvest = useDeleteHarvest();

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!harvest) return (
    <div className="text-center py-16 space-y-4">
      <p className="text-stone-400">Colheita não encontrada.</p>
      <Button variant="secondary" onClick={() => navigate('/harvests')}>← Voltar</Button>
    </div>
  );

  const apiary = apiaries.find((a) => a.local_id === harvest.apiary_local_id);
  const honeyInfo = HONEY_LABEL[harvest.honey_type];
  const matConfig = harvest.maturation_status ? MATURATION_CONFIG[harvest.maturation_status] : null;

  // Per-hive volume rows
  const hiveRows = (harvest.hive_local_ids ?? []).map((hid) => ({
    hive: hives.find((h) => h.local_id === hid),
    volume: (harvest.hive_volumes as Record<string, number> | null)?.[hid] ?? null,
  }));

  const hasQuality = harvest.brix !== null || harvest.humidity_pct !== null
    || harvest.viscosity !== null || harvest.visual_aspect || harvest.bubbles || harvest.paper_test;

  const hasInputs = harvest.syrup_provided || harvest.pollen_ball_provided || harvest.wax_provided;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="text-stone-400 hover:text-stone-100 transition-colors text-sm">
            ← Voltar
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-stone-100">
                {honeyInfo?.icon} {honeyInfo?.label ?? harvest.honey_type}
              </h1>
              {harvest.is_dirty && <Badge variant="warning">Não sincronizado</Badge>}
            </div>
            <p className="text-stone-500 text-sm mt-0.5">
              {apiary?.name ?? '—'} · {formatDate(harvest.harvested_at)}
              {harvest.responsible_name && ` · ${harvest.responsible_name}`}
            </p>
          </div>
        </div>

        {canManage && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (confirm('Excluir esta colheita? Esta ação não pode ser desfeita.')) {
                deleteHarvest.mutate(harvest.local_id, {
                  onSuccess: () => navigate('/harvests'),
                });
              }
            }}
          >
            Excluir
          </Button>
        )}
      </div>

      {/* Maturation banner */}
      {matConfig && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${matConfig.className}`}>
          <span className="text-2xl flex-shrink-0">{matConfig.icon}</span>
          <div>
            <p className="text-sm font-semibold">{matConfig.label}</p>
            {harvest.honey_type === 'maturado' && harvest.maturation_status === 'aguardando_maturacao' && (
              <p className="text-xs opacity-80 mt-0.5">
                Este lote aguarda o processo de maturação antes de ser adicionado ao estoque.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Volume & hives summary */}
      <Card>
        <CardHeader><CardTitle>Caixas e Volumes</CardTitle></CardHeader>
        <div className="divide-y divide-stone-800 mt-1">
          {hiveRows.map(({ hive, volume }, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-stone-500">🏠</span>
                <span className="text-stone-200">{hive?.code ?? '—'}</span>
              </div>
              <span className="text-amber-400 font-medium">
                {volume !== null ? `${volume.toLocaleString('pt-BR')} mL` : '—'}
              </span>
            </div>
          ))}
          {hiveRows.length === 0 && (
            <p className="text-stone-500 text-sm py-4 text-center">Nenhuma caixa registrada</p>
          )}
        </div>

        {/* Totals */}
        {(harvest.total_volume_ml !== null || harvest.total_weight_kg !== null) && (
          <div className="border-t border-stone-800 pt-3 mt-1 grid grid-cols-2 gap-3">
            {harvest.total_volume_ml !== null && (
              <div className="bg-stone-800/60 rounded-xl p-3 text-center">
                <p className="text-xs text-stone-500">Volume total</p>
                <p className="text-xl font-bold text-amber-400">
                  {harvest.total_volume_ml >= 1000
                    ? `${(harvest.total_volume_ml / 1000).toFixed(2)} L`
                    : `${harvest.total_volume_ml.toLocaleString('pt-BR')} mL`}
                </p>
              </div>
            )}
            {harvest.total_weight_kg !== null && (
              <div className="bg-stone-800/60 rounded-xl p-3 text-center">
                <p className="text-xs text-stone-500">Peso total</p>
                <p className="text-xl font-bold text-amber-300">
                  {harvest.total_weight_kg.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Quality parameters */}
      {hasQuality && (
        <Card>
          <CardHeader><CardTitle>🔬 Parâmetros de Qualidade</CardTitle></CardHeader>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {harvest.brix !== null && (
              <div className="bg-stone-800 rounded-xl px-3 py-2.5">
                <p className="text-xs text-stone-500">Brix</p>
                <p className="text-lg font-bold text-amber-400">{harvest.brix}°Bx</p>
              </div>
            )}
            {harvest.humidity_pct !== null && (
              <div className="bg-stone-800 rounded-xl px-3 py-2.5">
                <p className="text-xs text-stone-500">Umidade</p>
                <p className={`text-lg font-bold ${harvest.humidity_pct <= 30 ? 'text-emerald-400' : harvest.humidity_pct <= 35 ? 'text-amber-400' : 'text-red-400'}`}>
                  {harvest.humidity_pct}%
                </p>
              </div>
            )}
            {harvest.viscosity !== null && (
              <div className="bg-stone-800 rounded-xl px-3 py-2.5">
                <p className="text-xs text-stone-500">Viscosidade</p>
                <p className="text-lg font-bold text-stone-200">
                  {VISCOSITY_ICON[harvest.viscosity]} {harvest.viscosity}/5
                </p>
              </div>
            )}
            {harvest.visual_aspect && (
              <div className="bg-stone-800 rounded-xl px-3 py-2.5">
                <p className="text-xs text-stone-500">Aspecto</p>
                <p className="text-sm font-medium text-stone-200">{VISUAL_LABEL[harvest.visual_aspect]}</p>
              </div>
            )}
            {harvest.bubbles && (
              <div className="bg-stone-800 rounded-xl px-3 py-2.5 col-span-2">
                <p className="text-xs text-stone-500">Bolhas</p>
                <p className="text-sm font-medium text-stone-200">{BUBBLES_LABEL[harvest.bubbles]}</p>
              </div>
            )}
            {harvest.paper_test && (
              <div className="bg-stone-800 rounded-xl px-3 py-2.5 col-span-2">
                <p className="text-xs text-stone-500">Teste do papel</p>
                <p className="text-sm font-medium text-stone-200">{PAPER_LABEL[harvest.paper_test]}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Inputs */}
      {hasInputs && (
        <Card>
          <CardHeader><CardTitle>🌺 Insumos Fornecidos</CardTitle></CardHeader>
          <div className="flex flex-wrap gap-2 mt-2">
            {harvest.syrup_provided && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-900/30 border border-emerald-800/50 text-emerald-300">
                🍬 Xarope
              </span>
            )}
            {harvest.pollen_ball_provided && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-900/30 border border-emerald-800/50 text-emerald-300">
                🌼 Bolinhos de pólen
              </span>
            )}
            {harvest.wax_provided && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-900/30 border border-emerald-800/50 text-emerald-300">
                🕯️ Cera
              </span>
            )}
          </div>
          {harvest.input_notes && (
            <p className="text-sm text-stone-400 mt-3 italic">"{harvest.input_notes}"</p>
          )}
        </Card>
      )}

      {/* Notes */}
      {harvest.notes && (
        <Card>
          <CardHeader><CardTitle>📝 Observações</CardTitle></CardHeader>
          <p className="text-sm text-stone-300 mt-2 leading-relaxed">{harvest.notes}</p>
        </Card>
      )}

      {/* Criar lote de maturação */}
      {harvest.honey_type === 'maturado' && canManage && (
        <Card>
          <CardHeader><CardTitle>🍯 Lote de Processamento</CardTitle></CardHeader>
          <div className="flex items-center justify-between gap-4 mt-2">
            <p className="text-sm text-stone-400">Mel maturado pode ser vinculado a um lote de pós-colheita para acompanhamento completo.</p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/batches/new?harvest=${harvest.local_id}&apiary=${harvest.apiary_local_id}&date=${harvest.harvested_at?.slice(0, 10) ?? ''}`)}
              className="shrink-0"
            >
              + Criar lote
            </Button>
          </div>
        </Card>
      )}

      {/* Metadata */}
      <p className="text-xs text-stone-600 text-center pb-4">
        Registrado em {formatDate(harvest.created_at)}
        {harvest.is_dirty ? ' · pendente de sincronização' : ''}
      </p>
    </div>
  );
}
