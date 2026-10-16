/**
 * Normalizes inspection checklist health data from any schema version (v2 / v3).
 * All accesses are defensive — never crashes on undefined/null checklist.
 */

export interface ChecklistHealth {
  /** Colony strength as a 1–5 numeric score */
  strength: number;
  /** True if any invaders, pests, disease signals or critical weakness signs are recorded */
  hasAlerts: boolean;
  /** Combined invader/pest values for display (v3 invaders + v2 pests_observed) */
  allInvaders: string[];
  /** Disease values for display (v2 only; empty in v3) */
  diseasesObserved: string[];
  /** True if colony needs feeding based on management actions or legacy flag */
  needsFeeding: boolean;
  /** True if colony needs space expansion based on box observations or legacy flag */
  needsExpansion: boolean;
}

const STRENGTH_MAP: Record<string, number> = {
  very_weak: 1,
  weak: 2,
  medium: 3,
  strong: 4,
  very_strong: 5,
};

/** Mesmos valores neutros que SanidadeTab trata como "nada observado". */
const VALORES_NEUTROS = ['ausentes', 'nenhum', 'nenhuma'];

/** Safely coerce an unknown value to string[]. */
function safeArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : [];
}

export function normalizeChecklistHealth(checklist: unknown): ChecklistHealth {
  const c = (checklist != null && typeof checklist === 'object' ? checklist : {}) as Record<string, unknown>;

  // Strength: v3 uses colony_strength enum, v2 uses population_strength number
  const strength: number =
    STRENGTH_MAP[c.colony_strength as string] ??
    (typeof c.population_strength === 'number' ? c.population_strength : 3);

  // Invaders / alert signals
  const invaders = safeArray(c.invaders);
  const pestsObserved = safeArray(c.pests_observed);
  const diseasesObserved = safeArray(c.diseases_observed);
  const weaknessSigns = safeArray(c.weakness_signs);

  // "Ausentes"/"nenhum" são a resposta negativa do formulário (e o valor
  // padrão) — não podem contar como invasor presente.
  const allInvaders = [...invaders, ...pestsObserved].filter((v) => !VALORES_NEUTROS.includes(v));
  const criticalWeakness = weaknessSigns.some((s) =>
    ['suspeita_orfandade', 'abandono_total', 'sem_postura_visivel', 'colonia_fraca'].includes(s)
  );
  const hasAlerts = allInvaders.length > 0 || diseasesObserved.length > 0 || criticalWeakness;

  // Feeding need: v4 management_actions_pending[], v3 management_actions[],
  // v2 needs_feeding boolean.
  // "Precisa alimentar" é justamente uma pendência, então o campo novo entra
  // aqui — sem ele, inspeções novas (que deixam o legado vazio) perderiam o
  // indicador nos cards e dashboards.
  const mgmtActions = [
    ...safeArray(c.management_actions),
    ...safeArray(c.management_actions_pending),
  ];
  const needsFeeding =
    !!c.needs_feeding ||
    mgmtActions.some((a) => a.includes('alimenta'));

  // Expansion need: v3 management_actions[] / box_observations[], v2 needs_space_expansion boolean
  const boxObs = safeArray(c.box_observations);
  const needsExpansion =
    !!c.needs_space_expansion ||
    mgmtActions.some((a) => a.includes('melgueira') || a.includes('expans')) ||
    boxObs.some((o) => o.includes('melgueira') || o.includes('expans'));

  return { strength, hasAlerts, allInvaders, diseasesObserved, needsFeeding, needsExpansion };
}
