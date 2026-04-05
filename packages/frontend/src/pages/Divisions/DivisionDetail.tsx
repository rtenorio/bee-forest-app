import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDivision, useUpdateDivision } from '@/hooks/useDivisions';
import { useHives } from '@/hooks/useHives';
import { useApiaries } from '@/hooks/useApiaries';
import { useAuthStore } from '@/store/authStore';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import type { DivisionStatus } from '@bee-forest/shared';

function StatusBadge({ status }: { status: DivisionStatus }) {
  const cls =
    status === 'realizada'
      ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/40'
      : status === 'cancelada'
      ? 'bg-stone-800 text-stone-500 border border-stone-700'
      : 'bg-amber-900/40 text-amber-400 border border-amber-700/40';
  const label =
    status === 'realizada' ? '✅ Realizada' : status === 'cancelada' ? 'Cancelada' : '⏳ Pendente';
  return <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${cls}`}>{label}</span>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-stone-500 mb-0.5">{label}</p>
      <p className="text-sm text-stone-200">{value ?? '—'}</p>
    </div>
  );
}

export function DivisionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;
  const { data: division, isLoading } = useDivision(id ?? '');
  const updateDivision = useUpdateDivision();
  const { data: hives = [] } = useHives();
  const { data: apiaries = [] } = useApiaries();

  const canExecute = ['master_admin', 'socio', 'responsavel', 'tratador'].includes(user.role);
  const canCancel  = ['master_admin', 'socio', 'responsavel'].includes(user.role);

  const [execOpen, setExecOpen] = useState(false);
  const [hiveNewId, setHiveNewId] = useState('');
  const [apiaryDestId, setApiaryDestId] = useState('');
  const [dividedAt, setDividedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [dividedBy, setDividedBy] = useState(user.name);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleExecute(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!hiveNewId || !dividedAt || !dividedBy) {
      setError('Preencha caixa nova, data e responsável pela execução.');
      return;
    }
    try {
      await updateDivision.mutateAsync({
        localId: id!,
        data: {
          status: 'realizada',
          hive_new_local_id: hiveNewId,
          apiary_destination_local_id: apiaryDestId || null,
          divided_at: dividedAt,
          divided_by: dividedBy,
          notes: notes || null,
        },
      });
      setExecOpen(false);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Erro ao atualizar');
    }
  }

  async function handleCancel() {
    if (!confirm('Cancelar esta divisão?')) return;
    await updateDivision.mutateAsync({ localId: id!, data: { status: 'cancelada' } });
  }

  const sortedHives = [...hives].sort((a, b) => {
    const na = parseInt(a.code.split('-')[1] ?? '0', 10);
    const nb = parseInt(b.code.split('-')[1] ?? '0', 10);
    return na - nb;
  });

  if (isLoading) return (
    <div className="flex justify-center py-20"><Spinner /></div>
  );
  if (!division) return (
    <div className="text-center py-20 text-stone-500">Divisão não encontrada.</div>
  );

  const originDate = format(new Date(division.identified_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const execDate = division.divided_at
    ? format(new Date(division.divided_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="mt-1 text-stone-400 hover:text-stone-200">←</button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-stone-100">
              Divisão — {division.hive_origin_code ?? division.hive_origin_local_id}
            </h1>
            <StatusBadge status={division.status} />
          </div>
          {division.apiary_origin_name && (
            <p className="text-sm text-stone-400">{division.apiary_origin_name}</p>
          )}
        </div>
      </div>

      {/* Identification info */}
      <Card>
        <CardHeader><CardTitle>Identificação</CardTitle></CardHeader>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Field label="Caixa de origem" value={division.hive_origin_code} />
          <Field label="Meliponário" value={division.apiary_origin_name} />
          <Field label="Identificado em" value={originDate} />
          <Field label="Identificado por" value={division.identified_by} />
          {division.notes && <div className="col-span-2"><Field label="Observações" value={division.notes} /></div>}
        </div>
      </Card>

      {/* Execution info (when done) */}
      {division.status === 'realizada' && (
        <Card>
          <CardHeader><CardTitle>Execução</CardTitle></CardHeader>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Field label="Nova caixa" value={division.hive_new_code ?? division.hive_new_local_id} />
            <Field label="Meliponário destino" value={division.apiary_destination_name} />
            <Field label="Realizada em" value={execDate} />
            <Field label="Realizada por" value={division.divided_by} />
          </div>
        </Card>
      )}

      {/* Execution form */}
      {division.status === 'pendente' && canExecute && !execOpen && (
        <div className="space-y-2">
          <Button className="w-full" onClick={() => setExecOpen(true)}>
            ✂️ Registrar execução da divisão
          </Button>
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={updateDivision.isPending}
              className="w-full py-2 text-sm text-stone-500 hover:text-red-400 transition-colors"
            >
              Cancelar divisão
            </button>
          )}
        </div>
      )}

      {execOpen && (
        <Card>
          <CardHeader><CardTitle>Registrar Execução</CardTitle></CardHeader>
          <form onSubmit={handleExecute} className="mt-4 space-y-4">
            {error && (
              <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">{error}</p>
            )}

            <div>
              <label className="text-xs text-stone-400 block mb-1">Nova caixa *</label>
              <select
                required
                value={hiveNewId}
                onChange={(e) => {
                  setHiveNewId(e.target.value);
                  const h = hives.find((x) => x.local_id === e.target.value);
                  if (h) setApiaryDestId(h.apiary_local_id);
                }}
                className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">Selecione a caixa gerada...</option>
                {sortedHives
                  .filter((h) => h.local_id !== division.hive_origin_local_id)
                  .map((h) => (
                    <option key={h.local_id} value={h.local_id}>{h.code}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-stone-400 block mb-1">Meliponário destino</label>
              <select
                value={apiaryDestId}
                onChange={(e) => setApiaryDestId(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">Mesmo meliponário de origem</option>
                {apiaries.map((a) => (
                  <option key={a.local_id} value={a.local_id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-400 block mb-1">Data da execução *</label>
                <input
                  type="date"
                  required
                  value={dividedAt}
                  onChange={(e) => setDividedAt(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs text-stone-400 block mb-1">Executado por *</label>
                <input
                  type="text"
                  required
                  value={dividedBy}
                  onChange={(e) => setDividedBy(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-stone-400 block mb-1">Observações</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setExecOpen(false)} disabled={updateDivision.isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateDivision.isPending} className="flex-1">
                {updateDivision.isPending ? 'Salvando...' : 'Confirmar execução'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
