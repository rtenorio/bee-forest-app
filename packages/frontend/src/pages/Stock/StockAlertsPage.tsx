import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStockAlerts, useResolveAlert } from '@/hooks/useStock';
import { useStockItems } from '@/hooks/useStock';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { MovementModal } from '@/components/stock/MovementModal';
import type { StockItem } from '@bee-forest/shared';

const UNIT_LABELS: Record<string, string> = {
  ml: 'ml', l: 'L', g: 'g', kg: 'kg', units: 'un.',
};

export function StockAlertsPage() {
  const navigate = useNavigate();
  const { data: alerts = [], isLoading } = useStockAlerts();
  const { data: allItems = [] } = useStockItems();
  const resolve = useResolveAlert();

  const [movItem, setMovItem] = useState<StockItem | null>(null);

  const activeAlerts = alerts.filter((a) => !a.resolved_at);
  const criticalAlerts = activeAlerts.filter((a) => a.alert_type === 'out_of_stock');
  const lowAlerts = activeAlerts.filter((a) => a.alert_type === 'low_stock');

  function openMovement(alert: (typeof alerts)[number]) {
    const item = allItems.find((i) => i.local_id === alert.stock_item_local_id);
    if (item) setMovItem(item);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/stock')} className="text-stone-500 hover:text-stone-300 transition-colors">← </button>
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Alertas de Estoque</h1>
          <p className="text-stone-500 text-sm">Itens abaixo do estoque mínimo</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4">
          <p className="text-2xl mb-1">🚨</p>
          <p className="text-2xl font-bold text-red-300">{criticalAlerts.length}</p>
          <p className="text-xs text-red-400">Estoque zerado</p>
        </div>
        <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4">
          <p className="text-2xl mb-1">⚠️</p>
          <p className="text-2xl font-bold text-amber-300">{lowAlerts.length}</p>
          <p className="text-xs text-amber-400">Estoque baixo</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-center text-stone-500 py-12">Carregando...</p>
      ) : activeAlerts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">✅</p>
          <p className="text-stone-300 font-medium">Nenhum alerta ativo</p>
          <p className="text-stone-500 text-sm mt-1">Todos os itens estão acima do estoque mínimo</p>
        </div>
      ) : (
        <Card>
          <div className="divide-y divide-stone-800">
            {activeAlerts.map((alert) => {
              const pct = alert.min_quantity > 0
                ? Math.min(100, (alert.current_quantity / alert.min_quantity) * 100)
                : 0;
              const isOut = alert.alert_type === 'out_of_stock';

              return (
                <div key={alert.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-stone-200">{alert.item_name}</p>
                        <Badge variant={isOut ? 'danger' : 'warning'}>
                          {isOut ? 'Crítico — Zerado' : 'Baixo'}
                        </Badge>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">{alert.apiary_name}</p>

                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <span className={isOut ? 'text-red-400 font-semibold' : 'text-amber-400 font-semibold'}>
                          {alert.current_quantity.toFixed(alert.item_unit === 'units' ? 0 : 3)} {UNIT_LABELS[alert.item_unit] ?? alert.item_unit}
                        </span>
                        <span className="text-stone-600 text-xs">
                          mín: {alert.min_quantity.toFixed(alert.item_unit === 'units' ? 0 : 3)} {UNIT_LABELS[alert.item_unit] ?? alert.item_unit}
                        </span>
                      </div>

                      {alert.min_quantity > 0 && (
                        <div className="w-full bg-stone-700 rounded-full h-1.5 mt-2">
                          <div
                            className={`h-1.5 rounded-full transition-all ${isOut ? 'bg-red-500' : 'bg-amber-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}

                      <p className="text-xs text-stone-600 mt-1">
                        Desde {new Date(alert.triggered_at).toLocaleDateString('pt-BR', { dateStyle: 'medium' })}
                      </p>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" onClick={() => openMovement(alert)}>
                        ⬆ Entrada
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/stock/${alert.apiary_local_id}`)}
                      >
                        Ver item
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => resolve.mutate(alert.id)}
                        loading={resolve.isPending}
                        title="Marcar como resolvido"
                      >
                        ✓
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {movItem && (
        <MovementModal
          open={!!movItem}
          onClose={() => setMovItem(null)}
          item={movItem}
          initialType="entry"
        />
      )}
    </div>
  );
}
