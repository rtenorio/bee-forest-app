import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCreateHarvest } from '@/hooks/useHarvests';
import { useHives } from '@/hooks/useHives';
import { useApiaries } from '@/hooks/useApiaries';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { todayISO } from '@/utils/dates';
import { HarvestCreateSchema } from '@bee-forest/shared';
import type { HoneyType, VisualAspect, BubblesLevel, PaperTest, ViscosityLevel } from '@bee-forest/shared';

// ─── Wizard state ────────────────────────────────────────────────────────────

interface WizardData {
  apiary_local_id: string;
  harvested_at: string;
  responsible_name: string;
  hive_local_ids: string[];

  honey_type: HoneyType;
  total_volume_ml: string;
  total_weight_kg: string;

  humidity_pct: string;
  brix: string;
  visual_aspect: VisualAspect | null;
  bubbles: BubblesLevel | null;
  paper_test: PaperTest | null;
  viscosity: ViscosityLevel | null;

  syrup_provided: boolean;
  pollen_ball_provided: boolean;
  wax_provided: boolean;

  notes: string;
}

function makeDefault(responsible: string): WizardData {
  return {
    apiary_local_id: '',
    harvested_at: todayISO(),
    responsible_name: responsible,
    hive_local_ids: [],
    honey_type: 'maturado',
    total_volume_ml: '',
    total_weight_kg: '',
    humidity_pct: '',
    brix: '',
    visual_aspect: null,
    bubbles: null,
    paper_test: null,
    viscosity: null,
    syrup_provided: false,
    pollen_ball_provided: false,
    wax_provided: false,
    notes: '',
  };
}

// ─── Reusable UI pieces ───────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-stone-300 mb-2">{children}</p>;
}

function OptionButton({
  active, onClick, children, colorActive = 'amber',
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  colorActive?: 'amber' | 'emerald' | 'sky';
}) {
  const activeClass = {
    amber: 'bg-amber-500/20 border-amber-500/60 text-amber-300',
    emerald: 'bg-emerald-900/40 border-emerald-600/60 text-emerald-300',
    sky: 'bg-sky-900/40 border-sky-600/60 text-sky-300',
  }[colorActive];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-medium transition-colors',
        active ? activeClass : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
      )}
    >
      {children}
    </button>
  );
}

// Escala visual de viscosidade (1–5)
function ViscosityPicker({
  value,
  onChange,
}: {
  value: ViscosityLevel | null;
  onChange: (v: ViscosityLevel) => void;
}) {
  const LABELS: Record<number, { icon: string; label: string }> = {
    1: { icon: '💧', label: 'Muito fluido' },
    2: { icon: '🫗', label: 'Fluido' },
    3: { icon: '🍯', label: 'Normal' },
    4: { icon: '🫙', label: 'Denso' },
    5: { icon: '🧱', label: 'Muito denso' },
  };

  return (
    <div>
      <SectionLabel>Viscosidade</SectionLabel>
      <div className="flex gap-2">
        {([1, 2, 3, 4, 5] as ViscosityLevel[]).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors',
              value === n
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
            )}
          >
            <span className="text-xl">{LABELS[n].icon}</span>
            <span>{n}</span>
          </button>
        ))}
      </div>
      {value && (
        <p className="text-xs text-stone-500 text-center mt-1">{LABELS[value].label}</p>
      )}
    </div>
  );
}

// Seletor de bolhas
function BubblesPicker({
  value,
  onChange,
}: {
  value: BubblesLevel | null;
  onChange: (v: BubblesLevel) => void;
}) {
  return (
    <div>
      <SectionLabel>Bolhas (fermentação)</SectionLabel>
      <div className="flex gap-2">
        {([
          { v: 'none', icon: '✅', label: 'Nenhuma' },
          { v: 'few', icon: '🟡', label: 'Poucas' },
          { v: 'many', icon: '🔴', label: 'Muitas' },
        ] as { v: BubblesLevel; icon: string; label: string }[]).map((opt) => (
          <OptionButton
            key={opt.v}
            active={value === opt.v}
            onClick={() => onChange(opt.v)}
            colorActive={opt.v === 'none' ? 'emerald' : opt.v === 'few' ? 'amber' : 'amber'}
          >
            <span className="text-xl">{opt.icon}</span>
            {opt.label}
          </OptionButton>
        ))}
      </div>
    </div>
  );
}

