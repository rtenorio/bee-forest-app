import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHarvests, useDeleteHarvest } from '@/hooks/useHarvests';
import { useApiaries } from '@/hooks/useApiaries';
import { useHives } from '@/hooks/useHives';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/utils/dates';
import type { Harvest } from '@bee-forest/shared';

// ─── Labels e helpers ─────────────────────────────────────────────────────────

const HONEY_TYPE_LABEL: Record<string, string> = {
  maturado: '✨ Maturado',
  vivo: '🌿 Vivo',
};

const VISUAL_ASPECT_LABEL: Record<string, string> = {
  clear: '💎 Límpido',
  cloudy: '🌫️ Turvo',
  crystallized: '❄️ Cristalizado',
};

const BUBBLES_LABEL: Record<string, string> = {
  none: '✅ Sem bolhas',
  few: '🟡 Poucas bolhas',
  many: '🔴 Muitas bolhas',
};

const PAPER_TEST_LABEL: Record<string, string> = {
  pass: '✅ Aprovado',
  fail: '❌ Reprovado',
};

const VISCOSITY_ICON: Record<number, string> = {
  1: '💧', 2: '🫗', 3: '🍯', 4: '🫙', 5: '🧱',
};

type QualityColor = 'success' | 'warning' | 'danger';

function qualityScore(h: Harvest): { color: QualityColor; label: string } | null {
  let score = 0;
  let total = 0;
  if (h.paper_test !== null) { total++; if (h.paper_test === 'pass') score++; }
  if (h.bubbles !== null) { total++; if (h.bubbles === 'none') score++; else if (h.bubbles === 'few') score += 0.5; }
  if (h.humidity_pct !== null) { total++; if (h.humidity_pct <= 30) score++; else if (h.humidity_pct <= 35) score += 0.5; }
  if (total === 0) return null;
  const pct = score / total;
  if (pct >= 0.8) return { color: 'success', label: 'Boa' };
  if (pct >= 0.5) return { color: 'warning', label: 'Regular' };
  return { color: 'danger', label: 'Atenção' };
}

// ─── Componente de card de colheita ───────────────────────────────────────────

