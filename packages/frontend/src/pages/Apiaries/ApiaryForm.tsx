import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { useCreateApiary, useUpdateApiary } from '@/hooks/useApiaries';
import { ApiaryCreateSchema } from '@bee-forest/shared';
import type { Apiary } from '@bee-forest/shared';

interface Props {
  initial?: Apiary;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ApiaryForm({ initial, onSuccess, onCancel }: Props) {
  const createApiary = useCreateApiary();
  const updateApiary = useUpdateApiary();
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    location: initial?.location ?? '',
    owner_name: initial?.owner_name ?? '',
    notes: initial?.notes ?? '',
    latitude: initial?.latitude != null ? String(initial.latitude) : '',
    longitude: initial?.longitude != null ? String(initial.longitude) : '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = ApiaryCreateSchema.safeParse({
      ...form,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
    });

    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => { errs[e.path[0]] = e.message; });
      setErrors(errs);
      return;
    }

    if (initial) {
      await updateApiary.mutateAsync({ local_id: initial.local_id, data: result.data });
    } else {
      await createApiary.mutateAsync(result.data);
    }
    onSuccess();
  };

  const isPending = createApiary.isPending || updateApiary.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Nome do Meliponário *" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder="ex: Meliponário Primavera" />
      <Input label="Localização" value={form.location} onChange={(e) => set('location', e.target.value)} error={errors.location} placeholder="ex: Sítio Flores, Zona Rural" />
      <Input label="Proprietário" value={form.owner_name} onChange={(e) => set('owner_name', e.target.value)} placeholder="Nome do responsável" />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Latitude" type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="-15.7801" />
        <Input label="Longitude" type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="-47.9292" />
      </div>
      <Textarea label="Observações" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Informações adicionais..." />
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={isPending} className="flex-1">
          {initial ? 'Salvar Alterações' : 'Criar Meliponário'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
