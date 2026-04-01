import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { useCreateHive, useUpdateHive } from '@/hooks/useHives';
import { useApiaries } from '@/hooks/useApiaries';
import { useSpecies } from '@/hooks/useSpecies';
import { HiveCreateSchema } from '@bee-forest/shared';
import { todayISO } from '@/utils/dates';
import type { Hive } from '@bee-forest/shared';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativa' },
  { value: 'inactive', label: 'Inativa' },
  { value: 'dead', label: 'Morta' },
  { value: 'transferred', label: 'Transferida' },
];

const BOX_TYPES = [
  { value: '', label: 'Selecionar tipo...' },
  { value: 'INPA', label: 'INPA' },
  { value: 'PNN', label: 'PNN' },
  { value: 'Racional', label: 'Racional' },
  { value: 'Jolminha', label: 'Jolminha' },
  { value: 'Outro', label: 'Outro' },
];

interface Props {
  initial?: Hive;
  defaultApiaryId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function HiveForm({ initial, defaultApiaryId, onSuccess, onCancel }: Props) {
  const createHive = useCreateHive();
  const updateHive = useUpdateHive();
  const { data: apiaries = [] } = useApiaries();
  const { data: speciesList = [] } = useSpecies();

  const apiaryOptions = [
    { value: '', label: 'Selecionar apiário...' },
    ...apiaries.map((a) => ({ value: a.local_id, label: a.name })),
  ];

  const speciesOptions = [
    { value: '', label: 'Espécie não identificada' },
    ...speciesList.map((s) => ({ value: s.local_id, label: s.name })),
  ];

  const [form, setForm] = useState({
    apiary_local_id: initial?.apiary_local_id ?? defaultApiaryId ?? '',
    species_local_id: initial?.species_local_id ?? '',
    code: initial?.code ?? '',
    status: initial?.status ?? 'active',
    installation_date: initial?.installation_date ?? todayISO(),
    box_type: initial?.box_type ?? '',
    notes: initial?.notes ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = HiveCreateSchema.safeParse({
      ...form,
      species_local_id: form.species_local_id || null,
      installation_date: form.installation_date || null,
      box_type: form.box_type || '',
    });

    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => { errs[e.path[0]] = e.message; });
      setErrors(errs);
      return;
    }

    if (initial) {
      await updateHive.mutateAsync({ local_id: initial.local_id, data: result.data });
    } else {
      await createHive.mutateAsync(result.data);
    }
    onSuccess();
  };

  const isPending = createHive.isPending || updateHive.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Select
            label="Meliponário *"
            options={apiaryOptions}
            value={form.apiary_local_id}
            onChange={(e) => set('apiary_local_id', e.target.value)}
            error={errors.apiary_local_id}
          />
        </div>
        <Input
          label="Código da Colmeia *"
          value={form.code}
          onChange={(e) => set('code', e.target.value)}
          error={errors.code}
          placeholder="ex: C-001"
        />
        <Select
          label="Status"
          options={STATUS_OPTIONS}
          value={form.status}
          onChange={(e) => set('status', e.target.value)}
        />
        <Select
          label="Espécie"
          options={speciesOptions}
          value={form.species_local_id}
          onChange={(e) => set('species_local_id', e.target.value)}
        />
        <Select
          label="Tipo de Caixa"
          options={BOX_TYPES}
          value={form.box_type}
          onChange={(e) => set('box_type', e.target.value)}
        />
        <div className="col-span-2">
          <Input
            label="Data de Instalação"
            type="date"
            value={form.installation_date ?? ''}
            onChange={(e) => set('installation_date', e.target.value)}
          />
        </div>
      </div>
      <Textarea label="Observações" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={isPending} className="flex-1">
          {initial ? 'Salvar Alterações' : 'Criar Colmeia'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}
