import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { InspectionChecklistForm } from '@/components/inspection/InspectionChecklist';
import { useCreateInspection } from '@/hooks/useInspections';
import { useHives } from '@/hooks/useHives';
import { useUIStore } from '@/store/uiStore';
import { InspectionCreateSchema } from '@bee-forest/shared';
import { todayISO, nowISO } from '@/utils/dates';
import type { InspectionChecklist } from '@bee-forest/shared';

const DEFAULT_CHECKLIST: InspectionChecklist = {
  population_strength: 3,
  brood_present: true,
  queen_seen: null,
  honey_stores: 'adequate',
  pests_observed: [],
  diseases_observed: [],
  propolis_quality: null,
  temperament: null,
  needs_feeding: false,
  needs_space_expansion: false,
};

const WEATHER_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'sunny', label: '☀️ Ensolarado' },
  { value: 'cloudy', label: '⛅ Nublado' },
  { value: 'rainy', label: '🌧️ Chuvoso' },
];

interface Props {
  defaultHiveId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function InspectionForm({ defaultHiveId, onSuccess, onCancel }: Props) {
  const navigate = useNavigate();
  const createInspection = useCreateInspection();
  const { data: hives = [] } = useHives();
  const { inspectorName } = useUIStore();

  const hiveOptions = [
    { value: '', label: 'Selecionar colmeia...' },
    ...hives.filter((h) => h.status === 'active').map((h) => ({ value: h.local_id, label: h.code })),
  ];

  const [form, setForm] = useState({
    hive_local_id: defaultHiveId ?? '',
    inspected_at: nowISO().slice(0, 16),
    inspector_name: inspectorName,
    weight_kg: '',
    temperature_c: '',
    weather: '',
    notes: '',
    next_inspection_due: '',
  });
  const [checklist, setChecklist] = useState<InspectionChecklist>(DEFAULT_CHECKLIST);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = InspectionCreateSchema.safeParse({
      hive_local_id: form.hive_local_id,
      inspected_at: new Date(form.inspected_at).toISOString(),
      inspector_name: form.inspector_name,
      checklist,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      temperature_c: form.temperature_c ? parseFloat(form.temperature_c) : null,
      weather: form.weather || null,
      notes: form.notes,
      photos: [],
      next_inspection_due: form.next_inspection_due || null,
    });

    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => { errs[e.path[0]] = e.message; });
      setErrors(errs);
      return;
    }

    const inspection = await createInspection.mutateAsync(result.data);
    onSuccess();
    navigate(`/hives/${form.hive_local_id}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Select
            label="Colmeia *"
            options={hiveOptions}
            value={form.hive_local_id}
            onChange={(e) => set('hive_local_id', e.target.value)}
            error={errors.hive_local_id}
          />
        </div>
        <Input
          label="Data e Hora"
          type="datetime-local"
          value={form.inspected_at}
          onChange={(e) => set('inspected_at', e.target.value)}
        />
        <Input
          label="Inspetor"
          value={form.inspector_name}
          onChange={(e) => set('inspector_name', e.target.value)}
          placeholder="Nome do inspetor"
        />
        <Input
          label="Temperatura (°C)"
          type="number"
          step="0.1"
          value={form.temperature_c}
          onChange={(e) => set('temperature_c', e.target.value)}
          placeholder="ex: 28.5"
        />
        <Select
          label="Clima"
          options={WEATHER_OPTIONS}
          value={form.weather}
          onChange={(e) => set('weather', e.target.value)}
        />
      </div>

      {/* Checklist */}
      <div className="border-t border-stone-800 pt-4">
        <h3 className="font-semibold text-stone-200 mb-4">Checklist da Inspeção</h3>
        <InspectionChecklistForm value={checklist} onChange={setChecklist} />
      </div>

      <Textarea
        label="Observações gerais"
        value={form.notes}
        onChange={(e) => set('notes', e.target.value)}
        placeholder="Anotações adicionais..."
      />

      <Input
        label="Próxima inspeção prevista"
        type="date"
        value={form.next_inspection_due}
        onChange={(e) => set('next_inspection_due', e.target.value)}
      />

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={createInspection.isPending} className="flex-1">
          Registrar Inspeção
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}
