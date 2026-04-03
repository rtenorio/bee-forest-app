import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCreateHarvest } from '@/hooks/useHarvests';
import { useHives } from '@/hooks/useHives';
import { useApiaries } from '@/hooks/useApiaries';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { todayISO } from '@/utils/dates';
import { HarvestCreateSchema } from '@bee-forest/shared';
import type { HoneyType, VisualAspect, BubblesLevel, PaperTest, ViscosityLevel } from '@bee-forest/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

type HarvestMode = 'individual' | 'apiary';

interface WizardData {
  mode: HarvestMode;
  harvested_at: string;
  responsible_name: string;

  hive_search: string;
  apiary_local_id: string;
  hive_local_ids: string[];
  hive_volumes: Record<string, string>; // hive_local_id → volume string input
  total_weight_kg: string;

  honey_type: HoneyType;

  humidity_pct: string;
  brix: string;
  visual_aspect: VisualAspect | null;
  bubbles: BubblesLevel | null;
  paper_test: PaperTest | null;
  viscosity: ViscosityLevel | null;

  syrup_provided: boolean;
  pollen_ball_provided: boolean;
  wax_provided: boolean;
  input_notes: string;

  notes: string;
}

function makeDefault(responsible: string, presetMode: HarvestMode): WizardData {
  return {
    mode: presetMode,
    harvested_at: todayISO(),
    responsible_name: responsible,
    hive_search: '',
    apiary_local_id: '',
    hive_local_ids: [],
    hive_volumes: {},
    total_weight_kg: '',
    honey_type: 'maturado',
    humidity_pct: '',
    brix: '',
    visual_aspect: null,
    bubbles: null,
    paper_test: null,
    viscosity: null,
    syrup_provided: false,
    pollen_ball_provided: false,
    wax_provided: false,
    input_notes: '',
    notes: '',
  };
}

// ─── Reusable pickers ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-stone-300 mb-2">{children}</p>;
}

function PickerBtn({
  active, onClick, icon, label, sub, color = 'amber',
}: {
  active: boolean; onClick: () => void; icon: string; label: string; sub?: string;
  color?: 'amber' | 'emerald' | 'sky' | 'red';
}) {
  const activeClass = {
    amber: 'bg-amber-500/15 border-amber-500/60 text-amber-200',
    emerald: 'bg-emerald-500/15 border-emerald-600/60 text-emerald-200',
    sky: 'bg-sky-500/15 border-sky-600/60 text-sky-200',
    red: 'bg-red-500/15 border-red-600/60 text-red-200',
  }[color];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-sm font-medium transition-colors text-center',
        active ? activeClass : 'bg-stone-800/60 border-stone-700 text-stone-400 hover:border-stone-600'
      )}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="leading-tight">{label}</span>
      {sub && <span className="text-xs opacity-70 leading-tight">{sub}</span>}
      {active && (
        <span className={cn(
          'absolute top-1.5 right-1.5 w-2 h-2 rounded-full',
          { 'bg-amber-400': color === 'amber', 'bg-emerald-400': color === 'emerald', 'bg-sky-400': color === 'sky', 'bg-red-400': color === 'red' }
        )} />
      )}
    </button>
  );
}

function ViscosityPicker({ value, onChange }: { value: ViscosityLevel | null; onChange: (v: ViscosityLevel | null) => void }) {
  const LABELS: Record<number, { icon: string; label: string }> = {
    1: { icon: '💧', label: 'Muito fluido' }, 2: { icon: '🫗', label: 'Fluido' },
    3: { icon: '🍯', label: 'Normal' }, 4: { icon: '🫙', label: 'Denso' }, 5: { icon: '🧱', label: 'Muito denso' },
  };
  return (
    <div>
      <SectionLabel>Viscosidade</SectionLabel>
      <div className="flex gap-2">
        {([1, 2, 3, 4, 5] as ViscosityLevel[]).map((n) => (
          <button key={n} type="button" onClick={() => onChange(value === n ? null : n)}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors',
              value === n ? 'bg-amber-500/15 border-amber-500/60 text-amber-300' : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
            )}>
            <span className="text-xl">{LABELS[n].icon}</span>
            <span>{n}</span>
          </button>
        ))}
      </div>
      {value && <p className="text-xs text-stone-500 text-center mt-1">{LABELS[value].label}</p>}
    </div>
  );
}

