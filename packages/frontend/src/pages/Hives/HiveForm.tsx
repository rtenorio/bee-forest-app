import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { useCreateHive, useUpdateHive } from '@/hooks/useHives';
import { useApiaries } from '@/hooks/useApiaries';
import { useSpecies } from '@/hooks/useSpecies';
import { useAuthStore } from '@/store/authStore';
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
  { value: '', label: 'Selecionar modelo...' },
  { value: 'INPA', label: 'INPA' },
  { value: 'PNN', label: 'PNN' },
  { value: 'Rádio', label: 'Rádio' },
  { value: 'Vertical', label: 'Vertical' },
  { value: 'Racional', label: 'Racional' },
  { value: 'Jolminha', label: 'Jolminha' },
  { value: 'Outro', label: 'Outro' },
];

const WOOD_TYPES = [
  { value: '', label: 'Selecionar madeira...' },
  { value: 'Pinus', label: 'Pinus' },
  { value: 'Eucalipto', label: 'Eucalipto' },
  { value: 'Jaqueira', label: 'Jaqueira' },
  { value: 'Vinhático', label: 'Vinhático' },
  { value: 'Tauari', label: 'Tauari' },
  { value: 'Outra', label: 'Outra (campo livre)' },
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
  const user = useAuthStore((s) => s.user)!;
  const { data: allApiaries = [] } = useApiaries();
  const { data: speciesList = [] } = useSpecies();

  // Responsável only sees their assigned apiaries
  const apiaries = user.role === 'responsavel'
    ? allApiaries.filter((a) => user.apiary_local_ids.includes(a.local_id))
    : allApiaries;

  const apiaryOptions = [
    { value: '', label: 'Selecionar meliponário...' },
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
    modules_count: initial?.modules_count != null ? String(initial.modules_count) : '1',
    wood_type: initial?.wood_type ?? '',
    wood_type_other: initial?.wood_type_other ?? '',
    notes: initial?.notes ?? '',
    has_honey_super: initial?.has_honey_super ?? false,
    honey_super_placed_at: initial?.honey_super_placed_at ?? '',
    honey_super_removed_at: initial?.honey_super_removed_at ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = HiveCreateSchema.safeParse({
      ...form,
      species_local_id: form.species_local_id || null,
      installation_date: form.installation_date || null,
      box_type: form.box_type || '',
      modules_count: form.modules_count ? parseInt(form.modules_count, 10) : null,
      wood_type: form.wood_type || null,
      wood_type_other: form.wood_type === 'Outra' ? (form.wood_type_other || null) : null,
      honey_super_placed_at: form.has_honey_super && form.honey_super_placed_at ? form.honey_super_placed_at : null,
      honey_super_removed_at: !form.has_honey_super && form.honey_super_removed_at ? form.honey_super_removed_at : null,
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
          label="Código da Caixa *"
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
          label="Modelo"
          options={BOX_TYPES}
          value={form.box_type}
          onChange={(e) => set('box_type', e.target.value)}
        />
        <Input
          label="Data de Instalação"
          type="date"
          value={form.installation_date ?? ''}
          onChange={(e) => set('installation_date', e.target.value)}
        />
        <Input
          label="Nº de módulos"
          type="number"
          min={1}
          value={form.modules_count}
          onChange={(e) => set('modules_count', e.target.value)}
        />
        <Select
          label="Madeira da caixa"
          options={WOOD_TYPES}
          value={form.wood_type}
          onChange={(e) => set('wood_type', e.target.value)}
        />
        {form.wood_type === 'Outra' && (
          <Input
            label="Especifique a madeira"
            value={form.wood_type_other}
            onChange={(e) => set('wood_type_other', e.target.value)}
            placeholder="ex: Cedro rosa"
          />
        )}
      </div>

      {/* Melgueira */}
      <div className="space-y-3 border border-stone-700 rounded-lg p-3">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.has_honey_super}
            onChange={(e) => {
              set('has_honey_super', e.target.checked);
              if (!e.target.checked) set('honey_super_placed_at', '');
            }}
            className="w-4 h-4 rounded accent-amber-500"
          />
          <span className="text-sm font-medium text-stone-200">Tem melgueira</span>
        </label>
        {form.has_honey_super && (
          <Input
            label="Data de colocação"
            type="date"
            value={form.honey_super_placed_at}
            onChange={(e) => set('honey_super_placed_at', e.target.value)}
          />
        )}
        {!form.has_honey_super && !!initial?.has_honey_super && (
          <Input
            label="Data de retirada"
            type="date"
            value={form.honey_super_removed_at}
            onChange={(e) => set('honey_super_removed_at', e.target.value)}
          />
        )}
      </div>

      <Textarea label="Observações" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={isPending} className="flex-1">
          {initial ? 'Salvar Alterações' : 'Criar Caixa'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}
