import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHarvests } from '@/hooks/useHarvests';
import { useApiaries } from '@/hooks/useApiaries';
import { useHives } from '@/hooks/useHives';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/utils/dates';
import type { Harvest } from '@bee-forest/shared';

// ─── Labels / helpers ─────────────────────────────────────────────────────────

const HONEY_TYPE_LABEL: Record<string, string> = {
  maturado: '✨ Maturado',
  vivo:     '🌿 Vivo',
};

const MATURATION_BADGE: Record<string, { label: string; variant: 'warning' | 'amber' | 'success' }> = {
  aguardando_maturacao: { label: 'Maturando', variant: 'warning' },
  em_maturacao:         { label: 'Em maturação', variant: 'amber' },
  concluido:            { label: 'Concluído', variant: 'success' },
};

type QualityColor = 'success' | 'warning' | 'danger';

function qualityScore(h: Harvest): { color: QualityColor; label: string } | null {
  let score = 0;
  let total = 0;
  if (h.paper_test !== null)    { total++; if (h.paper_test === 'pass') score++; }
  if (h.bubbles !== null)       { total++; if (h.bubbles === 'none') score++; else if (h.bubbles === 'few') score += 0.5; }
  if (h.humidity_pct !== null)  { total++; if (h.humidity_pct <= 30) score++; else if (h.humidity_pct <= 35) score += 0.5; }
  if (total === 0) return null;
  const pct = score / total;
  if (pct >= 0.8) return { color: 'success', label: 'Boa qualidade' };
  if (pct >= 0.5) return { color: 'warning', label: 'Qualidade regular' };
  return { color: 'danger', label: 'Atenção' };
}

// ─── HarvestCard ──────────────────────────────────────────────────────────────

function HarvestCard({
  harvest, apiaryName, hiveCount,
}: {
  harvest: Harvest; apiaryName: string; hiveCount: number;
}) {
  const navigate = useNavigate();
  const quality = qualityScore(harvest);
  const matBadge = harvest.maturation_status ? MATURATION_BADGE[harvest.maturation_status] : null;

  return (
    <button
      type="button"
      onClick={() => navigate(`/harvests/${harvest.local_id}`)}
      className="w-full text-left"
    >
      <Card className="hover:border-amber-600/40 transition-colors group">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-stone-100 text-base">
                {HONEY_TYPE_LABEL[harvest.honey_type] ?? harvest.honey_type}
              </p>
              {quality && <Badge variant={quality.color}>{quality.label}</Badge>}
              {matBadge && <Badge variant={matBadge.variant}>{matBadge.label}</Badge>}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              {apiaryName} · {formatDate(harvest.harvested_at)}
              {harvest.responsible_name && ` · ${harvest.responsible_name}`}
            </p>
          </div>
          <span className="text-stone-600 group-hover:text-stone-400 transition-colors text-sm flex-shrink-0 mt-0.5">
            →
          </span>
        </div>

        {/* Summary */}
        <div className="flex flex-wrap gap-3 mt-2">
          {hiveCount > 0 && (
            <span className="text-xs text-stone-400">
              🏠 {hiveCount} caixa{hiveCount > 1 ? 's' : ''}
            </span>
          )}
          {harvest.total_volume_ml !== null && (
            <span className="text-xs text-amber-400 font-medium">
              🫙 {harvest.total_volume_ml >= 1000
                ? `${(harvest.total_volume_ml / 1000).toFixed(2)} L`
                : `${harvest.total_volume_ml.toLocaleString('pt-BR')} mL`}
            </span>
          )}
          {harvest.total_weight_kg !== null && (
            <span className="text-xs text-amber-300 font-medium">
              ⚖️ {harvest.total_weight_kg.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg
            </span>
          )}
          {harvest.brix !== null && (
            <span className="text-xs text-stone-400">{harvest.brix}°Bx</span>
          )}
          {harvest.humidity_pct !== null && (
            <span className="text-xs text-stone-400">{harvest.humidity_pct}% umidade</span>
          )}
        </div>

        {/* Inputs */}
        {(harvest.syrup_provided || harvest.pollen_ball_provided || harvest.wax_provided) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {harvest.syrup_provided && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 border border-emerald-800/50 text-emerald-400">
                🍬 Xarope
              </span>
            )}
            {harvest.pollen_ball_provided && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 border border-emerald-800/50 text-emerald-400">
                🌼 Pólen
              </span>
            )}
            {harvest.wax_provided && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 border border-emerald-800/50 text-emerald-400">
                🕯️ Cera
              </span>
            )}
          </div>
        )}
      </Card>
    </button>
  );
}

