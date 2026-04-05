import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  useMelgueira,
  useInstallMelgueira,
  useRemoveMelgueira,
  useDeleteMelgueira,
  useUpdateMelgueira,
} from '@/hooks/useMelgueiras';
import { useEquipmentMovements } from '@/hooks/useEquipment';
import { useHives } from '@/hooks/useHives';
import { useAuthStore } from '@/store/authStore';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import type { MelgueiraStatus } from '@bee-forest/shared';

const STATUS_STYLE: Record<MelgueiraStatus, string> = {
  disponivel: 'bg-emerald-900/40 text-emerald-400 border-emerald-700/40',
  em_uso:     'bg-sky-900/40 text-sky-300 border-sky-700/40',
  manutencao: 'bg-amber-900/40 text-amber-400 border-amber-700/40',
};

const STATUS_LABEL: Record<MelgueiraStatus, string> = {
  disponivel: '✅ Disponível',
  em_uso:     '📦 Em Uso',
  manutencao: '🔧 Manutenção',
};

const MOVEMENT_LABELS: Record<string, string> = {
  instalacao: '📦 Instalação',
  retirada:   '↩ Retirada',
  entrada:    '⬆ Entrada',
  saida:      '⬇ Saída',
  desmontagem:'🪚 Desmontagem',
};