// Teste do papel
function PaperTestPicker({
  value,
  onChange,
}: {
  value: PaperTest | null;
  onChange: (v: PaperTest) => void;
}) {
  return (
    <div>
      <SectionLabel>Teste do papel</SectionLabel>
      <p className="text-xs text-stone-500 mb-2">
        Coloque uma gota no papel: passa = absorção lenta (mel maduro); reprovado = absorção rápida (mel verde).
      </p>
      <div className="flex gap-3">
        <OptionButton active={value === 'pass'} onClick={() => onChange('pass')} colorActive="emerald">
          <span className="text-2xl">✅</span>
          Aprovado
        </OptionButton>
        <OptionButton active={value === 'fail'} onClick={() => onChange('fail')} colorActive="amber">
          <span className="text-2xl">❌</span>
          Reprovado
        </OptionButton>
      </div>
    </div>
  );
}

const STEPS = [
  { id: 1, label: 'Identificação', icon: '📋' },
  { id: 2, label: 'Caixas', icon: '🏠' },
  { id: 3, label: 'Produção', icon: '🍯' },
  { id: 4, label: 'Qualidade', icon: '🔬' },
  { id: 5, label: 'Insumos', icon: '🌺' },
];

// ─── Wizard page ──────────────────────────────────────────────────────────────

