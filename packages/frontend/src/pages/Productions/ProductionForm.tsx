import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { useCreateProduction } from '@/hooks/useProductions';
import { useHives } from '@/hooks/useHives';
import { ProductionCreateSchema } from '@bee-forest/shared';
import { todayISO } from '@/utils/dates';

const PRODUCT_OPTIONS = [
  { value: 'honey', label: '🍯 Mel' },
  { value: 'propolis', label: '🟫 Própolis' },
  { value: 'pollen', label: '🌼 Pólen' },
  { value: 'wax', label: '🕯️ Cera' },
];

const GRADE_OPTIONS = [
  { value: '', label: 'Sem classificação' },
  { value: 'A', label: 'A - Premium' },
  { value: 'B', label: 'B - Padrão' },
  { value: 'C', label: 'C - Abaixo do padrão' },
];

interface Props {
  defaultHiveId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ProductionForm({ defaultHiveId, onSuccess, onCancel }: Props) {
  const createProduction = useCreateProduction();
  const { data: hives = [] } = useHives();

  const hiveOptions = [
    { value: '', label: 'Selecionar colmeia...' },
    ...hives.filter((h) => h.status === 'active').map((h) => ({ value: h.local_id, label: h.code })),
  ];

  const [form, setForm] = useState({
    hive_local_id: defaultHiveId ?? '',
    product_type: 'honey',
    quantity_g: '',
    harvested_at: todayISO(),
    quality_grade: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const result = ProductionCreateSchema.safeParse({
      ...form,
      quantity_g: parseFloat(form.quantity_g),
      quality_grade: form.quality_grade || null,
    });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => { errs[e.path[0]] = e.message; });
      setErrors(errs);
      return;
    }
    await createProduction.mutateAsync(result.data);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!defaultHiveId && (
        <Select label="Colmeia *" options={hiveOptions} value={form.hive_local_id} onChange={(e) => set('hive_local_id', e.target.value)} error={errors.hive_local_id} />
      )}
      <Select label="Produto *" options={PRODUCT_OPTIONS} value={form.product_type} onChange={(e) => set('product_type', e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Quantidade (g) *" type="number" step="0.1" value={form.quantity_g} onChange={(e) => set('quantity_g', e.target.value)} error={errors.quantity_g} placeholder="ex: 500" />
        <Input label="Data da Colheita" type="date" value={form.harvested_at} onChange={(e) => set('harvested_at', e.target.value)} />
      </div>
      <Select label="Grau de Qualidade" options={GRADE_OPTIONS} value={form.quality_grade} onChange={(e) => set('quality_grade', e.target.value)} />
      <Textarea label="Observações" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={createProduction.isPending} className="flex-1">Registrar Produção</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}
