import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { InspectionChecklistForm } from '@/components/inspection/InspectionChecklist';
import { SanidadeTab } from '@/components/inspection/SanidadeTab';
import { FotoAnaliseIA } from '@/components/inspection/FotoAnaliseIA';
import { useCreateInspection } from '@/hooks/useInspections';
import { useHives } from '@/hooks/useHives';
import { useUIStore } from '@/store/uiStore';
import { useInspectionAI } from '@/hooks/useInspectionAI';
import { InspectionCreateSchema, SANIDADE_INITIAL_VALUES } from '@bee-forest/shared';
import { todayISO, nowISO } from '@/utils/dates';
import type { InspectionChecklist } from '@bee-forest/shared';
import type { InspectionAIResult } from '@/types/inspection';

const DEFAULT_CHECKLIST: InspectionChecklist = {
  // Contexto
  inspection_type: 'external_internal',
  time_of_day: 'morning',

  // Clima
  precipitation_observed: false,
  weather_feel: [],
  perceived_bloom: 'medium',
  weather_notes: '',

  // Atividade
  activity_level: 'normal',
  activity_observations: ['organized_entry'],
  entry_notes: '',

  // Força da colônia
  colony_strength: 'medium',
  strength_observations: ['compatible_population'],

  // Reservas
  honey_stores: 'adequate',
  pollen_stores: 'adequate',
  food_observations: ['honey_pots_intact', 'pollen_pots_intact'],
  food_notes: '',

  // Cria
  brood_status: 'normal',
  brood_observations: ['queen_visualized', 'recent_laying_visible', 'normal_brood'],
  brood_notes: '',

  // Condição da caixa
  box_observations: ['intact_box', 'lid_sealing_well', 'adequate_entrance'],
  box_notes: '',

  // Sanidade — valores neutros (exclusão mútua gerenciada pelo SanidadeTab)
  invaders: ['ausentes'],
  other_invader_text: '',
  weakness_signs: ['nenhum'],
  internal_changes: ['nenhuma'],
  odor_description: '',
  sanitary_severity: null,

  // Potencial produtivo
  productive_potential: 'medium',
  productive_observations: ['good_food_intake', 'apt_for_production'],
  productive_notes: '',

  // Manejo
  management_actions: ['no_intervention'],
  management_description: '',
  materials_used: '',

  // Tarefas
  tasks: [],

  // Conclusão
  overall_status: 'healthy',
  recommendation: 'maintain_routine',
  next_inspection_days: 7,
  final_summary: '',
  generate_alert: false,
  notify_technician: false,
  mark_priority: false,
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
    { value: '', label: 'Selecionar caixa de abelha...' },
    ...hives.filter((h) => h.status === 'active').map((h) => ({ value: h.local_id, label: h.code })),
  ];

  const [form, setForm] = useState({
    hive_local_id: defaultHiveId ?? '',
    inspected_at: nowISO().slice(0, 16),
    inspector_name: inspectorName,
    weight_kg: '',
    temperature_c: '',
    sky_condition: '',
    notes: '',
    next_inspection_due: '',
  });
  const [checklist, setChecklist] = useState<InspectionChecklist>(DEFAULT_CHECKLIST);
  const [sanidade, setSanidade] = useState(SANIDADE_INITIAL_VALUES);
  const [aiSuggestions, setAISuggestions] = useState<InspectionAIResult | null>(null);
  const [showFotoAnaliseIA, setShowFotoAnaliseIA] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // setFieldValue unificado para o hook useInspectionAI
  const setFieldValue = (field: string, value: unknown) => {
    if (field === 'invasores' || field === 'sinaisEnfraquecimento' || field === 'alteracoesInternas') {
      setSanidade((s) => ({ ...s, [field]: value as string[] }));
    } else if (field.startsWith('_aiSuggestion_')) {
      // sugestões de sanidade com confiança média — passa para o SanidadeTab via aiSuggestions
    } else {
      setForm((f) => ({ ...f, [field]: value }));
    }
  };

  const { aplicarResultadoIA } = useInspectionAI(setFieldValue);

  const handleAIResult = (resultado: InspectionAIResult) => {
    setAISuggestions(resultado);
    aplicarResultadoIA(resultado);
  };

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = InspectionCreateSchema.safeParse({
      hive_local_id: form.hive_local_id,
      inspected_at: new Date(form.inspected_at).toISOString(),
      inspector_name: form.inspector_name,
      checklist: {
        ...checklist,
        invaders: sanidade.invasores,
        weakness_signs: sanidade.sinaisEnfraquecimento,
        internal_changes: sanidade.alteracoesInternas,
      },
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      temperature_c: form.temperature_c ? parseFloat(form.temperature_c) : null,
      sky_condition: form.sky_condition || null,
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
            label="Caixa de abelha *"
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
          value={form.sky_condition}
          onChange={(e) => set('sky_condition', e.target.value)}
        />
      </div>

      {/* Botão de análise por IA */}
      <div className="border-t border-stone-800 pt-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 className="font-semibold text-stone-200">Análise por IA</h3>
          <button
            type="button"
            onClick={() => setShowFotoAnaliseIA((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 8,
              border: '1px solid var(--color-border-tertiary)',
              background: showFotoAnaliseIA ? 'var(--color-background-info)' : 'var(--color-background-secondary)',
              color: showFotoAnaliseIA ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            🤖 {showFotoAnaliseIA ? 'Fechar' : 'Preencher com fotos'}
          </button>
        </div>
        {showFotoAnaliseIA && (
          <div style={{ marginBottom: 20 }}>
            <FotoAnaliseIA
              onResultado={handleAIResult}
              onFechar={() => setShowFotoAnaliseIA(false)}
            />
          </div>
        )}
      </div>

      {/* Checklist */}
      <div className="border-t border-stone-800 pt-4">
        <h3 className="font-semibold text-stone-200 mb-4">Checklist da Inspeção</h3>
        <InspectionChecklistForm value={checklist} onChange={setChecklist} />
      </div>

      {/* Sanidade */}
      <div className="border-t border-stone-800 pt-4">
        <h3 className="font-semibold text-stone-200 mb-1">Sanidade</h3>
        <SanidadeTab
          values={sanidade}
          onChange={(field, value) => setSanidade((s) => ({ ...s, [field]: value }))}
          aiSuggestions={aiSuggestions ?? undefined}
        />
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
