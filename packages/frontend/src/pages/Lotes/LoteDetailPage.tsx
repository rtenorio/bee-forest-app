import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import QRCode from 'qrcode';
import {
  useLote, useUpdateLoteStatus, useAddEtapa, useAddFrasco,
  type LoteStatus, type EtapaTipo, type FrascoDestino,
} from '@/hooks/useLotes';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<LoteStatus, { label: string; cls: string; next?: LoteStatus }> = {
  coletado:       { label: 'Coletado',       cls: 'bg-stone-700/60 text-stone-300 border-stone-600/40',     next: 'desumidificando' },
  desumidificando:{ label: 'Desumidificando', cls: 'bg-blue-900/40 text-blue-300 border-blue-700/40',        next: 'maturando' },
  maturando:      { label: 'Maturando',      cls: 'bg-amber-900/40 text-amber-300 border-amber-700/40',     next: 'envasado' },
  envasado:       { label: 'Envasado',       cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40', next: 'vendido' },
  vendido:        { label: 'Vendido',        cls: 'bg-purple-900/40 text-purple-300 border-purple-700/40' },
};

const ETAPA_LABELS: Record<EtapaTipo, string> = {
  desumidificacao: 'Desumidificação',
  maturacao:       'Maturação',
  envase:          'Envase',
  analise:         'Análise',
  outro:           'Outro',
};

const ETAPA_ICONS: Record<EtapaTipo, string> = {
  desumidificacao: '💨',
  maturacao:       '🔄',
  envase:          '📦',
  analise:         '🔬',
  outro:           '📝',
};

const DESTINO_LABELS: Record<FrascoDestino, string> = {
  consumo_proprio: 'Consumo próprio',
  venda_direta:    'Venda direta',
  bee_forest_luxe: 'Bee Forest Luxe',
  exportacao:      'Exportação',
};

// ── QR canvas ─────────────────────────────────────────────────────────────────

function QRCanvas({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, { width: 160, margin: 2 });
    }
  }, [url]);
  return <canvas ref={canvasRef} className="rounded-lg" />;
}

// ── Advance status modal ──────────────────────────────────────────────────────

