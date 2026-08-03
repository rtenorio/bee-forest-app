import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useCreateInspection } from '@/hooks/useInspections';
import { useCreateDivision } from '@/hooks/useDivisions';
import { useHives } from '@/hooks/useHives';
import { useApiaries } from '@/hooks/useApiaries';
import { useAuthStore } from '@/store/authStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Textarea';
import { InspectionSection } from '@/components/inspection/InspectionSection';
import { ChipGroup } from '@/components/inspection/ChipGroup';
import { OptionCards } from '@/components/inspection/OptionCards';
import { InspectionSummaryCard, computeScore } from '@/components/inspection/InspectionSummaryCard';
import { cn } from '@/utils/cn';
import { todayISO } from '@/utils/dates';
import {
  toggleInvasores,
  toggleSinaisEnfraquecimento,
  toggleAlteracoesInternas,
} from '@bee-forest/shared';
import type {
  InspectionChecklist,
  InspectionTask,
  SkyCondition,
} from '@bee-forest/shared';

// ─── Chip option lists (mesmas usadas em ColonyInspectionPage) ────────────────

const ACTIVITY_CHIPS = [
  { value: 'entrada_organizada', label: 'Entrada organizada' },
  { value: 'entrada_desorganizada', label: 'Entrada desorganizada' },
  { value: 'muitas_campeiras', label: 'Muitas campeiras retornando' },
  { value: 'pouco_fluxo', label: 'Pouco fluxo' },
  { value: 'defesa_ativa', label: 'Defesa ativa' },
  { value: 'comportamento_anormal', label: 'Comportamento anormal' },
];

const STRENGTH_CHIPS = [
  { value: 'populacao_reduzida', label: 'População reduzida' },
  { value: 'populacao_compativel', label: 'População compatível' },
  { value: 'alta_densidade', label: 'Alta densidade' },
  { value: 'colonia_em_expansao', label: 'Colônia em expansão' },
  { value: 'colonia_em_retracao', label: 'Colônia em retração' },
];

const FOOD_CHIPS = [
  { value: 'potes_mel_integros', label: 'Potes de mel íntegros' },
  { value: 'potes_polen_integros', label: 'Potes de pólen íntegros' },
  { value: 'mel_recém_armazenado', label: 'Mel recém armazenado' },
  { value: 'polen_aspecto_normal', label: 'Pólen com aspecto normal' },
  { value: 'sinais_consumo_elevado', label: 'Sinais de consumo elevado' },
  { value: 'polen_deteriorado', label: 'Pólen deteriorado' },
  { value: 'potes_rompidos', label: 'Potes rompidos' },
];

const BROOD_CHIPS = [
  { value: 'rainha_visualizada', label: 'Rainha visualizada' },
  { value: 'postura_recente', label: 'Postura recente visível' },
  { value: 'cria_normal', label: 'Cria normal' },
  { value: 'cria_desorganizada', label: 'Cria desorganizada' },
  { value: 'falha_postura', label: 'Falha de postura' },
  { value: 'suspeita_orfandade', label: 'Suspeita de perda de rainha' },
  { value: 'discos_irregulares', label: 'Discos de cria irregulares' },
];

const BOX_CHIPS = [
  { value: 'caixa_integra', label: 'Caixa íntegra' },
  { value: 'tampa_vedando', label: 'Tampa vedando bem' },
  { value: 'entrada_adequada', label: 'Entrada adequada' },
  { value: 'umidade_excessiva', label: 'Umidade excessiva' },
  { value: 'mofo', label: 'Mofo' },
  { value: 'estrutura_danificada', label: 'Estrutura danificada' },
  { value: 'frestas', label: 'Frestas' },
  { value: 'sinais_cupim', label: 'Sinais de cupim' },
  { value: 'suporte_comprometido', label: 'Suporte comprometido' },
];

const INVADER_CHIPS = [
  { value: 'ausentes', label: 'Ausentes' },
  { value: 'formigas', label: 'Formigas' },
  { value: 'moscas_foridas', label: 'Moscas fóridas' },
  { value: 'forideos_nos_potes', label: 'Forídeos nos potes' },
  { value: 'aranhas', label: 'Aranhas' },
  { value: 'lagartixa', label: 'Lagartixa' },
  { value: 'cupins', label: 'Cupins' },
  { value: 'saque_outras_abelhas', label: 'Saque por outras abelhas' },
  { value: 'outros', label: 'Outros' },
];

const WEAKNESS_CHIPS = [
  { value: 'nenhum', label: 'Nenhum' },
  { value: 'baixa_atividade', label: 'Baixa atividade' },
  { value: 'poucas_campeiras', label: 'Poucas campeiras' },
  { value: 'colonia_fraca', label: 'Colônia fraca' },
  { value: 'sem_postura_visivel', label: 'Sem postura visível' },
  { value: 'suspeita_orfandade', label: 'Suspeita de orfandade' },
  { value: 'abandono_parcial', label: 'Abandono parcial' },
  { value: 'abandono_total', label: 'Abandono total' },
];

const INTERNAL_CHIPS = [
  { value: 'nenhuma', label: 'Nenhuma' },
  { value: 'umidade_excessiva', label: 'Umidade excessiva' },
  { value: 'mofo', label: 'Mofo' },
  { value: 'mel_fermentando', label: 'Mel fermentando' },
  { value: 'polen_deteriorado', label: 'Pólen deteriorado' },
  { value: 'potes_rompidos', label: 'Potes rompidos' },
  { value: 'odor_anormal', label: 'Odor anormal' },
];

const PRODUCTIVE_CHIPS = [
  { value: 'boa_entrada_alimento', label: 'Boa entrada de alimento' },
  { value: 'colonia_em_recuperacao', label: 'Colônia em recuperação' },
  { value: 'colonia_pronta_expansao', label: 'Pronta para expansão' },
  { value: 'apta_divisao_futura', label: 'Apta para divisão futura' },
  { value: 'apta_producao', label: 'Apta para produção' },
  { value: 'nao_apta_manejo_produtivo', label: 'Não apta para manejo produtivo' },
];

