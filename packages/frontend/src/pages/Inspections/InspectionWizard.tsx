import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCreateInspection } from '@/hooks/useInspections';
import { useHives } from '@/hooks/useHives';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { AudioRecorder } from '@/components/inspection/AudioRecorder';
import { PhotoCapture } from '@/components/inspection/PhotoCapture';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { nowISO } from '@/utils/dates';
import { InspectionCreateSchema } from '@bee-forest/shared';
import type { InspectionChecklist } from '@bee-forest/shared';

// ─── Wizard state ────────────────────────────────────────────────────────────

interface WizardData {
  hive_local_id: string;
  inspected_at: string;
  inspector_name: string;
  weather: string;
  temperature_c: string;
  population_strength: 1 | 2 | 3 | 4 | 5;
  queen_seen: boolean | null;
  brood_present: boolean;
  temperament: 'calm' | 'nervous' | 'aggressive' | null;
  honey_stores: 'low' | 'adequate' | 'abundant';
  pollen_stores: 'low' | 'adequate' | 'abundant';
  propolis_quality: 'poor' | 'normal' | 'good' | null;
  pests_observed: string[];
  diseases_observed: string[];
  box_condition: 'poor' | 'fair' | 'good' | null;
  weight_kg: string;
  interventions: string[];
  needs_feeding: boolean;
  needs_space_expansion: boolean;
  next_inspection_due: string;
  notes: string;
  stepPhotos: string[][];   // [step0photos, step1photos, …]
  stepAudio: string[][];    // [step0audio, step1audio, …]
}

function makeDefault(hiveId: string, inspector: string): WizardData {
  return {
    hive_local_id: hiveId,
    inspected_at: nowISO().slice(0, 16),
    inspector_name: inspector,
    weather: '',
    temperature_c: '',
    population_strength: 3,
    queen_seen: null,
    brood_present: true,
    temperament: null,
    honey_stores: 'adequate',
    pollen_stores: 'adequate',
    propolis_quality: null,
    pests_observed: [],
    diseases_observed: [],
    box_condition: null,
    weight_kg: '',
    interventions: [],
    needs_feeding: false,
    needs_space_expansion: false,
    next_inspection_due: '',
    notes: '',
    stepPhotos: [[], [], [], [], [], []],
    stepAudio: [[], [], [], [], [], []],
  };
}

// ─── Small reusable pieces ───────────────────────────────────────────────────

function TriToggle<T>({
  label, options, value, onChange,
}: {
  label: string;
  options: { v: T | null; label: string; icon?: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-stone-300 mb-2">{label}</p>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => onChange(value === o.v ? null : o.v)}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors',
              value === o.v
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
            )}
          >
            {o.icon && <span className="text-xl">{o.icon}</span>}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LevelPicker({
  label, value, onChange,
}: {
  label: string;
  value: 'low' | 'adequate' | 'abundant';
  onChange: (v: 'low' | 'adequate' | 'abundant') => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-stone-300 mb-2">{label}</p>
      <div className="flex gap-2">
        {(['low', 'adequate', 'abundant'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              'flex-1 py-2 rounded-xl text-sm border transition-colors',
              value === v
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
            )}
          >
            {v === 'low' ? '🟥 Baixa' : v === 'adequate' ? '🟨 Adequada' : '🟩 Abundante'}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleChip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-sm border transition-colors',
        active
          ? 'bg-red-900/50 border-red-500/60 text-red-300'
          : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
      )}
    >
      {label}
    </button>
  );
}

function BeeStrengthPicker({ value, onChange }: { value: number; onChange: (v: 1 | 2 | 3 | 4 | 5) => void }) {
  const LABELS = ['', 'Muito fraca', 'Fraca', 'Média', 'Forte', 'Muito forte'];
  return (
    <div>
      <div className="flex gap-2 mb-2">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              'flex-1 py-3 rounded-xl text-2xl transition-colors border',
              value >= n
                ? 'bg-amber-500/25 border-amber-500/60'
                : 'bg-stone-800 border-stone-700 hover:border-stone-600'
            )}
          >
            🐝
          </button>
        ))}
      </div>
      <p className="text-xs text-stone-500 text-center">{LABELS[value]}</p>
    </div>
  );
}