function AdvanceStatusModal({
  current, next, loteId, onClose,
}: { current: LoteStatus; next: LoteStatus; loteId: string; onClose: () => void }) {
  const [obs, setObs] = useState('');
  const update = useUpdateLoteStatus();
  const cfg = STATUS_CFG[next];

  async function confirm() {
    await update.mutateAsync({ local_id: loteId, status: next, observacao: obs || undefined });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-sm p-6 space-y-4">
        <h3 className="text-base font-bold text-stone-100">Avançar status</h3>
        <p className="text-sm text-stone-400">
          Mover lote de <strong className="text-stone-200">{STATUS_CFG[current].label}</strong> para{' '}
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
        </p>
        <div>
          <label className="text-xs text-stone-400 mb-1 block">Observação (opcional)</label>
          <textarea
            value={obs} onChange={(e) => setObs(e.target.value)}
            rows={3} placeholder="Notas sobre esta etapa…"
            className="w-full bg-stone-700 border border-stone-600 text-stone-100 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-stone-400 hover:text-stone-200">Cancelar</button>
          <button onClick={confirm} disabled={update.isPending}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
            {update.isPending ? 'Salvando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add frasco modal ──────────────────────────────────────────────────────────

function AddFrascoModal({ loteId, onClose }: { loteId: string; onClose: () => void }) {
  const [form, setForm] = useState({ quantidade: '', volume_ml: '', destino: '' as FrascoDestino | '', data_envase: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState<string | null>(null);
  const addFrasco = useAddFrasco();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const qtd = parseInt(form.quantidade, 10);
    const vol = parseInt(form.volume_ml, 10);
    if (!qtd || qtd <= 0) { setError('Quantidade deve ser positiva'); return; }
    if (!vol || vol <= 0) { setError('Volume por frasco deve ser positivo'); return; }
    try {
      await addFrasco.mutateAsync({
        local_id:    loteId,
        quantidade:  qtd,
        volume_ml:   vol,
        destino:     form.destino as FrascoDestino || undefined,
        data_envase: form.data_envase || undefined,
      });
      onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erro'); }
  }

  const inputCls = 'w-full bg-stone-700 border border-stone-600 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-sm p-6 space-y-4">
        <h3 className="text-base font-bold text-stone-100">Registrar envase</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-400 mb-1 block">Quantidade</label>
              <input type="number" min="1" placeholder="Ex: 50" value={form.quantidade}
                onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-stone-400 mb-1 block">Volume/frasco (ml)</label>
              <input type="number" min="1" placeholder="Ex: 250" value={form.volume_ml}
                onChange={(e) => setForm((f) => ({ ...f, volume_ml: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-xs text-stone-400 mb-1 block">Destino</label>
            <select value={form.destino} onChange={(e) => setForm((f) => ({ ...f, destino: e.target.value as FrascoDestino | '' }))} className={inputCls}>
              <option value="">Selecione…</option>
              {Object.entries(DESTINO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-400 mb-1 block">Data de envase</label>
            <input type="date" value={form.data_envase} onChange={(e) => setForm((f) => ({ ...f, data_envase: e.target.value }))} className={inputCls} />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-stone-400 hover:text-stone-200">Cancelar</button>
            <button type="submit" disabled={addFrasco.isPending}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg">
              {addFrasco.isPending ? 'Salvando…' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function LoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: lote, isLoading } = useLote(id ?? '');
  const [showAdvance, setShowAdvance]   = useState(false);
  const [showFrasco, setShowFrasco]     = useState(false);

  const appUrl = window.location.origin;
  const rastreabilidadeUrl = `${appUrl}/rastreabilidade/${id}`;

  function printLabel() {
    const w = window.open('', '_blank');
    if (!w || !lote) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Etiqueta ${lote.codigo}</title>
    <style>
      body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: white; }
      .label { border: 2px solid #333; border-radius: 12px; padding: 20px; max-width: 280px; text-align: center; }
      h2 { margin: 0 0 4px; font-size: 18px; }
      p  { margin: 4px 0; font-size: 12px; color: #555; }
      canvas { margin: 12px 0; }
    </style></head><body>
    <div class="label">
      <h2>🍯 Bee Forest</h2>
      <p style="font-weight:bold;font-size:14px;">${lote.codigo}</p>
      <p>${lote.apiary_nome}</p>
      <p>${lote.volume_total_ml} ml${lote.umidade ? ' · ' + lote.umidade + '% umidade' : ''}${lote.brix ? ' · Brix ' + lote.brix : ''}</p>
      <p id="qr-placeholder">QR: ${rastreabilidadeUrl}</p>
      <p style="font-size:10px;margin-top:8px;">Rastreabilidade completa via QR code</p>
    </div>
    <script>
      window.onload = function() { window.print(); };
    </script></body></html>`);
    w.document.close();
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!lote) return (
    <div className="text-center py-20 text-stone-500">
      <p>Lote não encontrado.</p>
      <button onClick={() => navigate('/lotes')} className="mt-4 text-amber-400 hover:underline text-sm">← Voltar</button>
    </div>
  );

  const cfg      = STATUS_CFG[lote.status] ?? STATUS_CFG.coletado;
  const nextStatus = cfg.next;
  const totalFrascos = lote.frascos.reduce((s, f) => s + f.quantidade, 0);
  const volEnvasado  = lote.frascos.reduce((s, f) => s + f.quantidade * f.volume_ml, 0);

  return (
    <>
      {showAdvance && nextStatus && (
        <AdvanceStatusModal current={lote.status} next={nextStatus} loteId={lote.local_id} onClose={() => setShowAdvance(false)} />
      )}
      {showFrasco && <AddFrascoModal loteId={lote.local_id} onClose={() => setShowFrasco(false)} />}

      <div className="space-y-5 max-w-3xl">
        {/* Back */}
        <button onClick={() => navigate('/lotes')} className="text-stone-500 hover:text-stone-300 text-sm flex items-center gap-1">
          ← Lotes
        </button>

        {/* Header */}
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="font-mono text-2xl font-bold text-amber-400">{lote.codigo}</p>
              <p className="text-stone-400 text-sm">{lote.apiary_nome}</p>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                <span className="text-stone-500 text-xs">
                  {format(new Date(lote.data_colheita + 'T12:00:00'), "d MMM yyyy", { locale: ptBR })}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {nextStatus && (
                <button onClick={() => setShowAdvance(true)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-lg transition-colors">
                  Avançar → {STATUS_CFG[nextStatus].label}
                </button>
              )}
              <button onClick={() => setShowFrasco(true)}
                className="px-3 py-1.5 bg-stone-700 hover:bg-stone-600 text-stone-200 text-sm font-semibold rounded-lg transition-colors">
                + Registrar envase
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {[
              { label: 'Volume total',    value: `${lote.volume_total_ml} ml` },
              { label: 'Umidade',         value: lote.umidade != null ? `${lote.umidade}%` : '—' },
              { label: 'Brix',            value: lote.brix    != null ? `${lote.brix}%`   : '—' },
              { label: 'Etapas',          value: String(lote.etapas.length) },
            ].map((s) => (
              <div key={s.label} className="bg-stone-800/60 border border-stone-700/50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-stone-100">{s.value}</p>
                <p className="text-xs text-stone-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Timeline */}
        <Card>
          <h2 className="text-sm font-semibold text-stone-300 mb-4">Etapas do processo</h2>
          {lote.etapas.length === 0 ? (
            <p className="text-stone-500 text-sm">Nenhuma etapa registrada ainda.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-stone-700" />
              <div className="space-y-4">
                {lote.etapas.map((e, i) => (
                  <div key={e.id} className="flex gap-4 relative">
                    <div className="w-8 h-8 rounded-full bg-stone-800 border-2 border-amber-500/60 flex items-center justify-center text-sm z-10 shrink-0">
                      {ETAPA_ICONS[e.tipo]}
                    </div>
                    <div className="flex-1 pb-2">
                      <p className="text-sm font-semibold text-stone-200">{ETAPA_LABELS[e.tipo]}</p>
                      <p className="text-xs text-stone-400">
                        {format(new Date(e.data_inicio + 'T12:00:00'), "d MMM yyyy", { locale: ptBR })}
                        {e.data_fim && ` → ${format(new Date(e.data_fim + 'T12:00:00'), "d MMM yyyy", { locale: ptBR })}`}
                        {e.responsavel_nome && ` · ${e.responsavel_nome}`}
                      </p>
                      {e.observacao && <p className="text-xs text-stone-500 mt-0.5">{e.observacao}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Frascos */}
        {lote.frascos.length > 0 && (
          <Card>
            <h2 className="text-sm font-semibold text-stone-300 mb-3">Frascos envasados</h2>
            <div className="flex gap-6 mb-3 text-sm">
              <span className="text-stone-400">Total: <strong className="text-stone-200">{totalFrascos} frascos</strong></span>
              <span className="text-stone-400">Volume: <strong className="text-amber-400">{volEnvasado} ml</strong></span>
            </div>
            <div className="space-y-2">
              {lote.frascos.map((f) => (
                <div key={f.id} className="flex items-center justify-between bg-stone-800/60 rounded-xl px-4 py-2.5 text-sm">
                  <span className="text-stone-200">{f.quantidade}× {f.volume_ml} ml</span>
                  <div className="flex items-center gap-3 text-xs text-stone-400">
                    {f.destino && <span>{DESTINO_LABELS[f.destino]}</span>}
                    {f.data_envase && <span>{format(new Date(f.data_envase + 'T12:00:00'), "d MMM yyyy", { locale: ptBR })}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* QR Code */}
        <Card>
          <h2 className="text-sm font-semibold text-stone-300 mb-3">Rastreabilidade</h2>
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="bg-white rounded-lg p-2">
              <QRCanvas url={rastreabilidadeUrl} />
            </div>
            <div className="space-y-2 flex-1">
              <p className="text-xs text-stone-400 break-all">{rastreabilidadeUrl}</p>
              <p className="text-xs text-stone-500">Aponte a câmera do consumidor para este QR code para ver a rastreabilidade completa do lote.</p>
              <button onClick={printLabel}
                className="mt-2 px-3 py-1.5 bg-stone-700 hover:bg-stone-600 text-stone-200 text-sm font-semibold rounded-lg transition-colors">
                🖨️ Imprimir etiqueta
              </button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