const MANAGEMENT_CHIPS = [
  { value: 'sem_intervencao', label: 'Sem intervenção' },
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'limpeza_externa', label: 'Limpeza externa' },
  { value: 'controle_formigas', label: 'Controle de formigas' },
  { value: 'reducao_entrada', label: 'Redução da entrada' },
  { value: 'troca_caixa', label: 'Troca de caixa' },
  { value: 'ajuste_vedacao', label: 'Ajuste de vedação' },
  { value: 'reorganizacao_interna', label: 'Reorganização interna' },
  { value: 'divisao', label: 'Divisão' },
  { value: 'isolamento_colonia', label: 'Isolamento da colônia' },
  { value: 'uniao_colonia', label: 'União com outra colônia' },
  { value: 'encaminhada_avaliacao', label: 'Encaminhada para avaliação técnica' },
];

const PREDEFINED_TASKS = [
  { value: 'fornecer_xarope', label: 'Fornecer xarope' },
  { value: 'fornecer_bombom_polen', label: 'Fornecer bombom de pólen' },
  { value: 'fornecer_cera', label: 'Fornecer cera' },
  { value: 'aplicar_formicida', label: 'Aplicar formicida' },
  { value: 'combater_forideos', label: 'Combater forídeos' },
  { value: 'acrescentar_modulo', label: 'Acrescentar módulo' },
  { value: 'retirar_modulo', label: 'Retirar módulo' },
  { value: 'trocar_acetato', label: 'Trocar acetato' },
  { value: 'trocar_fitas', label: 'Trocar fitas' },
  { value: 'agendar_divisao', label: 'Agendar divisão' },
  { value: 'colher_mel', label: 'Colher mel' },
  { value: 'trocar_caixa', label: 'Trocar caixa' },
];

const WEATHER_FEEL_CHIPS = [
  { value: 'dry', label: 'Seco' },
  { value: 'humid', label: 'Úmido' },
  { value: 'rainy', label: 'Chuvoso' },
  { value: 'very_hot', label: 'Muito quente' },
];

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  inspected_at: string;
  inspector_name: string;
  weight_kg: string;
  temperature_c: string;
  humidity_pct: string;
  precipitation_mm: string;
  sky_condition: SkyCondition | null;
  notes: string;
  next_inspection_due: string;
  checklist: InspectionChecklist;
}

function defaultChecklist(): InspectionChecklist {
  return {
    inspection_type: 'external_internal',
    time_of_day: 'morning',
    precipitation_observed: false,
    weather_feel: [],
    perceived_bloom: 'medium',
    weather_notes: '',
    activity_level: 'normal',
    activity_observations: ['entrada_organizada'],
    entry_notes: '',
    colony_strength: 'medium',
    strength_observations: ['populacao_compativel'],
    honey_stores: 'adequate',
    pollen_stores: 'adequate',
    food_observations: ['potes_mel_integros', 'potes_polen_integros'],
    food_notes: '',
    brood_status: 'normal',
    brood_observations: ['rainha_visualizada', 'postura_recente', 'cria_normal'],
    brood_notes: '',
    box_observations: ['caixa_integra', 'tampa_vedando', 'entrada_adequada'],
    box_notes: '',
    invaders: ['ausentes'],
    other_invader_text: '',
    weakness_signs: ['nenhum'],
    internal_changes: ['nenhuma'],
    odor_description: '',
    sanitary_severity: null,
    productive_potential: 'medium',
    productive_observations: ['boa_entrada_alimento', 'apta_producao'],
    productive_notes: '',
    management_actions: ['sem_intervencao'],
    management_description: '',
    materials_used: '',
    tasks: [],
    overall_status: 'healthy',
    recommendation: 'maintain_routine',
    next_inspection_days: 7,
    final_summary: '',
    generate_alert: false,
    notify_technician: false,
    mark_priority: false,
  };
}

function makeDefault(inspectorName: string): FormState {
  return {
    inspected_at: todayISO() + 'T' + new Date().toTimeString().slice(0, 5),
    inspector_name: inspectorName,
    weight_kg: '',
    temperature_c: '',
    humidity_pct: '',
    precipitation_mm: '',
    sky_condition: null,
    notes: '',
    next_inspection_due: '',
    checklist: defaultChecklist(),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2">
      <p className="text-sm font-medium text-stone-300">{children}</p>
      {hint && <p className="text-xs text-stone-500 mt-0.5">{hint}</p>}
    </div>
  );
}

function NumericInput({
  label, unit, value, onChange, min, max, step = 1,
}: {
  label: string; unit: string; value: string;
  onChange: (v: string) => void; min?: number; max?: number; step?: number;
}) {
  return (
    <div>
      <p className="text-xs text-stone-400 mb-1">{label}</p>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min} max={max} step={step}
          className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 pr-10 text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          placeholder="—"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500 pointer-events-none">{unit}</span>
      </div>
    </div>
  );
}

