import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useStockSummary, useStockAlerts } from '@/hooks/useStock';
import { useApiaries } from '@/hooks/useApiaries';
import { useEquipmentItems, useEquipmentMovements, useAdjustEquipment } from '@/hooks/useEquipment';
import { useMelgueiras, useCreateMelgueira } from '@/hooks/useMelgueiras';
import { useAuthStore } from '@/store/authStore';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/utils/cn';
import type { StockApiarySummary, EquipmentItemType, MelgueiraStatus, MelgueiraCreate } from '@bee-forest/shared';

function fmtVol(ml: number) {
  if (!ml) return '0 ml';
  return ml >= 1000 ? `${(ml / 1000).toFixed(2)} L` : `${ml.toFixed(0)} ml`;
}
function fmtKg(kg: number) {
  if (!kg) return '0 kg';
  return kg >= 1 ? `${kg.toFixed(3)} kg` : `${(kg * 1000).toFixed(0)} g`;
}

function ApiaryStockCard({ s, alertsCount }: { s: StockApiarySummary; alertsCount: number }) {
  const navigate = useNavigate();
  const hasAlert = alertsCount > 0;
  return (
    <Card
      className={cn('cursor-pointer hover:border-amber-600/50 transition-colors', hasAlert && 'border-red-700/50')}
      onClick={() => navigate(`/stock/${s.apiary_local_id}`)}
    >
      <CardHeader>
        <CardTitle>{s.apiary_name ?? 'Meliponário'}</CardTitle>
        {hasAlert && <Badge variant="danger">{alertsCount} alerta{alertsCount !== 1 ? 's' : ''}</Badge>}
      </CardHeader>
      <div className="space-y-3">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Mel</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-stone-800 rounded-lg p-3">
            <p className="text-xs text-stone-500 mb-1">Mel Vivo</p>
            <p className="text-sm font-semibold text-amber-300">{fmtVol(s.honey_vivo_volume_ml)}</p>
            {s.honey_vivo_weight_kg > 0 && <p className="text-xs text-stone-500">{fmtKg(s.honey_vivo_weight_kg)}</p>}
          </div>
          <div className="bg-stone-800 rounded-lg p-3">
            <p className="text-xs text-stone-500 mb-1">Mel Maturado</p>
            <p className="text-sm font-semibold text-amber-400">{fmtVol(s.honey_maturado_volume_ml)}</p>
            {s.honey_maturado_weight_kg > 0 && <p className="text-xs text-stone-500">{fmtKg(s.honey_maturado_weight_kg)}</p>}
          </div>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-stone-800">
          <p className="text-xs text-stone-500">Insumos</p>
          <div className="flex gap-1.5">
            {s.inputs_ok > 0 && <Badge variant="success">{s.inputs_ok} ok</Badge>}
            {s.inputs_low > 0 && <Badge variant="warning">{s.inputs_low} baixo</Badge>}
            {s.inputs_out > 0 && <Badge variant="danger">{s.inputs_out} zerado</Badge>}
            {s.inputs_ok + s.inputs_low + s.inputs_out === 0 && <span className="text-xs text-stone-600">—</span>}
          </div>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-stone-800">
          <p className="text-xs text-stone-500">Embalagens</p>
          <span className="text-sm text-stone-300">{s.packaging_total > 0 ? `${s.packaging_total.toFixed(0)} un.` : '—'}</span>
        </div>
      </div>
    </Card>
  );
}

const MELGUEIRA_STATUS_LABEL: Record<MelgueiraStatus, string> = {
  disponivel: '✅ Disponível',
  em_uso:     '📦 Em Uso',
  manutencao: '🔧 Manutenção',
};
const MELGUEIRA_STATUS_STYLE: Record<MelgueiraStatus, string> = {
  disponivel: 'bg-emerald-900/40 text-emerald-400 border-emerald-700/40',
  em_uso:     'bg-sky-900/40 text-sky-300 border-sky-700/40',
  manutencao: 'bg-amber-900/40 text-amber-400 border-amber-700/40',
};

const EQUIPMENT_LABELS: Record<EquipmentItemType, string> = {
  modulo_ninho:      '🏗️ Módulo Ninho',
  modulo_sobreninho: '🏗️ Módulo Sobreninho',
  caixa_vazia:       '📦 Caixa Vazia',
};

const MOVEMENT_LABELS: Record<string, string> = {
  instalacao: '📦 Instalação',
  retirada:   '↩ Retirada',
  entrada:    '⬆ Entrada',
  saida:      '⬇ Saída',
  desmontagem:'🪚 Desmontagem',
};

type MainTab = 'equipamentos' | 'mel';
type EquipTab = 'melgueiras' | 'modulos' | 'historico';

