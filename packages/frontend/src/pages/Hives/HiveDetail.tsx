import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useHive, useDeleteHive } from '@/hooks/useHives';
import { useInspections, useDeleteInspection } from '@/hooks/useInspections';
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

export function HiveDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;
  const canManageHive = user.role === 'socio' || user.role === 'responsavel';
  const canSeeProduction = user.role === 'socio' || user.role === 'responsavel';

  type Tab = 'Inspeções' | 'Produção' | 'Alimentação';
  const TABS: Tab[] = canSeeProduction ? ['Inspeções', 'Produção', 'Alimentação'] : ['Inspeções'];

  const [tab, setTab] = useState<Tab>('Inspeções');
  const [editHive, setEditHive] = useState(false);
  const [addProduction, setAddProduction] = useState(false);
  const [addFeeding, setAddFeeding] = useState(false);

  const { data: hive, isLoading } = useHive(id!);
  const { data: inspections = [] } = useInspections(id);
  const { data: productions = [] } = useProductions(id);
  const { data: feedings = [] } = useFeedings(id);
  const { data: speciesList = [] } = useSpecies();
  const deleteHive = useDeleteHive();
  const deleteInspection = useDeleteInspection();

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!hive) return <div className="text-stone-400 text-center py-16">Caixa não encontrada</div>;

  const species = speciesList.find((s) => s.local_id === hive.species_local_id);
  const sortedInspections = [...inspections].sort((a, b) => b.inspected_at.localeCompare(a.inspected_at));
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

      {/* Hive details: modules + wood */}
      {(hive.modules_count != null || hive.wood_type) && (
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
        </div>
      )}

      {/* QR Code */}
      <QRCodeDisplay hiveLocalId={hive.local_id} qrCodeText={hive.qr_code} />

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
    </div>
  );
}