function TaskRow({
  task, onChange, onRemove,
}: {
  task: InspectionTask;
  onChange: (t: InspectionTask) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-stone-800/60 border border-stone-700 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-stone-200">
          {task.label === 'tarefa_personalizada'
            ? (task.custom_text || 'Tarefa personalizada')
            : PREDEFINED_TASKS.find((t) => t.value === task.label)?.label ?? task.label}
        </p>
        <button type="button" onClick={onRemove} className="text-stone-500 hover:text-red-400 transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {task.label === 'tarefa_personalizada' && (
        <input
          type="text"
          placeholder="Descreva a tarefa"
          value={task.custom_text}
          onChange={(e) => onChange({ ...task, custom_text: e.target.value })}
          className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      )}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-xs text-stone-500 mb-1">Prazo</p>
          <input
            type="date"
            value={task.due_date ?? ''}
            onChange={(e) => onChange({ ...task, due_date: e.target.value || null })}
            className="w-full bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-stone-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div>
          <p className="text-xs text-stone-500 mb-1">Responsável</p>
          <input
            type="text"
            value={task.assignee_name}
            onChange={(e) => onChange({ ...task, assignee_name: e.target.value })}
            placeholder="Nome"
            className="w-full bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-stone-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div>
          <p className="text-xs text-stone-500 mb-1">Prioridade</p>
          <select
            value={task.priority}
            onChange={(e) => onChange({ ...task, priority: e.target.value as InspectionTask['priority'] })}
            className="w-full bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-stone-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="normal">Normal</option>
            <option value="urgent">Urgente</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BatchInspectionPage() {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const user = useAuthStore((s) => s.user);

  const { data: hives = [], isLoading: hivesLoading } = useHives();
  const { data: apiaries = [] } = useApiaries();
  const createInspection = useCreateInspection();
  const createDivision = useCreateDivision();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [apiaryId, setApiaryId] = useState('');
  const [selectedHiveIds, setSelectedHiveIds] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>(() => makeDefault(user?.name ?? ''));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [batchError, setBatchError] = useState<{ saved: number; total: number; hiveCode: string; message: string } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherFetched, setWeatherFetched] = useState(false);

  const accessibleHives = useMemo(() => {
    if (!user) return [];
    return user.role === 'tratador'
      ? hives.filter((h) => user.hive_local_ids.includes(h.local_id) && h.status === 'active' && !h.deleted_at)
      : hives.filter((h) => h.status === 'active' && !h.deleted_at);
  }, [hives, user]);

  const apiariesWithAccessibleHives = useMemo(() => {
    const ids = new Set(accessibleHives.map((h) => h.apiary_local_id));
    return apiaries.filter((a) => ids.has(a.local_id) && !a.deleted_at);
  }, [apiaries, accessibleHives]);

  const apiary = apiaries.find((a) => a.local_id === apiaryId) ?? null;

  const apiaryHives = useMemo(() => {
    if (!apiaryId) return [];
    return [...accessibleHives.filter((h) => h.apiary_local_id === apiaryId)]
      .sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }));
  }, [accessibleHives, apiaryId]);

  const selectedHives = useMemo(
    () => apiaryHives.filter((h) => selectedHiveIds.includes(h.local_id)),
    [apiaryHives, selectedHiveIds]
  );

  // Reset hive selection when apiary changes
  useEffect(() => {
    setSelectedHiveIds([]);
    setWeatherFetched(false);
  }, [apiaryId]);

  // Auto-fetch weather when entering step 3 with an apiary that has coordinates
  useEffect(() => {
    if (step !== 3 || weatherFetched || !apiary?.latitude || !apiary.longitude || !isOnline) return;
    setWeatherLoading(true);
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${apiary.latitude}&longitude=${apiary.longitude}&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover&timezone=America/Recife`
    )
      .then((r) => r.json())
      .then((data) => {
        const c = data?.current ?? {};
        const cloudCover: number = c.cloud_cover ?? 0;
        const sky: SkyCondition = cloudCover < 25 ? 'sunny' : cloudCover < 75 ? 'partly_cloudy' : 'cloudy';
        setForm((f) => ({
          ...f,
          temperature_c: c.temperature_2m != null ? String(c.temperature_2m) : f.temperature_c,
          humidity_pct: c.relative_humidity_2m != null ? String(c.relative_humidity_2m) : f.humidity_pct,
          precipitation_mm: c.precipitation != null ? String(c.precipitation) : f.precipitation_mm,
          sky_condition: sky,
          checklist: { ...f.checklist, precipitation_observed: (c.precipitation ?? 0) > 0 },
        }));
        setWeatherFetched(true);
      })
      .catch(() => { /* offline / failure — user fills manually */ })
      .finally(() => setWeatherLoading(false));
  }, [step, weatherFetched, apiary, isOnline]);

  const setCL = useCallback(<K extends keyof InspectionChecklist>(key: K, value: InspectionChecklist[K]) => {
    setForm((f) => ({ ...f, checklist: { ...f.checklist, [key]: value } }));
  }, []);

  const score = computeScore(form.checklist);

  const addTask = (label: string) => {
    const task: InspectionTask = {
      id: uuidv4(), label, custom_text: '', due_date: null, assignee_name: '', priority: 'normal',
    };
    setCL('tasks', [...form.checklist.tasks, task]);
  };
  const updateTask = (id: string, updated: InspectionTask) => {
    setCL('tasks', form.checklist.tasks.map((t) => t.id === id ? updated : t));
  };
  const removeTask = (id: string) => {
    setCL('tasks', form.checklist.tasks.filter((t) => t.id !== id));
  };

  const toggleHive = (id: string) => {
    setSelectedHiveIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };
  const selectAllHives = () => setSelectedHiveIds(apiaryHives.map((h) => h.local_id));
  const clearHives = () => setSelectedHiveIds([]);

  const nextDueFromDays = (days: number | null): string | null => {
    if (!days) return form.next_inspection_due || null;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const submit = async () => {
    if (selectedHiveIds.length === 0) return;
    setSubmitting(true);
    setBatchError(null);
    setProgress({ done: 0, total: selectedHiveIds.length });

    const checklist: InspectionChecklist = {
      ...form.checklist,
      overall_status: form.checklist.overall_status ?? score.status,
      recommendation: form.checklist.recommendation ?? score.recommendation,
    };
    const next_inspection_due = nextDueFromDays(checklist.next_inspection_days);
    const willCreateDivision = checklist.management_actions.includes('divisao');

    let saved = 0;
    try {
      for (let i = 0; i < selectedHives.length; i++) {
        const hive = selectedHives[i];
        await createInspection.mutateAsync({
          hive_local_id: hive.local_id,
          inspected_at: form.inspected_at,
          inspector_name: form.inspector_name,
          checklist,
          weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
          temperature_c: form.temperature_c ? parseFloat(form.temperature_c) : null,
          humidity_pct: form.humidity_pct ? parseFloat(form.humidity_pct) : null,
          precipitation_mm: form.precipitation_mm ? parseFloat(form.precipitation_mm) : null,
          sky_condition: form.sky_condition,
          notes: checklist.final_summary || form.notes,
          photos: [],
          audio_notes: [],
          next_inspection_due,
          copied_from_previous: false,
        });

        if (willCreateDivision && hive.apiary_local_id) {
          createDivision.mutate({
            local_id: uuidv4(),
            hive_origin_local_id: hive.local_id,
            apiary_origin_local_id: hive.apiary_local_id,
            identified_at: form.inspected_at.slice(0, 10),
            identified_by: form.inspector_name || user?.name || '',
          });
        }

        saved = i + 1;
        setProgress({ done: saved, total: selectedHiveIds.length });
      }
      navigate('/inspections');
    } catch (err) {
      console.error('[BatchInspectionPage] erro ao salvar lote:', err);
      setBatchError({
        saved,
        total: selectedHiveIds.length,
        hiveCode: selectedHives[saved]?.code ?? '—',
        message: err instanceof Error ? err.message : String(err),
      });
      // As caixas já salvas permanecem — remove-as da seleção para permitir retomar o lote
      if (saved > 0) {
        const remaining = selectedHives.slice(saved).map((h) => h.local_id);
        setSelectedHiveIds(remaining);
      }
      setSubmitting(false);
      setProgress(null);
    }
  };

  // ── Render guards ─────────────────────────────────────────────────────────

  if (hivesLoading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const isInternal = form.checklist.inspection_type === 'external_internal';

  // Option lists
  const skyOptions = [
    { value: 'sunny', label: 'Ensolarado', icon: '☀️' },
    { value: 'partly_cloudy', label: 'Parcialmente nublado', icon: '⛅' },
    { value: 'cloudy', label: 'Nublado', icon: '☁️' },
  ];
  const contextTypeOptions = [
    { value: 'external_only', label: 'Somente externa', description: 'Avaliação visual da entrada' },
    { value: 'external_internal', label: 'Externa + interna', description: 'Inclui abertura da caixa' },
  ];
  const timeOptions = [
    { value: 'morning', label: 'Manhã', icon: '🌅' },
    { value: 'afternoon', label: 'Tarde', icon: '☀️' },
    { value: 'night', label: 'Noite', icon: '🌙' },
  ];
  const activityOptions = [
    { value: 'very_low', label: 'Muito baixa', icon: '😴' },
    { value: 'low', label: 'Baixa', icon: '😐' },
    { value: 'normal', label: 'Normal', icon: '✅' },
    { value: 'high', label: 'Alta', icon: '🐝' },
  ];
  const strengthOptions = [
    { value: 'very_weak', label: 'Muito fraca' },
    { value: 'weak', label: 'Fraca' },
    { value: 'medium', label: 'Média' },
    { value: 'strong', label: 'Forte' },
    { value: 'very_strong', label: 'Muito forte' },
  ];
  const storeOptions = [
    { value: 'low', label: 'Baixo', icon: '🔴' },
    { value: 'adequate', label: 'Adequado', icon: '🟡' },
    { value: 'high', label: 'Alto', icon: '🟢' },
  ];
  const broodOptions = [
    { value: 'not_evaluated', label: 'Não avaliada' },
    { value: 'reduced', label: 'Reduzida' },
    { value: 'normal', label: 'Normal' },
    { value: 'intense', label: 'Intensa' },
  ];
  const bloomOptions = [
    { value: 'low', label: 'Baixa', icon: '🌿' },
    { value: 'medium', label: 'Média', icon: '🌸' },
    { value: 'high', label: 'Alta', icon: '🌺' },
  ];
  const sanitaryOptions = [
    { value: 'mild', label: 'Leve', icon: '🟢' },
    { value: 'moderate', label: 'Moderada', icon: '🟡' },
    { value: 'severe', label: 'Grave', icon: '🟠' },
    { value: 'critical', label: 'Crítica', icon: '🔴' },
  ];
  const productiveOptions = [
    { value: 'very_low', label: 'Muito baixo' },
    { value: 'low', label: 'Baixo' },
    { value: 'medium', label: 'Médio' },
    { value: 'high', label: 'Alto' },
    { value: 'very_high', label: 'Muito alto' },
  ];
  const statusOptions = [
    { value: 'healthy', label: 'Saudável', icon: '✅' },
    { value: 'attention', label: 'Atenção', icon: '⚠️' },
    { value: 'high_risk', label: 'Alto risco', icon: '🔴' },
    { value: 'critical', label: 'Crítica', icon: '🚨' },
  ];
  const recOptions = [
    { value: 'maintain_routine', label: 'Manter rotina normal' },
    { value: 'reassess_soon', label: 'Reavaliar em breve' },
    { value: 'corrective_management', label: 'Exige manejo corretivo' },
    { value: 'refer_to_technician', label: 'Encaminhar ao técnico' },
  ];
  const nextInspDaysOptions = [
    { value: '3', label: '3 dias' },
    { value: '7', label: '7 dias' },
    { value: '15', label: '15 dias' },
    { value: '30', label: '30 dias' },
  ];

  return (
    <div className="min-h-screen bg-stone-950">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-stone-950/95 backdrop-blur-sm border-b border-stone-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-stone-700 text-stone-400 hover:text-stone-200 hover:border-stone-600 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-stone-100 leading-tight">Inspeção em Lote</h1>
            <p className="text-xs text-stone-500 truncate">
              Etapa {step} de 3 · {step === 1 ? 'Meliponário' : step === 2 ? 'Caixas' : 'Checklist'}
            </p>
          </div>
          {!isOnline && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Offline
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-1">
          {[1, 2, 3].map((s) => (
            <div key={s} className={cn(
              'flex-1 h-1.5 rounded-full',
              s <= step ? 'bg-amber-500' : 'bg-stone-800'
            )} />
          ))}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4 pb-32">

        {/* ═══ STEP 1: Selecionar meliponário ═══════════════════════════════ */}
        {step === 1 && (
          <section className="bg-stone-900 border border-stone-800 rounded-2xl px-6 py-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-stone-100 mb-1">Qual meliponário?</h2>
              <p className="text-xs text-stone-500">A inspeção em lote é restrita a um único meliponário (mesmo clima e mesmo escopo).</p>
            </div>

            {apiariesWithAccessibleHives.length === 0 ? (
              <div className="bg-stone-800/50 border border-stone-700 rounded-xl px-4 py-6 text-center">
                <p className="text-sm text-stone-400">Nenhum meliponário com caixas acessíveis.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {apiariesWithAccessibleHives.map((a) => {
                  const count = accessibleHives.filter((h) => h.apiary_local_id === a.local_id).length;
                  const active = apiaryId === a.local_id;
                  return (
                    <button
                      key={a.local_id}
                      type="button"
                      onClick={() => setApiaryId(a.local_id)}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors text-left',
                        active
                          ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                          : 'bg-stone-800/60 border-stone-700 text-stone-300 hover:border-stone-600'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl flex-shrink-0">🏡</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{a.name}</p>
                          {a.location && <p className="text-xs text-stone-500 truncate">{a.location}</p>}
                        </div>
                      </div>
                      <span className="text-xs text-stone-500 flex-shrink-0">{count} caixa{count !== 1 ? 's' : ''}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ═══ STEP 2: Selecionar caixas ═══════════════════════════════════ */}
        {step === 2 && (
          <section className="bg-stone-900 border border-stone-800 rounded-2xl px-6 py-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-stone-100 mb-1">Caixas que receberão a inspeção</h2>
                <p className="text-xs text-stone-500 truncate">{apiary?.name} · {selectedHiveIds.length} de {apiaryHives.length} selecionadas</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button type="button" onClick={selectAllHives}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors px-2 py-1 rounded border border-amber-500/30"
                >Todas</button>
                <button type="button" onClick={clearHives}
                  className="text-xs text-stone-500 hover:text-stone-300 transition-colors px-2 py-1 rounded border border-stone-700"
                >Limpar</button>
              </div>
            </div>

            {apiaryHives.length === 0 ? (
              <div className="bg-stone-800/50 border border-stone-700 rounded-xl px-4 py-6 text-center">
                <p className="text-sm text-stone-400">Este meliponário não tem caixas ativas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {apiaryHives.map((h) => {
                  const checked = selectedHiveIds.includes(h.local_id);
                  return (
                    <label key={h.local_id} className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors',
                      checked
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                        : 'bg-stone-800/60 border-stone-700 text-stone-300 hover:border-stone-600'
                    )}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleHive(h.local_id)}
                        className="w-4 h-4 rounded border-stone-600 bg-stone-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-stone-950"
                      />
                      <span className="text-sm font-medium truncate">{h.code}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ═══ STEP 3: Checklist ════════════════════════════════════════════ */}
        {step === 3 && (
          <>
            {/* Falha parcial do lote */}
            {batchError && (
              <div className="bg-red-500/10 border border-red-500/40 rounded-2xl px-4 py-3 flex items-start gap-3">
                <span className="text-xl flex-shrink-0">⚠️</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-red-200">
                    {batchError.saved > 0
                      ? `${batchError.saved} de ${batchError.total} caixas salvas — falhou na caixa ${batchError.hiveCode}`
                      : `Nenhuma caixa foi salva — falhou na caixa ${batchError.hiveCode}`}
                  </p>
                  <p className="text-xs text-red-300/70 mt-0.5 break-words">{batchError.message}</p>
                  {batchError.saved > 0 && (
                    <p className="text-xs text-red-300/70 mt-1">
                      As caixas já salvas foram removidas da seleção. Clique em concluir para tentar as {selectedHiveIds.length} restantes.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Banner de contexto */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 flex items-start gap-3">
              <span className="text-xl flex-shrink-0">📋</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-200">
                  Esta inspeção será replicada em {selectedHiveIds.length} caixa{selectedHiveIds.length !== 1 ? 's' : ''} de {apiary?.name}
                </p>
                <p className="text-xs text-amber-300/70 mt-0.5">
                  Sem fotos, sem áudio, sem análise por IA — preencha os campos abaixo e a mesma inspeção será aplicada a todas.
                </p>
              </div>
            </div>

            {/* Identidade do lote */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl px-6 py-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-stone-500 mb-1">Data e hora</p>
                  <input
                    type="datetime-local"
                    value={form.inspected_at}
                    onChange={(e) => setForm((f) => ({ ...f, inspected_at: e.target.value }))}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <p className="text-xs text-stone-500 mb-1">Operador</p>
                  <input
                    type="text"
                    value={form.inspector_name}
                    onChange={(e) => setForm((f) => ({ ...f, inspector_name: e.target.value }))}
                    placeholder="Nome do operador"
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Clima */}
            <InspectionSection step={1} title="Condições Climáticas" subtitle="Dados automáticos — editáveis" icon="🌤️">
              {weatherLoading && (
                <div className="flex items-center gap-2 text-xs text-amber-400 mb-3">
                  <Spinner />
                  Buscando dados climáticos do meliponário…
                </div>
              )}
              {!isOnline && (
                <p className="text-xs text-stone-500 mb-3">Offline — preencha manualmente.</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <NumericInput label="Temperatura" unit="°C" value={form.temperature_c} onChange={(v) => setForm((f) => ({ ...f, temperature_c: v }))} step={0.1} />
                <NumericInput label="Umidade" unit="%" value={form.humidity_pct} onChange={(v) => setForm((f) => ({ ...f, humidity_pct: v }))} min={0} max={100} />
                <NumericInput label="Chuva" unit="mm" value={form.precipitation_mm} onChange={(v) => setForm((f) => ({ ...f, precipitation_mm: v }))} min={0} step={0.1} />
              </div>
              <div>
                <FieldLabel>Condição do céu</FieldLabel>
                <OptionCards options={skyOptions} value={form.sky_condition} onChange={(v) => setForm((f) => ({ ...f, sky_condition: v as SkyCondition }))} columns={3} compact />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCL('precipitation_observed', !form.checklist.precipitation_observed)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                    form.checklist.precipitation_observed
                      ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                      : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
                  )}
                >
                  🌧️ {form.checklist.precipitation_observed ? 'Chuva observada' : 'Sem chuva'}
                </button>
              </div>
              <div>
                <FieldLabel>Sensação climática</FieldLabel>
                <ChipGroup options={WEATHER_FEEL_CHIPS} value={form.checklist.weather_feel} onChange={(v) => setCL('weather_feel', v)} color="sky" />
              </div>
              <div>
                <FieldLabel>Florada percebida</FieldLabel>
                <OptionCards options={bloomOptions} value={form.checklist.perceived_bloom} onChange={(v) => setCL('perceived_bloom', v as InspectionChecklist['perceived_bloom'])} columns={3} compact />
              </div>
            </InspectionSection>

            {/* Contexto */}
            <InspectionSection step={2} title="Contexto da Inspeção" subtitle="Defina o tipo e horário" icon="📋">
              <div>
                <FieldLabel>Tipo de inspeção</FieldLabel>
                <OptionCards options={contextTypeOptions} value={form.checklist.inspection_type} onChange={(v) => setCL('inspection_type', v as InspectionChecklist['inspection_type'])} columns={2} />
              </div>
              <div>
                <FieldLabel>Horário</FieldLabel>
                <OptionCards options={timeOptions} value={form.checklist.time_of_day} onChange={(v) => setCL('time_of_day', v as InspectionChecklist['time_of_day'])} columns={3} compact />
              </div>
              {form.checklist.inspection_type === 'external_only' && (
                <p className="text-xs text-stone-500 bg-stone-800/50 border border-stone-700 rounded-lg px-3 py-2">
                  ℹ️ As seções "Cria" e "Alterações internas" serão ocultadas para inspeção somente externa.
                </p>
              )}
            </InspectionSection>

            {/* Atividade */}
            <InspectionSection step={3} title="Atividade na Entrada" subtitle="Avalie o movimento externo" icon="🚪">
              <div>
                <FieldLabel>Nível de atividade</FieldLabel>
                <OptionCards options={activityOptions} value={form.checklist.activity_level} onChange={(v) => setCL('activity_level', v as InspectionChecklist['activity_level'])} columns={4} compact />
              </div>
              <div>
                <FieldLabel>Observações</FieldLabel>
                <ChipGroup options={ACTIVITY_CHIPS} value={form.checklist.activity_observations} onChange={(v) => setCL('activity_observations', v)} />
              </div>
              <div>
                <FieldLabel hint="Opcional">Observações sobre a entrada</FieldLabel>
                <Textarea value={form.checklist.entry_notes} onChange={(e) => setCL('entry_notes', e.target.value)} placeholder="Ex: abelhas saindo agressivamente, pilhagem detectada…" rows={2} />
              </div>
            </InspectionSection>

            {/* Força */}
            <InspectionSection step={4} title="Força da Colônia" icon="💪">
              <div>
                <FieldLabel>Avaliação geral</FieldLabel>
                <OptionCards options={strengthOptions} value={form.checklist.colony_strength} onChange={(v) => setCL('colony_strength', v as InspectionChecklist['colony_strength'])} columns={5} compact />
              </div>
              <div>
                <FieldLabel>Observações</FieldLabel>
                <ChipGroup options={STRENGTH_CHIPS} value={form.checklist.strength_observations} onChange={(v) => setCL('strength_observations', v)} />
              </div>
            </InspectionSection>

            {/* Reservas */}
            <InspectionSection step={5} title="Reservas Alimentares" icon="🍯">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Mel</FieldLabel>
                  <OptionCards options={storeOptions} value={form.checklist.honey_stores} onChange={(v) => setCL('honey_stores', v as InspectionChecklist['honey_stores'])} columns={3} compact />
                </div>
                <div>
                  <FieldLabel>Pólen</FieldLabel>
                  <OptionCards options={storeOptions} value={form.checklist.pollen_stores} onChange={(v) => setCL('pollen_stores', v as InspectionChecklist['pollen_stores'])} columns={3} compact />
                </div>
              </div>
              <div>
                <FieldLabel>Observações</FieldLabel>
                <ChipGroup options={FOOD_CHIPS} value={form.checklist.food_observations} onChange={(v) => setCL('food_observations', v)} color="emerald" />
              </div>
              <div>
                <FieldLabel hint="Opcional">Observações sobre reservas</FieldLabel>
                <Textarea value={form.checklist.food_notes} onChange={(e) => setCL('food_notes', e.target.value)} placeholder="Detalhes sobre armazenamento ou consumo…" rows={2} />
              </div>
            </InspectionSection>

            {/* Cria (somente interna) */}
            {isInternal && (
              <InspectionSection step={6} title="Cria e Rainha" subtitle="Somente inspeção interna" icon="🥚">
                <div>
                  <FieldLabel>Situação da cria</FieldLabel>
                  <OptionCards options={broodOptions} value={form.checklist.brood_status} onChange={(v) => setCL('brood_status', v as InspectionChecklist['brood_status'])} columns={4} compact />
                </div>
                <div>
                  <FieldLabel>Observações</FieldLabel>
                  <ChipGroup options={BROOD_CHIPS} value={form.checklist.brood_observations} onChange={(v) => setCL('brood_observations', v)} color="emerald" />
                </div>
                <div>
                  <FieldLabel hint="Opcional">Observações sobre cria e rainha</FieldLabel>
                  <Textarea value={form.checklist.brood_notes} onChange={(e) => setCL('brood_notes', e.target.value)} placeholder="Discos de cria, postura, comportamento da rainha…" rows={2} />
                </div>
              </InspectionSection>
            )}

            {/* Caixa */}
            <InspectionSection step={isInternal ? 7 : 6} title="Condição da Caixa" icon="📦">
              <div>
                <FieldLabel>Observações</FieldLabel>
                <ChipGroup options={BOX_CHIPS} value={form.checklist.box_observations} onChange={(v) => setCL('box_observations', v)} color="sky" />
              </div>
              <div>
                <FieldLabel hint="Opcional">Observações estruturais</FieldLabel>
                <Textarea value={form.checklist.box_notes} onChange={(e) => setCL('box_notes', e.target.value)} placeholder="Estado da madeira, frestas, infiltrações…" rows={2} />
              </div>
            </InspectionSection>

            {/* Sanidade */}
            <InspectionSection step={isInternal ? 8 : 7} title="Sanidade" subtitle="Específico para uruçu — abelha sem ferrão" icon="🔬">
              <div>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Invasores e predadores</p>
                <ChipGroup
                  options={INVADER_CHIPS}
                  value={form.checklist.invaders}
                  onChange={(next) => {
                    const prev = form.checklist.invaders;
                    const toggled = next.find(x => !prev.includes(x)) ?? prev.find(x => !next.includes(x));
                    if (toggled) setCL('invaders', toggleInvasores(prev, toggled));
                  }}
                  color="red"
                />
                {form.checklist.invaders.includes('outros') && (
                  <input
                    type="text"
                    value={form.checklist.other_invader_text}
                    onChange={(e) => setCL('other_invader_text', e.target.value)}
                    placeholder="Qual invasor?"
                    className="mt-2 w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Sinais de enfraquecimento</p>
                <ChipGroup
                  options={WEAKNESS_CHIPS}
                  value={form.checklist.weakness_signs}
                  onChange={(next) => {
                    const prev = form.checklist.weakness_signs;
                    const toggled = next.find(x => !prev.includes(x)) ?? prev.find(x => !next.includes(x));
                    if (toggled) setCL('weakness_signs', toggleSinaisEnfraquecimento(prev, toggled));
                  }}
                  color="red"
                />
              </div>
              {isInternal && (
                <div>
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Alterações internas</p>
                  <ChipGroup
                    options={INTERNAL_CHIPS}
                    value={form.checklist.internal_changes}
                    onChange={(next) => {
                      const prev = form.checklist.internal_changes;
                      const toggled = next.find(x => !prev.includes(x)) ?? prev.find(x => !next.includes(x));
                      if (toggled) setCL('internal_changes', toggleAlteracoesInternas(prev, toggled));
                    }}
                    color="red"
                  />
                  {form.checklist.internal_changes.includes('odor_anormal') && (
                    <input
                      type="text"
                      value={form.checklist.odor_description}
                      onChange={(e) => setCL('odor_description', e.target.value)}
                      placeholder="Descreva o odor…"
                      className="mt-2 w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  )}
                </div>
              )}
              <div>
                <FieldLabel>Gravidade sanitária</FieldLabel>
                <OptionCards options={sanitaryOptions} value={form.checklist.sanitary_severity} onChange={(v) => setCL('sanitary_severity', v as InspectionChecklist['sanitary_severity'])} columns={4} compact />
              </div>
            </InspectionSection>

            {/* Potencial produtivo */}
            <InspectionSection step={isInternal ? 9 : 8} title="Potencial Produtivo" icon="📈">
              <div>
                <FieldLabel>Avaliação</FieldLabel>
                <OptionCards options={productiveOptions} value={form.checklist.productive_potential} onChange={(v) => setCL('productive_potential', v as InspectionChecklist['productive_potential'])} columns={5} compact />
              </div>
              <div>
                <FieldLabel>Observações</FieldLabel>
                <ChipGroup options={PRODUCTIVE_CHIPS} value={form.checklist.productive_observations} onChange={(v) => setCL('productive_observations', v)} color="emerald" />
              </div>
              <div>
                <FieldLabel hint="Opcional">Observação sobre potencial</FieldLabel>
                <Textarea value={form.checklist.productive_notes} onChange={(e) => setCL('productive_notes', e.target.value)} rows={2} />
              </div>
            </InspectionSection>

            {/* Manejo */}
            <InspectionSection step={isInternal ? 10 : 9} title="Manejo Realizado" icon="🛠️">
              <div>
                <FieldLabel>Ações realizadas</FieldLabel>
                <ChipGroup options={MANAGEMENT_CHIPS} value={form.checklist.management_actions} onChange={(v) => setCL('management_actions', v)} color="sky" />
              </div>
              {form.checklist.management_actions.includes('divisao') && (
                <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                  ⚠️ Divisão será criada em {selectedHiveIds.length} caixa{selectedHiveIds.length !== 1 ? 's' : ''} — confira se faz sentido aplicar a todas.
                </p>
              )}
              <div>
                <FieldLabel>Observações necessárias</FieldLabel>
                <Textarea value={form.checklist.management_description} onChange={(e) => setCL('management_description', e.target.value)} placeholder="Descreva o que foi feito em detalhes…" rows={3} />
              </div>
              <div>
                <FieldLabel hint="Opcional">Materiais utilizados</FieldLabel>
                <input
                  type="text"
                  value={form.checklist.materials_used}
                  onChange={(e) => setCL('materials_used', e.target.value)}
                  placeholder="Ex: xarope, barreira contra formigas, vedação da tampa…"
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </InspectionSection>

            {/* Tarefas */}
            <InspectionSection step={isInternal ? 11 : 10} title="Tarefas a Fazer" icon="✅" subtitle={`Aplicadas a todas as ${selectedHiveIds.length} caixas`}>
              <div>
                <FieldLabel hint="Clique para adicionar">Tarefas predefinidas</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_TASKS.map((pt) => {
                    const already = form.checklist.tasks.some((t) => t.label === pt.value);
                    return (
                      <button
                        key={pt.value}
                        type="button"
                        onClick={() => !already && addTask(pt.value)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                          already
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 cursor-default'
                            : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-amber-500/40 hover:text-stone-200'
                        )}
                      >
                        {already ? '✓ ' : '+ '}{pt.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => addTask('tarefa_personalizada')}
                    className="px-3 py-1.5 rounded-full text-sm font-medium border bg-stone-800 border-dashed border-stone-600 text-stone-500 hover:text-stone-300 hover:border-stone-500 transition-all"
                  >
                    + Tarefa personalizada
                  </button>
                </div>
              </div>
              {form.checklist.tasks.length > 0 && (
                <div className="space-y-3">
                  {form.checklist.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onChange={(t) => updateTask(task.id, t)}
                      onRemove={() => removeTask(task.id)}
                    />
                  ))}
                </div>
              )}
            </InspectionSection>

            {/* Conclusão */}
            <InspectionSection step={isInternal ? 12 : 11} title="Conclusão" icon="🎯" defaultOpen>
              <div>
                <FieldLabel>Análise automática</FieldLabel>
                <InspectionSummaryCard checklist={form.checklist} />
              </div>
              <div>
                <FieldLabel>Estado geral (confirme ou ajuste)</FieldLabel>
                <OptionCards
                  options={statusOptions}
                  value={form.checklist.overall_status ?? score.status}
                  onChange={(v) => setCL('overall_status', v as InspectionChecklist['overall_status'])}
                  columns={4}
                  compact
                  color={
                    (form.checklist.overall_status ?? score.status) === 'healthy' ? 'emerald' :
                    (form.checklist.overall_status ?? score.status) === 'attention' ? 'amber' : 'red'
                  }
                />
              </div>
              <div>
                <FieldLabel>Recomendação</FieldLabel>
                <OptionCards
                  options={recOptions}
                  value={form.checklist.recommendation ?? score.recommendation}
                  onChange={(v) => setCL('recommendation', v as InspectionChecklist['recommendation'])}
                  columns={2}
                />
              </div>
              <div>
                <FieldLabel>Próxima inspeção</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {nextInspDaysOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCL('next_inspection_days', Number(opt.value))}
                      className={cn(
                        'px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                        form.checklist.next_inspection_days === Number(opt.value)
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCL('next_inspection_days', null)}
                      className={cn(
                        'px-3 py-2 rounded-lg border text-sm transition-all',
                        form.checklist.next_inspection_days === null && form.next_inspection_due
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
                      )}
                    >
                      Data personalizada
                    </button>
                    {form.checklist.next_inspection_days === null && (
                      <input
                        type="date"
                        value={form.next_inspection_due}
                        onChange={(e) => setForm((f) => ({ ...f, next_inspection_due: e.target.value }))}
                        className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    )}
                  </div>
                </div>
              </div>
              <div>
                <FieldLabel>Resumo final</FieldLabel>
                <Textarea
                  value={form.checklist.final_summary}
                  onChange={(e) => setCL('final_summary', e.target.value)}
                  placeholder="Colônias com boa atividade, reservas adequadas e sem invasores. Manter acompanhamento normal."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                {[
                  { key: 'generate_alert' as const, label: 'Gerar alerta automático' },
                  { key: 'notify_technician' as const, label: 'Notificar responsável técnico' },
                  { key: 'mark_priority' as const, label: 'Marcar colônias para revisão prioritária' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.checklist[key]}
                      onChange={(e) => setCL(key, e.target.checked)}
                      className="w-4 h-4 rounded border-stone-600 bg-stone-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-stone-950"
                    />
                    <span className="text-sm text-stone-300 group-hover:text-stone-100 transition-colors">{label}</span>
                  </label>
                ))}
              </div>
            </InspectionSection>
          </>
        )}
      </div>

      {/* ── Sticky footer ──────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-stone-950/95 backdrop-blur-sm border-t border-stone-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          {step > 1 && !submitting && (
            <Button variant="secondary" size="md" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
              ← Voltar
            </Button>
          )}
          <div className="flex-1" />

          {step === 3 && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => setPreviewOpen(true)}
              disabled={submitting}
            >
              👁 Visualizar caixas ({selectedHiveIds.length})
            </Button>
          )}

          {step === 1 && (
            <Button
              variant="primary"
              size="md"
              disabled={!apiaryId}
              onClick={() => setStep(2)}
            >
              Próximo →
            </Button>
          )}
          {step === 2 && (
            <Button
              variant="primary"
              size="md"
              disabled={selectedHiveIds.length === 0}
              onClick={() => setStep(3)}
            >
              Próximo ({selectedHiveIds.length}) →
            </Button>
          )}
          {step === 3 && (
            <Button
              variant="primary"
              size="md"
              loading={submitting}
              disabled={selectedHiveIds.length === 0}
              onClick={submit}
            >
              {progress
                ? `Salvando ${progress.done}/${progress.total}…`
                : `Concluir lote (${selectedHiveIds.length})`}
            </Button>
          )}
        </div>
      </div>

      {/* ── Preview modal ──────────────────────────────────────────────────── */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title={`Caixas do lote (${selectedHives.length})`} size="md">
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          <p className="text-xs text-stone-500 mb-3">
            🏡 {apiary?.name} — a inspeção será replicada nestas caixas:
          </p>
          {selectedHives.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-6">Nenhuma caixa selecionada.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {selectedHives.map((h) => (
                <div key={h.local_id} className="px-3 py-2 rounded-lg bg-stone-800 border border-stone-700 text-sm text-stone-200 truncate">
                  {h.code}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="secondary" size="md" onClick={() => setPreviewOpen(false)}>Fechar</Button>
        </div>
      </Modal>
    </div>
  );
}