export function StockPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user)!;
  const [filterApiary, setFilterApiary] = useState('');

  const initMain = searchParams.get('tab') === 'mel' ? 'mel' : 'equipamentos';
  const [mainTab, setMainTab] = useState<MainTab>(initMain as MainTab);
  const [equipTab, setEquipTab] = useState<EquipTab>(
    (searchParams.get('tab') === 'melgueiras' ? 'melgueiras' : 'melgueiras') as EquipTab
  );

  const { data: summaries = [], isLoading: loadingSummary } = useStockSummary(filterApiary || undefined);
  const { data: alerts = [] } = useStockAlerts();
  const { data: apiaries = [] } = useApiaries();
  const { data: equipItems = [], isLoading: loadingEquip, isError: errorEquip } = useEquipmentItems();
  const { data: equipMovements = [] } = useEquipmentMovements({ limit: 100 });
  const { data: melgueiras = [] } = useMelgueiras();
  const adjustEquipment = useAdjustEquipment();
  const createMelgueira = useCreateMelgueira();

  const [adjustItem, setAdjustItem] = useState<EquipmentItemType | null>(null);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustType, setAdjustType] = useState<'entrada' | 'saida'>('entrada');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustBy, setAdjustBy] = useState(user.name);
  const [adjustErr, setAdjustErr] = useState<string | null>(null);

  const [newMelgOpen, setNewMelgOpen] = useState(false);
  const [melgCode, setMelgCode]       = useState('');
  const [melgApiary, setMelgApiary]   = useState('');
  const [melgNotes, setMelgNotes]     = useState('');
  const [melgErr, setMelgErr]         = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<MelgueiraStatus | ''>('');

  const canManage = ['master_admin', 'socio', 'responsavel'].includes(user.role);
  const isTratador = user.role === 'tratador';

  const activeApiaries = apiaries.filter((a) => !a.deleted_at);
  const totalAlerts = alerts.length;
  const alertsByApiary = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.apiary_local_id] = (acc[a.apiary_local_id] ?? 0) + 1;
    return acc;
  }, {});

  function switchMain(t: MainTab) {
    setMainTab(t);
    setSearchParams(t === 'mel' ? { tab: 'mel' } : {}, { replace: true });
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    setAdjustErr(null);
    const delta = parseInt(adjustDelta, 10);
    if (!delta || delta <= 0) { setAdjustErr('Quantidade inválida'); return; }
    if (!adjustItem) return;
    try {
      await adjustEquipment.mutateAsync({
        type: adjustItem,
        delta: adjustType === 'entrada' ? delta : -delta,
        movement_type: adjustType,
        reason: adjustReason || null,
        performed_by: adjustBy || null,
      });
      setAdjustItem(null);
      setAdjustDelta('');
      setAdjustReason('');
    } catch (err) {
      setAdjustErr((err as Error).message ?? 'Erro ao ajustar');
    }
  }

  async function handleCreateMelgueira(e: React.FormEvent) {
    e.preventDefault();
    setMelgErr(null);
    if (!melgCode.trim()) { setMelgErr('Código obrigatório'); return; }
    const data: MelgueiraCreate = {
      local_id: uuidv4(),
      code: melgCode.trim(),
      apiary_local_id: melgApiary || null,
      notes: melgNotes || null,
    };
    try {
      await createMelgueira.mutateAsync(data);
      setNewMelgOpen(false);
      setMelgCode(''); setMelgApiary(''); setMelgNotes('');
    } catch (err) {
      setMelgErr((err as Error).message ?? 'Erro ao criar');
    }
  }

  const filteredMelgueiras = filterStatus
    ? melgueiras.filter((m) => m.status === filterStatus)
    : melgueiras;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Estoque</h1>
          <p className="text-stone-500 text-sm">Equipamentos, melgueiras, mel e insumos</p>
        </div>
        {!isTratador && mainTab === 'mel' && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate('/stock/alerts')}>
              {totalAlerts > 0 ? `⚠️ ${totalAlerts} alerta${totalAlerts !== 1 ? 's' : ''}` : '⚠️ Alertas'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/stock/movements')}>
              📋 Movimentações
            </Button>
          </div>
        )}
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 bg-stone-800 p-1 rounded-xl w-fit">
        {([
          { key: 'equipamentos', label: '🏗️ Equipamentos' },
          { key: 'mel', label: '🍯 Mel & Insumos' },
        ] as { key: MainTab; label: string }[]).map((t) => (
          <button key={t.key} onClick={() => switchMain(t.key)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              mainTab === t.key ? 'bg-amber-500 text-stone-900' : 'text-stone-400 hover:text-stone-200'
            )}
          >{t.label}</button>
        ))}
      </div>

      {/* ── Equipamentos section ─────────────────────────────────────────────── */}
      {mainTab === 'equipamentos' && (
        <div className="space-y-5">
          {/* Sub-tabs */}
          <div className="border-b border-stone-800">
            <div className="flex gap-0">
              {([
                { key: 'melgueiras', label: 'Melgueiras' },
                { key: 'modulos',    label: 'Módulos e Caixas' },
                { key: 'historico',  label: 'Histórico' },
              ] as { key: EquipTab; label: string }[]).map((t) => (
                <button key={t.key} onClick={() => setEquipTab(t.key)}
                  className={cn(
                    'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                    equipTab === t.key
                      ? 'border-amber-500 text-amber-400'
                      : 'border-transparent text-stone-400 hover:text-stone-200'
                  )}
                >{t.label}</button>
              ))}
            </div>
          </div>

          {/* Sub-tab: Melgueiras */}
          {equipTab === 'melgueiras' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                  {(['', 'disponivel', 'em_uso', 'manutencao'] as (MelgueiraStatus | '')[]).map((s) => (
                    <button key={s ?? 'all'} onClick={() => setFilterStatus(s)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                        filterStatus === s
                          ? 'bg-amber-500 text-stone-900'
                          : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                      )}
                    >
                      {s === '' ? 'Todas' : MELGUEIRA_STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
                {canManage && (
                  <Button size="sm" onClick={() => setNewMelgOpen(true)}>+ Nova melgueira</Button>
                )}
              </div>

              {filteredMelgueiras.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-3xl mb-2">🍯</p>
                  <p className="text-stone-500">Nenhuma melgueira cadastrada</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMelgueiras.map((m) => (
                    <button
                      key={m.local_id}
                      onClick={() => navigate(`/stock/melgueiras/${m.local_id}`)}
                      className="w-full text-left bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 hover:bg-stone-800/60 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-stone-100">{m.code}</p>
                          <p className="text-xs text-stone-500 mt-0.5">
                            {m.apiary_name ?? '—'}
                            {m.status === 'em_uso' && m.hive_code ? ` · Caixa ${m.hive_code}` : ''}
                          </p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${MELGUEIRA_STATUS_STYLE[m.status]}`}>
                          {MELGUEIRA_STATUS_LABEL[m.status]}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-tab: Módulos e Caixas */}
          {equipTab === 'modulos' && (
            <div className="space-y-3">
              {equipItems.map((item) => (
                <Card key={item.local_id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-stone-100">{EQUIPMENT_LABELS[item.type]}</p>
                      <p className="text-2xl font-bold text-amber-400 mt-1">{item.quantity}</p>
                      <p className="text-xs text-stone-500">unidade{item.quantity !== 1 ? 's' : ''} disponível{item.quantity !== 1 ? 'is' : ''}</p>
                    </div>
                    {canManage && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => {
                          setAdjustItem(item.type); setAdjustType('entrada');
                          setAdjustDelta(''); setAdjustReason(''); setAdjustErr(null);
                        }}>⬆ Entrada</Button>
                        <Button size="sm" variant="secondary" onClick={() => {
                          setAdjustItem(item.type); setAdjustType('saida');
                          setAdjustDelta(''); setAdjustReason(''); setAdjustErr(null);
                        }}>⬇ Saída</Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}

              {loadingEquip && (
                <p className="text-stone-500 text-center py-8">Carregando...</p>
              )}
              {errorEquip && (
                <p className="text-red-400 text-center py-8 text-sm">Erro ao carregar equipamentos. Tente recarregar a página.</p>
              )}
            </div>
          )}

          {/* Sub-tab: Histórico */}
          {equipTab === 'historico' && (
            <div className="space-y-2">
              {equipMovements.length === 0 ? (
                <p className="text-stone-500 text-center py-8">Nenhuma movimentação registrada</p>
              ) : (
                <Card>
                  <div className="divide-y divide-stone-800">
                    {equipMovements.map((m) => (
                      <div key={m.id} className="py-3 flex items-start justify-between text-sm">
                        <div>
                          <p className="text-stone-200">
                            {MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}
                            {' · '}
                            <span className="text-stone-400">
                              {m.item_type === 'melgueira'
                                ? 'Melgueira'
                                : EQUIPMENT_LABELS[m.item_type as EquipmentItemType] ?? m.item_type}
                            </span>
                          </p>
                          <p className="text-xs text-stone-500 mt-0.5">
                            {m.quantity > 1 ? `${m.quantity}x ` : ''}
                            {m.hive_code ? `Caixa ${m.hive_code} · ` : ''}
                            {m.performed_by ?? ''}
                          </p>
                          {m.reason && <p className="text-xs text-stone-400 italic">"{m.reason}"</p>}
                        </div>
                        <p className="text-xs text-stone-500 shrink-0">
                          {new Date(m.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Mel & Insumos section ────────────────────────────────────────────── */}
      {mainTab === 'mel' && (
        <div className="space-y-5">
          {totalAlerts > 0 && (
            <div className="flex items-center gap-3 bg-red-900/20 border border-red-700/40 rounded-xl p-4">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <p className="text-red-300 font-medium text-sm">
                  {totalAlerts} item{totalAlerts !== 1 ? 's' : ''} com estoque abaixo do mínimo
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => navigate('/stock/alerts')}>Ver →</Button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Mel Vivo Total',     value: fmtVol(summaries.reduce((a, s) => a + s.honey_vivo_volume_ml, 0)), icon: '🍯' },
              { label: 'Mel Maturado Total', value: fmtVol(summaries.reduce((a, s) => a + s.honey_maturado_volume_ml, 0)), icon: '🫙' },
              { label: 'Meliponários',       value: String(activeApiaries.length), icon: '🏡' },
              { label: 'Alertas Ativos',     value: String(totalAlerts), icon: '🔔' },
            ].map((stat) => (
              <div key={stat.label} className="bg-stone-800 rounded-xl p-4">
                <p className="text-2xl mb-1">{stat.icon}</p>
                <p className="text-lg font-bold text-stone-100">{stat.value}</p>
                <p className="text-xs text-stone-500">{stat.label}</p>
              </div>
            ))}
          </div>

          {activeApiaries.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setFilterApiary('')}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                  !filterApiary ? 'bg-amber-500 text-stone-900' : 'bg-stone-800 text-stone-400 hover:text-stone-200')}>
                Todos
              </button>
              {activeApiaries.map((a) => (
                <button key={a.local_id} onClick={() => setFilterApiary(a.local_id)}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    filterApiary === a.local_id ? 'bg-amber-500 text-stone-900' : 'bg-stone-800 text-stone-400 hover:text-stone-200')}>
                  {a.name}
                </button>
              ))}
            </div>
          )}

          {loadingSummary ? (
            <p className="text-stone-500 text-center py-12">Carregando estoque...</p>
          ) : summaries.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📦</p>
              <p className="text-stone-400">Nenhum item de estoque cadastrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {summaries.map((s) => (
                <ApiaryStockCard key={s.apiary_local_id} s={s} alertsCount={alertsByApiary[s.apiary_local_id] ?? 0} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Adjust equipment modal */}
      <Modal
        open={!!adjustItem}
        onClose={() => setAdjustItem(null)}
        title={`${adjustType === 'entrada' ? 'Entrada' : 'Saída'} — ${adjustItem ? EQUIPMENT_LABELS[adjustItem] : ''}`}
      >
        <form onSubmit={handleAdjust} className="space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdjustType('entrada')}
              className={cn('flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                adjustType === 'entrada'
                  ? 'bg-emerald-900/40 text-emerald-400 border-emerald-700/50'
                  : 'bg-stone-800 text-stone-400 border-stone-700')}>
              ⬆ Entrada
            </button>
            <button type="button" onClick={() => setAdjustType('saida')}
              className={cn('flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                adjustType === 'saida'
                  ? 'bg-red-900/40 text-red-400 border-red-700/50'
                  : 'bg-stone-800 text-stone-400 border-stone-700')}>
              ⬇ Saída
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Quantidade *</label>
            <input type="number" min="1" value={adjustDelta} onChange={(e) => setAdjustDelta(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Motivo</label>
            <input type="text" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="Ex: compra, perda, uso em divisão..."
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Registrado por</label>
            <input type="text" value={adjustBy} onChange={(e) => setAdjustBy(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          {adjustErr && <p className="text-sm text-red-400">{adjustErr}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={adjustEquipment.isPending} className="flex-1">
              {adjustEquipment.isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdjustItem(null)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* New melgueira modal */}
      <Modal open={newMelgOpen} onClose={() => setNewMelgOpen(false)} title="Nova Melgueira">
        <form onSubmit={handleCreateMelgueira} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Código *</label>
            <input type="text" value={melgCode} onChange={(e) => setMelgCode(e.target.value)}
              placeholder="Ex: MLG-001-ALD"
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500" />
            <p className="text-xs text-stone-500 mt-1">Padrão sugerido: MLG-001-ALD (sigla do meliponário)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Meliponário</label>
            <select value={melgApiary} onChange={(e) => setMelgApiary(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500">
              <option value="">Selecione (opcional)...</option>
              {apiaries.filter((a) => !a.deleted_at).map((a) => (
                <option key={a.local_id} value={a.local_id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Observações</label>
            <textarea value={melgNotes} onChange={(e) => setMelgNotes(e.target.value)} rows={2}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500 resize-none" />
          </div>
          {melgErr && <p className="text-sm text-red-400">{melgErr}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={createMelgueira.isPending} className="flex-1">
              {createMelgueira.isPending ? 'Criando...' : 'Criar melgueira'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setNewMelgOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
