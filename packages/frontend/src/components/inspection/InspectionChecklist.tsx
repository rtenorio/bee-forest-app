import { cn } from '@/utils/cn';
import type { InspectionChecklist as ChecklistType } from '@bee-forest/shared';

interface Props {
  value: ChecklistType;
  onChange: (value: ChecklistType) => void;
  readOnly?: boolean;
}

const PEST_OPTIONS = [
  { id: 'small_hive_beetle', label: 'Pequeno besouro da colmeia' },
  { id: 'phorid_flies', label: 'Moscas fóridas' },
  { id: 'ants', label: 'Formigas' },
  { id: 'wax_moth', label: 'Traça da cera' },
  { id: 'lizards', label: 'Lagartos' },
];

const DISEASE_OPTIONS = [
  { id: 'american_foulbrood', label: 'Loque americano' },
  { id: 'nosemosis', label: 'Nosemose' },
  { id: 'chalkbrood', label: 'Cria giz' },
  { id: 'sacbrood', label: 'Cria ensacada' },
];

function BeeStrengthPicker({ value, onChange }: { value: number; onChange: (v: 1|2|3|4|5) => void }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n as 1|2|3|4|5)}
          className={cn(
            'flex-1 py-2 rounded-lg text-xl transition-colors border',
            value >= n
              ? 'bg-amber-500/20 border-amber-500/60 text-amber-400'
              : 'bg-stone-800 border-stone-700 text-stone-600 hover:border-stone-600'
          )}
          title={`Força ${n}`}
        >
          🐝
        </button>
      ))}
    </div>
  );
}

function ToggleBadge({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-sm border transition-colors',
        active
          ? 'bg-red-900/60 border-red-500/60 text-red-300'
          : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
      )}
    >
      {label}
    </button>
  );
}

export function InspectionChecklistForm({ value, onChange, readOnly = false }: Props) {
  const update = (patch: Partial<ChecklistType>) => {
    if (!readOnly) onChange({ ...value, ...patch });
  };

  const toggleList = (list: 'pests_observed' | 'diseases_observed', item: string) => {
    const current = value[list] ?? [];
    const updated = current.includes(item) ? current.filter((i) => i !== item) : [...current, item];
    update({ [list]: updated });
  };

  return (
    <div className="space-y-5">
      {/* Population Strength */}
      <div>
        <label className="block text-sm font-medium text-stone-300 mb-2">
          Força da população
        </label>
        <BeeStrengthPicker
          value={value.population_strength}
          onChange={(v) => update({ population_strength: v })}
        />
        <p className="text-xs text-stone-500 mt-1">1 = fraca · 5 = muito forte</p>
      </div>

      {/* Yes/No fields */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: 'brood_present', label: 'Cria presente', icon: '🥚' },
          { key: 'needs_feeding', label: 'Precisa alimentar', icon: '🌺' },
          { key: 'needs_space_expansion', label: 'Precisa expandir', icon: '📦' },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => update({ [key]: !value[key as keyof ChecklistType] } as Partial<ChecklistType>)}
            disabled={readOnly}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors',
              (value[key as keyof ChecklistType] as boolean)
                ? 'bg-emerald-900/40 border-emerald-600/60 text-emerald-300'
                : 'bg-stone-800 border-stone-700 text-stone-400'
            )}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}

        {/* Honey stores */}
        <div className="col-span-2">
          <label className="block text-xs text-stone-400 mb-1.5">Reserva de mel</label>
          <div className="flex gap-2">
            {(['low', 'adequate', 'abundant'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => update({ honey_stores: v })}
                disabled={readOnly}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm border transition-colors',
                  value.honey_stores === v
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                    : 'bg-stone-800 border-stone-700 text-stone-400'
                )}
              >
                {v === 'low' ? 'Baixa' : v === 'adequate' ? 'Adequada' : 'Abundante'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Temperament */}
      <div>
        <label className="block text-sm font-medium text-stone-300 mb-2">Temperamento</label>
        <div className="flex gap-2">
          {([
            { v: 'calm', label: 'Calma', icon: '😊' },
            { v: 'nervous', label: 'Nervosa', icon: '😬' },
            { v: 'aggressive', label: 'Agressiva', icon: '😡' },
          ] as const).map(({ v, label, icon }) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ temperament: value.temperament === v ? null : v })}
              disabled={readOnly}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-xs transition-colors',
                value.temperament === v
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                  : 'bg-stone-800 border-stone-700 text-stone-400'
              )}
            >
              <span className="text-lg">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Pollen stores */}
      <div>
        <label className="block text-sm font-medium text-stone-300 mb-2">Reserva de pólen</label>
        <div className="flex gap-2">
          {(['low', 'adequate', 'abundant'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ pollen_stores: v })}
              disabled={readOnly}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm border transition-colors',
                value.pollen_stores === v
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                  : 'bg-stone-800 border-stone-700 text-stone-400'
              )}
            >
              {v === 'low' ? 'Baixa' : v === 'adequate' ? 'Adequada' : 'Abundante'}
            </button>
          ))}
        </div>
      </div>

      {/* Box condition */}
      <div>
        <label className="block text-sm font-medium text-stone-300 mb-2">Estado da caixa</label>
        <div className="flex gap-2">
          {(['poor', 'fair', 'good'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ box_condition: v })}
              disabled={readOnly}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm border transition-colors',
                value.box_condition === v
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                  : 'bg-stone-800 border-stone-700 text-stone-400'
              )}
            >
              {v === 'poor' ? '🔴 Ruim' : v === 'fair' ? '🟡 Regular' : '🟢 Bom'}
            </button>
          ))}
        </div>
      </div>

      {/* Pests */}
      <div>
        <label className="block text-sm font-medium text-stone-300 mb-2">Pragas observadas</label>
        <div className="flex flex-wrap gap-2">
          {PEST_OPTIONS.map(({ id, label }) => (
            <ToggleBadge
              key={id}
              label={label}
              active={(value.pests_observed ?? []).includes(id)}
              onClick={() => toggleList('pests_observed', id)}
            />
          ))}
        </div>
      </div>

      {/* Diseases */}
      <div>
        <label className="block text-sm font-medium text-stone-300 mb-2">Doenças observadas</label>
        <div className="flex flex-wrap gap-2">
          {DISEASE_OPTIONS.map(({ id, label }) => (
            <ToggleBadge
              key={id}
              label={label}
              active={(value.diseases_observed ?? []).includes(id)}
              onClick={() => toggleList('diseases_observed', id)}
            />
          ))}
        </div>
      </div>

      {/* Interventions (read-only display) */}
      {readOnly && value.interventions && value.interventions.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-stone-300 mb-2">Intervenções realizadas</label>
          <div className="flex flex-wrap gap-2">
            {value.interventions.map((id) => (
              <span key={id} className="px-3 py-1.5 rounded-full text-sm bg-emerald-900/40 border border-emerald-600/40 text-emerald-300">
                {id.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
