import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { useCreateFeeding } from '@/hooks/useFeedings';
import { useHives } from '@/hooks/useHives';
import { FeedingCreateSchema } from '@bee-forest/shared';
import { todayISO } from '@/utils/dates';

const FEED_OPTIONS = [
  { value: 'sugar_syrup', label: '🍬 Xarope de açúcar' },
  { value: 'honey', label: '🍯 Mel diluído' },
  { value: 'pollen_sub', label: '🌺 Substituto de pólen' },
  { value: 'other', label: '🌿 Outro' },
];

interface Props {
  defaultHiveId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function FeedingForm({ defaultHiveId, onSuccess, onCancel }: Props) {
  const createFeeding = useCreateFeeding();
  const { data: hives = [] } = useHives();

  const hiveOptions = [
    { value: '', label: 'Selecionar colmeia...' },
    ...hives.filter((h) => h.status === 'active').map((h) => ({ value: h.local_id, label: h.code })),
  ];

  const [form, setForm] = useState({
    hive_local_id: defaultHiveId ?? '',
    feed_type: 'sugar_syrup',
    quantity_ml: '',
    fed_at: todayISO(),
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const result = FeedingCreateSchema.safeParse({
      ...form,
      quantity_ml: form.quantity_ml ? parseFloat(form.quantity_ml) : null,
    });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => { errs[e.path[0]] = e.message; });
      setErrors(errs);
      return;
    }
    await createFeeding.mutateAsync(result.data);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!defaultHiveId && (
        <Select label="Colmeia *" options={hiveOptions} value={form.hive_local_id} onChange={(e) => set('hive_local_id', e.target.value)} error={errors.hive_local_id} />
      )}
      <Select label="Tipo de Alimentação *" options={FEED_OPTIONS} value={form.feed_type} onChange={(e) => set('feed_type', e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Quantidade (ml)" type="number" step="0.1" value={form.quantity_ml} onChange={(e) => set('quantity_ml', e.target.value)} placeholder="ex: 200" />
        <Input label="Data" type="date" value={form.fed_at} onChange={(e) => set('fed_at', e.target.value)} />
      </div>
      <Textarea label="Observações" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={createFeeding.isPending} className="flex-1">Registrar Alimentação</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}
