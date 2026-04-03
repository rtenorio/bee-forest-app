import { cn } from '@/utils/cn';
import type { InspectionChecklist } from '@bee-forest/shared';

// ─── Scoring ─────────────────────────────────────────────────────────────────

function scoreActivity(c: InspectionChecklist): number {
  const map: Record<string, number> = { very_low: 0, low: 0, normal: 2, high: 2 };
  return c.activity_level ? (map[c.activity_level] ?? 1) : 1;
}

function scoreStrength(c: InspectionChecklist): number {
  const map: Record<string, number> = { very_weak: 0, weak: 0, medium: 1, strong: 2, very_strong: 2 };
  return c.colony_strength ? (map[c.colony_strength] ?? 1) : 1;
}

function scoreFoodReserves(c: InspectionChecklist): number {
  const v = (s: string | null) => (s === 'high' || s === 'adequate' ? 1 : 0);
  return v(c.honey_stores) + v(c.pollen_stores);
}

function scoreBrood(c: InspectionChecklist): number {
  if (!c.brood_status || c.brood_status === 'not_evaluated') return 1;
  const map: Record<string, number> = { reduced: 0, normal: 2, intense: 2 };
  if (c.brood_observations.includes('suspeita_orfandade') || c.brood_observations.includes('falha_postura')) return 0;
  return map[c.brood_status] ?? 1;
}

function scoreSanity(c: InspectionChecklist): number {
  if (!c.sanitary_severity) return 2;
  const map: Record<string, number> = { mild: 2, moderate: 1, severe: 0, critical: 0 };
  return map[c.sanitary_severity] ?? 2;
}

function hasCriticalRule(c: InspectionChecklist): string | null {
  if (c.weakness_signs.includes('suspeita_orfandade') && c.strength_observations.includes('populacao_reduzida'))
    return 'Suspeita de orfandade com população reduzida';
  if (c.weakness_signs.includes('abandono_total'))
    return 'Abandono total da colônia detectado';
  if (c.invaders.includes('moscas_foridas') && c.weakness_signs.includes('sem_postura_visivel'))
    return 'Forídeos ativos com ausência de postura';
  if (c.internal_changes.includes('mofo') && c.internal_changes.includes('mel_fermentando'))
    return 'Mofo e mel fermentando simultaneamente';
  const heavyInvaders = c.invaders.filter((i) => i !== 'outros').length;
  if (heavyInvaders >= 2 && c.weakness_signs.includes('colonia_fraca'))
    return 'Múltiplos invasores com colônia fraca';
  return null;
}

export interface InspectionScore {
  total: number;
  status: 'healthy' | 'attention' | 'high_risk' | 'critical';
  recommendation: 'maintain_routine' | 'reassess_soon' | 'corrective_management' | 'refer_to_technician';
  criticalRule: string | null;
  axes: { label: string; score: number }[];
}

export function computeScore(c: InspectionChecklist): InspectionScore {
  const axes = [
    { label: 'Atividade', score: scoreActivity(c) },
    { label: 'Força', score: scoreStrength(c) },
    { label: 'Reservas', score: scoreFoodReserves(c) },
    { label: 'Cria', score: scoreBrood(c) },
    { label: 'Sanidade', score: scoreSanity(c) },
  ];
  const total = axes.reduce((s, a) => s + a.score, 0);
  const criticalRule = hasCriticalRule(c);

  let status: InspectionScore['status'];
  if (criticalRule) {
    status = 'critical';
  } else if (total >= 8) {
    status = 'healthy';
  } else if (total >= 5) {
    status = 'attention';
  } else if (total >= 3) {
    status = 'high_risk';
  } else {
    status = 'critical';
  }

  const recMap: Record<InspectionScore['status'], InspectionScore['recommendation']> = {
    healthy: 'maintain_routine',
    attention: 'reassess_soon',
    high_risk: 'corrective_management',
    critical: 'refer_to_technician',
  };

  return { total, status, recommendation: recMap[status], criticalRule, axes };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  checklist: InspectionChecklist;
  className?: string;
}

const statusConfig = {
  healthy: {
    label: 'Saudável',
    icon: '✅',
    color: 'border-emerald-500/40 bg-emerald-500/10',
    titleColor: 'text-emerald-300',
    dot: 'bg-emerald-400',
  },
  attention: {
    label: 'Atenção',
    icon: '⚠️',
    color: 'border-amber-500/40 bg-amber-500/10',
    titleColor: 'text-amber-300',
    dot: 'bg-amber-400',
  },
  high_risk: {
    label: 'Alto Risco',
    icon: '🔴',
    color: 'border-orange-500/40 bg-orange-500/10',
    titleColor: 'text-orange-300',
    dot: 'bg-orange-400',
  },
  critical: {
    label: 'Crítica',
    icon: '🚨',
    color: 'border-red-500/40 bg-red-500/10',
    titleColor: 'text-red-300',
    dot: 'bg-red-400',
  },
};

const recLabels: Record<string, string> = {
  maintain_routine: 'Manter rotina normal',
  reassess_soon: 'Reavaliar em breve',
  corrective_management: 'Exige manejo corretivo',
  refer_to_technician: 'Encaminhar ao técnico',
};

export function InspectionSummaryCard({ checklist, className }: Props) {
  const score = computeScore(checklist);
  const cfg = statusConfig[score.status];

  return (
    <div className={cn('rounded-xl border p-5', cfg.color, className)}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{cfg.icon}</span>
        <div>
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Status sugerido</p>
          <p className={cn('text-lg font-bold', cfg.titleColor)}>{cfg.label}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-stone-500">Pontuação</p>
          <p className={cn('text-2xl font-bold tabular-nums', cfg.titleColor)}>{score.total}<span className="text-sm font-normal text-stone-500">/10</span></p>
        </div>
      </div>

      {/* Axes */}
      <div className="grid grid-cols-5 gap-1.5 mb-4">
        {score.axes.map((ax) => (
          <div key={ax.label} className="flex flex-col items-center gap-1">
            <div className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'w-2 h-2 rounded-full',
                    i < ax.score ? cfg.dot : 'bg-stone-700'
                  )}
                />
              ))}
            </div>
            <span className="text-xs text-stone-500 text-center leading-tight">{ax.label}</span>
          </div>
        ))}
      </div>

      {/* Critical rule */}
      {score.criticalRule && (
        <div className="mb-3 flex items-start gap-2 text-xs bg-red-950/60 border border-red-700/40 rounded-lg px-3 py-2">
          <span className="text-red-400 flex-shrink-0">⚠</span>
          <span className="text-red-300">{score.criticalRule}</span>
        </div>
      )}

      {/* Recommendation */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-stone-400">Recomendação:</span>
        <span className={cn('font-medium', cfg.titleColor)}>{recLabels[score.recommendation]}</span>
      </div>
    </div>
  );
}