function HarvestCard({
  harvest,
  apiaryName,
  hiveCount,
  onDelete,
}: {
  harvest: Harvest;
  apiaryName: string;
  hiveCount: number;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const quality = qualityScore(harvest);

  return (
    <Card className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-stone-100 text-base">
              {HONEY_TYPE_LABEL[harvest.honey_type] ?? harvest.honey_type}
            </p>
            {quality && (
              <Badge variant={quality.color}>
                {quality.label}
              </Badge>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            {apiaryName} · {formatDate(harvest.harvested_at)}
            {harvest.responsible_name && ` · ${harvest.responsible_name}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((o) => !o)}
          className="text-stone-500 hover:text-stone-300 text-xs px-2 py-1 rounded-lg border border-stone-700 hover:border-stone-600 transition-colors flex-shrink-0"
        >
          {expanded ? '▲ Menos' : '▼ Detalhes'}
        </button>
      </div>

      {/* Summary row */}
      <div className="flex flex-wrap gap-3">
        {hiveCount > 0 && (
          <span className="text-xs text-stone-400">
            🏠 {hiveCount} caixa{hiveCount > 1 ? 's' : ''}
          </span>
        )}
        {harvest.total_volume_ml !== null && (
          <span className="text-xs text-amber-400 font-medium">
            🫙 {harvest.total_volume_ml.toLocaleString('pt-BR')} mL
          </span>
        )}
        {harvest.total_weight_kg !== null && (
          <span className="text-xs text-amber-300 font-medium">
            ⚖️ {harvest.total_weight_kg.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg
          </span>
        )}
      </div>

      {/* Insumos fornecidos */}
      {(harvest.syrup_provided || harvest.pollen_ball_provided || harvest.wax_provided) && (
        <div className="flex flex-wrap gap-1.5">
          {harvest.syrup_provided && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-800/50">
              🍬 Xarope
            </span>
          )}
          {harvest.pollen_ball_provided && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-800/50">
              🌼 Pólen
            </span>
          )}
          {harvest.wax_provided && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-800/50">
              🕯️ Cera
            </span>
          )}
        </div>
      )}

      {/* Expanded quality details */}
      {expanded && (
        <div className="border-t border-stone-700 pt-3 space-y-2">
          <p className="text-xs font-medium text-stone-400">Parâmetros de qualidade</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {harvest.humidity_pct !== null && (
              <div className="bg-stone-800 rounded-lg px-3 py-2">
                <p className="text-stone-500">Umidade</p>
                <p className="text-stone-200 font-medium">{harvest.humidity_pct}%</p>
              </div>
            )}
            {harvest.brix !== null && (
              <div className="bg-stone-800 rounded-lg px-3 py-2">
                <p className="text-stone-500">Brix</p>
                <p className="text-stone-200 font-medium">{harvest.brix}°Bx</p>
              </div>
            )}
            {harvest.viscosity !== null && (
              <div className="bg-stone-800 rounded-lg px-3 py-2">
                <p className="text-stone-500">Viscosidade</p>
                <p className="text-stone-200 font-medium">
                  {VISCOSITY_ICON[harvest.viscosity]} {harvest.viscosity}/5
                </p>
              </div>
            )}
            {harvest.visual_aspect && (
              <div className="bg-stone-800 rounded-lg px-3 py-2">
                <p className="text-stone-500">Aspecto</p>
                <p className="text-stone-200 font-medium">{VISUAL_ASPECT_LABEL[harvest.visual_aspect]}</p>
              </div>
            )}
            {harvest.bubbles && (
              <div className="bg-stone-800 rounded-lg px-3 py-2 col-span-2">
                <p className="text-stone-500">Bolhas</p>
                <p className="text-stone-200 font-medium">{BUBBLES_LABEL[harvest.bubbles]}</p>
              </div>
            )}
            {harvest.paper_test && (
              <div className="bg-stone-800 rounded-lg px-3 py-2 col-span-2">
                <p className="text-stone-500">Teste do papel</p>
                <p className="text-stone-200 font-medium">{PAPER_TEST_LABEL[harvest.paper_test]}</p>
              </div>
            )}
          </div>
          {harvest.notes && (
            <p className="text-xs text-stone-500 italic">{harvest.notes}</p>
          )}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onDelete}
              className="text-xs text-red-500 hover:text-red-400 transition-colors"
            >
              Excluir colheita
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── HarvestsPage ─────────────────────────────────────────────────────────────

export function HarvestsPage() {
  const navigate = useNavigate();
  const { data: harvests = [], isLoading } = useHarvests();
  const { data: apiaries = [] } = useApiaries();
  const { data: hives = [] } = useHives();
  const deleteHarvest = useDeleteHarvest();

  const [filterApiary, setFilterApiary] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('all');

  // Opções de filtro
  const apiaryOptions = [
    { value: '', label: 'Todos os meliponários' },
    ...apiaries.map((a) => ({ value: a.local_id, label: a.name })),
  ];

  const periodOptions = [
    { value: 'all', label: 'Todos os períodos' },
    { value: '30', label: 'Últimos 30 dias' },
    { value: '90', label: 'Últimos 90 dias' },
    { value: '365', label: 'Este ano' },
  ];

  // Filtragem
  const filtered = harvests.filter((h) => {
    if (filterApiary && h.apiary_local_id !== filterApiary) return false;
    if (filterPeriod !== 'all') {
      const days = parseInt(filterPeriod, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      if (new Date(h.harvested_at) < cutoff) return false;
    }
    return true;
  });

  // Totais para o período filtrado
  const totalVolume = filtered.reduce((acc, h) => acc + (h.total_volume_ml ?? 0), 0);
  const totalWeight = filtered.reduce((acc, h) => acc + (h.total_weight_kg ?? 0), 0);

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Colheitas</h1>
          <p className="text-stone-500 text-sm">
            {harvests.length} registro{harvests.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" onClick={() => navigate('/harvests/new')}>
          + Nova Colheita
        </Button>
      </div>

      {/* Filtros */}
      {harvests.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Select
            label=""
            options={apiaryOptions}
            value={filterApiary}
            onChange={(e) => setFilterApiary(e.target.value)}
          />
          <Select
            label=""
            options={periodOptions}
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
          />
        </div>
      )}

      {/* Resumo do período */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center">
            <p className="text-2xl font-bold text-amber-400">{filtered.length}</p>
            <p className="text-xs text-stone-500">Colheitas</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl font-bold text-amber-300">
              {totalVolume >= 1000
                ? `${(totalVolume / 1000).toFixed(2)}L`
                : `${totalVolume.toFixed(0)}mL`}
            </p>
            <p className="text-xs text-stone-500">Volume total</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl font-bold text-amber-200">
              {totalWeight.toFixed(2)}kg
            </p>
            <p className="text-xs text-stone-500">Peso total</p>
          </Card>
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        harvests.length === 0 ? (
          <EmptyState
            icon="🍯"
            title="Nenhuma colheita registrada"
            description="Registre as colheitas de mel, incluindo parâmetros de qualidade e caixas colhidas."
            action={{ label: 'Registrar Colheita', onClick: () => navigate('/harvests/new') }}
          />
        ) : (
          <EmptyState
            icon="🔍"
            title="Nenhuma colheita neste filtro"
            description="Tente ampliar o período ou selecionar outro meliponário."
          />
        )
      ) : (
        <div className="space-y-3">
          {filtered.map((harvest) => {
            const apiary = apiaries.find((a) => a.local_id === harvest.apiary_local_id);
            const hiveCount = harvest.hive_local_ids?.length ?? 0;
            return (
              <HarvestCard
                key={harvest.local_id}
                harvest={harvest}
                apiaryName={apiary?.name ?? 'Meliponário desconhecido'}
                hiveCount={hiveCount}
                onDelete={() => deleteHarvest.mutate(harvest.local_id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