// ─── Steps config ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: 0, label: 'Identificação', icon: '📋', subtitle: 'Data, operador e modo de colheita' },
  { id: 1, label: 'Caixas',        icon: '🏠', subtitle: 'Selecione as caixas e informe os volumes' },
  { id: 2, label: 'Tipo do mel',   icon: '🍯', subtitle: 'Tipo do mel coletado' },
  { id: 3, label: 'Qualidade',     icon: '🔬', subtitle: 'Parâmetros de qualidade do mel' },
  { id: 4, label: 'Insumos',       icon: '🌺', subtitle: 'Insumos fornecidos após a colheita' },
  { id: 5, label: 'Conclusão',     icon: '✅', subtitle: 'Observações e finalização' },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function HarvestWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user)!;
  const { data: apiaries = [], isLoading: apiariesLoading } = useApiaries();
  const { data: hives = [], isLoading: hivesLoading } = useHives();
  const createHarvest = useCreateHarvest();

  const presetHiveId = searchParams.get('hive') ?? '';
  const presetMode: HarvestMode = presetHiveId ? 'individual' : 'apiary';
  const isTratador = user.role === 'tratador';

  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(() => {
    const d = makeDefault(user.name ?? '', isTratador ? 'individual' : presetMode);
    if (presetHiveId) {
      d.hive_local_ids = [presetHiveId];
    }
    return d;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const update = (patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch }));

  // ── Accessible hives & apiaries ───────────────────────────────────────────

  const accessibleHives = useMemo(() => {
    const active = hives.filter((h) => h.status === 'active');
    if (user.role === 'socio') return active;
    if (user.role === 'responsavel') return active.filter((h) => user.apiary_local_ids.includes(h.apiary_local_id));
    return active.filter((h) => user.hive_local_ids.includes(h.local_id));
  }, [hives, user]);

  const accessibleApiaries = useMemo(() => {
    const ids = new Set(accessibleHives.map((h) => h.apiary_local_id));
    return apiaries.filter((a) => ids.has(a.local_id));
  }, [apiaries, accessibleHives]);

  // ── Hive subsets ──────────────────────────────────────────────────────────

  const apiaryHives = useMemo(() =>
    accessibleHives
      .filter((h) => h.apiary_local_id === data.apiary_local_id)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [accessibleHives, data.apiary_local_id]
  );

  const searchResults = useMemo(() => {
    if (!data.hive_search.trim()) return [];
    const q = data.hive_search.toLowerCase();
    return accessibleHives
      .filter((h) => h.code.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
      .slice(0, 10);
  }, [accessibleHives, data.hive_search]);

  // ── Computed volume total ─────────────────────────────────────────────────

  const volTotal = useMemo(() => {
    return data.hive_local_ids.reduce((acc, id) => {
      return acc + (parseFloat(data.hive_volumes[id] || '0') || 0);
    }, 0);
  }, [data.hive_local_ids, data.hive_volumes]);

  // ── Hive toggle helpers ───────────────────────────────────────────────────

  function toggleHive(local_id: string) {
    const cur = data.hive_local_ids;
    if (cur.includes(local_id)) {
      update({ hive_local_ids: cur.filter((id) => id !== local_id) });
    } else {
      if (data.mode === 'individual') {
        update({ hive_local_ids: [local_id], hive_search: '' });
      } else {
        update({ hive_local_ids: [...cur, local_id] });
      }
    }
  }

  function setVolume(hive_id: string, vol: string) {
    update({ hive_volumes: { ...data.hive_volumes, [hive_id]: vol } });
  }

  function selectAllHives() {
    update({ hive_local_ids: apiaryHives.map((h) => h.local_id) });
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(forDraft = false): boolean {
    const errs: Record<string, string> = {};

    if (step === 0) {
      if (!data.harvested_at) errs.harvested_at = 'Informe a data';
      if (data.mode === 'apiary' && !data.apiary_local_id) errs.apiary_local_id = 'Selecione o meliponário';
    }
    if (step === 1) {
      if (data.hive_local_ids.length === 0) errs.hive_local_ids = 'Selecione ao menos uma caixa';
    }
    if (!forDraft && step === 5) {
      // final submit: no extra required fields beyond hives
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

  // ── Submit ────────────────────────────────────────────────────────────────

  async function submit(asDraft = false) {
    if (!validate(asDraft)) return;
    setSubmitting(true);
    try {
      // Compute apiary from selected hive if in individual mode
      let finalApiary = data.apiary_local_id;
      if (data.mode === 'individual' && data.hive_local_ids.length > 0) {
        const hive = hives.find((h) => h.local_id === data.hive_local_ids[0]);
        if (hive) finalApiary = hive.apiary_local_id;
      }

      // Numeric hive_volumes (selected hives only)
      const hiveVolumesNumeric: Record<string, number> = {};
      for (const id of data.hive_local_ids) {
        const v = parseFloat(data.hive_volumes[id] || '0') || 0;
        if (v > 0) hiveVolumesNumeric[id] = v;
      }

      const total_volume_ml = volTotal > 0 ? volTotal : null;
      const total_weight_kg = data.total_weight_kg ? parseFloat(data.total_weight_kg) : null;

      const maturation_status = !asDraft && data.honey_type === 'maturado'
        ? 'aguardando_maturacao' as const
        : null;

      const payload = HarvestCreateSchema.parse({
        apiary_local_id: finalApiary,
        harvested_at: data.harvested_at,
        responsible_name: data.responsible_name,
        hive_local_ids: data.hive_local_ids,
        hive_volumes: hiveVolumesNumeric,
        honey_type: data.honey_type,
        maturation_status,
        total_volume_ml,
        total_weight_kg,
        humidity_pct: data.humidity_pct ? parseFloat(data.humidity_pct) : null,
        brix: data.brix ? parseFloat(data.brix) : null,
        visual_aspect: data.visual_aspect,
        bubbles: data.bubbles,
        paper_test: data.paper_test,
        viscosity: data.viscosity,
        syrup_provided: data.syrup_provided,
        pollen_ball_provided: data.pollen_ball_provided,
        wax_provided: data.wax_provided,
        input_notes: data.input_notes,
        notes: data.notes,
      });

      const result = await createHarvest.mutateAsync(payload);
      navigate(`/harvests/${result.local_id}`, { replace: true });
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

  // ── Preselected hive for individual mode ──────────────────────────────────
  const preselectedHive = data.mode === 'individual' && data.hive_local_ids.length > 0
    ? hives.find((h) => h.local_id === data.hive_local_ids[0])
    : null;

  // ─────────────────────────────────────────────────────────────────────────
  // Step content
  // ─────────────────────────────────────────────────────────────────────────

  const stepContent = [

    // ── Step 0: Identificação + Modo ───────────────────────────────────────
    <div className="space-y-5" key="s0">
      {/* Mode (disable apiary for tratador) */}
      {!isTratador && (
        <div>
          <SectionLabel>Modo de colheita</SectionLabel>
          <div className="flex gap-3">
            <PickerBtn
              active={data.mode === 'individual'} icon="🏠" label="Caixa individual"
              sub="Busca por código" color="amber"
              onClick={() => update({ mode: 'individual', hive_local_ids: [], apiary_local_id: '' })}
            />
            <PickerBtn
              active={data.mode === 'apiary'} icon="🏡" label="Meliponário inteiro"
              sub="Seleciona múltiplas" color="amber"
              onClick={() => update({ mode: 'apiary', hive_local_ids: [], hive_search: '' })}
            />
          </div>
        </div>
      )}

      {/* Date */}
      <Input
        label="Data da colheita *"
        type="date"
        value={data.harvested_at}
        onChange={(e) => update({ harvested_at: e.target.value })}
        error={errors.harvested_at}
      />

      {/* Responsible */}
      <Input
        label="Operador responsável"
        value={data.responsible_name}
        onChange={(e) => update({ responsible_name: e.target.value })}
        placeholder="Nome de quem realizou a colheita"
      />

      {/* Apiary selector (apiary mode) */}
      {data.mode === 'apiary' && (
        <Select
          label="Meliponário *"
          options={[
            { value: '', label: 'Selecionar meliponário...' },
            ...accessibleApiaries.map((a) => ({ value: a.local_id, label: a.name })),
          ]}
          value={data.apiary_local_id}
          onChange={(e) => update({ apiary_local_id: e.target.value, hive_local_ids: [] })}
          error={errors.apiary_local_id}
        />
      )}
    </div>,

    // ── Step 1: Caixas + Volumes ───────────────────────────────────────────
    <div className="space-y-4" key="s1">
      {data.mode === 'individual' ? (
        /* ── Individual: search + select one hive ── */
        <>
          {!preselectedHive ? (
            <div>
              <Input
                label="Buscar caixa por código"
                value={data.hive_search}
                onChange={(e) => update({ hive_search: e.target.value })}
                placeholder="ex: CME-001"
              />
              {errors.hive_local_ids && <p className="text-xs text-red-400 mt-1">{errors.hive_local_ids}</p>}
              {searchResults.length > 0 && (
                <div className="mt-2 space-y-1">
                  {searchResults.map((h) => (
                    <button
                      key={h.local_id}
                      type="button"
                      onClick={() => toggleHive(h.local_id)}
                      className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-stone-700 bg-stone-800/60 hover:border-amber-500/50 hover:bg-amber-500/10 transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-stone-100">{h.code}</p>
                        <p className="text-xs text-stone-500">
                          {apiaries.find((a) => a.local_id === h.apiary_local_id)?.name ?? ''}
                        </p>
                      </div>
                      <span className="text-amber-400 text-xs">Selecionar →</span>
                    </button>
                  ))}
                </div>
              )}
              {data.hive_search.length > 1 && searchResults.length === 0 && (
                <p className="text-stone-500 text-sm mt-2">Nenhuma caixa encontrada.</p>
              )}
            </div>
          ) : (
            /* ── Selected hive + volume input ── */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-amber-500/40 bg-amber-500/10">
                <div>
                  <p className="font-semibold text-amber-300">{preselectedHive.code}</p>
                  <p className="text-xs text-stone-500">
                    {apiaries.find((a) => a.local_id === preselectedHive.apiary_local_id)?.name ?? ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => update({ hive_local_ids: [], hive_search: '' })}
                  className="text-xs text-stone-500 hover:text-red-400 transition-colors"
                >
                  Trocar
                </button>
              </div>
              <Input
                label="Volume coletado (mL)"
                type="number"
                step="0.1"
                min="0"
                value={data.hive_volumes[preselectedHive.local_id] ?? ''}
                onChange={(e) => setVolume(preselectedHive.local_id, e.target.value)}
                placeholder="ex: 500"
              />
              <Input
                label="Peso total (kg) — opcional"
                type="number"
                step="0.001"
                value={data.total_weight_kg}
                onChange={(e) => update({ total_weight_kg: e.target.value })}
                placeholder="ex: 0.720"
              />
            </div>
          )}
        </>
      ) : (
        /* ── Apiary mode: multi-select + per-hive volumes ── */
        <>
          {!data.apiary_local_id ? (
            <p className="text-stone-500 text-sm text-center py-8">
              Selecione o meliponário na etapa anterior.
            </p>
          ) : apiaryHives.length === 0 ? (
            <p className="text-stone-500 text-sm text-center py-8">
              Nenhuma caixa ativa neste meliponário.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-stone-400">
                  {data.hive_local_ids.length} de {apiaryHives.length} caixas selecionadas
                </p>
                <div className="flex gap-3">
                  <button type="button" onClick={selectAllHives}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
                    Todas
                  </button>
                  <button type="button" onClick={() => update({ hive_local_ids: [] })}
                    className="text-xs text-stone-500 hover:text-stone-300 transition-colors">
                    Nenhuma
                  </button>
                </div>
              </div>
              {errors.hive_local_ids && <p className="text-xs text-red-400">{errors.hive_local_ids}</p>}

              <div className="space-y-2">
                {apiaryHives.map((hive) => {
                  const selected = data.hive_local_ids.includes(hive.local_id);
                  return (
                    <div key={hive.local_id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors',
                        selected
                          ? 'bg-amber-500/10 border-amber-500/40'
                          : 'bg-stone-800/40 border-stone-700'
                      )}>
                      <button type="button" onClick={() => toggleHive(hive.local_id)}
                        className={cn(
                          'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                          selected ? 'bg-amber-500 border-amber-500' : 'border-stone-600'
                        )}>
                        {selected && <span className="text-stone-950 text-xs font-bold">✓</span>}
                      </button>
                      <span className={cn('text-sm font-medium flex-1', selected ? 'text-amber-200' : 'text-stone-400')}>
                        {hive.code}
                      </span>
                      {selected && (
                        <div className="flex items-center gap-1.5 w-28">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="mL"
                            value={data.hive_volumes[hive.local_id] ?? ''}
                            onChange={(e) => setVolume(hive.local_id, e.target.value)}
                            className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2 py-1 text-sm text-stone-100 placeholder-stone-600 focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {data.hive_local_ids.length > 0 && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-stone-800/60 rounded-xl border border-stone-700 p-3 text-center">
                    <p className="text-xs text-stone-500">Volume total</p>
                    <p className="text-lg font-bold text-amber-400">
                      {volTotal > 0 ? `${volTotal.toLocaleString('pt-BR')} mL` : '—'}
                    </p>
                  </div>
                  <Input
                    label="Peso total (kg)"
                    type="number"
                    step="0.001"
                    value={data.total_weight_kg}
                    onChange={(e) => update({ total_weight_kg: e.target.value })}
                    placeholder="ex: 2.100"
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>,

    // ── Step 2: Tipo do mel ────────────────────────────────────────────────
    <div className="space-y-5" key="s2">
      <div className="flex gap-3">
        <PickerBtn
          active={data.honey_type === 'vivo'} onClick={() => update({ honey_type: 'vivo' })}
          icon="🌿" label="Mel vivo" sub="Fermentação natural • Estoque imediato"
          color="emerald"
        />
        <PickerBtn
          active={data.honey_type === 'maturado'} onClick={() => update({ honey_type: 'maturado' })}
          icon="✨" label="Mel maturado" sub="Baixa umidade • Brix alto"
          color="amber"
        />
      </div>

      {data.honey_type === 'vivo' && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-emerald-700/40 bg-emerald-900/20">
          <span className="text-2xl flex-shrink-0">🌿</span>
          <div>
            <p className="text-sm font-semibold text-emerald-300">Mel vivo</p>
            <p className="text-xs text-emerald-400 mt-0.5">
              Este lote será registrado diretamente no estoque após a conclusão.
            </p>
          </div>
        </div>
      )}

      {data.honey_type === 'maturado' && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-700/40 bg-amber-900/20">
          <span className="text-2xl flex-shrink-0">⏳</span>
          <div>
            <p className="text-sm font-semibold text-amber-300">Mel maturado</p>
            <p className="text-xs text-amber-400 mt-0.5">
              Este lote será encaminhado para maturação com status{' '}
              <strong>aguardando maturação</strong> após ser salvo.
            </p>
          </div>
        </div>
      )}
    </div>,

    // ── Step 3: Qualidade ──────────────────────────────────────────────────
    <div className="space-y-6" key="s3">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Brix (°Bx)"
          type="number" step="0.1" min="0" max="100"
          value={data.brix}
          onChange={(e) => update({ brix: e.target.value })}
          placeholder="ex: 72.0"
        />
        <Input
          label="Umidade (%)"
          type="number" step="0.1" min="0" max="100"
          value={data.humidity_pct}
          onChange={(e) => update({ humidity_pct: e.target.value })}
          placeholder="ex: 26.5"
        />
      </div>

      <ViscosityPicker value={data.viscosity} onChange={(v) => update({ viscosity: v })} />

      <div>
        <SectionLabel>Aspecto visual</SectionLabel>
        <div className="flex gap-2">
          {([
            { v: 'clear', icon: '💎', label: 'Límpido' },
            { v: 'cloudy', icon: '🌫️', label: 'Turvo' },
            { v: 'crystallized', icon: '❄️', label: 'Cristalizado' },
          ] as { v: VisualAspect; icon: string; label: string }[]).map((opt) => (
            <PickerBtn
              key={opt.v}
              active={data.visual_aspect === opt.v}
              onClick={() => update({ visual_aspect: data.visual_aspect === opt.v ? null : opt.v })}
              icon={opt.icon} label={opt.label}
            />
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Bolhas (fermentação)</SectionLabel>
        <div className="flex gap-2">
          {([
            { v: 'none', icon: '✅', label: 'Sem bolhas', color: 'emerald' },
            { v: 'few', icon: '🟡', label: 'Poucas', color: 'amber' },
            { v: 'many', icon: '🔴', label: 'Muitas', color: 'red' },
          ] as { v: BubblesLevel; icon: string; label: string; color: 'emerald' | 'amber' | 'red' }[]).map((opt) => (
            <PickerBtn
              key={opt.v}
              active={data.bubbles === opt.v}
              onClick={() => update({ bubbles: data.bubbles === opt.v ? null : opt.v })}
              icon={opt.icon} label={opt.label} color={opt.color}
            />
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Teste do papel</SectionLabel>
        <p className="text-xs text-stone-500 mb-2">
          Gota no papel: absorção lenta = mel maduro (aprovado); rápida = mel verde (reprovado).
        </p>
        <div className="flex gap-3">
          <PickerBtn
            active={data.paper_test === 'pass'}
            onClick={() => update({ paper_test: data.paper_test === 'pass' ? null : 'pass' })}
            icon="✅" label="Aprovado" sub="Firme no papel" color="emerald"
          />
          <PickerBtn
            active={data.paper_test === 'fail'}
            onClick={() => update({ paper_test: data.paper_test === 'fail' ? null : 'fail' })}
            icon="❌" label="Reprovado" sub="Escorreu" color="amber"
          />
        </div>
      </div>
    </div>,

    // ── Step 4: Insumos ────────────────────────────────────────────────────
    <div className="space-y-5" key="s4">
      <p className="text-sm text-stone-400">
        Marque os insumos fornecidos às caixas durante ou após a colheita.
      </p>

      <div className="space-y-2">
        {([
          { key: 'syrup_provided',       icon: '🍬', label: 'Xarope (calda)',    desc: 'Solução de açúcar' },
          { key: 'pollen_ball_provided', icon: '🌼', label: 'Bolinhos de pólen', desc: 'Suplemento proteico' },
          { key: 'wax_provided',         icon: '🕯️', label: 'Cera',             desc: 'Para construção' },
        ] as { key: keyof Pick<WizardData, 'syrup_provided' | 'pollen_ball_provided' | 'wax_provided'>; icon: string; label: string; desc: string }[]).map(({ key, icon, label, desc }) => (
          <button
            key={key} type="button"
            onClick={() => update({ [key]: !data[key] })}
            className={cn(
              'w-full flex items-center gap-4 px-4 py-3 rounded-xl border text-left transition-colors',
              data[key]
                ? 'bg-emerald-900/25 border-emerald-600/50 text-emerald-300'
                : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
            )}>
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

      <Textarea
        label="Observações sobre insumos (opcional)"
        value={data.input_notes}
        onChange={(e) => update({ input_notes: e.target.value })}
        placeholder="Quantidades, instruções especiais..."
        rows={2}
      />
    </div>,

    // ── Step 5: Conclusão ──────────────────────────────────────────────────
    <div className="space-y-5" key="s5">
      {/* Summary card */}
      <div className="rounded-xl border border-stone-700 bg-stone-800/50 divide-y divide-stone-700">
        {[
          { label: 'Data', value: data.harvested_at.split('-').reverse().join('/') },
          {
            label: 'Caixas',
            value: data.hive_local_ids.length > 0
              ? data.hive_local_ids
                  .map((id) => hives.find((h) => h.local_id === id)?.code ?? id)
                  .join(', ')
              : '—'
          },
          {
            label: 'Volume',
            value: volTotal > 0
              ? `${volTotal.toLocaleString('pt-BR')} mL`
              : data.total_weight_kg
              ? `${data.total_weight_kg} kg`
              : '—'
          },
          { label: 'Tipo', value: data.honey_type === 'vivo' ? '🌿 Mel vivo' : '✨ Mel maturado' },
          ...(data.honey_type === 'maturado'
            ? [{ label: 'Status', value: '⏳ Aguardando maturação' }]
            : []),
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-stone-500">{label}</span>
            <span className="text-stone-200 font-medium text-right max-w-[60%] truncate">{value}</span>
          </div>
        ))}
      </div>

      <Textarea
        label="Observações gerais (opcional)"
        value={data.notes}
        onChange={(e) => update({ notes: e.target.value })}
        placeholder="Condições gerais da colheita, intercorrências, notas relevantes..."
        rows={4}
      />

      {errors.submit && (
        <div className="flex items-start gap-2 text-sm bg-red-950/60 border border-red-700/40 rounded-xl px-4 py-3">
          <span className="text-red-400 flex-shrink-0">⚠</span>
          <span className="text-red-300">{errors.submit}</span>
        </div>
      )}
    </div>,
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-stone-900 border-b border-stone-800">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)}
            className="text-stone-400 hover:text-stone-100 transition-colors p-1" title="Cancelar">
            ✕
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-stone-100 truncate">
              {currentApiary ? `Colheita · ${currentApiary.name}`
                : preselectedHive ? `Colheita · ${preselectedHive.code}`
                : 'Nova Colheita'}
            </p>
            <p className="text-xs text-stone-500">{stepInfo.icon} {stepInfo.label}</p>
          </div>
          {volTotal > 0 && (
            <span className="text-xs text-amber-400 font-medium flex-shrink-0">
              🫙 {volTotal.toLocaleString('pt-BR')} mL
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <button key={s.id} type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                title={s.label}>
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
          <p className="text-stone-500 text-sm mt-0.5">{stepInfo.subtitle}</p>
        </div>
        {stepContent[step]}
      </main>

      {/* Sticky footer */}
      <footer className="sticky bottom-0 bg-stone-900 border-t border-stone-800 px-4 py-3">
        <div className="flex gap-3 max-w-2xl mx-auto">
          {step > 0 ? (
            <Button variant="secondary" onClick={back} className="flex-1">← Voltar</Button>
          ) : (
            <Button variant="secondary" onClick={() => navigate(-1)} className="flex-1">Cancelar</Button>
          )}

          {step < STEPS.length - 1 ? (
            <Button onClick={next} className="flex-1">Próxima →</Button>
          ) : (
            <div className="flex gap-2 flex-1">
              <Button
                variant="secondary"
                onClick={() => submit(true)}
                loading={submitting}
                className="flex-1"
              >
                Rascunho
              </Button>
              <Button
                onClick={() => submit(false)}
                loading={submitting}
                className="flex-1 bg-amber-600 hover:bg-amber-500"
              >
                🍯 Concluir
              </Button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
