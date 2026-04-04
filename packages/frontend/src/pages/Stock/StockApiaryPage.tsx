import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStockItems, useStockMovements, useUpdateStockItem, useDeleteStockItem, useCreateStockItem } from '@/hooks/useStock';
import { useApiaries } from '@/hooks/useApiaries';
import { useAuthStore } from '@/store/authStore';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { MovementModal } from '@/components/stock/MovementModal';
import { cn } from '@/utils/cn';
import type { StockItem, StockCategory, StockMovementType } from '@bee-forest/shared';

type Tab = 'honey' | 'input' | 'packaging';

const UNITS: Record<string, string[]> = {
  honey: ['ml', 'l', 'g', 'kg'],
  input: ['ml', 'l', 'g', 'kg', 'units'],
  packaging: ['units'],
};

const UNIT_LABELS: Record<string, string> = {
  ml: 'ml', l: 'litros', g: 'gramas', kg: 'kg', units: 'unidades',
};

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  entry: '⬆ Entrada', exit: '⬇ Saída', transfer: '↔ Transferência',
};

function StockBar({ current, min }: { current: number; min: number }) {
  if (min <= 0) return null;
  const pct = Math.min(100, (current / min) * 100);
  const color = current <= 0 ? 'bg-red-500' : current <= min ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="w-full bg-stone-700 rounded-full h-1.5 mt-2">
      <div className={cn('h-1.5 rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ItemRow({
  item,
  canOperate,
  onMove,
  onEdit,
  onDelete,
}: {
  item: StockItem & { has_alert?: boolean };
  canOperate: boolean;
  onMove: (item: StockItem, type: StockMovementType) => void;
  onEdit: (item: StockItem) => void;
  onDelete: (item: StockItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: movements = [] } = useStockMovements(
    expanded ? { apiary_local_id: item.apiary_local_id } : undefined
  );
  const itemMovements = movements.filter((m) => m.stock_item_local_id === item.local_id).slice(0, 10);

  const isLow = item.min_quantity > 0 && item.current_quantity <= item.min_quantity;
  const isOut = item.current_quantity <= 0;

  return (
    <div className={cn('border-b border-stone-800 last:border-0', isOut && 'bg-red-900/10')}>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-stone-200 truncate">{item.name}</p>
              {isOut && <Badge variant="danger">Zerado</Badge>}
              {isLow && !isOut && <Badge variant="warning">Baixo</Badge>}
            </div>
            <p className="text-sm text-stone-300 mt-0.5">
              {item.current_quantity.toFixed(item.unit === 'units' ? 0 : 3)} {UNIT_LABELS[item.unit] ?? item.unit}
              {item.category === 'honey' && item.current_weight_kg != null && item.current_weight_kg > 0 && (
                <span className="text-stone-500 ml-2">/ {item.current_weight_kg.toFixed(3)} kg</span>
              )}
            </p>
            {item.min_quantity > 0 && (
              <>
                <p className="text-xs text-stone-600 mt-0.5">
                  Mínimo: {item.min_quantity.toFixed(item.unit === 'units' ? 0 : 3)} {UNIT_LABELS[item.unit] ?? item.unit}
                </p>
                <StockBar current={item.current_quantity} min={item.min_quantity} />
              </>
            )}
          </div>

          {canOperate && (
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" variant="secondary" onClick={() => onMove(item, 'entry')} title="Entrada">⬆</Button>
              <Button size="sm" variant="secondary" onClick={() => onMove(item, 'exit')} title="Saída">⬇</Button>
              <Button size="sm" variant="secondary" onClick={() => onMove(item, 'transfer')} title="Transferir">↔</Button>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="p-1.5 text-stone-500 hover:text-stone-300 transition-colors text-xs"
              >
                {expanded ? '▲' : '▼'}
              </button>
              <button onClick={() => onEdit(item)} className="p-1.5 text-stone-500 hover:text-amber-400 transition-colors">✏️</button>
              <button onClick={() => onDelete(item)} className="p-1.5 text-stone-500 hover:text-red-400 transition-colors">🗑️</button>
            </div>
          )}
        </div>

        {expanded && (
          <div className="mt-3 space-y-1">
            <p className="text-xs text-stone-500 uppercase tracking-wide">Últimas movimentações</p>
            {itemMovements.length === 0 ? (
              <p className="text-xs text-stone-600 py-2">Nenhuma movimentação registrada</p>
            ) : (
              itemMovements.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs py-1 border-b border-stone-800/50 last:border-0">
                  <span className="text-stone-500">{new Date(m.created_at).toLocaleDateString('pt-BR')}</span>
                  <span className={m.direction === 'in' ? 'text-emerald-400' : 'text-red-400'}>
                    {m.direction === 'in' ? '+' : '-'}{m.quantity.toFixed(3)} {item.unit}
                  </span>
                  <span className="text-stone-500">{MOVEMENT_TYPE_LABELS[m.movement_type] ?? m.movement_type}</span>
                  {m.responsible_name && <span className="text-stone-600">{m.responsible_name}</span>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface NewItemForm {
  name: string; honey_type: string; unit: string; min_quantity: string; notes: string;
}

export function StockApiaryPage() {
  const { apiaryId } = useParams<{ apiaryId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;
  const [tab, setTab] = useState<Tab>('honey');

  const { data: items = [], isLoading } = useStockItems({ apiary_local_id: apiaryId });
  const { data: apiaries = [] } = useApiaries();
  const createItem = useCreateStockItem();
  const updateItem = useUpdateStockItem();
  const deleteItem = useDeleteStockItem();

  const apiary = apiaries.find((a) => a.local_id === apiaryId);

  const [movItem, setMovItem] = useState<StockItem | null>(null);
  const [movType, setMovType] = useState<StockMovementType>('entry');
  const [showNewItem, setShowNewItem] = useState(false);
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [newForm, setNewForm] = useState<NewItemForm>({ name: '', honey_type: 'vivo', unit: 'ml', min_quantity: '', notes: '' });
  const [editForm, setEditForm] = useState<Partial<NewItemForm>>({});
  const [formError, setFormError] = useState('');

  const canOperate = user.role !== 'tratador';
  const canCreate = user.role === 'master_admin' || user.role === 'socio' || user.role === 'responsavel';

  const TABS: { key: Tab; label: string; icon: string }[] = canOperate
    ? [{ key: 'honey', label: 'Mel', icon: '🍯' }, { key: 'input', label: 'Insumos', icon: '🌺' }, { key: 'packaging', label: 'Embalagens', icon: '📦' }]
    : [{ key: 'input', label: 'Insumos', icon: '🌺' }];

  const tabItems = items.filter((i) => i.category === tab && !i.deleted_at);

  function openMove(item: StockItem, type: StockMovementType) {
    setMovItem(item);
    setMovType(type);
  }

  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!newForm.name.trim()) { setFormError('Nome é obrigatório'); return; }
    try {
      await createItem.mutateAsync({
        apiary_local_id: apiaryId!,
        category: tab as StockCategory,
        name: newForm.name.trim(),
        honey_type: tab === 'honey' ? (newForm.honey_type as 'vivo' | 'maturado') : null,
        unit: newForm.unit as never,
        min_quantity: parseFloat(newForm.min_quantity) || 0,
        notes: newForm.notes || null,
      });
      setShowNewItem(false);
      setNewForm({ name: '', honey_type: 'vivo', unit: 'ml', min_quantity: '', notes: '' });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao criar item');
    }
  }

  async function handleEditItem(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    await updateItem.mutateAsync({ local_id: editItem.local_id, data: editForm });
    setEditItem(null);
  }

  function handleDeleteItem(item: StockItem) {
    if (confirm(`Excluir "${item.name}"? Esta ação não pode ser desfeita.`)) {
      deleteItem.mutate(item.local_id);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/stock')} className="text-stone-500 hover:text-stone-300 transition-colors">← </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-stone-100">{apiary?.name ?? 'Estoque'}</h1>
          <p className="text-stone-500 text-sm">Gestão de estoque por categoria</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-800 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === t.key ? 'bg-amber-500 text-stone-900' : 'text-stone-400 hover:text-stone-200'
            )}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>
            {tab === 'honey' ? 'Mel' : tab === 'input' ? 'Insumos' : 'Embalagens'}
          </CardTitle>
          {canCreate && (
            <Button size="sm" onClick={() => setShowNewItem(true)}>+ Novo item</Button>
          )}
        </CardHeader>

        {isLoading ? (
          <p className="py-8 text-center text-stone-500">Carregando...</p>
        ) : tabItems.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-3xl mb-2">📦</p>
            <p className="text-stone-500 text-sm">Nenhum item cadastrado</p>
            {canCreate && (
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => setShowNewItem(true)}>
                Cadastrar item
              </Button>
            )}
          </div>
        ) : (
          <div>
            {tabItems.map((item) => (
              <ItemRow
                key={item.local_id}
                item={item}
                canOperate={canOperate}
                onMove={openMove}
                onEdit={(i) => { setEditItem(i); setEditForm({ name: i.name, min_quantity: String(i.min_quantity), notes: i.notes ?? '' }); }}
                onDelete={handleDeleteItem}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Movement modal */}
      {movItem && (
        <MovementModal
          open={!!movItem}
          onClose={() => setMovItem(null)}
          item={movItem}
          initialType={movType}
        />
      )}

      {/* New item modal */}
      <Modal open={showNewItem} onClose={() => setShowNewItem(false)} title="Novo item de estoque">
        <form onSubmit={handleCreateItem} className="space-y-4">
          <Input label="Nome *" value={newForm.name} onChange={(e) => setNewForm(f => ({ ...f, name: e.target.value }))} />
          {tab === 'honey' && (
            <div>
              <label className="block text-xs font-medium text-stone-400 mb-1">Tipo de mel</label>
              <select value={newForm.honey_type} onChange={(e) => setNewForm(f => ({ ...f, honey_type: e.target.value }))}
                className="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                <option value="vivo">Mel Vivo</option>
                <option value="maturado">Mel Maturado</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Unidade *</label>
            <select value={newForm.unit} onChange={(e) => setNewForm(f => ({ ...f, unit: e.target.value }))}
              className="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
              {UNITS[tab].map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
            </select>
          </div>
          <Input label="Estoque mínimo" type="number" min="0" step="0.001" value={newForm.min_quantity}
            onChange={(e) => setNewForm(f => ({ ...f, min_quantity: e.target.value }))}
            hint="Quantidade mínima que dispara alerta" />
          <Input label="Observações" value={newForm.notes} onChange={(e) => setNewForm(f => ({ ...f, notes: e.target.value }))} />
          {formError && <p className="text-sm text-red-400">{formError}</p>}
          <div className="flex gap-3">
            <Button type="submit" loading={createItem.isPending} className="flex-1">Criar item</Button>
            <Button type="button" variant="secondary" onClick={() => setShowNewItem(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Edit item modal */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title={`Editar: ${editItem?.name}`}>
        <form onSubmit={handleEditItem} className="space-y-4">
          <Input label="Nome" value={editForm.name ?? ''} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="Estoque mínimo" type="number" min="0" step="0.001" value={editForm.min_quantity ?? ''}
            onChange={(e) => setEditForm(f => ({ ...f, min_quantity: e.target.value }))} />
          <Input label="Observações" value={editForm.notes ?? ''} onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))} />
          <div className="flex gap-3">
            <Button type="submit" loading={updateItem.isPending} className="flex-1">Salvar</Button>
            <Button type="button" variant="secondary" onClick={() => setEditItem(null)}>Cancelar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
