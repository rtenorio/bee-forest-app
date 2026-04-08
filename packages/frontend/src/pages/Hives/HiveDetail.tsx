import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useHive, useDeleteHive } from '@/hooks/useHives';
import { useInspections, useDeleteInspection } from '@/hooks/useInspections';
import { useInstructions } from '@/hooks/useInstructions';
import { useProductions } from '@/hooks/useProductions';
import { useFeedings } from '@/hooks/useFeedings';
import { useSpecies } from '@/hooks/useSpecies';
import { useAuthStore } from '@/store/authStore';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { HiveStatusBadge } from '@/components/hive/HiveStatusBadge';
import { InspectionChecklistForm } from '@/components/inspection/InspectionChecklist';
import { HiveForm } from './HiveForm';
import { ProductionForm } from '../Productions/ProductionForm';
import { FeedingForm } from '../Feedings/FeedingForm';
import { formatDate, formatDateTime, daysSince } from '@/utils/dates';
import { QRCodeDisplay } from '@/components/hive/QRCodeDisplay';
import { normalizeChecklistHealth } from '@/utils/inspectionUtils';
import { exportHivePdf } from '@/utils/exportPdf';
import { HiveInstructions } from './HiveInstructions';
import { useDivisions } from '@/hooks/useDivisions';
import { useTransfers, useCreateTransfer } from '@/hooks/useTransfers';
import { useApiaries } from '@/hooks/useApiaries';
import { useMelgueiras, useInstallMelgueira, useRemoveMelgueira } from '@/hooks/useMelgueiras';
import { v4 as uuidv4 } from 'uuid';

