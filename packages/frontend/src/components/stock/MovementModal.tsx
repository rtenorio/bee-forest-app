import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCreateMovement } from '@/hooks/useStock';
import { useApiaries } from '@/hooks/useApiaries';
import type { StockItem, StockMovementType, StockMovementDirection } from '@bee-forest/shared';

const ORIGIN_LABELS: Record<string, string> = {
  purchase: 'Compra', harvest: 'Colheita', batch: 'Lote', transfer: 'Transferência recebida', manual: 'Manual',
};
const DESTINATION_LABELS: Record<string, string> = {
  sale: 'Venda', internal_use: 'Uso interno', processing: 'Beneficiamento', transfer: 'Transferência enviada', manual: 'Manual',
};

interface Props {
  open: boolean;
  onClose: () => void;
  item: StockItem;
  initialType?: StockMovementType;
}

export function MovementModal({ open, onClose, item, initialType = 'entry' }: Props) {
  const create = useCreateMovement();
  const { data: apiaries = [] } = useApiaries();

  const [type, setType] = useState<StockMovementType>(initialType);
  const [quantity, setQuantity] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [originType, setOriginType] = useState('manual');
  const [destinationType, setDestinationType] = useState('manual');
  const [destApiaryId, setDestApiaryId] = useState('');
  const [destNotes, setDestNotes] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setType(initialType);
    setQuantity('');
    setWeightKg('');
    setOriginType('manual');
    setDestinationType('manual');
    setDestApiaryId('');
    setDestNotes('');
    setUnitPrice('');
    setNotes('');
    setError('');
  }, [open, initialType]);

  const isHoney = item.category === 'honey';
  const direction: StockMovementDirection = type === 'entry' ? 'in' : type === 'exit' ? 'out' : 'out';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) { setError('Quantidade deve ser maior que zero'); return; }
    if (type === 'transfer' && !destApiaryId) { setError('Selecione o meliponário de destino'); return; }

    try {
      await create.mutateAsync({
        stock_item_local_id: item.local_id,
        movement_type: type,
        quantity: qty,
        weight_kg: isHoney && weightKg ? parseFloat(weightKg) : null,
        direction,
        origin_type: type === 'entry' ? (originType as never) : null,
        destination_type: type === 'exit' ? (destinationType as never) : type === 'transfer' ? 'transfer' : null,
        destination_apiary_id: type === 'transfer' ? destApiaryId : null,
        destination_notes: destNotes || null,
        unit_price: destinationType === 'sale' && unitPrice ? parseFloat(unitPrice) : null,
        notes: notes || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar movimentação');
    }
  }

  const destApiaries = apiaries.filter((a) => a.local_id !== item.apiary_local_id && !a.deleted_at);

  return (
    <Modal open={open} onClose={onClose} title={`Registrar movimentação — ${item.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type selector */}
        <div className="flex rounded-lg overflow-hidden border border-stone-700">
          {(['entry', 'exit', 'transfer'] as StockMovementType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                type === t ? 'bg-amber-500 text-stone-900' : 'bg-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              {t === 'entry' ? '⬆ Entrada' : t === 'exit' ? '⬇ Saída' : '↔ Transferência'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`Quantidade (${item.unit})`}
            type="number"
            min="0"
            step="0.001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          {isHoney && (
            <Input
              label="Peso (kg)"
              type="number"
              min="0"
              step="0.001"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          )}
        </div>

        {type === 'entry' && (
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Origem</label>
            <select
              value={originType}
              onChange={(e) => setOriginType(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            >
              {Object.entries(ORIGIN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        )}

        {type === 'exit' && (
          <>
            <div>
              <label className="block text-xs font-medium text-stone-400 mb-1">Destino</label>
              <select
                value={destinationType}
                onChange={(e) => setDestinationType(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              >
                {Object.entries(DESTINATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {destinationType === 'sale' && (
              <Input
                label="Preço unitário (R$)"
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            )}
          </>
        )}

        {type === 'transfer' && (
          <>
            <div>
              <label className="block text-xs font-medium text-stone-400 mb-1">Meliponário de destino *</label>
              <select
                value={destApiaryId}
                onChange={(e) => setDestApiaryId(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">Selecione...</option>
                {destApiaries.map((a) => <option key={a.local_id} value={a.local_id}>{a.name}</option>)}
              </select>
            </div>
            <Input
              label="Observações do destino"
              value={destNotes}
              onChange={(e) => setDestNotes(e.target.value)}
            />
          </>
        )}

        <Input
          label="Observações"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" loading={create.isPending} className="flex-1">
            Registrar
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </form>
    </Modal>
  );
}