// ─── Step components ─────────────────────────────────────────────────────────

function MediaSection({ stepIdx, data, update }: { stepIdx: number; data: WizardData; update: (p: Partial<WizardData>) => void }) {
  function setPhotos(photos: string[]) {
    const s = [...data.stepPhotos]; s[stepIdx] = photos; update({ stepPhotos: s });
  }
  function setAudio(audios: string[]) {
    const s = [...data.stepAudio]; s[stepIdx] = audios; update({ stepAudio: s });
  }
  const photoCount = data.stepPhotos[stepIdx]?.length ?? 0;
  const audioCount = data.stepAudio[stepIdx]?.length ?? 0;
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-stone-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-stone-400 hover:bg-stone-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>📎 Fotos e Áudio</span>
          {(photoCount > 0 || audioCount > 0) && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs">
              {photoCount > 0 && `${photoCount} foto${photoCount > 1 ? 's' : ''}`}
              {photoCount > 0 && audioCount > 0 && ' · '}
              {audioCount > 0 && `${audioCount} áudio${audioCount > 1 ? 's' : ''}`}
            </span>
          )}
        </span>
        <span className={cn('transition-transform', open && 'rotate-180')}>▾</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-stone-700">
          <div className="pt-3">
            <p className="text-xs text-stone-500 mb-2">Fotos</p>
            <PhotoCapture photos={data.stepPhotos[stepIdx] ?? []} onChange={setPhotos} />
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-2">Áudio</p>
            <AudioRecorder audios={data.stepAudio[stepIdx] ?? []} onChange={setAudio} />
          </div>
        </div>
      )}
    </div>
  );
}

const PEST_OPTIONS = [
  { id: 'small_hive_beetle', label: '🪲 Besouro da caixa' },
  { id: 'phorid_flies', label: '🪰 Moscas fóridas' },
  { id: 'ants', label: '🐜 Formigas' },
  { id: 'wax_moth', label: '🦋 Traça da cera' },
  { id: 'lizards', label: '🦎 Lagartos' },
  { id: 'spiders', label: '🕷️ Aranhas' },
];

const DISEASE_OPTIONS = [
  { id: 'american_foulbrood', label: 'Loque americano' },
  { id: 'nosemosis', label: 'Nosemose' },
  { id: 'chalkbrood', label: 'Cria giz' },
  { id: 'sacbrood', label: 'Cria ensacada' },
  { id: 'stonebrood', label: 'Cria pedra' },
];

const INTERVENTION_OPTIONS = [
  { id: 'fed_colony', label: '🌺 Alimentei a colônia' },
  { id: 'expanded_box', label: '📦 Expandi a caixa' },
  { id: 'removed_pests', label: '🧹 Removi pragas' },
  { id: 'transferred_frames', label: '🔄 Transferi favos' },
  { id: 'applied_treatment', label: '💊 Apliquei tratamento' },
  { id: 'cleaned_box', label: '🧽 Limpei a caixa' },
  { id: 'relocated_hive', label: '🚚 Mudei a posição' },
];

const STEPS = [
  { id: 1, label: 'Identificação', icon: '📋' },
  { id: 2, label: 'População', icon: '🐝' },
  { id: 3, label: 'Mel e Pólen', icon: '🍯' },
  { id: 4, label: 'Sanidade', icon: '🔬' },
  { id: 5, label: 'Infraestrutura', icon: '🏠' },
  { id: 6, label: 'Ações', icon: '✅' },
];

// ─── Wizard page ──────────────────────────────────────────────────────────────

