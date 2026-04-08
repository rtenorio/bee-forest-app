import type { InspectionChecklist as ChecklistType } from '@bee-forest/shared';

interface Props {
  value: ChecklistType;
  onChange: (value: ChecklistType) => void;
  readOnly?: boolean;
}

// ─── Label maps ───────────────────────────────────────────────────────────────

const STRENGTH_LABEL: Record<string, string> = {
  very_weak: 'Muito fraca', weak: 'Fraca', medium: 'Média', strong: 'Forte', very_strong: 'Muito forte',
};
const STRENGTH_NUM: Record<string, number> = {
  very_weak: 1, weak: 2, medium: 3, strong: 4, very_strong: 5,
};
const ACTIVITY_LABEL: Record<string, string> = {
  very_low: 'Muito baixa', low: 'Baixa', normal: 'Normal', high: 'Alta',
};
const STORES_LABEL: Record<string, string> = {
  low: 'Baixa', adequate: 'Adequada', high: 'Alta',
};
const BROOD_LABEL: Record<string, string> = {
  not_evaluated: 'Não avaliada', reduced: 'Reduzida', normal: 'Normal', intense: 'Intensa',
};
const SANITARY_LABEL: Record<string, string> = {
  mild: 'Leve', moderate: 'Moderada', severe: 'Grave', critical: 'Crítica',
};
const POTENTIAL_LABEL: Record<string, string> = {
  very_low: 'Muito baixo', low: 'Baixo', medium: 'Médio', high: 'Alto', very_high: 'Muito alto',
};
const OVERALL_STATUS: Record<string, { label: string; color: string }> = {
  healthy:   { label: 'Saudável',   color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700/40' },
  attention: { label: 'Atenção',    color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/40' },
  high_risk: { label: 'Alto risco', color: 'text-orange-400 bg-orange-900/30 border-orange-700/40' },
  critical:  { label: 'Crítica',    color: 'text-red-400 bg-red-900/30 border-red-700/40' },
};
const RECOMMENDATION_LABEL: Record<string, string> = {
  maintain_routine: 'Manter rotina',
  reassess_soon: 'Reavaliar em breve',
  corrective_management: 'Manejo corretivo',
  refer_to_technician: 'Encaminhar ao técnico',
};
const INSPECTION_TYPE_LABEL: Record<string, string> = {
  external_only: 'Somente externa',
  external_internal: 'Externa + interna',
};
const TIME_LABEL: Record<string, string> = {
  morning: 'Manhã', afternoon: 'Tarde', night: 'Noite',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : [];
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b border-stone-800 last:border-0">
      <span className="text-xs text-stone-500 shrink-0">{label}</span>
      <span className="text-xs text-stone-200 text-right">{value}</span>
    </div>
  );
}

function TagList({ tags, color = 'stone' }: { tags: string[]; color?: 'stone' | 'red' | 'amber' | 'emerald' }) {
  if (tags.length === 0) return null;
  const cls = {
    stone:   'bg-stone-800 border-stone-700 text-stone-300',
    red:     'bg-red-900/40 border-red-700/40 text-red-300',
    amber:   'bg-amber-900/40 border-amber-700/40 text-amber-300',
    emerald: 'bg-emerald-900/40 border-emerald-700/40 text-emerald-300',
  }[color];
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {tags.map((t) => (
        <span key={t} className={`px-2 py-0.5 rounded-full text-xs border ${cls}`}>
          {t.replace(/_/g, ' ')}
        </span>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-stone-900/60 border border-stone-800 rounded-xl px-4 py-3 space-y-1">
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InspectionChecklistForm({ value }: Props) {
  const c = (value ?? {}) as Record<string, unknown>;

  // Backward-compat strength: v3 enum or v2 number
  const strengthNum: number =
    STRENGTH_NUM[c.colony_strength as string] ??
    (typeof c.population_strength === 'number' ? (c.population_strength as number) : 0);
  const strengthLabel =
    STRENGTH_LABEL[c.colony_strength as string] ??
    (strengthNum > 0 ? `${strengthNum}/5` : null);

  const invaders = [...safeArray(c.invaders), ...safeArray(c.pests_observed)];
  const weaknessSigns = safeArray(c.weakness_signs);
  const internalChanges = safeArray(c.internal_changes);
  const mgmtActions = [...safeArray(c.management_actions), ...safeArray(c.interventions)];
  const productiveObs = safeArray(c.productive_observations);
  const tasks = safeArray(c.tasks);

  const hasAlerts = invaders.length > 0 || weaknessSigns.length > 0 || internalChanges.length > 0;

  return (
    <div className="space-y-3">

      {/* Overall status */}
      {c.overall_status && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${OVERALL_STATUS[c.overall_status as string]?.color ?? 'text-stone-400 bg-stone-800 border-stone-700'}`}>
            {OVERALL_STATUS[c.overall_status as string]?.label ?? String(c.overall_status)}
          </span>
          {c.recommendation && (
            <span className="text-xs text-stone-400">
              → {RECOMMENDATION_LABEL[c.recommendation as string] ?? String(c.recommendation)}
            </span>
          )}
        </div>
      )}

      {/* Context */}
      {(c.inspection_type || c.time_of_day) && (
        <Section title="Contexto">
          {c.inspection_type && <Row label="Tipo" value={INSPECTION_TYPE_LABEL[c.inspection_type as string] ?? String(c.inspection_type)} />}
          {c.time_of_day && <Row label="Horário" value={TIME_LABEL[c.time_of_day as string] ?? String(c.time_of_day)} />}
        </Section>
      )}

      {/* Colony strength */}
      {strengthNum > 0 && (
        <Section title="Força da colônia">
          <div className="flex items-center gap-3">
            <span className="text-amber-400 text-lg">{'🐝'.repeat(strengthNum)}</span>
            {strengthLabel && <span className="text-xs text-stone-400">{strengthLabel}</span>}
          </div>
          {safeArray(c.strength_observations).length > 0 && (
            <TagList tags={safeArray(c.strength_observations)} color="amber" />
          )}
        </Section>
      )}

      {/* Activity */}
      {c.activity_level && (
        <Section title="Atividade na entrada">
          <Row label="Nível" value={ACTIVITY_LABEL[c.activity_level as string] ?? String(c.activity_level)} />
          <TagList tags={safeArray(c.activity_observations)} />
          {c.entry_notes && <p className="text-xs text-stone-400 mt-1 italic">"{String(c.entry_notes)}"</p>}
        </Section>
      )}

      {/* Food reserves */}
      {(c.honey_stores || c.pollen_stores) && (
        <Section title="Reservas alimentares">
          {c.honey_stores && <Row label="Mel" value={STORES_LABEL[c.honey_stores as string] ?? String(c.honey_stores)} />}
          {c.pollen_stores && <Row label="Pólen" value={STORES_LABEL[c.pollen_stores as string] ?? String(c.pollen_stores)} />}
          <TagList tags={safeArray(c.food_observations)} />
          {c.food_notes && <p className="text-xs text-stone-400 mt-1 italic">"{String(c.food_notes)}"</p>}
        </Section>
      )}

      {/* Brood */}
      {c.brood_status && c.brood_status !== 'not_evaluated' && (
        <Section title="Cria">
          <Row label="Status" value={BROOD_LABEL[c.brood_status as string] ?? String(c.brood_status)} />
          <TagList tags={safeArray(c.brood_observations)} />
          {c.brood_notes && <p className="text-xs text-stone-400 mt-1 italic">"{String(c.brood_notes)}"</p>}
        </Section>
      )}

      {/* Box condition */}
      {safeArray(c.box_observations).length > 0 && (
        <Section title="Condição da caixa">
          <TagList tags={safeArray(c.box_observations)} />
          {c.box_notes && <p className="text-xs text-stone-400 mt-1 italic">"{String(c.box_notes)}"</p>}
        </Section>
      )}

      {/* Sanitary health */}
      {hasAlerts && (
        <Section title="Sanidade">
          {invaders.length > 0 && (
            <>
              <p className="text-xs text-stone-500">Invasores / pragas</p>
              <TagList tags={invaders} color="red" />
            </>
          )}
          {weaknessSigns.length > 0 && (
            <>
              <p className="text-xs text-stone-500 mt-2">Sinais de fraqueza</p>
              <TagList tags={weaknessSigns} color="red" />
            </>
          )}
          {internalChanges.length > 0 && (
            <>
              <p className="text-xs text-stone-500 mt-2">Alterações internas</p>
              <TagList tags={internalChanges} color="red" />
            </>
          )}
          {c.sanitary_severity && (
            <Row label="Severidade" value={SANITARY_LABEL[c.sanitary_severity as string] ?? String(c.sanitary_severity)} />
          )}
          {c.odor_description && <p className="text-xs text-stone-400 mt-1 italic">Odor: "{String(c.odor_description)}"</p>}
        </Section>
      )}

      {/* Productive potential */}
      {c.productive_potential && (
        <Section title="Potencial produtivo">
          <Row label="Potencial" value={POTENTIAL_LABEL[c.productive_potential as string] ?? String(c.productive_potential)} />
          {productiveObs.length > 0 && <TagList tags={productiveObs} color="emerald" />}
          {c.productive_notes && <p className="text-xs text-stone-400 mt-1 italic">"{String(c.productive_notes)}"</p>}
        </Section>
      )}

      {/* Management */}
      {mgmtActions.length > 0 && (
        <Section title="Manejo realizado">
          <TagList tags={mgmtActions} color="emerald" />
          {c.management_description && <p className="text-xs text-stone-400 mt-1 italic">"{String(c.management_description)}"</p>}
          {c.materials_used && <p className="text-xs text-stone-500 mt-1">Materiais: {String(c.materials_used)}</p>}
        </Section>
      )}

      {/* Tasks */}
      {tasks.length > 0 && (
        <Section title="Tarefas vinculadas">
          <div className="space-y-1">
            {(tasks as Array<Record<string, unknown>>).map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-stone-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span>{String(t.custom_text || t.label).replace(/_/g, ' ')}</span>
                {t.due_date && <span className="text-stone-500 ml-auto">{String(t.due_date)}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Final summary */}
      {c.final_summary && (
        <Section title="Resumo final">
          <p className="text-sm text-stone-300">{String(c.final_summary)}</p>
        </Section>
      )}
    </div>
  );
}