// ─── HarvestsPage ─────────────────────────────────────────────────────────────

export function HarvestsPage() {
  const navigate = useNavigate();
  const { data: harvests = [], isLoading } = useHarvests();
  const { data: apiaries = [] } = useApiaries();
  const { data: hives = [] } = useHives();

  const [filterApiary, setFilterApiary]     = useState('');
  const [filterHoneyType, setFilterHoneyType] = useState('');
  const [filterPeriod, setFilterPeriod]     = useState('all');

  const apiaryOptions = [
    { value: '', label: 'Todos os meliponários' },
    ...apiaries.map((a) => ({ value: a.local_id, label: a.name })),
  ];

  const honeyTypeOptions = [
    { value: '', label: 'Qualquer tipo' },
    { value: 'maturado', label: '✨ Mel maturado' },
    { value: 'vivo',     label: '🌿 Mel vivo' },
  ];

  const periodOptions = [
    { value: 'all',  label: 'Todos os períodos' },
    { value: '30',   label: 'Últimos 30 dias' },
    { value: '90',   label: 'Últimos 90 dias' },
    { value: '365',  label: 'Este ano' },
  ];

  const filtered = harvests.filter((h) => {
    if (filterApiary && h.apiary_local_id !== filterApiary) return false;
    if (filterHoneyType && h.honey_type !== filterHoneyType) return false;
    if (filterPeriod !== 'all') {
      const days = parseInt(filterPeriod, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      if (new Date(h.harvested_at) < cutoff) return false;
    }
    return true;
  });

  const totalVolume = filtered.reduce((acc, h) => acc + (h.total_volume_ml ?? 0), 0);
  const totalWeight = filtered.reduce((acc, h) => acc + (h.total_weight_kg ?? 0), 0);
  const maturacaoCount = filtered.filter((h) => h.maturation_status === 'aguardando_maturacao').length;

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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Select options={apiaryOptions}   value={filterApiary}    onChange={(e) => setFilterApiary(e.target.value)} />
          <Select options={honeyTypeOptions} value={filterHoneyType} onChange={(e) => setFilterHoneyType(e.target.value)} />
          <Select options={periodOptions}   value={filterPeriod}    onChange={(e) => setFilterPeriod(e.target.value)}
            className="col-span-2 sm:col-span-1" />
        </div>
      )}

      {/* Resumo do período */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="text-center">
            <p className="text-2xl font-bold text-amber-400">{filtered.length}</p>
            <p className="text-xs text-stone-500">Colheitas</p>
          </Card>
          <Card className="text-center">
            <p className="text-xl font-bold text-amber-300">
              {totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(2)} L` : `${totalVolume.toFixed(0)} mL`}
            </p>
            <p className="text-xs text-stone-500">Volume total</p>
          </Card>
          <Card className="text-center">
            <p className="text-xl font-bold text-amber-200">{totalWeight.toFixed(2)} kg</p>
            <p className="text-xs text-stone-500">Peso total</p>
          </Card>
          {maturacaoCount > 0 && (
            <Card className="text-center">
              <p className="text-xl font-bold text-amber-500">{maturacaoCount}</p>
              <p className="text-xs text-stone-500">Aguardando maturação</p>
            </Card>
          )}
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        harvests.length === 0 ? (
          <EmptyState
            icon="🍯"
            title="Nenhuma colheita registrada"
            description="Registre as colheitas de mel com parâmetros de qualidade e volumes por caixa."
            action={{ label: 'Registrar Colheita', onClick: () => navigate('/harvests/new') }}
          />
        ) : (
          <EmptyState
            icon="🔍"
            title="Nenhuma colheita neste filtro"
            description="Tente ampliar o período ou ajustar os filtros."
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
                apiaryName={apiary?.name ?? '—'}
                hiveCount={hiveCount}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
