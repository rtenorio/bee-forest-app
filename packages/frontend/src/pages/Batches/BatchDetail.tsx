import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  useBatchDetail,
  useUpdateBatchStatus,
  useRejectBatch,
  useStartDehumidification,
  useAddDehumMeasurement,
  useCompleteDehumidification,
  useStartMaturation,
  useAddMaturationObservation,
  useCompleteMaturation,
  useBottleBatch,
  useSellBatch,
} from '@/hooks/useBatches';
import { useAuthStore } from '@/store/authStore';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import type { BatchStatus, DehumidificationSession, MaturationSession } from '@bee-forest/shared';

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BatchStatus, { label: string; icon: string; variant: 'default' | 'warning' | 'success' | 'danger' | 'amber' }> = {
  collected:           { label: 'Coletado',         icon: '🫙', variant: 'default' },
  in_natura_ready:     { label: 'In natura pronto', icon: '✅', variant: 'success' },
  in_dehumidification: { label: 'Desumidificando',  icon: '💨', variant: 'amber' },
  dehumidified:        { label: 'Desumidificado',   icon: '✅', variant: 'success' },
  in_maturation:       { label: 'Maturando',        icon: '🔄', variant: 'warning' },
  matured:             { label: 'Maturado',          icon: '✨', variant: 'success' },
  bottled:             { label: 'Envasado',          icon: '📦', variant: 'success' },
  sold:                { label: 'Vendido',           icon: '💰', variant: 'default' },
  rejected:            { label: 'Reprovado',         icon: '🚫', variant: 'danger' },
};

// ── Timeline step ─────────────────────────────────────────────────────────────