export function MelgueiraDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;
  const canManage = ['master_admin', 'socio', 'responsavel'].includes(user.role);

  const { data: melgueira, isLoading } = useMelgueira(id ?? '');
  const { data: movements = [] } = useEquipmentMovements({ item_type: 'melgueira', limit: 50 });
  const { data: hives = [] } = useHives();
  const installMelgueira = useInstallMelgueira();
  const removeMelgueira  = useRemoveMelgueira();
  const deleteMelgueira  = useDeleteMelgueira();
  const updateMelgueira  = useUpdateMelgueira();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrOpen, setQrOpen]         = useState(false);
  const [qrDataUrl, setQrDataUrl]   = useState<string | null>(null);

  const [installOpen, setInstallOpen] = useState(false);
  const [installHive, setInstallHive] = useState('');
  const [installDate, setInstallDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [installBy, setInstallBy]     = useState(user.name);
  const [installErr, setInstallErr]   = useState<string | null>(null);

  const [removeOpen, setRemoveOpen]   = useState(false);
  const [removeBy, setRemoveBy]       = useState(user.name);
  const [removeReason, setRemoveReason] = useState('');

  const [editOpen, setEditOpen]     = useState(false);
  const [editCode, setEditCode]     = useState('');
  const [editStatus, setEditStatus] = useState<MelgueiraStatus>('disponivel');
  const [editNotes, setEditNotes]   = useState('');
  const [editErr, setEditErr]       = useState<string | null>(null);

  const appUrl = import.meta.env.VITE_APP_URL ?? window.location.origin;

  useEffect(() => {
    if (!qrOpen || !melgueira) return;
    const content = `${appUrl}/h/${mlg.code}`;
    QRCode.toCanvas(canvasRef.current!, content, {
      width: 240, margin: 2, color: { dark: '#000000', light: '#ffffff' },
    }).catch(console.error);
    QRCode.toDataURL(content, { width: 240, margin: 2 })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [qrOpen, melgueira, appUrl]);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!melgueira) return <div className="text-center py-20 text-stone-400">Melgueira não encontrada.</div>;

  const myMovements = movements.filter((m) => m.item_local_id === mlg.local_id);

  const sortedHives = [...hives].sort((a, b) => {
    const na = parseInt(a.code.split('-')[1] ?? '0', 10);
    const nb = parseInt(b.code.split('-')[1] ?? '0', 10);
    return na - nb;
  });

  const availableHives = sortedHives.filter((h) => h.status !== 'inactive');
  // After early-return guards, TypeScript can't narrow closures — use local alias
  // (functions below are only ever called when melgueira is defined)
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const mlg = melgueira!;

  function openInstall() {
    setInstallHive(''); setInstallErr(null);
    setInstallDate(new Date().toISOString().slice(0, 10));
    setInstallOpen(true);
  }

  function openEdit() {
    setEditCode(mlg.code);
    setEditStatus(mlg.status);
    setEditNotes(mlg.notes ?? '');
    setEditErr(null);
    setEditOpen(true);
  }

  function handlePrint() {
    if (!qrDataUrl) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head>
        <title>Etiqueta — ${mlg.code}</title>
        <style>
          body { margin:0; display:flex; flex-direction:column; align-items:center;
                 justify-content:center; min-height:100vh; font-family:monospace; }
          h2 { font-size:20px; margin-bottom:8px; letter-spacing:2px; }
          img { display:block; }
          p { font-size:11px; color:#555; margin-top:6px; }
        </style>
      </head><body>
        <h2>${mlg.code}</h2>
        <img src="${qrDataUrl}" width="240" height="240" />
        <p>Melgueira · ${mlg.apiary_name ?? ''}</p>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  async function handleInstall(e: React.FormEvent) {
    e.preventDefault();
    setInstallErr(null);
    if (!installHive) { setInstallErr('Selecione a caixa'); return; }
    try {
      await installMelgueira.mutateAsync({
        localId: mlg.local_id,
        hive_local_id: installHive,
        installed_at: installDate,
        performed_by: installBy,
      });
      setInstallOpen(false);
    } catch (err) {
      setInstallErr((err as Error).message ?? 'Erro ao instalar');
    }
  }

  async function handleRemove(e: React.FormEvent) {
    e.preventDefault();
    try {
      await removeMelgueira.mutateAsync({
        localId: mlg.local_id,
        performed_by: removeBy,
        reason: removeReason || undefined,
      });
      setRemoveOpen(false);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditErr(null);
    try {
      await updateMelgueira.mutateAsync({
        localId: mlg.local_id,
        data: { code: editCode, status: editStatus, notes: editNotes || null },
      });
      setEditOpen(false);
    } catch (err) {
      setEditErr((err as Error).message ?? 'Erro ao salvar');
    }
  }

  function handleDelete() {
    if (!confirm(`Excluir melgueira "${mlg.code}"? Esta ação não pode ser desfeita.`)) return;
    deleteMelgueira.mutate(mlg.local_id, { onSuccess: () => navigate('/stock?tab=melgueiras') });
  }

  return (
    <div className="space-y-5 max-w-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate(-1)} className="mt-1 text-stone-400 hover:text-stone-200">←</button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-stone-100">{mlg.code}</h1>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${STATUS_STYLE[mlg.status]}`}>
                {STATUS_LABEL[mlg.status]}
              </span>
            </div>
            {mlg.apiary_name && (
              <p className="text-sm text-stone-400">{mlg.apiary_name}</p>
            )}
          </div>
        </div>

        {canManage && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={openEdit}>Editar</Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>Excluir</Button>
          </div>
        )}
      </div>

      {/* Status / hive info */}
      <Card>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-stone-500 mb-0.5">Meliponário</p>
            <p className="text-sm text-stone-200">{mlg.apiary_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-0.5">Situação</p>
            <p className="text-sm text-stone-200">{STATUS_LABEL[mlg.status]}</p>
          </div>
          {mlg.status === 'em_uso' && (
            <>
              <div>
                <p className="text-xs text-stone-500 mb-0.5">Instalada na caixa</p>
                <p className="text-sm text-stone-200">
                  {mlg.hive_code
                    ? (
                      <button
                        onClick={() => navigate(`/hives/${mlg.hive_local_id}`)}
                        className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
                      >
                        {mlg.hive_code}
                      </button>
                    )
                    : '—'
                  }
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-500 mb-0.5">Instalada em</p>
                <p className="text-sm text-stone-200">
                  {mlg.installed_at
                    ? new Date(mlg.installed_at).toLocaleDateString('pt-BR')
                    : '—'}
                </p>
              </div>
            </>
          )}
          {mlg.notes && (
            <div className="col-span-2">
              <p className="text-xs text-stone-500 mb-0.5">Observações</p>
              <p className="text-sm text-stone-400 italic">"{mlg.notes}"</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {canManage && (
          <div className="mt-4 flex gap-2 pt-4 border-t border-stone-800">
            {mlg.status === 'disponivel' && (
              <Button size="sm" onClick={openInstall}>📦 Instalar em caixa</Button>
            )}
            {mlg.status === 'em_uso' && (
              <Button size="sm" variant="secondary" onClick={() => setRemoveOpen(true)}>↩ Retirar</Button>
            )}
          </div>
        )}
      </Card>

      {/* QR Code */}
      <div className="border border-stone-800 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setQrOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-stone-300 hover:text-stone-100 hover:bg-stone-800/60 transition-colors"
        >
          <span className="flex items-center gap-2">
            <span>📷</span>
            <span>QR Code · {mlg.code}</span>
          </span>
          <span className="text-stone-500 text-xs">{qrOpen ? '▲' : '▼'}</span>
        </button>
        {qrOpen && (
          <div className="px-4 pb-4 pt-2 flex flex-col items-center gap-3 bg-stone-900/30">
            <canvas ref={canvasRef} className="rounded-lg bg-white p-2" />
            <p className="text-xs text-stone-400 font-mono tracking-widest">{mlg.code}</p>
            <div className="flex gap-2">
              {qrDataUrl && (
                <Button variant="secondary" size="sm" onClick={() => {
                  const a = document.createElement('a');
                  a.href = qrDataUrl;
                  a.download = `qr-${mlg.code}.png`;
                  a.click();
                }}>⬇ Baixar PNG</Button>
              )}
              <Button variant="secondary" size="sm" onClick={handlePrint} disabled={!qrDataUrl}>
                🖨 Imprimir etiqueta
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Movement history */}
      <Card>
        <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
        {myMovements.length === 0 ? (
          <p className="text-stone-500 text-sm text-center py-6">Nenhuma movimentação registrada</p>
        ) : (
          <div className="divide-y divide-stone-800 mt-2">
            {myMovements.slice(0, 20).map((m) => (
              <div key={m.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <p className="text-stone-200">{MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}</p>
                  {mlg.hive_code && <p className="text-xs text-stone-500">Caixa {mlg.hive_code}</p>}
                  {m.reason && <p className="text-xs text-stone-400 italic">"{m.reason}"</p>}
                </div>
                <p className="text-xs text-stone-500 shrink-0">
                  {new Date(m.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modals */}
      <Modal open={installOpen} onClose={() => setInstallOpen(false)} title="Instalar Melgueira">
        <form onSubmit={handleInstall} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Caixa *</label>
            <select
              value={installHive}
              onChange={(e) => setInstallHive(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="">Selecione a caixa...</option>
              {availableHives.map((h) => (
                <option key={h.local_id} value={h.local_id}>{h.code}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Data de instalação *</label>
            <input type="date" value={installDate} onChange={(e) => setInstallDate(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Instalado por</label>
            <input type="text" value={installBy} onChange={(e) => setInstallBy(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          {installErr && <p className="text-sm text-red-400">{installErr}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={installMelgueira.isPending} className="flex-1">
              {installMelgueira.isPending ? 'Instalando...' : 'Confirmar instalação'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setInstallOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={removeOpen} onClose={() => setRemoveOpen(false)} title="Retirar Melgueira">
        <form onSubmit={handleRemove} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Retirado por</label>
            <input type="text" value={removeBy} onChange={(e) => setRemoveBy(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Motivo (opcional)</label>
            <textarea value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} rows={2}
              placeholder="Ex: colheita concluída, manutenção..."
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 resize-none" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={removeMelgueira.isPending} className="flex-1">
              {removeMelgueira.isPending ? 'Retirando...' : 'Confirmar retirada'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setRemoveOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar Melgueira">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Código *</label>
            <input type="text" value={editCode} onChange={(e) => setEditCode(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Status</label>
            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as MelgueiraStatus)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500">
              <option value="disponivel">Disponível</option>
              <option value="em_uso">Em Uso</option>
              <option value="manutencao">Manutenção</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">Observações</label>
            <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500 resize-none" />
          </div>
          {editErr && <p className="text-sm text-red-400">{editErr}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={updateMelgueira.isPending} className="flex-1">
              {updateMelgueira.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