export function HiveDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;
  const canManageHive = user.role === 'socio' || user.role === 'responsavel';
  const canSeeProduction = user.role === 'socio' || user.role === 'responsavel';

  const canTransfer = ['master_admin', 'socio', 'responsavel'].includes(user.role);

  type Tab = 'Inspeções' | 'Produção' | 'Alimentação' | 'Divisões' | 'Transferências' | 'Melgueiras';
  const TABS: Tab[] = canSeeProduction
    ? ['Inspeções', 'Produção', 'Alimentação', 'Divisões', 'Transferências', 'Melgueiras']
    : ['Inspeções', 'Divisões', 'Transferências', 'Melgueiras'];

  const [tab, setTab] = useState<Tab>('Inspeções');
  const [editHive, setEditHive] = useState(false);
  const [addProduction, setAddProduction] = useState(false);
  const [addFeeding, setAddFeeding] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferDestApiary, setTransferDestApiary] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transferBy, setTransferBy] = useState(user.name);
  const [transferReason, setTransferReason] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);

  const { data: hive, isLoading } = useHive(id!);
  const { data: inspections = [] } = useInspections(id);
  const { data: productions = [] } = useProductions(id);
  const { data: feedings = [] } = useFeedings(id);
  const [installMelgOpen, setInstallMelgOpen] = useState(false);
  const [installMelgId, setInstallMelgId]     = useState('');
  const [installMelgDate, setInstallMelgDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [installMelgBy, setInstallMelgBy]     = useState(user.name);

  const { data: divisions = [] } = useDivisions({ hive_local_id: id });
  const { data: originDivisions = [] } = useDivisions({ hive_new_local_id: id });
  const { data: transfers = [] } = useTransfers({ hive_local_id: id });
  const { data: apiaries = [] } = useApiaries();
  const { data: hiveMelgueiras = [] } = useMelgueiras({ hive_local_id: id });
  const { data: availableMelgueiras = [] } = useMelgueiras({ status: 'disponivel' });
  const createTransfer    = useCreateTransfer();
  const installMelgueira  = useInstallMelgueira();
  const removeMelgueira   = useRemoveMelgueira();
  const { data: speciesList = [] } = useSpecies();
  const deleteHive = useDeleteHive();
  const deleteInspection = useDeleteInspection();
  const { data: hiveInstructionsPanel = [] } = useInstructions({ hive_local_id: id!, status: 'pending' });
  const { data: apiaryInstructionsPanel = [] } = useInstructions({ apiary_local_id: hive?.apiary_local_id, status: 'pending' });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!hive) return <div className="text-stone-400 text-center py-16">Caixa não encontrada</div>;

  const species = speciesList.find((s) => s.local_id === hive.species_local_id);
  const sortedInspections = [...inspections].sort((a, b) => b.inspected_at.localeCompare(a.inspected_at));

  const apiaryLevelPanel = apiaryInstructionsPanel.filter((i) => !i.hive_local_id);
  const allPendingPanel = [
    ...hiveInstructionsPanel,
    ...apiaryLevelPanel.filter((a) => !hiveInstructionsPanel.find((h) => h.local_id === a.local_id)),
  ];
  const pendingCount = allPendingPanel.length;
  const days = sortedInspections.length > 0 ? daysSince(sortedInspections[0].inspected_at) : null;

  const strengthData = [...sortedInspections].reverse().map((i) => ({
    date: formatDate(i.inspected_at),
    forca: normalizeChecklistHealth(i.checklist).strength,
  }));

  const productionByType = productions.reduce<Record<string, number>>((acc, p) => {
    acc[p.product_type] = (acc[p.product_type] ?? 0) + p.quantity_g;
    return acc;
  }, {});
  const productionChartData = Object.entries(productionByType).map(([name, total]) => ({
    name: name === 'honey' ? 'Mel' : name === 'propolis' ? 'Própolis' : name === 'pollen' ? 'Pólen' : 'Cera',
    total,
  }));

  const PRODUCT_LABELS: Record<string, string> = {
    honey: '🍯 Mel', propolis: '🟫 Própolis', pollen: '🌼 Pólen', wax: '🕯️ Cera',
  };
  const FEED_LABELS: Record<string, string> = {
    sugar_syrup: '🍬 Xarope de açúcar', honey: '🍯 Mel', pollen_sub: '🌺 Substituto de pólen', other: '🌿 Outro',
  };

  async function handleTransfer() {
    setTransferError(null);
    if (!transferDestApiary) { setTransferError('Selecione o meliponário de destino'); return; }
    if (!hive.apiary_local_id) { setTransferError('Meliponário de origem não identificado'); return; }
    if (transferDestApiary === hive.apiary_local_id) { setTransferError('Destino deve ser diferente da origem'); return; }
    try {
      await createTransfer.mutateAsync({
        local_id: uuidv4(),
        hive_local_id: hive.local_id,
        apiary_origin_local_id: hive.apiary_local_id,
        apiary_destination_local_id: transferDestApiary,
        transferred_at: transferDate,
        transferred_by: transferBy,
        reason: transferReason || undefined,
      });
      setTransferOpen(false);
      setTransferDestApiary('');
      setTransferReason('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao transferir';
      setTransferError(msg);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-stone-400 hover:text-stone-100 transition-colors text-sm"
          >
            ← Voltar
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-stone-100">{hive.code}</h1>
              <HiveStatusBadge status={hive.status} />
              {hive.is_dirty && <Badge variant="warning">Não sincronizado</Badge>}
              {hive.apiary_origin_local_id && hive.apiary_origin_local_id !== hive.apiary_local_id && (() => {
                const origin = apiaries.find((a) => a.local_id === hive.apiary_origin_local_id);
                return origin ? (
                  <span className="text-xs bg-sky-900/40 text-sky-300 border border-sky-700/40 px-2 py-0.5 rounded-full">
                    Transferida de {origin.name}
                  </span>
                ) : null;
              })()}
            </div>
            {species && <p className="text-stone-500 text-sm">{species.name} • {species.scientific_name}</p>}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate(`/inspections/new?hive=${id}`)}>
            + Inspeção
          </Button>
          {canSeeProduction && (
            <Button variant="secondary" size="sm" onClick={() => navigate(`/harvests/new?hive=${id}`)}>
              🫙 Colheita
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => {
            const apiaryName = hive.apiary_local_id;
            exportHivePdf({
              hiveCode: hive.code,
              apiaryName,
              hiveData: [
                { label: 'Código', value: hive.code },
                { label: 'Status', value: hive.status },
                { label: 'Modelo', value: hive.box_type ?? '—' },
                { label: 'Instalação', value: hive.installation_date ? formatDate(hive.installation_date) : '—' },
                { label: 'Espécie', value: species?.name ?? '—' },
                { label: 'Notas', value: hive.notes ?? '—' },
              ],
              inspections: sortedInspections.map((i) => ({
                date: formatDate(i.inspected_at),
                inspector: i.inspector_name,
                health: String(normalizeChecklistHealth(i.checklist).strength),
                notes: i.notes ?? '',
              })),
              productions: productions.map((p) => ({
                date: formatDate(p.harvested_at),
                product: PRODUCT_LABELS[p.product_type] ?? p.product_type,
                quantity: `${p.quantity_g}g`,
                notes: p.notes ?? '',
              })),
            });
          }}>
            📄 PDF
          </Button>
          {canTransfer && (
            <Button variant="secondary" size="sm" onClick={() => setTransferOpen(true)}>
              🔀 Transferir
            </Button>
          )}
          {canManageHive && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditHive(true)}>Editar</Button>
              <Button variant="danger" size="sm" onClick={() => {
                if (confirm(`Excluir caixa "${hive.code}"?`)) {
                  deleteHive.mutate(hive.local_id, { onSuccess: () => navigate(-1) });
                }
              }}>Excluir</Button>
            </>
          )}
        </div>
      </div>

      {/* Instructions alert panel — tratador only */}
      {user.role === 'tratador' && (
        pendingCount > 0 ? (
          <div className="flex items-center justify-between gap-3 flex-wrap rounded-2xl px-4 py-4 bg-amber-900/30 border border-amber-600/50">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <p className="text-base font-semibold text-amber-300">
                {pendingCount} orientação{pendingCount !== 1 ? 'ões' : ''} pendente{pendingCount !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => document.getElementById('hive-instructions')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-sm font-bold transition-colors"
            >
              Ver orientações
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-emerald-900/20 border border-emerald-800/40">
            <p className="text-sm text-emerald-400">Nenhuma orientação pendente ✅</p>
          </div>
        )
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Instalação', value: formatDate(hive.installation_date) },
          { label: 'Modelo', value: hive.box_type || '—' },
          { label: 'Última Inspeção', value: days !== null ? `há ${days} dia${days !== 1 ? 's' : ''}` : 'Nunca' },
          { label: 'Total Inspeções', value: String(inspections.length) },
        ].map((item) => (
          <Card key={item.label} className="text-center">
            <p className="text-lg font-bold text-amber-400">{item.value}</p>
            <p className="text-xs text-stone-500">{item.label}</p>
          </Card>
        ))}
      </div>

      {/* Hive details: modules + wood + honey super */}
      {(hive.modules_count != null || hive.wood_type || hive.has_honey_super) && (
        <div className="flex flex-wrap gap-2">
          {hive.modules_count != null && (
            <span className="text-xs px-3 py-1.5 rounded-full bg-stone-800 border border-stone-700 text-stone-300">
              🏗️ {hive.modules_count} módulo{hive.modules_count !== 1 ? 's' : ''}
            </span>
          )}
          {hive.wood_type && (
            <span className="text-xs px-3 py-1.5 rounded-full bg-stone-800 border border-stone-700 text-stone-300">
              🪵 {hive.wood_type === 'Outra' && hive.wood_type_other ? hive.wood_type_other : hive.wood_type}
            </span>
          )}
          {hive.has_honey_super && (
            <span className="text-xs px-3 py-1.5 rounded-full bg-amber-900/40 border border-amber-700/50 text-amber-300">
              🍯 Melgueira{hive.honey_super_placed_at ? ` desde ${formatDate(hive.honey_super_placed_at)}` : ''}
            </span>
          )}
          {!hive.has_honey_super && hive.honey_super_removed_at && (
            <span className="text-xs px-3 py-1.5 rounded-full bg-stone-800 border border-stone-700 text-stone-400">
              🍯 Melgueira retirada em {formatDate(hive.honey_super_removed_at)}
            </span>
          )}
        </div>
      )}

      {/* QR Code */}
      <QRCodeDisplay hiveLocalId={hive.local_id} qrCodeText={hive.qr_code} />

      {/* Instruções pendentes — visível para tratador */}
      <div id="hive-instructions">
        {user.role === 'tratador' && (
          <HiveInstructions hiveLocalId={hive.local_id} apiaryLocalId={hive.apiary_local_id} />
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-stone-800">
        <div className="flex gap-0">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Inspeções */}
      {tab === 'Inspeções' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-stone-200">Histórico ({inspections.length})</h2>
            <Button size="sm" onClick={() => navigate(`/inspections/new?hive=${id}`)}>+ Nova Inspeção</Button>
          </div>

          {strengthData.length > 1 && (
            <Card>
              <CardHeader><CardTitle>Força da População</CardTitle></CardHeader>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={strengthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#292524" />
                    <XAxis dataKey="date" tick={{ fill: '#78716c', fontSize: 11 }} />
                    <YAxis domain={[1, 5]} tick={{ fill: '#78716c', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #292524', borderRadius: 8 }} />
                    <Line type="monotone" dataKey="forca" stroke="#f59e0b" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {sortedInspections.length === 0 ? (
            <p className="text-stone-500 text-center py-8">Nenhuma inspeção registrada</p>
          ) : (
            <div className="space-y-3">
              {sortedInspections.map((inspection, idx) => (
                <Card key={inspection.local_id} className={idx === 0 ? 'border-amber-600/40' : ''}>
                  <CardHeader>
                    <div>
                      <p className="font-semibold text-stone-100">{formatDateTime(inspection.inspected_at)}</p>
                      {inspection.inspector_name && (
                        <p className="text-xs text-stone-500">por {inspection.inspector_name}</p>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-amber-400 font-bold" title={`Força: ${normalizeChecklistHealth(inspection.checklist).strength}`}>
                        {'🐝'.repeat(normalizeChecklistHealth(inspection.checklist).strength)}
                      </span>
                      {canManageHive && (
                        <Button variant="danger" size="sm" onClick={() => {
                          if (confirm('Excluir esta inspeção?')) deleteInspection.mutate(inspection.local_id);
                        }}>×</Button>
                      )}
                    </div>
                  </CardHeader>
                  {idx === 0 && (
                    <InspectionChecklistForm value={inspection.checklist} onChange={() => {}} readOnly />
                  )}
                  {inspection.notes && (
                    <p className="text-sm text-stone-400 mt-2 italic">"{inspection.notes}"</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Produção (sócio / responsável only) */}
      {tab === 'Produção' && canSeeProduction && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-stone-200">Produções ({productions.length})</h2>
            <Button size="sm" onClick={() => setAddProduction(true)}>+ Registrar Colheita</Button>
          </div>

          {productionChartData.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Total por Produto (g)</CardTitle></CardHeader>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productionChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#292524" />
                    <XAxis dataKey="name" tick={{ fill: '#78716c', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#78716c', fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #292524', borderRadius: 8 }} />
                    <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {productions.length === 0 ? (
            <p className="text-stone-500 text-center py-8">Nenhuma produção registrada</p>
          ) : (
            <div className="space-y-2">
              {productions.map((p) => (
                <Card key={p.local_id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-stone-100">
                        {PRODUCT_LABELS[p.product_type] ?? p.product_type} • {p.quantity_g}g
                      </p>
                      <p className="text-xs text-stone-500">{formatDate(p.harvested_at)}</p>
                    </div>
                    {p.quality_grade && <Badge variant="amber">{p.quality_grade}</Badge>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Alimentação (sócio / responsável only) */}
      {tab === 'Alimentação' && canSeeProduction && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-stone-200">Alimentações ({feedings.length})</h2>
            <Button size="sm" onClick={() => setAddFeeding(true)}>+ Registrar</Button>
          </div>

          {feedings.length === 0 ? (
            <p className="text-stone-500 text-center py-8">Nenhuma alimentação registrada</p>
          ) : (
            <div className="space-y-2">
              {feedings.map((f) => (
                <Card key={f.local_id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-stone-100">
                        {FEED_LABELS[f.feed_type] ?? f.feed_type}
                        {f.quantity_ml ? ` • ${f.quantity_ml}ml` : ''}
                      </p>
                      <p className="text-xs text-stone-500">{formatDate(f.fed_at)}</p>
                    </div>
                    {f.notes && (
                      <p className="text-xs text-stone-500 italic ml-2 truncate max-w-xs">{f.notes}</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Divisões */}
      {tab === 'Divisões' && (
        <div className="space-y-3">

          {/* Genealogia */}
          {(originDivisions.length > 0 || divisions.some((d) => d.status === 'realizada' && d.hive_new_code)) && (
            <Card>
              <CardHeader><CardTitle>🌳 Genealogia</CardTitle></CardHeader>
              <div className="mt-3 space-y-3">

                {/* Caixa mãe */}
                {originDivisions[0] && (
                  <div>
                    <p className="text-xs text-stone-500 mb-1">Origem (caixa mãe)</p>
                    <button
                      onClick={() => navigate(`/hives/${originDivisions[0].hive_origin_local_id}`)}
                      className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      <span className="text-stone-500">←</span>
                      <span className="font-medium">{originDivisions[0].hive_origin_code ?? originDivisions[0].hive_origin_local_id}</span>
                      {originDivisions[0].apiary_origin_name && (
                        <span className="text-xs text-stone-500">({originDivisions[0].apiary_origin_name})</span>
                      )}
                      <span className="text-xs text-stone-600">
                        · divisão em {new Date(originDivisions[0].identified_at).toLocaleDateString('pt-BR')}
                      </span>
                    </button>
                  </div>
                )}

                {/* Caixas filhas */}
                {divisions.some((d) => d.status === 'realizada' && d.hive_new_code) && (
                  <div>
                    <p className="text-xs text-stone-500 mb-1">Filhas geradas</p>
                    <div className="space-y-1">
                      {divisions
                        .filter((d) => d.status === 'realizada' && d.hive_new_local_id)
                        .map((d) => (
                          <button
                            key={d.local_id}
                            onClick={() => navigate(`/hives/${d.hive_new_local_id}`)}
                            className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                          >
                            <span className="text-stone-500">→</span>
                            <span className="font-medium">{d.hive_new_code ?? d.hive_new_local_id}</span>
                            {d.apiary_destination_name && d.apiary_destination_name !== hive?.apiary_local_id && (
                              <span className="text-xs text-stone-500">({d.apiary_destination_name})</span>
                            )}
                            <span className="text-xs text-stone-600">
                              · {d.divided_at ? new Date(d.divided_at).toLocaleDateString('pt-BR') : new Date(d.identified_at).toLocaleDateString('pt-BR')}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-stone-200">Histórico de Divisões ({divisions.length})</h2>
            <Button size="sm" onClick={() => navigate('/divisions')}>Ver todas</Button>
          </div>
          {divisions.length === 0 ? (
            <p className="text-stone-500 text-center py-8">Nenhuma divisão registrada para esta caixa</p>
          ) : (
            <div className="space-y-2">
              {divisions.map((d) => (
                <button
                  key={d.local_id}
                  onClick={() => navigate(`/divisions/${d.local_id}`)}
                  className="w-full text-left bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 hover:bg-stone-800/60 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-stone-100">
                        {d.status === 'realizada' && d.hive_new_code
                          ? `→ ${d.hive_new_code}`
                          : d.status === 'pendente'
                          ? 'Divisão pendente'
                          : 'Cancelada'}
                      </p>
                      <p className="text-xs text-stone-500">
                        Identificada em {new Date(d.identified_at).toLocaleDateString('pt-BR')} por {d.identified_by}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                      d.status === 'realizada'
                        ? 'bg-emerald-900/40 text-emerald-400 border-emerald-700/40'
                        : d.status === 'cancelada'
                        ? 'bg-stone-800 text-stone-500 border-stone-700'
                        : 'bg-amber-900/40 text-amber-400 border-amber-700/40'
                    }`}>
                      {d.status === 'realizada' ? '✅ Realizada' : d.status === 'cancelada' ? 'Cancelada' : '⏳ Pendente'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Melgueiras */}
      {tab === 'Melgueiras' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-stone-200">Melgueiras instaladas ({hiveMelgueiras.length})</h2>
            {canTransfer && availableMelgueiras.length > 0 && (
              <Button size="sm" onClick={() => { setInstallMelgId(''); setInstallMelgOpen(true); }}>
                + Instalar melgueira
              </Button>
            )}
          </div>
          {hiveMelgueiras.length === 0 ? (
            <p className="text-stone-500 text-center py-8">Nenhuma melgueira instalada nesta caixa</p>
          ) : (
            <div className="space-y-2">
              {hiveMelgueiras.map((m) => (
                <div key={m.local_id} className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <button
                        onClick={() => navigate(`/stock/melgueiras/${m.local_id}`)}
                        className="font-medium text-amber-400 hover:text-amber-300 text-sm underline underline-offset-2"
                      >
                        {m.code}
                      </button>
                      {m.installed_at && (
                        <p className="text-xs text-stone-500 mt-0.5">
                          Instalada em {new Date(m.installed_at).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                    {canTransfer && (
                      <Button size="sm" variant="secondary" onClick={() =>
                        removeMelgueira.mutate({ localId: m.local_id, performed_by: user.name })
                      }>
                        Retirar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Transferências */}
      {tab === 'Transferências' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-stone-200">Histórico de Transferências ({transfers.length})</h2>
            {canTransfer && (
              <Button size="sm" onClick={() => setTransferOpen(true)}>🔀 Transferir</Button>
            )}
          </div>
          {transfers.length === 0 ? (
            <p className="text-stone-500 text-center py-8">Nenhuma transferência registrada para esta caixa</p>
          ) : (
            <div className="space-y-2">
              {transfers.map((t) => (
                <div
                  key={t.local_id}
                  className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-stone-100">
                        {t.apiary_origin_name ?? t.apiary_origin_local_id}
                        <span className="text-stone-400 mx-2">→</span>
                        {t.apiary_destination_name ?? t.apiary_destination_local_id}
                      </p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {new Date(t.transferred_at).toLocaleDateString('pt-BR')} · por {t.transferred_by}
                      </p>
                      {t.reason && (
                        <p className="text-xs text-stone-400 mt-1 italic">"{t.reason}"</p>
                      )}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-sky-900/40 text-sky-300 border border-sky-700/40 whitespace-nowrap">
                      Transferida
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <Modal open={editHive} onClose={() => setEditHive(false)} title="Editar Caixa" size="lg">
        <HiveForm initial={hive} onSuccess={() => setEditHive(false)} onCancel={() => setEditHive(false)} />
      </Modal>

      <Modal open={addProduction} onClose={() => setAddProduction(false)} title="Registrar Produção">
        <ProductionForm defaultHiveId={id} onSuccess={() => setAddProduction(false)} onCancel={() => setAddProduction(false)} />
      </Modal>

      <Modal open={addFeeding} onClose={() => setAddFeeding(false)} title="Registrar Alimentação">
        <FeedingForm defaultHiveId={id} onSuccess={() => setAddFeeding(false)} onCancel={() => setAddFeeding(false)} />
      </Modal>

      <Modal open={installMelgOpen} onClose={() => setInstallMelgOpen(false)} title="Instalar Melgueira">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Melgueira *</label>
            <select value={installMelgId} onChange={(e) => setInstallMelgId(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500">
              <option value="">Selecione...</option>
              {availableMelgueiras.map((m) => (
                <option key={m.local_id} value={m.local_id}>{m.code}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Data de instalação</label>
            <input type="date" value={installMelgDate} onChange={(e) => setInstallMelgDate(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Instalado por</label>
            <input type="text" value={installMelgBy} onChange={(e) => setInstallMelgBy(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                if (!installMelgId) return;
                await installMelgueira.mutateAsync({
                  localId: installMelgId,
                  hive_local_id: hive.local_id,
                  installed_at: installMelgDate,
                  performed_by: installMelgBy,
                });
                setInstallMelgOpen(false);
              }}
              disabled={!installMelgId || installMelgueira.isPending}
              className="flex-1"
            >
              {installMelgueira.isPending ? 'Instalando...' : 'Confirmar instalação'}
            </Button>
            <Button variant="ghost" onClick={() => setInstallMelgOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      <Modal open={transferOpen} onClose={() => { setTransferOpen(false); setTransferError(null); }} title="Transferir Caixa">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-stone-400 mb-3">
              Caixa <span className="text-stone-200 font-medium">{hive.code}</span> será movida para outro meliponário.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Meliponário de destino *</label>
            <select
              value={transferDestApiary}
              onChange={(e) => setTransferDestApiary(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="">Selecione...</option>
              {apiaries
                .filter((a) => a.local_id !== hive.apiary_local_id)
                .map((a) => (
                  <option key={a.local_id} value={a.local_id}>{a.name}</option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Data da transferência *</label>
            <input
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Transferido por *</label>
            <input
              type="text"
              value={transferBy}
              onChange={(e) => setTransferBy(e.target.value)}
              placeholder="Nome do responsável"
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Motivo (opcional)</label>
            <textarea
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              rows={2}
              placeholder="Ex: Florada nova, superlotação..."
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {transferError && (
            <p className="text-sm text-red-400">{transferError}</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleTransfer}
              disabled={createTransfer.isPending}
              className="flex-1"
            >
              {createTransfer.isPending ? 'Transferindo...' : 'Confirmar transferência'}
            </Button>
            <Button variant="ghost" onClick={() => { setTransferOpen(false); setTransferError(null); }}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
