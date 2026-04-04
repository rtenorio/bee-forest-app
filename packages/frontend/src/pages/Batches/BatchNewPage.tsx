import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateBatch } from '@/hooks/useBatches';
import { useApiaries } from '@/hooks/useApiaries';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';

export function BatchNewPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;
  const { data: apiaries = [] } = useApiaries();
  const createBatch = useCreateBatch();

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    apiary_local_id: '',
    harvest_date: today,
    honey_type: 'vivo' as 'vivo' | 'maturado',
    bee_species: '',
    floral_context: '',
    gross_weight_grams: '',
    net_weight_grams: '',
    initial_moisture: '',
    initial_brix: '',
    processing_route: 'in_natura' as string,
    notes: '',
  });

  const [error, setError] = useState<string | null>(null);

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const apiaryOptions = [
    { value: '', label: 'Selecione o meliponário' },
    ...apiaries.map((a) => ({ value: a.local_id, label: a.name })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.apiary_local_id) { setError('Selecione o meliponário'); return; }
    if (!form.harvest_date) { setError('Informe a data da colheita'); return; }

    try {
      const batch = await createBatch.mutateAsync({
        apiary_local_id: form.apiary_local_id,
        harvest_local_id: null,
        harvest_date: form.harvest_date,
        honey_type: form.honey_type,
        bee_species: form.bee_species || null,
        floral_context: form.floral_context || null,
        gross_weight_grams: form.gross_weight_grams ? parseFloat(form.gross_weight_grams) * 1000 : null,
        net_weight_grams: form.net_weight_grams ? parseFloat(form.net_weight_grams) * 1000 : null,
        initial_moisture: form.initial_moisture ? parseFloat(form.initial_moisture) : null,
        initial_brix: form.initial_brix ? parseFloat(form.initial_brix) : null,
        processing_route: form.processing_route as never,
        is_bottled: false,
        is_sold: false,
        final_destination: null,
        collection_responsible_local_id: null,
        notes: form.notes,
        current_status: 'collected',
      });
      navigate(`/batches/${batch.local_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar lote');
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-stone-400 hover:text-stone-100 text-sm transition-colors">
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-stone-100">Novo Lote de Mel</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Meliponário */}
        <div>
          <label className="text-xs text-stone-400 block mb-1.5">Meliponário *</label>
          <Select
            options={apiaryOptions}
            value={form.apiary_local_id}
            onChange={(e) => set('apiary_local_id', e.target.value)}
          />
        </div>

        {/* Data colheita */}
        <div>
          <label className="text-xs text-stone-400 block mb-1.5">Data da colheita *</label>
          <Input type="date" value={form.harvest_date} onChange={(e) => set('harvest_date', e.target.value)} />
        </div>

        {/* Tipo de mel + Rota */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-stone-400 block mb-1.5">Tipo de mel *</label>
            <Select
              options={[
                { value: 'vivo', label: '🌿 Mel vivo' },
                { value: 'maturado', label: '✨ Mel maturado' },
              ]}
              value={form.honey_type}
              onChange={(e) => set('honey_type', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1.5">Rota de processamento</label>
            <Select
              options={[
                { value: 'in_natura', label: '🌿 In natura' },
                { value: 'dehumidified', label: '💨 Desumidificar' },
                { value: 'matured', label: '✨ Maturar' },
                { value: 'dehumidified_then_matured', label: '💨✨ Desumid. + Maturar' },
              ]}
              value={form.processing_route}
              onChange={(e) => set('processing_route', e.target.value)}
            />
          </div>
        </div>

        {/* Espécie + Contexto floral */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-stone-400 block mb-1.5">Espécie (abelha)</label>
            <Input placeholder="Ex: Scaptotrigona" value={form.bee_species} onChange={(e) => set('bee_species', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1.5">Contexto floral</label>
            <Input placeholder="Ex: Florada de eucalipto" value={form.floral_context} onChange={(e) => set('floral_context', e.target.value)} />
          </div>
        </div>

        {/* Pesos */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-stone-400 block mb-1.5">Peso bruto (kg)</label>
            <Input type="number" step="0.001" min="0" placeholder="0.000" value={form.gross_weight_grams} onChange={(e) => set('gross_weight_grams', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1.5">Peso líquido (kg)</label>
            <Input type="number" step="0.001" min="0" placeholder="0.000" value={form.net_weight_grams} onChange={(e) => set('net_weight_grams', e.target.value)} />
          </div>
        </div>

        {/* Medições iniciais */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-stone-400 block mb-1.5">Umidade inicial (%)</label>
            <Input type="number" step="0.1" min="0" max="100" placeholder="Ex: 28.5" value={form.initial_moisture} onChange={(e) => set('initial_moisture', e.target.value)} />
            {form.initial_moisture && parseFloat(form.initial_moisture) > 30 && (
              <p className="text-xs text-red-400 mt-1">⚠️ Umidade acima de 30% — risco de fermentação</p>
            )}
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1.5">Brix inicial (°Bx)</label>
            <Input type="number" step="0.1" min="0" placeholder="Ex: 72.0" value={form.initial_brix} onChange={(e) => set('initial_brix', e.target.value)} />
          </div>
        </div>

        {/* Responsável */}
        <div>
          <label className="text-xs text-stone-400 block mb-1.5">Responsável pela coleta</label>
          <Input placeholder={user.name ?? ''} disabled className="opacity-60" />
          <p className="text-xs text-stone-600 mt-1">Atribuído automaticamente ao usuário logado</p>
        </div>

        {/* Notas */}
        <div>
          <label className="text-xs text-stone-400 block mb-1.5">Observações</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            placeholder="Condições da colheita, características observadas..."
            className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700/40 rounded-xl px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={createBatch.isPending} className="flex-1">
            {createBatch.isPending ? <Spinner className="w-4 h-4" /> : 'Criar Lote'}
          </Button>
        </div>
      </form>
    </div>
  );
}