export function HarvestWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user)!;
  const { data: apiaries = [], isLoading: apiariesLoading } = useApiaries();
  const { data: hives = [], isLoading: hivesLoading } = useHives();
  const createHarvest = useCreateHarvest();

  const defaultApiaryId = searchParams.get('apiary') ?? '';

  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(() => ({
    ...makeDefault(user.name ?? ''),
    apiary_local_id: defaultApiaryId,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const update = (patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch }));

  const apiaryOptions = [
    { value: '', label: 'Selecionar meliponário...' },
    ...apiaries
      .filter((a) =>
        user.role === 'socio' ? true : user.apiary_local_ids.includes(a.local_id)
      )
      .map((a) => ({ value: a.local_id, label: a.name })),
  ];

  // Filtra caixas ativas do meliponário selecionado
  const apiaryHives = hives
    .filter((h) => h.apiary_local_id === data.apiary_local_id && h.status === 'active')
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  function toggleHive(local_id: string) {
    const cur = data.hive_local_ids;
    update({
      hive_local_ids: cur.includes(local_id)
        ? cur.filter((id) => id !== local_id)
        : [...cur, local_id],
    });
  }

  function selectAllHives() {
    update({ hive_local_ids: apiaryHives.map((h) => h.local_id) });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (step === 0) {
      if (!data.apiary_local_id) errs.apiary_local_id = 'Selecione o meliponário';
      if (!data.harvested_at) errs.harvested_at = 'Informe a data';
    }
    if (step === 1 && data.hive_local_ids.length === 0) {
      errs.hive_local_ids = 'Selecione ao menos uma caixa';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (!validate()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
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
      const payload = HarvestCreateSchema.parse({
        apiary_local_id: data.apiary_local_id,
        harvested_at: data.harvested_at,
        responsible_name: data.responsible_name,
        hive_local_ids: data.hive_local_ids,
        honey_type: data.honey_type,
        total_volume_ml: data.total_volume_ml ? parseFloat(data.total_volume_ml) : null,
        total_weight_kg: data.total_weight_kg ? parseFloat(data.total_weight_kg) : null,
        humidity_pct: data.humidity_pct ? parseFloat(data.humidity_pct) : null,
        brix: data.brix ? parseFloat(data.brix) : null,
        visual_aspect: data.visual_aspect,
        bubbles: data.bubbles,
        paper_test: data.paper_test,
        viscosity: data.viscosity,
        syrup_provided: data.syrup_provided,
        pollen_ball_provided: data.pollen_ball_provided,
        wax_provided: data.wax_provided,
        notes: data.notes,
      });

      await createHarvest.mutateAsync(payload);
      navigate('/harvests', { replace: true });
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Erro ao salvar' });
      setSubmitting(false);
    }
  }

  if (apiariesLoading || hivesLoading) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }

  const currentApiary = apiaries.find((a) => a.local_id === data.apiary_local_id);
  const stepInfo = STEPS[step];

  // ── Step content ──────────────────────────────────────────────────────────

  const stepContent = [

    // ── Step 0: Identificação ─────────────────────────────────────────────
    <div className="space-y-5" key="s0">
      <Select
        label="Meliponário *"
        options={apiaryOptions}
        value={data.apiary_local_id}
        onChange={(e) => update({ apiary_local_id: e.target.value, hive_local_ids: [] })}
        error={errors.apiary_local_id}
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Input
            label="Data da colheita *"
            type="date"
            value={data.harvested_at}
            onChange={(e) => update({ harvested_at: e.target.value })}
            error={errors.harvested_at}
          />
        </div>
        <div className="col-span-2">
          <Input
            label="Responsável"
            value={data.responsible_name}
            onChange={(e) => update({ responsible_name: e.target.value })}
            placeholder="Nome de quem realizou a colheita"
          />
        </div>
      </div>

      <div>
        <SectionLabel>Tipo do mel</SectionLabel>
        <div className="flex gap-3">
          {([
            { v: 'maturado', icon: '✨', label: 'Maturado', desc: 'Baixa umidade, brix alto' },
            { v: 'vivo', icon: '🌿', label: 'Vivo', desc: 'Fermentação natural' },
          ] as { v: HoneyType; icon: string; label: string; desc: string }[]).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => update({ honey_type: opt.v })}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-sm font-medium transition-colors',
                data.honey_type === opt.v
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                  : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
              )}
            >
              <span className="text-2xl">{opt.icon}</span>
              <span>{opt.label}</span>
              <span className="text-xs opacity-70">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,

    // ── Step 1: Caixas colhidas ───────────────────────────────────────────
    <div className="space-y-4" key="s1">
      {!data.apiary_local_id ? (
        <p className="text-stone-500 text-sm text-center py-8">
          Selecione o meliponário na etapa anterior.
        </p>
      ) : apiaryHives.length === 0 ? (
        <p className="text-stone-500 text-sm text-center py-8">
          Nenhuma caixa ativa neste meliponário.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-stone-400">
              {data.hive_local_ids.length} de {apiaryHives.length} caixas selecionadas
            </p>
            <button
              type="button"
              onClick={selectAllHives}
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              Selecionar todas
            </button>
          </div>

          {errors.hive_local_ids && (
            <p className="text-xs text-red-400">{errors.hive_local_ids}</p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {apiaryHives.map((hive) => {
              const selected = data.hive_local_ids.includes(hive.local_id);
              return (
                <button
                  key={hive.local_id}
                  type="button"
                  onClick={() => toggleHive(hive.local_id)}
                  className={cn(
                    'flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-sm font-medium transition-colors',
                    selected
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                      : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
                  )}
                >
                  <span className="text-xl">{selected ? '✅' : '🏠'}</span>
                  <span className="truncate max-w-full text-xs">{hive.code}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>,

    // ── Step 2: Produção ──────────────────────────────────────────────────
    <div className="space-y-5" key="s2">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Volume total (mL)"
          type="number"
          step="0.1"
          value={data.total_volume_ml}
          onChange={(e) => update({ total_volume_ml: e.target.value })}
          placeholder="ex: 1500"
        />
        <Input
          label="Peso total (kg)"
          type="number"
          step="0.001"
          value={data.total_weight_kg}
          onChange={(e) => update({ total_weight_kg: e.target.value })}
          placeholder="ex: 2.100"
        />
      </div>

      <div className="bg-stone-800/50 border border-stone-700 rounded-xl p-3 text-xs text-stone-500 space-y-1">
        <p className="font-medium text-stone-400">Referência de peso × volume</p>
        <p>Mel de abelha nativa: ~1,35–1,45 g/mL (varia por espécie e umidade)</p>
        <p>Ex.: 1.000 mL ≈ 1,35–1,45 kg</p>
      </div>

      <Textarea
        label="Observações da colheita"
        value={data.notes}
        onChange={(e) => update({ notes: e.target.value })}
        placeholder="Condições gerais, intercorrências, notas relevantes..."
        rows={3}
      />
    </div>,

    // ── Step 3: Qualidade ─────────────────────────────────────────────────
    <div className="space-y-6" key="s3">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Umidade (%)"
          type="number"
          step="0.1"
          min="0"
          max="100"
          value={data.humidity_pct}
          onChange={(e) => update({ humidity_pct: e.target.value })}
          placeholder="ex: 26.5"
        />
        <Input
          label="Brix (°Bx)"
          type="number"
          step="0.1"
          value={data.brix}
          onChange={(e) => update({ brix: e.target.value })}
          placeholder="ex: 72.0"
        />
      </div>

      <div>
        <SectionLabel>Aspecto visual</SectionLabel>
        <div className="flex gap-2">
          {([
            { v: 'clear', icon: '💎', label: 'Límpido' },
            { v: 'cloudy', icon: '🌫️', label: 'Turvo' },
            { v: 'crystallized', icon: '❄️', label: 'Cristalizado' },
          ] as { v: VisualAspect; icon: string; label: string }[]).map((opt) => (
            <OptionButton
              key={opt.v}
              active={data.visual_aspect === opt.v}
              onClick={() => update({ visual_aspect: data.visual_aspect === opt.v ? null : opt.v })}
            >
              <span className="text-xl">{opt.icon}</span>
              {opt.label}
            </OptionButton>
          ))}
        </div>
      </div>

      <BubblesPicker value={data.bubbles} onChange={(v) => update({ bubbles: data.bubbles === v ? null : v })} />

      <PaperTestPicker value={data.paper_test} onChange={(v) => update({ paper_test: data.paper_test === v ? null : v })} />

      <ViscosityPicker value={data.viscosity} onChange={(v) => update({ viscosity: data.viscosity === v ? null : v })} />
    </div>,

    // ── Step 4: Insumos fornecidos ────────────────────────────────────────
    <div className="space-y-6" key="s4">
      <p className="text-sm text-stone-400">
        Marque os insumos que foram fornecidos às caixas durante ou após a colheita.
      </p>

      <div className="space-y-3">
        {([
          { key: 'syrup_provided', icon: '🍬', label: 'Xarope (calda)', desc: 'Alimentação com solução de açúcar' },
          { key: 'pollen_ball_provided', icon: '🌼', label: 'Bolinhos de pólen', desc: 'Suplemento proteico' },
          { key: 'wax_provided', icon: '🕯️', label: 'Cera', desc: 'Fornecimento de cera para construção' },
        ] as { key: keyof Pick<WizardData, 'syrup_provided' | 'pollen_ball_provided' | 'wax_provided'>; icon: string; label: string; desc: string }[]).map(({ key, icon, label, desc }) => (
          <button
            key={key}
            type="button"
            onClick={() => update({ [key]: !data[key] })}
            className={cn(
              'w-full flex items-center gap-4 px-4 py-3 rounded-xl border text-left transition-colors',
              data[key]
                ? 'bg-emerald-900/30 border-emerald-600/50 text-emerald-300'
                : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
            )}
          >
            <span className="text-2xl">{icon}</span>
            <div className="flex-1">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs opacity-70">{desc}</p>
            </div>
            <span className={cn('text-lg', data[key] ? 'text-emerald-400' : 'text-stone-600')}>
              {data[key] ? '✓' : '○'}
            </span>
          </button>
        ))}
      </div>

      {errors.submit && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">
          {errors.submit}
        </p>
      )}
    </div>,
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col">
      {/* Header */}
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
              {currentApiary ? `Colheita · ${currentApiary.name}` : 'Nova Colheita'}
            </p>
            <p className="text-xs text-stone-500">{stepInfo.icon} {stepInfo.label}</p>
          </div>
          {data.hive_local_ids.length > 0 && (
            <span className="text-xs text-amber-400">
              🏠 {data.hive_local_ids.length} caixa{data.hive_local_ids.length > 1 ? 's' : ''}
            </span>
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
                className="flex-1 h-1.5 rounded-full overflow-hidden"
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

      {/* Content */}
      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-stone-100">
            {stepInfo.icon} {stepInfo.label}
          </h2>
          <p className="text-stone-500 text-sm mt-0.5">
            {[
              'Informe o meliponário, data e tipo do mel',
              'Selecione as caixas que foram colhidas',
              'Registre os volumes e pesos obtidos',
              'Avalie os parâmetros de qualidade do mel',
              'Registre os insumos fornecidos após a colheita',
            ][step]}
          </p>
        </div>

        {stepContent[step]}
      </main>

      {/* Footer */}
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
          <Button onClick={next} className="flex-1">
            Próxima →
          </Button>
        ) : (
          <Button
            onClick={submit}
            loading={submitting}
            className="flex-1 bg-amber-600 hover:bg-amber-500"
          >
            🍯 Registrar Colheita
          </Button>
        )}
      </footer>
    </div>
  );
}
