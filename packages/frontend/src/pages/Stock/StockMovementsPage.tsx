import { useState } from 'react';
import { useStockMovements } from '@/hooks/useStock';
import { useApiaries } from '@/hooks/useApiaries';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

const CATEGORY_LABELS: Record<string, string> = { honey: '🍯 Mel', input: '🌺 Insumos', packaging: '📦 Embalagens' };
const MOVEMENT_LABELS: Record<string, string> = { entry: 'Entrada', exit: 'Saída', transfer: 'Transferência' };
const ORIGIN_LABELS: Record<string, string> = {
  harvest: 'Colheita', batch: 'Lote', purchase: 'Compra', transfer: 'Transferência', manual: 'Manual',
};
const DEST_LABELS: Record<string, string> = {
  sale: 'Venda', internal_use: 'Uso interno', processing: 'Beneficiamento', transfer: 'Transferência', manual: 'Manual',
};

const PAGE_SIZE = 20;

export function StockMovementsPage() {
  const { data: apiaries = [] } = useApiaries();
  const [filterApiary, setFilterApiary] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [offset, setOffset] = useState(0);

  const { data: movements = [], isLoading } = useStockMovements({
    apiary_local_id: filterApiary || undefined,
    category: filterCategory || undefined,
    movement_type: filterType || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const totalIn = movements.filter((m) => m.direction === 'in').reduce((a, m) => a + m.quantity, 0);
  const totalOut = movements.filter((m) => m.direction === 'out').reduce((a, m) => a + m.quantity, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-stone-100">Movimentações de Estoque</h1>
        <p className="text-stone-500 text-sm">Histórico completo de entradas, saídas e transferências</p>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Meliponário</label>
            <select value={filterApiary} onChange={(e) => { setFilterApiary(e.target.value); setOffset(0); }}
              className="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
              <option value="">Todos</option>
              {apiaries.filter((a) => !a.deleted_at).map((a) => <option key={a.local_id} value={a.local_id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Categoria</label>
            <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setOffset(0); }}
              className="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
              <option value="">Todas</option>
              <option value="honey">Mel</option>
              <option value="input">Insumos</option>
              <option value="packaging">Embalagens</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Tipo</label>
            <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setOffset(0); }}
              className="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
              <option value="">Todos</option>
              <option value="entry">Entrada</option>
              <option value="exit">Saída</option>
              <option value="transfer">Transferência</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">De</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setOffset(0); }}
              className="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Até</label>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setOffset(0); }}
              className="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <div className="flex items-end">
            <button onClick={() => { setFilterApiary(''); setFilterCategory(''); setFilterType(''); setDateFrom(''); setDateTo(''); setOffset(0); }}
              className="px-3 py-2 text-stone-500 hover:text-stone-300 text-sm transition-colors">
              Limpar filtros
            </button>
          </div>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-4">
          <p className="text-xs text-emerald-400 mb-1">Total de entradas</p>
          <p className="text-xl font-bold text-emerald-300">+{totalIn.toFixed(2)}</p>
        </div>
        <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4">
          <p className="text-xs text-red-400 mb-1">Total de saídas</p>
          <p className="text-xl font-bold text-red-300">-{totalOut.toFixed(2)}</p>
        </div>
      </div>

      {/* List */}
      <Card>
        {isLoading ? (
          <p className="py-8 text-center text-stone-500">Carregando...</p>
        ) : movements.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-stone-500">Nenhuma movimentação encontrada</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-800">
            {movements.map((m) => (
              <div key={m.id} className="px-4 py-3 flex items-start gap-4">
                <div className={cn(
                  'shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm',
                  m.direction === 'in' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
                )}>
                  {m.direction === 'in' ? '⬆' : '⬇'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-stone-200 text-sm">{m.item_name}</p>
                    <Badge variant="default">{CATEGORY_LABELS[m.item_category ?? ''] ?? m.item_category}</Badge>
                    <Badge variant={m.direction === 'in' ? 'success' : 'danger'}>
                      {MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}
                    </Badge>
                  </div>
                  <p className={cn('text-sm font-semibold mt-0.5', m.direction === 'in' ? 'text-emerald-400' : 'text-red-400')}>
                    {m.direction === 'in' ? '+' : '-'}{m.quantity.toFixed(3)} {m.item_unit}
                    {m.weight_kg != null && m.weight_kg > 0 && (
                      <span className="text-stone-500 text-xs ml-2">/ {m.weight_kg.toFixed(3)} kg</span>
                    )}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-stone-500 flex-wrap">
                    <span>{m.apiary_name}</span>
                    {m.origin_type && <span>Origem: {ORIGIN_LABELS[m.origin_type] ?? m.origin_type}</span>}
                    {m.destination_type && <span>Destino: {DEST_LABELS[m.destination_type] ?? m.destination_type}</span>}
                    {m.responsible_name && <span>Por: {m.responsible_name}</span>}
                    {m.unit_price != null && <span>R$ {m.unit_price.toFixed(2)}/un.</span>}
                    {m.notes && <span className="text-stone-600 italic">{m.notes}</span>}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-stone-600">
                  {new Date(m.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pagination */}
      <div className="flex justify-center gap-3">
        {offset > 0 && (
          <Button variant="secondary" size="sm" onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
            ← Anterior
          </Button>
        )}
        {movements.length === PAGE_SIZE && (
          <Button variant="secondary" size="sm" onClick={() => setOffset(offset + PAGE_SIZE)}>
            Próxima →
          </Button>
        )}
      </div>
    </div>
  );
}
