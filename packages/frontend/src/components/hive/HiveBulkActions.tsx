import { useState } from 'react';
import { useBulkHiveAction, type HiveBulkAction } from '@/hooks/useHives';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/utils/cn';
import type { Hive } from '@bee-forest/shared';

/**
 * Camada clicável sobre o HiveCard no modo de seleção: o toque marca a caixa
 * em vez de abrir o detalhe.
 */
export function HiveSelectOverlay({ checked, onToggle, code }: { checked: boolean; onToggle: () => void; code: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      aria-label={`${checked ? 'Desmarcar' : 'Selecionar'} ${code}`}
      className={cn(
        'absolute inset-0 z-10 rounded-xl border-2 transition-colors text-left',
        checked ? 'border-amber-500 bg-amber-500/10' : 'border-transparent hover:border-stone-600',
      )}
    >
      <span
        className={cn(
          'absolute top-2 right-2 w-6 h-6 rounded-md border-2 flex items-center justify-center text-xs font-bold',
          checked ? 'bg-amber-500 border-amber-500 text-stone-950' : 'bg-stone-900/90 border-stone-500',
        )}
      >
        {checked ? '✓' : ''}
      </span>
    </button>
  );
}

/** Barra do topo da lista no modo de seleção. */
export function HiveSelectToolbar({ total, selected, onSelectAll, onClear, onExit }: {
  total: number;
  selected: number;
  onSelectAll: () => void;
  onClear: () => void;
  onExit: () => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap text-sm bg-stone-900 border border-stone-800 rounded-xl px-3 py-2">
      <span className="text-stone-300">{selected} de {total} selecionada{selected !== 1 ? 's' : ''}</span>
      <button onClick={selected === total ? onClear : onSelectAll} className="text-amber-400 hover:text-amber-300">
        {selected === total ? 'Desmarcar todas' : `Selecionar todas (${total})`}
      </button>
      <button onClick={onExit} className="ml-auto text-stone-400 hover:text-stone-200">Sair da seleção</button>
    </div>
  );
}

const MAX_CODIGOS = 12;
const PALAVRA_EXCLUIR = 'EXCLUIR';

const TEXTO: Record<HiveBulkAction, { titulo: string; botao: string }> = {
  inactivate: { titulo: 'Inativar caixas', botao: 'Inativar' },
  activate: { titulo: 'Reativar caixas', botao: 'Reativar' },
  delete: { titulo: 'Excluir caixas', botao: 'Excluir' },
};

/**
 * Barra fixa com as ações em lote. Inativar só altera caixas ativas e
 * reativar só as inativas — mortas e transferidas ficam como estão, porque
 * esses status têm significado próprio. Excluir vale para todas e pede que se
 * digite EXCLUIR.
 */
export function HiveBulkBar({ selected, onDone }: { selected: Hive[]; onDone: () => void }) {
  const bulk = useBulkHiveAction();
  const [acao, setAcao] = useState<HiveBulkAction | null>(null);
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const ativas = selected.filter((h) => h.status === 'active');
  const inativas = selected.filter((h) => h.status === 'inactive');

  if (selected.length === 0) return null;

  const alvo = acao === 'inactivate' ? ativas : acao === 'activate' ? inativas : selected;
  const ignoradas = selected.length - alvo.length;
  const podeConfirmar = acao !== 'delete' || confirmacao.trim().toUpperCase() === PALAVRA_EXCLUIR;

  const abrir = (a: HiveBulkAction) => { setAcao(a); setConfirmacao(''); setErro(null); };
  const fechar = () => { if (!bulk.isPending) setAcao(null); };

  const executar = async () => {
    if (!acao || alvo.length === 0 || !podeConfirmar) return;
    setErro(null);
    try {
      await bulk.mutateAsync({ action: acao, ids: alvo.map((h) => h.local_id) });
      setAcao(null);
      onDone();
    } catch (err) {
      console.error('[HiveBulkBar] falha na ação em lote:', err);
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-stone-900 border-t border-stone-800 pb-safe lg:left-60">
        <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
          <p className="text-sm text-stone-300 font-medium mr-auto">
            {selected.length} selecionada{selected.length !== 1 ? 's' : ''}
          </p>
          <Button variant="secondary" size="sm" onClick={() => abrir('inactivate')} disabled={ativas.length === 0}>
            Inativar{ativas.length > 0 ? ` (${ativas.length})` : ''}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => abrir('activate')} disabled={inativas.length === 0}>
            Reativar{inativas.length > 0 ? ` (${inativas.length})` : ''}
          </Button>
          <Button variant="danger" size="sm" onClick={() => abrir('delete')}>
            Excluir ({selected.length})
          </Button>
        </div>
      </div>

      <Modal open={acao !== null} onClose={fechar} title={acao ? TEXTO[acao].titulo : ''} size="sm">
        {acao && (
          <div className="space-y-4 text-sm">
            <p className="text-stone-300">
              {alvo.length} caixa{alvo.length !== 1 ? 's' : ''}:{' '}
              <span className="text-stone-400">
                {alvo.slice(0, MAX_CODIGOS).map((h) => h.code).join(', ')}
                {alvo.length > MAX_CODIGOS ? ` e mais ${alvo.length - MAX_CODIGOS}` : ''}
              </span>
            </p>

            {ignoradas > 0 && (
              <p className="text-xs text-stone-500">
                {ignoradas} selecionada{ignoradas !== 1 ? 's' : ''} não {ignoradas !== 1 ? 'mudam' : 'muda'}: {acao === 'inactivate' ? 'só caixas ativas são inativadas' : 'só caixas inativas são reativadas'}.
              </p>
            )}

            {acao === 'inactivate' && (
              <p className="text-xs text-stone-400">
                Caixas inativas saem do Painel de Manejo e da inspeção em lote, mas o histórico continua consultável e elas podem ser reativadas.
              </p>
            )}

            {acao === 'delete' && (
              <>
                <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  As caixas somem do app e não há como restaurá-las pela tela. Se a ideia é só tirá-las de circulação, prefira Inativar.
                </p>
                <label className="block text-xs text-stone-400">
                  Digite <span className="font-semibold text-stone-200">{PALAVRA_EXCLUIR}</span> para confirmar
                  <input
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                    autoFocus
                    className="mt-1 w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 focus:outline-none focus:border-red-500"
                  />
                </label>
              </>
            )}

            {erro && (
              <p className="text-xs text-red-300">Erro: {erro}. As caixas já processadas mantêm a alteração.</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={fechar} disabled={bulk.isPending}>Cancelar</Button>
              <Button
                variant={acao === 'delete' ? 'danger' : 'primary'}
                size="sm"
                onClick={executar}
                loading={bulk.isPending}
                disabled={alvo.length === 0 || !podeConfirmar}
              >
                {TEXTO[acao].botao} {alvo.length}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
