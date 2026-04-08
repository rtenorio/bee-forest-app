import { useMemo, useState } from 'react';
import { normalizeChecklistHealth } from '@/utils/inspectionUtils';
import { format, subMonths } from 'date-fns';
import { useHives } from '@/hooks/useHives';
import { useApiaries } from '@/hooks/useApiaries';
import { useInspections } from '@/hooks/useInspections';
import { useProductions } from '@/hooks/useProductions';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { exportCsv } from '@/utils/exportCsv';
import { cn } from '@/utils/cn';

// ─── Label maps ───────────────────────────────────────────────────────────────

const PEST_LABELS: Record<string, string> = {
  small_hive_beetle: 'Besouro da caixa', phorid_flies: 'Moscas fóridas',
  ants: 'Formigas', wax_moth: 'Traça da cera', lizards: 'Lagartos', spiders: 'Aranhas',
};
const DISEASE_LABELS: Record<string, string> = {
  podridao_cria: 'Podridão de cria',
  cria_seca: 'Cria seca',
  fungo_cria: 'Fungo na cria',
  fungo: 'Fungo',
  mal_de_maio: 'Mal de maio',
  deformidade_asa: 'Deformidade de asa',
  microsporidiose: 'Microsporidiose',
  nosemose: 'Nosemose',
  pillagem: 'Pilhagem',
};
const PRODUCT_LABELS: Record<string, string> = {
  honey: 'Mel', propolis: 'Própolis', pollen: 'Pólen', wax: 'Cera',
};
const LEVEL_LABELS: Record<string, string> = {
  low: 'Baixa', adequate: 'Adequada', abundant: 'Abundante',
};
const STRENGTH_LABELS = ['', 'Muito fraca', 'Fraca', 'Média', 'Forte', 'Muito forte'];
const QUEEN_LABELS: Record<string, string> = { true: 'Sim', false: 'Não', null: 'N/V' };
const TEMPERAMENT_LABELS: Record<string, string> = {
  calm: 'Calma', nervous: 'Nervosa', aggressive: 'Agressiva',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gToKg(g: number) {
  return g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${g} g`;
}

function formatDateDisplay(iso: string) {
  return iso.slice(0, 10).split('-').reverse().join('/');
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'production' | 'inspections';

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>('production');

  const { data: hives = [], isLoading: hivesLoading } = useHives();
  const { data: apiaries = [] } = useApiaries();
  const { data: productions = [], isLoading: prodLoading } = useProductions();
  const { data: inspections = [], isLoading: inspLoading } = useInspections();

  const isLoading = hivesLoading || prodLoading || inspLoading;

  // ── Shared filters ────────────────────────────────────────────────────────
  const defaultFrom = format(subMonths(new Date(), 6), 'yyyy-MM-dd');
  const defaultTo = format(new Date(), 'yyyy-MM-dd');

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [apiaryId, setApiaryId] = useState('');
  const [hiveId, setHiveId] = useState('');
  const [productType, setProductType] = useState('');

  // Filtered hive options based on selected apiary
  const hiveOptions = useMemo(() => {
    const base = apiaryId ? hives.filter((h) => h.apiary_local_id === apiaryId) : hives;
    return [
      { value: '', label: 'Todas as caixas' },
      ...base.map((h) => ({ value: h.local_id, label: h.code })),
    ];
  }, [hives, apiaryId]);

  const apiaryOptions = [
    { value: '', label: 'Todos os meliponários' },
    ...apiaries.map((a) => ({ value: a.local_id, label: a.name })),
  ];

  const productOptions = [
    { value: '', label: 'Todos os produtos' },
    { value: 'honey', label: '🍯 Mel' },
    { value: 'propolis', label: '🟫 Própolis' },
    { value: 'pollen', label: '🌼 Pólen' },
    { value: 'wax', label: '🕯️ Cera' },
  ];

  // Reset hive selection when apiary changes
  function handleApiaryChange(id: string) {
    setApiaryId(id);
    setHiveId('');
  }

  // ── Filtered productions ──────────────────────────────────────────────────
  const filteredProductions = useMemo(() => {
    return productions.filter((p) => {
      const date = p.harvested_at.slice(0, 10);
      if (date < dateFrom || date > dateTo) return false;
      if (hiveId && p.hive_local_id !== hiveId) return false;
      if (productType && p.product_type !== productType) return false;
      if (apiaryId) {
        const hive = hives.find((h) => h.local_id === p.hive_local_id);
        if (!hive || hive.apiary_local_id !== apiaryId) return false;
      }
      return true;
    }).sort((a, b) => b.harvested_at.localeCompare(a.harvested_at));
  }, [productions, dateFrom, dateTo, hiveId, productType, apiaryId, hives]);

  const productionSummary = useMemo(() => {
    const byType: Record<string, number> = {};
    for (const p of filteredProductions) {
      byType[p.product_type] = (byType[p.product_type] ?? 0) + p.quantity_g;
    }
    return byType;
  }, [filteredProductions]);

  // ── Filtered inspections ──────────────────────────────────────────────────
  const filteredInspections = useMemo(() => {
    return inspections.filter((i) => {
      const date = i.inspected_at.slice(0, 10);
      if (date < dateFrom || date > dateTo) return false;
      if (hiveId && i.hive_local_id !== hiveId) return false;
      if (apiaryId) {
        const hive = hives.find((h) => h.local_id === i.hive_local_id);
        if (!hive || hive.apiary_local_id !== apiaryId) return false;
      }
      return true;
    }).sort((a, b) => b.inspected_at.localeCompare(a.inspected_at));
  }, [inspections, dateFrom, dateTo, hiveId, apiaryId, hives]);

  const inspectionSummary = useMemo(() => {
    if (filteredInspections.length === 0) return null;
    const avgStrength = filteredInspections.reduce((s, i) => s + normalizeChecklistHealth(i.checklist).strength, 0) / filteredInspections.length;
    const withAlerts = filteredInspections.filter((i) => normalizeChecklistHealth(i.checklist).hasAlerts).length;
    const needsFeeding = filteredInspections.filter((i) => normalizeChecklistHealth(i.checklist).needsFeeding).length;
    return { avgStrength, withAlerts, needsFeeding, total: filteredInspections.length };
  }, [filteredInspections]);

  // ── CSV exports ───────────────────────────────────────────────────────────
  function exportProductionCsv() {
    const headers = ['Data', 'Caixa', 'Meliponário', 'Produto', 'Quantidade (g)', 'Quantidade (kg)', 'Grau', 'Observações'];
    const rows = filteredProductions.map((p) => {
      const hive = hives.find((h) => h.local_id === p.hive_local_id);
      const apiary = hive ? apiaries.find((a) => a.local_id === hive.apiary_local_id) : null;
      return [
        formatDateDisplay(p.harvested_at),
        hive?.code ?? p.hive_local_id,
        apiary?.name ?? '',
        PRODUCT_LABELS[p.product_type] ?? p.product_type,
        String(p.quantity_g),
        (p.quantity_g / 1000).toFixed(3),
        p.quality_grade ?? '',
        p.notes,
      ];
    });
    const period = `${dateFrom}_${dateTo}`;
    exportCsv(`producao_${period}.csv`, headers, rows);
  }

  function exportInspectionCsv() {
    const headers = [
      'Data', 'Caixa', 'Meliponário', 'Inspetor', 'Força', 'Rainha Vista',
      'Cria', 'Temperamento', 'Mel', 'Pólen', 'Pragas', 'Doenças',
      'Alimentar', 'Expandir', 'Próxima Inspeção', 'Observações',
    ];
    const rows = filteredInspections.map((i) => {
      const hive = hives.find((h) => h.local_id === i.hive_local_id);
      const apiary = hive ? apiaries.find((a) => a.local_id === hive.apiary_local_id) : null;
      const health = normalizeChecklistHealth(i.checklist);
      const raw = i.checklist as unknown as Record<string, unknown>;
      const honeyStores = (raw.honey_stores as string) ?? '';
      const pollenStores = (raw.pollen_stores as string) ?? '';
      const temperament = (raw.temperament as string) ?? '';
      return [
        formatDateDisplay(i.inspected_at),
        hive?.code ?? i.hive_local_id,
        apiary?.name ?? '',
        i.inspector_name,
        `${health.strength} - ${STRENGTH_LABELS[health.strength] ?? ''}`,
        QUEEN_LABELS[String(raw.queen_seen)] ?? '',
        raw.brood_present ? 'Sim' : 'Não',
        temperament ? (TEMPERAMENT_LABELS[temperament] ?? temperament) : '',
        LEVEL_LABELS[honeyStores] ?? honeyStores,
        LEVEL_LABELS[pollenStores] ?? pollenStores,
        health.allInvaders.map((p) => PEST_LABELS[p] ?? p).join('; '),
        health.diseasesObserved.map((d) => DISEASE_LABELS[d] ?? d).join('; '),
        health.needsFeeding ? 'Sim' : 'Não',
        health.needsExpansion ? 'Sim' : 'Não',
        i.next_inspection_due ? formatDateDisplay(i.next_inspection_due) : '',
        i.notes,
      ];
    });
    const period = `${dateFrom}_${dateTo}`;
    exportCsv(`inspecoes_${period}.csv`, headers, rows);
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-100">Relatórios</h1>
        <p className="text-stone-500 text-sm">Exporte dados de produção e inspeções</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-900 border border-stone-800 rounded-xl p-1 w-fit">
        {([
          { id: 'production' as Tab, label: '🍯 Produção' },
          { id: 'inspections' as Tab, label: '🔍 Inspeções' },
        ]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === id
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-stone-400 hover:text-stone-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <Input
            label="Data início"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            label="Data fim"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <Select
            label="Meliponário"
            options={apiaryOptions}
            value={apiaryId}
            onChange={(e) => handleApiaryChange(e.target.value)}
          />
          <Select
            label="Caixa"
            options={hiveOptions}
            value={hiveId}
            onChange={(e) => setHiveId(e.target.value)}
          />
          {tab === 'production' && (
            <div className="col-span-2 sm:col-span-1">
              <Select
                label="Produto"
                options={productOptions}
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-stone-500">
            {tab === 'production'
              ? `${filteredProductions.length} registro${filteredProductions.length !== 1 ? 's' : ''} encontrado${filteredProductions.length !== 1 ? 's' : ''}`
              : `${filteredInspections.length} inspeção${filteredInspections.length !== 1 ? 'ões' : ''} encontrada${filteredInspections.length !== 1 ? 's' : ''}`}
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={tab === 'production' ? exportProductionCsv : exportInspectionCsv}
            disabled={tab === 'production' ? filteredProductions.length === 0 : filteredInspections.length === 0}
          >
            ↓ Exportar CSV
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <>
          {/* ── Production tab ── */}
          {tab === 'production' && (
            <div className="space-y-4">
              {/* Summary */}
              {Object.keys(productionSummary).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(productionSummary).map(([type, total]) => (
                    <Card key={type} className="text-center">
                      <p className="text-lg font-bold text-amber-400">{gToKg(total)}</p>
                      <p className="text-xs text-stone-500">{PRODUCT_LABELS[type] ?? type}</p>
                    </Card>
                  ))}
                </div>
              )}

              {/* Table */}
              {filteredProductions.length === 0 ? (
                <p className="text-stone-500 text-center py-12">Nenhum registro no período selecionado</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-stone-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-800 bg-stone-900/60">
                        {['Data', 'Caixa', 'Meliponário', 'Produto', 'Quantidade', 'Grau', 'Observações'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-stone-400 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProductions.slice(0, 200).map((p) => {
                        const hive = hives.find((h) => h.local_id === p.hive_local_id);
                        const apiary = hive ? apiaries.find((a) => a.local_id === hive.apiary_local_id) : null;
                        return (
                          <tr key={p.local_id} className="border-b border-stone-800/60 hover:bg-stone-800/30 transition-colors">
                            <td className="px-4 py-3 text-stone-300 whitespace-nowrap">{formatDateDisplay(p.harvested_at)}</td>
                            <td className="px-4 py-3 font-medium text-amber-400 whitespace-nowrap">{hive?.code ?? '—'}</td>
                            <td className="px-4 py-3 text-stone-400 whitespace-nowrap">{apiary?.name ?? '—'}</td>
                            <td className="px-4 py-3 text-stone-300 whitespace-nowrap">{PRODUCT_LABELS[p.product_type] ?? p.product_type}</td>
                            <td className="px-4 py-3 text-stone-300 whitespace-nowrap">{gToKg(p.quantity_g)}</td>
                            <td className="px-4 py-3 text-stone-400">
                              {p.quality_grade && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  {p.quality_grade}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-stone-500 max-w-xs truncate">{p.notes || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredProductions.length > 200 && (
                    <p className="text-center text-xs text-stone-500 py-3 border-t border-stone-800">
                      Exibindo 200 de {filteredProductions.length} registros. Exporte o CSV para ver todos.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Inspections tab ── */}
          {tab === 'inspections' && (
            <div className="space-y-4">
              {/* Summary */}
              {inspectionSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Inspeções', value: inspectionSummary.total, color: 'text-purple-400' },
                    { label: 'Força média', value: inspectionSummary.avgStrength.toFixed(1) + ' 🐝', color: 'text-amber-400' },
                    { label: 'Com alertas', value: inspectionSummary.withAlerts, color: 'text-red-400' },
                    { label: 'Precisam alimentar', value: inspectionSummary.needsFeeding, color: 'text-orange-400' },
                  ].map((s) => (
                    <Card key={s.label} className="text-center">
                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-stone-500">{s.label}</p>
                    </Card>
                  ))}
                </div>
              )}

              {/* Table */}
              {filteredInspections.length === 0 ? (
                <p className="text-stone-500 text-center py-12">Nenhuma inspeção no período selecionado</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-stone-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-800 bg-stone-900/60">
                        {['Data', 'Caixa', 'Meliponário', 'Inspetor', 'Força', 'Rainha', 'Mel', 'Pragas', 'Doenças', 'Ações'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-stone-400 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInspections.slice(0, 200).map((i) => {
                        const hive = hives.find((h) => h.local_id === i.hive_local_id);
                        const apiary = hive ? apiaries.find((a) => a.local_id === hive.apiary_local_id) : null;
                        const health = normalizeChecklistHealth(i.checklist);
                        const raw = i.checklist as unknown as Record<string, unknown>;
                        return (
                          <tr key={i.local_id} className={cn(
                            'border-b border-stone-800/60 hover:bg-stone-800/30 transition-colors',
                            health.hasAlerts && 'bg-red-900/5'
                          )}>
                            <td className="px-4 py-3 text-stone-300 whitespace-nowrap">{formatDateDisplay(i.inspected_at)}</td>
                            <td className="px-4 py-3 font-medium text-amber-400 whitespace-nowrap">{hive?.code ?? '—'}</td>
                            <td className="px-4 py-3 text-stone-400 whitespace-nowrap">{apiary?.name ?? '—'}</td>
                            <td className="px-4 py-3 text-stone-400 whitespace-nowrap">{i.inspector_name || '—'}</td>
                            <td className="px-4 py-3 text-stone-300 whitespace-nowrap">
                              {'🐝'.repeat(health.strength)}
                            </td>
                            <td className="px-4 py-3 text-stone-300 whitespace-nowrap">
                              {QUEEN_LABELS[String(raw.queen_seen)] ?? '?'}
                            </td>
                            <td className="px-4 py-3 text-stone-400 whitespace-nowrap">
                              {LEVEL_LABELS[(raw.honey_stores as string) ?? ''] ?? '—'}
                            </td>
                            <td className="px-4 py-3">
                              {health.allInvaders.length > 0 ? (
                                <span className="text-red-400 text-xs">
                                  {health.allInvaders.map((p) => PEST_LABELS[p] ?? p).join(', ')}
                                </span>
                              ) : (
                                <span className="text-emerald-500 text-xs">Nenhuma</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {health.diseasesObserved.length > 0 ? (
                                <span className="text-red-400 text-xs">
                                  {health.diseasesObserved.map((d) => DISEASE_LABELS[d] ?? d).join(', ')}
                                </span>
                              ) : (
                                <span className="text-emerald-500 text-xs">Nenhuma</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs space-x-1 whitespace-nowrap">
                              {health.needsFeeding && <span className="text-orange-400">🌺 Alimentar</span>}
                              {health.needsExpansion && <span className="text-blue-400">📦 Expandir</span>}
                              {!health.needsFeeding && !health.needsExpansion && (
                                <span className="text-stone-600">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredInspections.length > 200 && (
                    <p className="text-center text-xs text-stone-500 py-3 border-t border-stone-800">
                      Exibindo 200 de {filteredInspections.length} inspeções. Exporte o CSV para ver todas.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
