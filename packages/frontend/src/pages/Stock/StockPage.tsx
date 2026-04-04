import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStockSummary, useStockAlerts } from '@/hooks/useStock';
import { useApiaries } from '@/hooks/useApiaries';
import { useAuthStore } from '@/store/authStore';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import type { StockApiarySummary } from '@bee-forest/shared';

function fmtVol(ml: number) {
  if (!ml) return '0 ml';
  return ml >= 1000 ? `${(ml / 1000).toFixed(2)} L` : `${ml.toFixed(0)} ml`;
}
function fmtKg(kg: number) {
  if (!kg) return '0 kg';
  return kg >= 1 ? `${kg.toFixed(3)} kg` : `${(kg * 1000).toFixed(0)} g`;
}

function ApiaryStockCard({ s, alertsCount }: { s: StockApiarySummary; alertsCount: number }) {
  const navigate = useNavigate();
  const hasAlert = alertsCount > 0;

  return (
    <Card
      className={cn('cursor-pointer hover:border-amber-600/50 transition-colors', hasAlert && 'border-red-700/50')}
      onClick={() => navigate(`/stock/${s.apiary_local_id}`)}
    >
      <CardHeader>
        <CardTitle>{s.apiary_name ?? 'Meliponário'}</CardTitle>
        {hasAlert && <Badge variant="danger">{alertsCount} alerta{alertsCount !== 1 ? 's' : ''}</Badge>}
      </CardHeader>

      {/* Mel */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Mel</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-stone-800 rounded-lg p-3">
            <p className="text-xs text-stone-500 mb-1">Mel Vivo</p>
            <p className="text-sm font-semibold text-amber-300">{fmtVol(s.honey_vivo_volume_ml)}</p>
            {s.honey_vivo_weight_kg > 0 && (
              <p className="text-xs text-stone-500">{fmtKg(s.honey_vivo_weight_kg)}</p>
            )}
          </div>
          <div className="bg-stone-800 rounded-lg p-3">
            <p className="text-xs text-stone-500 mb-1">Mel Maturado</p>
            <p className="text-sm font-semibold text-amber-400">{fmtVol(s.honey_maturado_volume_ml)}</p>
            {s.honey_maturado_weight_kg > 0 && (
              <p className="text-xs text-stone-500">{fmtKg(s.honey_maturado_weight_kg)}</p>
            )}
          </div>
        </div>

        {/* Insumos */}
        <div className="flex items-center justify-between py-2 border-t border-stone-800">
          <p className="text-xs text-stone-500">Insumos</p>
          <div className="flex gap-1.5">
            {s.inputs_ok > 0 && <Badge variant="success">{s.inputs_ok} ok</Badge>}
            {s.inputs_low > 0 && <Badge variant="warning">{s.inputs_low} baixo</Badge>}
            {s.inputs_out > 0 && <Badge variant="danger">{s.inputs_out} zerado</Badge>}
            {s.inputs_ok + s.inputs_low + s.inputs_out === 0 && <span className="text-xs text-stone-600">—</span>}
          </div>
        </div>

        {/* Embalagens */}
        <div className="flex items-center justify-between py-2 border-t border-stone-800">
          <p className="text-xs text-stone-500">Embalagens</p>
          <span className="text-sm text-stone-300">
            {s.packaging_total > 0 ? `${s.packaging_total.toFixed(0)} un.` : '—'}
          </span>
        </div>
      </div>
    </Card>
  );
}

export function StockPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;
  const [filterApiary, setFilterApiary] = useState('');

  const { data: summaries = [], isLoading } = useStockSummary(filterApiary || undefined);
  const { data: alerts = [] } = useStockAlerts();
  const { data: apiaries = [] } = useApiaries();

  const activeApiaries = apiaries.filter((a) => !a.deleted_at);
  const totalAlerts = alerts.length;

  const alertsByApiary = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.apiary_local_id] = (acc[a.apiary_local_id] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = filterApiary ? summaries.filter((s) => s.apiary_local_id === filterApiary) : summaries;
  const withStock = filtered.filter((s) =>
    s.honey_vivo_volume_ml > 0 || s.honey_maturado_volume_ml > 0 ||
    s.inputs_ok + s.inputs_low + s.inputs_out > 0 || s.packaging_total > 0
  );

  const isTratador = user.role === 'tratador';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Estoque</h1>
          <p className="text-stone-500 text-sm">Mel, insumos e embalagens por meliponário</p>
        </div>
        {!isTratador && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate('/stock/alerts')}>
              {totalAlerts > 0 ? `⚠️ ${totalAlerts} alerta${totalAlerts !== 1 ? 's' : ''}` : '⚠️ Alertas'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/stock/movements')}>
              📋 Movimentações
            </Button>
          </div>
        )}
      </div>

      {/* Global alert banner */}
      {totalAlerts > 0 && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-700/40 rounded-xl p-4">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <p className="text-red-300 font-medium text-sm">
              {totalAlerts} item{totalAlerts !== 1 ? 's' : ''} com estoque abaixo do mínimo
            </p>
            <p className="text-red-400/70 text-xs mt-0.5">Verifique e reponha os itens críticos</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => navigate('/stock/alerts')}>
            Ver alertas →
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Mel Vivo Total',
            value: fmtVol(summaries.reduce((a, s) => a + s.honey_vivo_volume_ml, 0)),
            icon: '🍯',
          },
          {
            label: 'Mel Maturado Total',
            value: fmtVol(summaries.reduce((a, s) => a + s.honey_maturado_volume_ml, 0)),
            icon: '🫙',
          },
          {
            label: 'Meliponários',
            value: String(activeApiaries.length),
            icon: '🏡',
          },
          {
            label: 'Alertas Ativos',
            value: String(totalAlerts),
            icon: '🔔',
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-stone-800 rounded-xl p-4">
            <p className="text-2xl mb-1">{stat.icon}</p>
            <p className="text-lg font-bold text-stone-100">{stat.value}</p>
            <p className="text-xs text-stone-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Apiary filter */}
      {activeApiaries.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterApiary('')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              !filterApiary ? 'bg-amber-500 text-stone-900' : 'bg-stone-800 text-stone-400 hover:text-stone-200'
            )}
          >
            Todos
          </button>
          {activeApiaries.map((a) => (
            <button
              key={a.local_id}
              onClick={() => setFilterApiary(a.local_id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                filterApiary === a.local_id ? 'bg-amber-500 text-stone-900' : 'bg-stone-800 text-stone-400 hover:text-stone-200'
              )}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      {/* Cards */}
      {isLoading ? (
        <p className="text-stone-500 text-center py-12">Carregando estoque...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-stone-400">Nenhum item de estoque cadastrado</p>
          {!isTratador && (
            <p className="text-stone-600 text-sm mt-1">
              Acesse um meliponário para cadastrar itens de estoque
            </p>
          )}
        </div>
      ) : (
        <>
          {withStock.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {withStock.map((s) => (
                <ApiaryStockCard key={s.apiary_local_id} s={s} alertsCount={alertsByApiary[s.apiary_local_id] ?? 0} />
              ))}
            </div>
          )}
          {/* Apiaries with stock items but empty quantities */}
          {filtered.filter((s) =>
            s.honey_vivo_volume_ml === 0 && s.honey_maturado_volume_ml === 0 &&
            s.inputs_ok + s.inputs_low + s.inputs_out === 0 && s.packaging_total === 0
          ).map((s) => (
            <div
              key={s.apiary_local_id}
              className="flex items-center justify-between p-4 bg-stone-900 border border-stone-800 rounded-xl cursor-pointer hover:border-stone-700 transition-colors"
              onClick={() => navigate(`/stock/${s.apiary_local_id}`)}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🏡</span>
                <div>
                  <p className="font-medium text-stone-300">{s.apiary_name}</p>
                  <p className="text-xs text-stone-600">Sem estoque cadastrado</p>
                </div>
              </div>
              <span className="text-stone-600 text-sm">→</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