function TimelineStep({ icon, label, done, active }: { icon: string; label: string; done: boolean; active: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${active ? 'text-amber-400 font-semibold' : done ? 'text-emerald-400' : 'text-stone-600'}`}>
      <span className="text-base">{done ? '✅' : active ? icon : '⭕'}</span>
      {label}
    </div>
  );
}

// ── Dehumidification section ──────────────────────────────────────────────────

function DehumidificationSection({
  sessions, batchLocalId, canOperate,
  onStart, onMeasure, onComplete,
}: {
  sessions: DehumidificationSession[];
  batchLocalId: string;
  canOperate: boolean;
  onStart: () => void;
  onMeasure: (sessionId: string) => void;
  onComplete: (sessionId: string) => void;
}) {
  if (sessions.length === 0) {
    return canOperate ? (
      <div className="text-center py-4">
        <p className="text-stone-500 text-sm mb-3">Nenhuma sessão de desumidificação</p>
        <Button size="sm" variant="secondary" onClick={onStart}>Iniciar Desumidificação</Button>
      </div>
    ) : (
      <p className="text-stone-500 text-sm">Nenhuma sessão registrada</p>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((s) => (
        <div key={s.id} className="bg-stone-800/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-stone-200">
                {new Date(s.start_datetime).toLocaleDateString('pt-BR')}
                {s.end_datetime && ` → ${new Date(s.end_datetime).toLocaleDateString('pt-BR')}`}
              </p>
              <p className="text-xs text-stone-500">{s.method.replace(/_/g, ' ')} {s.room_name ? `· ${s.room_name}` : ''}</p>
            </div>
            <Badge variant={s.result_status === 'completed' ? 'success' : s.result_status === 'in_progress' ? 'amber' : 'danger'}>
              {s.result_status === 'in_progress' ? '🔄 Em andamento' : s.result_status === 'completed' ? '✅ Concluído' : '⚠️ ' + s.result_status}
            </Badge>
          </div>

          {/* Medições */}
          {s.measurements.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-stone-500 uppercase tracking-wider">Medições</p>
              <div className="grid grid-cols-3 gap-1 text-xs text-stone-400">
                <span>Data</span><span>Umidade</span><span>Brix</span>
              </div>
              {s.measurements.map((m) => (
                <div key={m.id} className="grid grid-cols-3 gap-1 text-xs">
                  <span className="text-stone-500">{new Date(m.measured_at).toLocaleDateString('pt-BR')}</span>
                  <span className={m.moisture > 25 ? 'text-amber-400' : 'text-emerald-400'}>{m.moisture}%</span>
                  <span className="text-stone-300">{m.brix ?? '—'}°Bx</span>
                </div>
              ))}
              {s.measurements.length >= 2 && (
                <div className="pt-2">
                  <p className="text-xs text-stone-500 mb-2">Evolução</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart
                      data={s.measurements.map((m) => ({
                        data: new Date(m.measured_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                        Umidade: Number(m.moisture),
                        ...(m.brix != null ? { Brix: Number(m.brix) } : {}),
                      }))}
                      margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#292524" />
                      <XAxis dataKey="data" tick={{ fill: '#78716c', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#78716c', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: '#1c1917', border: '1px solid #292524', color: '#e7e5e4', borderRadius: 6, fontSize: 12 }} />
                      <Line type="monotone" dataKey="Umidade" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="Brix" stroke="#10b981" strokeWidth={1.5} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {s.final_moisture != null && (
            <div className="flex gap-4 text-xs pt-1 border-t border-stone-700">
              <span className="text-stone-400">Umidade final: <span className="text-emerald-400 font-medium">{s.final_moisture}%</span></span>
              {s.final_brix != null && <span className="text-stone-400">Brix final: <span className="text-emerald-400 font-medium">{s.final_brix}°Bx</span></span>}
            </div>
          )}

          {canOperate && s.result_status === 'in_progress' && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="secondary" onClick={() => onMeasure(s.local_id)}>+ Medição</Button>
              <Button size="sm" onClick={() => onComplete(s.local_id)}>Concluir</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Maturation section ────────────────────────────────────────────────────────

function MaturationSection({
  sessions, canOperate,
  onStart, onObserve, onComplete,
}: {
  sessions: MaturationSession[];
  canOperate: boolean;
  onStart: () => void;
  onObserve: (sessionId: string) => void;
  onComplete: (sessionId: string) => void;
}) {
  if (sessions.length === 0) {
    return canOperate ? (
      <div className="text-center py-4">
        <p className="text-stone-500 text-sm mb-3">Nenhuma sessão de maturação</p>
        <Button size="sm" variant="secondary" onClick={onStart}>Iniciar Maturação</Button>
      </div>
    ) : (
      <p className="text-stone-500 text-sm">Nenhuma sessão registrada</p>
    );
  }

  const DECISION_LABEL: Record<string, string> = {
    approved: '✅ Aprovado',
    approved_with_observation: '⚠️ Aprovado c/ observação',
    rejected: '🚫 Reprovado',
    redirected_for_new_processing: '🔄 Reencaminhado',
  };

  return (
    <div className="space-y-4">
      {sessions.map((s) => (
        <div key={s.id} className="bg-stone-800/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-stone-200">
                {new Date(s.start_datetime).toLocaleDateString('pt-BR')}
                {s.end_datetime && ` → ${new Date(s.end_datetime).toLocaleDateString('pt-BR')}`}
              </p>
              <p className="text-xs text-stone-500">
                {s.container_type ?? 'Recipiente'} · {s.closure_type.replace(/_/g, ' ')}
                {s.has_airlock ? ' · com airlock' : ''}
              </p>
            </div>
            <Badge variant={s.maturation_status === 'completed' ? 'success' : s.maturation_status === 'in_progress' ? 'amber' : 'danger'}>
              {s.maturation_status === 'in_progress' ? '🔄 Em andamento' : s.maturation_status === 'completed' ? '✅ Concluído' : '⚠️ ' + s.maturation_status}
            </Badge>
          </div>

          {/* Observações */}
          {s.observations.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-stone-500 uppercase tracking-wider">{s.observations.length} observação(ões)</p>
              {s.observations.slice(-3).map((o) => (
                <div key={o.id} className="flex items-start gap-2 text-xs text-stone-400">
                  <span className="text-stone-600 shrink-0">{new Date(o.observed_at).toLocaleDateString('pt-BR')}</span>
                  <span>
                    {[
                      o.bubbles_present && '🫧 Bolhas',
                      o.foam_present && '🔵 Espuma',
                      o.pressure_signs && '⚡ Pressão',
                      o.visible_fermentation_signs && '🚨 Fermentação',
                      o.aroma_change && '👃 Aroma',
                      o.phase_separation && '🫧 Separação',
                    ].filter(Boolean).join(' · ') || (o.observation_text ?? '—')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {s.final_decision && (
            <p className="text-xs pt-1 border-t border-stone-700">
              Decisão: <span className="font-medium text-stone-200">{DECISION_LABEL[s.final_decision] ?? s.final_decision}</span>
            </p>
          )}

          {canOperate && s.maturation_status === 'in_progress' && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="secondary" onClick={() => onObserve(s.local_id)}>+ Observação</Button>
              <Button size="sm" onClick={() => onComplete(s.local_id)}>Concluir</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type ActiveModal =
  | 'dehumidStart' | 'dehumidMeasure' | 'dehumidComplete'
  | 'matStart' | 'matObserve' | 'matComplete'
  | 'bottle' | 'sell' | 'reject' | null;

export function BatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;

  const canOperate = user.role !== 'tratador';
  const canManage = user.role === 'socio' || user.role === 'responsavel' || user.role === 'master_admin';

  const { data: batch, isLoading, error: fetchError } = useBatchDetail(id!);

  const updateStatus = useUpdateBatchStatus();
  const rejectBatch = useRejectBatch();
  const startDehumid = useStartDehumidification();
  const addMeasure = useAddDehumMeasurement();
  const completeDehumid = useCompleteDehumidification();
  const startMat = useStartMaturation();
  const addObs = useAddMaturationObservation();
  const completeMat = useCompleteMaturation();
  const bottleMut = useBottleBatch();
  const sellMut = useSellBatch();

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [modalForm, setModalForm] = useState<Record<string, string>>({});
  const [modalError, setModalError] = useState<string | null>(null);

  const closeModal = () => { setActiveModal(null); setModalForm({}); setModalError(null); };
  const setField = (k: string, v: string) => setModalForm((f) => ({ ...f, [k]: v }));

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (fetchError || !batch) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-stone-400">{fetchError ? 'Erro ao carregar lote (conexão necessária).' : 'Lote não encontrado.'}</p>
        <Button variant="secondary" onClick={() => navigate('/batches')}>← Voltar</Button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[batch.current_status];
  const status = batch.current_status;
  const activeDehum = batch.dehumidification_sessions.find((s) => s.result_status === 'in_progress');
  const activeMat = batch.maturation_sessions.find((s) => s.maturation_status === 'in_progress');

  // Alert computations
  const hasCriticalMoisture = batch.initial_moisture != null && batch.initial_moisture > 30 && !['sold', 'rejected'].includes(status);
  const hasFermentationSigns = batch.maturation_sessions.some((ms) =>
    ms.observations.some((o) => o.visible_fermentation_signs)
  );
  const daysSinceCreated = (Date.now() - new Date(batch.created_at).getTime()) / 86_400_000;
  const isStale = status === 'collected' && daysSinceCreated > 7;
  const lastCompletedDehum = batch.dehumidification_sessions.findLast((s) => s.result_status === 'completed');
  const highFinalMoisture = lastCompletedDehum?.final_moisture != null && lastCompletedDehum.final_moisture > 25;

  // ── Modal submit handlers ─────────────────────────────────────────────────

  async function submitDehumStart() {
    setModalError(null);
    try {
      await startDehumid.mutateAsync({
        local_id: id!,
        method: modalForm.method ?? 'passive_controlled_room',
        equipment: modalForm.equipment || undefined,
        room_name: modalForm.room_name || undefined,
        ambient_temperature_start: modalForm.amb_temp ? parseFloat(modalForm.amb_temp) : undefined,
        ambient_humidity_start: modalForm.amb_hum ? parseFloat(modalForm.amb_hum) : undefined,
        initial_moisture: modalForm.initial_moisture ? parseFloat(modalForm.initial_moisture) : undefined,
        initial_brix: modalForm.initial_brix ? parseFloat(modalForm.initial_brix) : undefined,
      });
      closeModal();
    } catch (e) { setModalError(e instanceof Error ? e.message : 'Erro'); }
  }

  async function submitDehumMeasure() {
    setModalError(null);
    if (!modalForm.moisture) { setModalError('Umidade obrigatória'); return; }
    try {
      await addMeasure.mutateAsync({
        local_id: id!,
        sessionId: selectedSessionId,
        moisture: parseFloat(modalForm.moisture),
        brix: modalForm.brix ? parseFloat(modalForm.brix) : undefined,
        ambient_temperature: modalForm.amb_temp ? parseFloat(modalForm.amb_temp) : undefined,
        ambient_humidity: modalForm.amb_hum ? parseFloat(modalForm.amb_hum) : undefined,
        notes: modalForm.notes || undefined,
      });
      closeModal();
    } catch (e) { setModalError(e instanceof Error ? e.message : 'Erro'); }
  }

  async function submitDehumComplete() {
    setModalError(null);
    if (!modalForm.final_moisture) { setModalError('Umidade final obrigatória'); return; }
    try {
      await completeDehumid.mutateAsync({
        local_id: id!,
        sessionId: selectedSessionId,
        final_moisture: parseFloat(modalForm.final_moisture),
        final_brix: modalForm.final_brix ? parseFloat(modalForm.final_brix) : undefined,
        result_status: modalForm.result_status ?? 'completed',
        notes: modalForm.notes || undefined,
      });
      closeModal();
    } catch (e) { setModalError(e instanceof Error ? e.message : 'Erro'); }
  }

  async function submitMatStart() {
    setModalError(null);
    try {
      await startMat.mutateAsync({
        local_id: id!,
        container_type: modalForm.container_type || undefined,
        container_material: modalForm.container_material || undefined,
        closure_type: modalForm.closure_type ?? 'loose_cap',
        has_airlock: modalForm.has_airlock === 'true',
        maturation_location: modalForm.maturation_location || undefined,
        ambient_temperature_start: modalForm.amb_temp ? parseFloat(modalForm.amb_temp) : undefined,
        ambient_humidity_start: modalForm.amb_hum ? parseFloat(modalForm.amb_hum) : undefined,
        sensory_notes_start: modalForm.sensory_notes || undefined,
      });
      closeModal();
    } catch (e) { setModalError(e instanceof Error ? e.message : 'Erro'); }
  }

  async function submitMatObserve() {
    setModalError(null);
    try {
      await addObs.mutateAsync({
        local_id: id!,
        sessionId: selectedSessionId,
        ambient_temperature: modalForm.amb_temp ? parseFloat(modalForm.amb_temp) : undefined,
        ambient_humidity: modalForm.amb_hum ? parseFloat(modalForm.amb_hum) : undefined,
        bubbles_present: modalForm.bubbles === 'true',
        foam_present: modalForm.foam === 'true',
        pressure_signs: modalForm.pressure === 'true',
        aroma_change: modalForm.aroma === 'true',
        phase_separation: modalForm.phase_sep === 'true',
        visible_fermentation_signs: modalForm.fermentation === 'true',
        observation_text: modalForm.notes || undefined,
      });
      closeModal();
    } catch (e) { setModalError(e instanceof Error ? e.message : 'Erro'); }
  }

  async function submitMatComplete() {
    setModalError(null);
    if (!modalForm.final_decision) { setModalError('Decisão final obrigatória'); return; }
    try {
      await completeMat.mutateAsync({
        local_id: id!,
        sessionId: selectedSessionId,
        final_decision: modalForm.final_decision,
        final_notes: modalForm.notes || undefined,
        maturation_status: 'completed',
      });
      closeModal();
    } catch (e) { setModalError(e instanceof Error ? e.message : 'Erro'); }
  }

  async function submitBottle() {
    setModalError(null);
    try {
      await bottleMut.mutateAsync({
        local_id: id!,
        container_type: modalForm.container_type || undefined,
        package_size_ml: modalForm.package_size_ml ? parseFloat(modalForm.package_size_ml) : undefined,
        quantity_filled: modalForm.quantity_filled ? parseInt(modalForm.quantity_filled) : undefined,
        total_volume_bottled_ml: modalForm.total_volume_bottled_ml ? parseFloat(modalForm.total_volume_bottled_ml) : undefined,
        notes: modalForm.notes || undefined,
      });
      closeModal();
    } catch (e) { setModalError(e instanceof Error ? e.message : 'Erro'); }
  }

  async function submitSell() {
    setModalError(null);
    try {
      await sellMut.mutateAsync({
        local_id: id!,
        sale_type: modalForm.sale_type ?? 'retail',
        destination: modalForm.destination || undefined,
        quantity_units: modalForm.quantity_units ? parseInt(modalForm.quantity_units) : undefined,
        total_volume_ml: modalForm.total_volume_ml ? parseFloat(modalForm.total_volume_ml) : undefined,
        notes: modalForm.notes || undefined,
      });
      closeModal();
    } catch (e) { setModalError(e instanceof Error ? e.message : 'Erro'); }
  }

  async function submitReject() {
    setModalError(null);
    if (!confirm('Reprovar este lote? Esta ação não pode ser desfeita.')) return;
    try {
      await rejectBatch.mutateAsync({ local_id: id!, reason: modalForm.reason });
      closeModal();
    } catch (e) { setModalError(e instanceof Error ? e.message : 'Erro'); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isBusy =
    startDehumid.isPending || addMeasure.isPending || completeDehumid.isPending ||
    startMat.isPending || addObs.isPending || completeMat.isPending ||
    bottleMut.isPending || sellMut.isPending || updateStatus.isPending || rejectBatch.isPending;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-stone-400 hover:text-stone-100 transition-colors text-sm">← Voltar</button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-stone-100 font-mono">{batch.code}</h1>
              <Badge variant={cfg.variant}>{cfg.icon} {cfg.label}</Badge>
            </div>
            <p className="text-stone-500 text-sm mt-0.5">
              {batch.apiary_name ?? '—'} · {new Date(batch.harvest_date).toLocaleDateString('pt-BR')}
              {batch.honey_type === 'maturado' ? ' · ✨ Maturado' : ' · 🌿 Vivo'}
            </p>
          </div>
        </div>
        {canManage && status !== 'rejected' && status !== 'sold' && (
          <Button variant="danger" size="sm" onClick={() => setActiveModal('reject')}>Reprovar</Button>
        )}
      </div>

      {/* Alert banners */}
      {hasFermentationSigns && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-red-700/40 bg-red-900/20 text-red-300 text-sm">
          <span className="text-xl shrink-0">🚨</span>
          <p><span className="font-semibold">Sinais de fermentação detectados</span> — verifique as observações de maturação.</p>
        </div>
      )}
      {hasCriticalMoisture && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-700/40 bg-amber-900/20 text-amber-300 text-sm">
          <span className="text-xl shrink-0">💧</span>
          <p><span className="font-semibold">Umidade inicial alta ({batch.initial_moisture}%)</span> — considere desumidificação antes do envase.</p>
        </div>
      )}
      {highFinalMoisture && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-700/40 bg-amber-900/20 text-amber-300 text-sm">
          <span className="text-xl shrink-0">⚠️</span>
          <p><span className="font-semibold">Umidade final ainda elevada ({lastCompletedDehum!.final_moisture}%)</span> após desumidificação.</p>
        </div>
      )}
      {isStale && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-stone-700/40 bg-stone-800/60 text-stone-400 text-sm">
          <span className="text-xl shrink-0">⏰</span>
          <p><span className="font-semibold">Lote parado há {Math.floor(daysSinceCreated)} dias</span> — nenhuma ação registrada desde a coleta.</p>
        </div>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader><CardTitle>Rota de processamento</CardTitle></CardHeader>
        <div className="flex flex-wrap gap-3">
          <TimelineStep icon="🫙" label="Colheita" done={true} active={false} />
          <span className="text-stone-700">→</span>
          <TimelineStep icon="🌿" label="In natura" done={!['collected'].includes(status)} active={status === 'in_natura_ready'} />
          {batch.processing_route.includes('dehumidif') && (
            <>
              <span className="text-stone-700">→</span>
              <TimelineStep icon="💨" label="Desumidificação" done={['dehumidified', 'in_maturation', 'matured', 'bottled', 'sold'].includes(status)} active={status === 'in_dehumidification'} />
            </>
          )}
          {batch.processing_route.includes('matur') && (
            <>
              <span className="text-stone-700">→</span>
              <TimelineStep icon="✨" label="Maturação" done={['matured', 'bottled', 'sold'].includes(status)} active={status === 'in_maturation'} />
            </>
          )}
          <span className="text-stone-700">→</span>
          <TimelineStep icon="📦" label="Envase" done={batch.is_bottled} active={status === 'bottled'} />
          <span className="text-stone-700">→</span>
          <TimelineStep icon="💰" label="Venda" done={batch.is_sold} active={status === 'sold'} />
        </div>
      </Card>

      {/* Dados do lote */}
      <Card>
        <CardHeader><CardTitle>📋 Dados do Lote</CardTitle></CardHeader>
        <div className="grid grid-cols-2 gap-3">
          {batch.net_weight_grams != null && (
            <div className="bg-stone-800 rounded-xl px-3 py-2.5">
              <p className="text-xs text-stone-500">Peso líquido</p>
              <p className="text-lg font-bold text-amber-400">{(batch.net_weight_grams / 1000).toFixed(3)} kg</p>
            </div>
          )}
          {batch.gross_weight_grams != null && (
            <div className="bg-stone-800 rounded-xl px-3 py-2.5">
              <p className="text-xs text-stone-500">Peso bruto</p>
              <p className="text-lg font-bold text-amber-300">{(batch.gross_weight_grams / 1000).toFixed(3)} kg</p>
            </div>
          )}
          {batch.initial_moisture != null && (
            <div className="bg-stone-800 rounded-xl px-3 py-2.5">
              <p className="text-xs text-stone-500">Umidade inicial</p>
              <p className={`text-lg font-bold ${batch.initial_moisture > 30 ? 'text-red-400' : batch.initial_moisture > 25 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {batch.initial_moisture}%
              </p>
            </div>
          )}
          {batch.initial_brix != null && (
            <div className="bg-stone-800 rounded-xl px-3 py-2.5">
              <p className="text-xs text-stone-500">Brix inicial</p>
              <p className="text-lg font-bold text-stone-200">{batch.initial_brix}°Bx</p>
            </div>
          )}
          {batch.bee_species && (
            <div className="bg-stone-800 rounded-xl px-3 py-2.5 col-span-2">
              <p className="text-xs text-stone-500">Espécie</p>
              <p className="text-sm text-stone-200 italic">{batch.bee_species}</p>
            </div>
          )}
          {batch.floral_context && (
            <div className="bg-stone-800 rounded-xl px-3 py-2.5 col-span-2">
              <p className="text-xs text-stone-500">Contexto floral</p>
              <p className="text-sm text-stone-200">{batch.floral_context}</p>
            </div>
          )}
        </div>
        {batch.notes && <p className="text-sm text-stone-400 mt-3 italic">"{batch.notes}"</p>}
      </Card>

      {/* Ações rápidas conforme status */}
      {canOperate && status !== 'rejected' && status !== 'sold' && (
        <Card>
          <CardHeader><CardTitle>⚡ Ações</CardTitle></CardHeader>
          <div className="flex flex-wrap gap-2">
            {status === 'collected' && (
              <Button size="sm" onClick={() => updateStatus.mutate({ local_id: id!, status: 'in_natura_ready' })}>
                {isBusy ? <Spinner className="w-4 h-4" /> : '✅ Marcar pronto in natura'}
              </Button>
            )}
            {status === 'in_natura_ready' && (
              <>
                {canManage && <Button size="sm" variant="secondary" onClick={() => setActiveModal('dehumidStart')}>💨 Iniciar desumidificação</Button>}
                {canManage && <Button size="sm" variant="secondary" onClick={() => setActiveModal('matStart')}>✨ Iniciar maturação</Button>}
                <Button size="sm" onClick={() => setActiveModal('bottle')}>📦 Envasar</Button>
              </>
            )}
            {status === 'in_dehumidification' && activeDehum && (
              <>
                <Button size="sm" variant="secondary" onClick={() => { setSelectedSessionId(activeDehum.local_id); setActiveModal('dehumidMeasure'); }}>
                  + Medição
                </Button>
                {canManage && (
                  <Button size="sm" onClick={() => { setSelectedSessionId(activeDehum.local_id); setActiveModal('dehumidComplete'); }}>
                    Concluir desumidificação
                  </Button>
                )}
              </>
            )}
            {status === 'dehumidified' && (
              <>
                {canManage && <Button size="sm" variant="secondary" onClick={() => setActiveModal('matStart')}>✨ Iniciar maturação</Button>}
                <Button size="sm" onClick={() => setActiveModal('bottle')}>📦 Envasar</Button>
              </>
            )}
            {status === 'in_maturation' && activeMat && (
              <>
                <Button size="sm" variant="secondary" onClick={() => { setSelectedSessionId(activeMat.local_id); setActiveModal('matObserve'); }}>
                  + Observação
                </Button>
                {canManage && (
                  <Button size="sm" onClick={() => { setSelectedSessionId(activeMat.local_id); setActiveModal('matComplete'); }}>
                    Concluir maturação
                  </Button>
                )}
              </>
            )}
            {(status === 'matured' || status === 'bottled') && (
              <Button size="sm" onClick={() => setActiveModal('sell')}>💰 Registrar venda</Button>
            )}
          </div>
        </Card>
      )}

      {/* Desumidificação */}
      {(batch.dehumidification_sessions.length > 0 || status === 'in_dehumidification' || status === 'dehumidified') && (
        <Card>
          <CardHeader><CardTitle>💨 Desumidificação</CardTitle></CardHeader>
          <DehumidificationSection
            sessions={batch.dehumidification_sessions}
            batchLocalId={id!}
            canOperate={canOperate && canManage}
            onStart={() => setActiveModal('dehumidStart')}
            onMeasure={(sid) => { setSelectedSessionId(sid); setActiveModal('dehumidMeasure'); }}
            onComplete={(sid) => { setSelectedSessionId(sid); setActiveModal('dehumidComplete'); }}
          />
        </Card>
      )}

      {/* Maturação */}
      {(batch.maturation_sessions.length > 0 || status === 'in_maturation' || status === 'matured') && (
        <Card>
          <CardHeader><CardTitle>✨ Maturação</CardTitle></CardHeader>
          <MaturationSection
            sessions={batch.maturation_sessions}
            canOperate={canOperate && canManage}
            onStart={() => setActiveModal('matStart')}
            onObserve={(sid) => { setSelectedSessionId(sid); setActiveModal('matObserve'); }}
            onComplete={(sid) => { setSelectedSessionId(sid); setActiveModal('matComplete'); }}
          />
        </Card>
      )}

      {/* Envase */}
      {batch.bottlings.length > 0 && (
        <Card>
          <CardHeader><CardTitle>📦 Envases</CardTitle></CardHeader>
          <div className="space-y-2">
            {batch.bottlings.map((b) => (
              <div key={b.id} className="flex items-center justify-between text-sm py-2 border-b border-stone-800 last:border-0">
                <div>
                  <p className="text-stone-200">{new Date(b.bottled_at).toLocaleDateString('pt-BR')}</p>
                  <p className="text-xs text-stone-500">
                    {b.container_type ?? 'Embalagem'} · {b.quantity_filled ?? '—'} unid.
                    {b.package_size_ml != null ? ` · ${b.package_size_ml}mL` : ''}
                  </p>
                </div>
                {b.total_volume_bottled_ml != null && (
                  <span className="text-amber-400 font-medium">{b.total_volume_bottled_ml >= 1000 ? `${(b.total_volume_bottled_ml / 1000).toFixed(2)}L` : `${b.total_volume_bottled_ml}mL`}</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Vendas */}
      {batch.sales.length > 0 && (
        <Card>
          <CardHeader><CardTitle>💰 Vendas</CardTitle></CardHeader>
          <div className="space-y-2">
            {batch.sales.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm py-2 border-b border-stone-800 last:border-0">
                <div>
                  <p className="text-stone-200">{new Date(s.sold_at).toLocaleDateString('pt-BR')}</p>
                  <p className="text-xs text-stone-500">
                    {s.sale_type} {s.destination ? `· ${s.destination}` : ''} {s.quantity_units != null ? `· ${s.quantity_units} unid.` : ''}
                  </p>
                </div>
                {s.total_volume_ml != null && (
                  <span className="text-emerald-400 font-medium">{s.total_volume_ml >= 1000 ? `${(s.total_volume_ml / 1000).toFixed(2)}L` : `${s.total_volume_ml}mL`}</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Modais ──────────────────────────────────────────────────────────── */}

      {/* Iniciar desumidificação */}
      <Modal open={activeModal === 'dehumidStart'} onClose={closeModal} title="Iniciar Desumidificação" size="md">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-stone-400 block mb-1">Método</label>
            <Select options={[
              { value: 'passive_controlled_room', label: 'Sala controlada passiva' },
              { value: 'dehumidifier_room', label: 'Sala com desumidificador' },
              { value: 'airflow_assisted', label: 'Fluxo de ar assistido' },
              { value: 'other', label: 'Outro' },
            ]} value={modalForm.method ?? 'passive_controlled_room'} onChange={(e) => setField('method', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-400 block mb-1">Equipamento</label>
              <Input placeholder="Ex: Desumidificador XY" value={modalForm.equipment ?? ''} onChange={(e) => setField('equipment', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Local / Sala</label>
              <Input placeholder="Ex: Câmara 1" value={modalForm.room_name ?? ''} onChange={(e) => setField('room_name', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-400 block mb-1">Umidade inicial (%)</label>
              <Input type="number" step="0.1" value={modalForm.initial_moisture ?? ''} onChange={(e) => setField('initial_moisture', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Brix inicial (°Bx)</label>
              <Input type="number" step="0.1" value={modalForm.initial_brix ?? ''} onChange={(e) => setField('initial_brix', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-400 block mb-1">Temp. ambiente (°C)</label>
              <Input type="number" step="0.1" value={modalForm.amb_temp ?? ''} onChange={(e) => setField('amb_temp', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Umid. ambiente (%)</label>
              <Input type="number" step="0.1" value={modalForm.amb_hum ?? ''} onChange={(e) => setField('amb_hum', e.target.value)} />
            </div>
          </div>
          {modalError && <p className="text-red-400 text-xs">{modalError}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Cancelar</Button>
            <Button onClick={submitDehumStart} disabled={startDehumid.isPending} className="flex-1">
              {startDehumid.isPending ? <Spinner className="w-4 h-4" /> : 'Iniciar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Adicionar medição */}
      <Modal open={activeModal === 'dehumidMeasure'} onClose={closeModal} title="Adicionar Medição" size="sm">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-stone-400 block mb-1">Umidade (%) *</label>
            <Input type="number" step="0.1" value={modalForm.moisture ?? ''} onChange={(e) => setField('moisture', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-400 block mb-1">Brix (°Bx)</label>
              <Input type="number" step="0.1" value={modalForm.brix ?? ''} onChange={(e) => setField('brix', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Temp. amb. (°C)</label>
              <Input type="number" step="0.1" value={modalForm.amb_temp ?? ''} onChange={(e) => setField('amb_temp', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Notas</label>
            <Input value={modalForm.notes ?? ''} onChange={(e) => setField('notes', e.target.value)} />
          </div>
          {modalError && <p className="text-red-400 text-xs">{modalError}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Cancelar</Button>
            <Button onClick={submitDehumMeasure} disabled={addMeasure.isPending} className="flex-1">
              {addMeasure.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Concluir desumidificação */}
      <Modal open={activeModal === 'dehumidComplete'} onClose={closeModal} title="Concluir Desumidificação" size="sm">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-stone-400 block mb-1">Umidade final (%) *</label>
            <Input type="number" step="0.1" value={modalForm.final_moisture ?? ''} onChange={(e) => setField('final_moisture', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Brix final (°Bx)</label>
            <Input type="number" step="0.1" value={modalForm.final_brix ?? ''} onChange={(e) => setField('final_brix', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Resultado</label>
            <Select options={[
              { value: 'completed', label: '✅ Concluído com sucesso' },
              { value: 'interrupted', label: '⚠️ Interrompido' },
              { value: 'failed', label: '🚫 Falhou' },
            ]} value={modalForm.result_status ?? 'completed'} onChange={(e) => setField('result_status', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Notas finais</label>
            <Input value={modalForm.notes ?? ''} onChange={(e) => setField('notes', e.target.value)} />
          </div>
          {modalError && <p className="text-red-400 text-xs">{modalError}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Cancelar</Button>
            <Button onClick={submitDehumComplete} disabled={completeDehumid.isPending} className="flex-1">
              {completeDehumid.isPending ? <Spinner className="w-4 h-4" /> : 'Concluir'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Iniciar maturação */}
      <Modal open={activeModal === 'matStart'} onClose={closeModal} title="Iniciar Maturação" size="md">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-400 block mb-1">Tipo de recipiente</label>
              <Input placeholder="Ex: Balde, Barrica" value={modalForm.container_type ?? ''} onChange={(e) => setField('container_type', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Material</label>
              <Input placeholder="Ex: Inox, Vidro" value={modalForm.container_material ?? ''} onChange={(e) => setField('container_material', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-400 block mb-1">Tipo de fechamento</label>
              <Select options={[
                { value: 'loose_cap', label: 'Tampa solta' },
                { value: 'sealed_cap', label: 'Tampa vedada' },
                { value: 'cork', label: 'Rolha' },
                { value: 'silicone_airlock', label: 'Airlock silicone' },
                { value: 's_bubbler_airlock', label: 'Airlock S' },
                { value: 'three_piece_airlock', label: 'Airlock 3 peças' },
                { value: 'other', label: 'Outro' },
              ]} value={modalForm.closure_type ?? 'loose_cap'} onChange={(e) => setField('closure_type', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Local</label>
              <Input placeholder="Ex: Câmara fria" value={modalForm.maturation_location ?? ''} onChange={(e) => setField('maturation_location', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-400 block mb-1">Temp. amb. (°C)</label>
              <Input type="number" step="0.1" value={modalForm.amb_temp ?? ''} onChange={(e) => setField('amb_temp', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Umid. amb. (%)</label>
              <Input type="number" step="0.1" value={modalForm.amb_hum ?? ''} onChange={(e) => setField('amb_hum', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Notas sensoriais iniciais</label>
            <Input placeholder="Aroma, consistência, aparência..." value={modalForm.sensory_notes ?? ''} onChange={(e) => setField('sensory_notes', e.target.value)} />
          </div>
          {modalError && <p className="text-red-400 text-xs">{modalError}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Cancelar</Button>
            <Button onClick={submitMatStart} disabled={startMat.isPending} className="flex-1">
              {startMat.isPending ? <Spinner className="w-4 h-4" /> : 'Iniciar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Observação maturação */}
      <Modal open={activeModal === 'matObserve'} onClose={closeModal} title="Adicionar Observação" size="md">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-400 block mb-1">Temp. (°C)</label>
              <Input type="number" step="0.1" value={modalForm.amb_temp ?? ''} onChange={(e) => setField('amb_temp', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Umidade (%)</label>
              <Input type="number" step="0.1" value={modalForm.amb_hum ?? ''} onChange={(e) => setField('amb_hum', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['bubbles', 'Bolhas presentes'],
              ['foam', 'Espuma'],
              ['pressure', 'Sinais de pressão'],
              ['aroma', 'Alteração aromática'],
              ['phase_sep', 'Separação de fase'],
              ['fermentation', 'Fermentação visível'],
            ] as [string, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modalForm[key] === 'true'}
                  onChange={(e) => setField(key, String(e.target.checked))}
                  className="accent-amber-500 w-4 h-4"
                />
                <span className="text-sm text-stone-300">{label}</span>
              </label>
            ))}
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Texto de observação</label>
            <Input value={modalForm.notes ?? ''} onChange={(e) => setField('notes', e.target.value)} />
          </div>
          {modalError && <p className="text-red-400 text-xs">{modalError}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Cancelar</Button>
            <Button onClick={submitMatObserve} disabled={addObs.isPending} className="flex-1">
              {addObs.isPending ? <Spinner className="w-4 h-4" /> : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Concluir maturação */}
      <Modal open={activeModal === 'matComplete'} onClose={closeModal} title="Concluir Maturação" size="sm">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-stone-400 block mb-1">Decisão final *</label>
            <Select options={[
              { value: '', label: 'Selecione...' },
              { value: 'approved', label: '✅ Aprovado' },
              { value: 'approved_with_observation', label: '⚠️ Aprovado com observação' },
              { value: 'rejected', label: '🚫 Reprovado' },
              { value: 'redirected_for_new_processing', label: '🔄 Reencaminhar para reprocessamento' },
            ]} value={modalForm.final_decision ?? ''} onChange={(e) => setField('final_decision', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Notas finais</label>
            <Input value={modalForm.notes ?? ''} onChange={(e) => setField('notes', e.target.value)} />
          </div>
          {modalError && <p className="text-red-400 text-xs">{modalError}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Cancelar</Button>
            <Button onClick={submitMatComplete} disabled={completeMat.isPending} className="flex-1">
              {completeMat.isPending ? <Spinner className="w-4 h-4" /> : 'Concluir'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Envase */}
      <Modal open={activeModal === 'bottle'} onClose={closeModal} title="Registrar Envase" size="sm">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-stone-400 block mb-1">Tipo de embalagem</label>
            <Input placeholder="Ex: Frasco de vidro 250mL" value={modalForm.container_type ?? ''} onChange={(e) => setField('container_type', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-400 block mb-1">Volume por unidade (mL)</label>
              <Input type="number" step="1" value={modalForm.package_size_ml ?? ''} onChange={(e) => setField('package_size_ml', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Quantidade (unid.)</label>
              <Input type="number" step="1" value={modalForm.quantity_filled ?? ''} onChange={(e) => setField('quantity_filled', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Volume total envasado (mL)</label>
            <Input type="number" step="1" value={modalForm.total_volume_bottled_ml ?? ''} onChange={(e) => setField('total_volume_bottled_ml', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Notas</label>
            <Input value={modalForm.notes ?? ''} onChange={(e) => setField('notes', e.target.value)} />
          </div>
          {modalError && <p className="text-red-400 text-xs">{modalError}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Cancelar</Button>
            <Button onClick={submitBottle} disabled={bottleMut.isPending} className="flex-1">
              {bottleMut.isPending ? <Spinner className="w-4 h-4" /> : 'Registrar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Venda */}
      <Modal open={activeModal === 'sell'} onClose={closeModal} title="Registrar Venda" size="sm">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-stone-400 block mb-1">Tipo de saída</label>
            <Select options={[
              { value: 'retail', label: 'Varejo' },
              { value: 'wholesale', label: 'Atacado' },
              { value: 'internal_use', label: 'Uso interno' },
              { value: 'sample', label: 'Amostra' },
              { value: 'discard', label: 'Descarte' },
              { value: 'other', label: 'Outro' },
            ]} value={modalForm.sale_type ?? 'retail'} onChange={(e) => setField('sale_type', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Destino</label>
            <Input placeholder="Nome do cliente ou destino" value={modalForm.destination ?? ''} onChange={(e) => setField('destination', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-400 block mb-1">Qtd. unidades</label>
              <Input type="number" step="1" value={modalForm.quantity_units ?? ''} onChange={(e) => setField('quantity_units', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Volume total (mL)</label>
              <Input type="number" step="1" value={modalForm.total_volume_ml ?? ''} onChange={(e) => setField('total_volume_ml', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Notas</label>
            <Input value={modalForm.notes ?? ''} onChange={(e) => setField('notes', e.target.value)} />
          </div>
          {modalError && <p className="text-red-400 text-xs">{modalError}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Cancelar</Button>
            <Button onClick={submitSell} disabled={sellMut.isPending} className="flex-1">
              {sellMut.isPending ? <Spinner className="w-4 h-4" /> : 'Registrar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reprovar */}
      <Modal open={activeModal === 'reject'} onClose={closeModal} title="Reprovar Lote" size="sm">
        <div className="space-y-3">
          <p className="text-stone-400 text-sm">Esta ação não pode ser desfeita. O lote será marcado como reprovado.</p>
          <div>
            <label className="text-xs text-stone-400 block mb-1">Motivo (opcional)</label>
            <Input value={modalForm.reason ?? ''} onChange={(e) => setField('reason', e.target.value)} />
          </div>
          {modalError && <p className="text-red-400 text-xs">{modalError}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Cancelar</Button>
            <Button variant="danger" onClick={submitReject} disabled={rejectBatch.isPending} className="flex-1">
              {rejectBatch.isPending ? <Spinner className="w-4 h-4" /> : 'Reprovar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Histórico de auditoria */}
      {batch.audit_logs.length > 0 && (
        <Card>
          <CardHeader><CardTitle>📜 Histórico</CardTitle></CardHeader>
          <div className="space-y-1.5 mt-2">
            {batch.audit_logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-xs py-1.5 border-b border-stone-800 last:border-0">
                <span className="text-stone-600 shrink-0 pt-0.5">
                  {new Date(log.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  {' '}
                  {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div>
                  <span className="text-stone-300 font-medium">{log.action.replace(/_/g, ' ')}</span>
                  {log.actor_name && <span className="text-stone-500"> · {log.actor_name}</span>}
                  {log.metadata.from && log.metadata.to && (
                    <span className="text-stone-500"> · {String(log.metadata.from)} → {String(log.metadata.to)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-xs text-stone-600 text-center pb-4">
        Criado em {new Date(batch.created_at).toLocaleDateString('pt-BR')}
      </p>
    </div>
  );
}