export function InspectionWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user)!;
  const { inspectorName } = useUIStore();
  const { data: hives = [], isLoading: hivesLoading } = useHives();
  const createInspection = useCreateInspection();

  const defaultHiveId = searchParams.get('hive') ?? '';

  // Filter hives by role
  const accessibleHives = user.role === 'tratador'
    ? hives.filter((h) => user.hive_local_ids.includes(h.local_id) && h.status === 'active')
    : hives.filter((h) => h.status === 'active');

  const hiveOptions = [
    { value: '', label: 'Selecionar caixa...' },
    ...accessibleHives.map((h) => ({ value: h.local_id, label: h.code })),
  ];

  const [step, setStep] = useState(0); // 0-indexed
  const [data, setData] = useState<WizardData>(() => makeDefault(defaultHiveId, inspectorName));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const update = (patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch }));

  function toggleList(key: 'pests_observed' | 'diseases_observed' | 'interventions', id: string) {
    const cur = data[key];
    update({ [key]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  }

  // ── Validation per step ──────────────────────────────────────────────────
  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (step === 0) {
      if (!data.hive_local_id) errs.hive_local_id = 'Selecione a caixa';
      if (!data.inspected_at) errs.inspected_at = 'Informe a data';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (!validate()) return;
    setStep((s) => Math.min(s + 1, 5));
    window.scrollTo(0, 0);
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo(0, 0);
  }

  async function submit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const checklist: InspectionChecklist = {
        population_strength: data.population_strength,
        queen_seen: data.queen_seen,
        brood_present: data.brood_present,
        temperament: data.temperament,
        honey_stores: data.honey_stores,
        pollen_stores: data.pollen_stores,
        propolis_quality: data.propolis_quality,
        pests_observed: data.pests_observed,
        diseases_observed: data.diseases_observed,
        box_condition: data.box_condition,
        interventions: data.interventions,
        needs_feeding: data.needs_feeding,
        needs_space_expansion: data.needs_space_expansion,
      };

      const payload = InspectionCreateSchema.parse({
        hive_local_id: data.hive_local_id,
        inspected_at: new Date(data.inspected_at).toISOString(),
        inspector_name: data.inspector_name,
        checklist,
        weight_kg: data.weight_kg ? parseFloat(data.weight_kg) : null,
        temperature_c: data.temperature_c ? parseFloat(data.temperature_c) : null,
        weather: data.weather || null,
        notes: data.notes,
        photos: data.stepPhotos.flat(),
        audio_notes: data.stepAudio.flat(),
        next_inspection_due: data.next_inspection_due || null,
      });

      await createInspection.mutateAsync(payload);
      navigate(`/hives/${data.hive_local_id}`, { replace: true });
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Erro ao salvar' });
      setSubmitting(false);
    }
  }

  if (hivesLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  const currentHive = hives.find((h) => h.local_id === data.hive_local_id);
  const stepInfo = STEPS[step];

  // ── Step content ─────────────────────────────────────────────────────────

  const stepContent = [

    // ── Step 0: Identificação ──────────────────────────────────────────────
    <div className="space-y-5" key="s0">
      <Select
        label="Caixa *"
        options={hiveOptions}
        value={data.hive_local_id}
        onChange={(e) => update({ hive_local_id: e.target.value })}
        error={errors.hive_local_id}
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Input
            label="Data e Hora *"
            type="datetime-local"
            value={data.inspected_at}
            onChange={(e) => update({ inspected_at: e.target.value })}
            error={errors.inspected_at}
          />
        </div>
        <Input
          label="Responsável"
          value={data.inspector_name}
          onChange={(e) => update({ inspector_name: e.target.value })}
          placeholder="Nome do inspetor"
        />
        <Select
          label="Clima"
          options={[
            { value: '', label: 'Não informado' },
            { value: 'sunny', label: '☀️ Ensolarado' },
            { value: 'cloudy', label: '⛅ Nublado' },
            { value: 'rainy', label: '🌧️ Chuvoso' },
          ]}
          value={data.weather}
          onChange={(e) => update({ weather: e.target.value })}
        />
        <div className="col-span-2">
          <Input
            label="Temperatura ambiente (°C)"
            type="number"
            step="0.1"
            value={data.temperature_c}
            onChange={(e) => update({ temperature_c: e.target.value })}
            placeholder="ex: 28.5"
          />
        </div>
      </div>
      <MediaSection stepIdx={0} data={data} update={update} />
    </div>,

    // ── Step 1: População ──────────────────────────────────────────────────
    <div className="space-y-6" key="s1">
      <div>
        <p className="text-sm font-medium text-stone-300 mb-3">Força da colônia</p>
        <BeeStrengthPicker value={data.population_strength} onChange={(v) => update({ population_strength: v })} />
      </div>
      <TriToggle
        label="Rainha vista?"
        options={[
          { v: true, label: 'Sim', icon: '👑' },
          { v: false, label: 'Não', icon: '❌' },
          { v: null, label: 'N/V', icon: '❓' },
        ]}
        value={data.queen_seen}
        onChange={(v) => update({ queen_seen: v })}
      />
      <div>
        <p className="text-sm font-medium text-stone-300 mb-2">Cria presente?</p>
        <div className="flex gap-3">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => update({ brood_present: v })}
              className={cn(
                'flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors',
                data.brood_present === v
                  ? 'bg-emerald-900/40 border-emerald-600/60 text-emerald-300'
                  : 'bg-stone-800 border-stone-700 text-stone-400'
              )}
            >
              {v ? '🥚 Sim' : '❌ Não'}
            </button>
          ))}
        </div>
      </div>
      <TriToggle
        label="Temperamento"
        options={[
          { v: 'calm', label: 'Calma', icon: '😊' },
          { v: 'nervous', label: 'Nervosa', icon: '😬' },
          { v: 'aggressive', label: 'Agressiva', icon: '😡' },
        ]}
        value={data.temperament}
        onChange={(v) => update({ temperament: v as typeof data.temperament })}
      />
      <MediaSection stepIdx={1} data={data} update={update} />
    </div>,

    // ── Step 2: Mel e Pólen ────────────────────────────────────────────────
    <div className="space-y-6" key="s2">
      <LevelPicker label="Reserva de mel 🍯" value={data.honey_stores} onChange={(v) => update({ honey_stores: v })} />
      <LevelPicker label="Reserva de pólen 🌼" value={data.pollen_stores} onChange={(v) => update({ pollen_stores: v })} />
      <TriToggle
        label="Qualidade da própolis"
        options={[
          { v: 'poor', label: 'Ruim', icon: '🔴' },
          { v: 'normal', label: 'Normal', icon: '🟡' },
          { v: 'good', label: 'Boa', icon: '🟢' },
        ]}
        value={data.propolis_quality}
        onChange={(v) => update({ propolis_quality: v as typeof data.propolis_quality })}
      />
      <MediaSection stepIdx={2} data={data} update={update} />
    </div>,

    // ── Step 3: Sanidade ───────────────────────────────────────────────────
    <div className="space-y-6" key="s3">
      <div>
        <p className="text-sm font-medium text-stone-300 mb-3">Pragas observadas</p>
        <div className="flex flex-wrap gap-2">
          {PEST_OPTIONS.map(({ id, label }) => (
            <ToggleChip
              key={id}
              label={label}
              active={data.pests_observed.includes(id)}
              onClick={() => toggleList('pests_observed', id)}
            />
          ))}
        </div>
        {data.pests_observed.length === 0 && (
          <p className="text-xs text-stone-500 mt-2">Nenhuma praga marcada = colônia sem pragas ✅</p>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-stone-300 mb-3">Doenças observadas</p>
        <div className="flex flex-wrap gap-2">
          {DISEASE_OPTIONS.map(({ id, label }) => (
            <ToggleChip
              key={id}
              label={label}
              active={data.diseases_observed.includes(id)}
              onClick={() => toggleList('diseases_observed', id)}
            />
          ))}
        </div>
        {data.diseases_observed.length === 0 && (
          <p className="text-xs text-stone-500 mt-2">Nenhuma doença marcada = colônia saudável ✅</p>
        )}
      </div>
      <MediaSection stepIdx={3} data={data} update={update} />
    </div>,

    // ── Step 4: Infraestrutura ─────────────────────────────────────────────
    <div className="space-y-6" key="s4">
      <TriToggle
        label="Estado da caixa"
        options={[
          { v: 'poor', label: 'Ruim', icon: '🔴' },
          { v: 'fair', label: 'Regular', icon: '🟡' },
          { v: 'good', label: 'Bom', icon: '🟢' },
        ]}
        value={data.box_condition}
        onChange={(v) => update({ box_condition: v as typeof data.box_condition })}
      />
      <Input
        label="Peso da caixa (kg)"
        type="number"
        step="0.01"
        value={data.weight_kg}
        onChange={(e) => update({ weight_kg: e.target.value })}
        placeholder="ex: 4.50"
      />
      <MediaSection stepIdx={4} data={data} update={update} />
    </div>,

    // ── Step 5: Ações ──────────────────────────────────────────────────────
    <div className="space-y-6" key="s5">
      <div>
        <p className="text-sm font-medium text-stone-300 mb-3">Intervenções realizadas</p>
        <div className="flex flex-wrap gap-2">
          {INTERVENTION_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => toggleList('interventions', id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm border transition-colors',
                data.interventions.includes(id)
                  ? 'bg-emerald-900/40 border-emerald-600/60 text-emerald-300'
                  : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {([
          { key: 'needs_feeding', label: '🌺 Precisa alimentar', icon: '' },
          { key: 'needs_space_expansion', label: '📦 Precisa expandir', icon: '' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => update({ [key]: !data[key] })}
            className={cn(
              'py-3 rounded-xl border text-sm font-medium transition-colors',
              data[key]
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : 'bg-stone-800 border-stone-700 text-stone-400'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Input
        label="Próxima inspeção prevista"
        type="date"
        value={data.next_inspection_due}
        onChange={(e) => update({ next_inspection_due: e.target.value })}
      />
      <Textarea
        label="Observações gerais"
        value={data.notes}
        onChange={(e) => update({ notes: e.target.value })}
        placeholder="Notas adicionais sobre a inspeção..."
        rows={4}
      />
      <MediaSection stepIdx={5} data={data} update={update} />

      {errors.submit && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">
          {errors.submit}
        </p>
      )}
    </div>,
  ];

  // ─── Render ────────────────────────────────────────────────────────────────

  const totalPhotos = data.stepPhotos.flat().length;
  const totalAudio = data.stepAudio.flat().length;

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-stone-900 border-b border-stone-800">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="text-stone-400 hover:text-stone-100 transition-colors p-1"
            title="Cancelar"
          >
            ✕
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-stone-100 truncate">
              {currentHive ? `Inspeção · ${currentHive.code}` : 'Nova Inspeção'}
            </p>
            <p className="text-xs text-stone-500">{stepInfo.icon} {stepInfo.label}</p>
          </div>
          {(totalPhotos > 0 || totalAudio > 0) && (
            <div className="text-xs text-stone-500 flex gap-2">
              {totalPhotos > 0 && <span>📷 {totalPhotos}</span>}
              {totalAudio > 0 && <span>🎙 {totalAudio}</span>}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className="flex-1 h-1.5 rounded-full transition-colors overflow-hidden"
                title={s.label}
              >
                <div className={cn(
                  'h-full w-full rounded-full',
                  i < step ? 'bg-amber-500' : i === step ? 'bg-amber-400' : 'bg-stone-700'
                )} />
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-500 mt-1.5 text-right">
            Etapa {step + 1} de {STEPS.length}
          </p>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-stone-100">
            {stepInfo.icon} {stepInfo.label}
          </h2>
          <p className="text-stone-500 text-sm mt-0.5">
            {[
              'Identifique a caixa e as condições da visita',
              'Avalie o estado da população',
              'Verifique os estoques de alimento',
              'Registre pragas e doenças encontradas',
              'Avalie as condições da caixa',
              'Registre as ações realizadas e próximos passos',
            ][step]}
          </p>
        </div>

        {stepContent[step]}
      </main>

      {/* ── Bottom nav ── */}
      <footer className="sticky bottom-0 bg-stone-900 border-t border-stone-800 px-4 py-3 flex gap-3">
        {step > 0 ? (
          <Button variant="secondary" onClick={back} className="flex-1">
            ← Voltar
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => navigate(-1)} className="flex-1">
            Cancelar
          </Button>
        )}

        {step < STEPS.length - 1 ? (
          <Button onClick={next} className="flex-2 flex-1">
            Próxima →
          </Button>
        ) : (
          <Button
            onClick={submit}
            loading={submitting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500"
          >
            ✓ Finalizar Inspeção
          </Button>
        )}
      </footer>
    </div>
  );
}
