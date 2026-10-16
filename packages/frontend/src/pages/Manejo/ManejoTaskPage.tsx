import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/utils/dates';
import { getManejoTask, type ManejoPendencia } from './manejoTasks';
import { useManejoPendencias } from './useManejoPendencias';

function agruparPorMeliponario(pendencias: ManejoPendencia[]) {
  const byApiary = new Map<string, { apiaryId: string; apiaryName: string; items: ManejoPendencia[] }>();
  for (const p of pendencias) {
    const grupo = byApiary.get(p.apiaryId);
    if (grupo) grupo.items.push(p);
    else byApiary.set(p.apiaryId, { apiaryId: p.apiaryId, apiaryName: p.apiaryName, items: [p] });
  }
  for (const grupo of byApiary.values()) {
    // Mais antiga primeiro.
    grupo.items.sort((a, b) => a.inspectionDate.localeCompare(b.inspectionDate));
  }
  return [...byApiary.values()].sort((a, b) => a.apiaryName.localeCompare(b.apiaryName));
}

export function ManejoTaskPage() {
  const navigate = useNavigate();
  const { taskKey = '' } = useParams<{ taskKey: string }>();
  const task = getManejoTask(taskKey);

  // Mesmo filtro de meliponário do painel, carregado pela URL.
  const [searchParams] = useSearchParams();
  const apiaryId = searchParams.get('meliponario') ?? '';
  const voltar = () => navigate(`/manejo${apiaryId ? `?meliponario=${apiaryId}` : ''}`);

  const { pendencias, isLoading } = useManejoPendencias(apiaryId || undefined);
  const [selected, setSelected] = useState<string[]>([]);
  const [copiado, setCopiado] = useState(false);

  const doTask = useMemo(
    () => pendencias.filter((p) => p.taskKey === taskKey),
    [pendencias, taskKey]
  );
  const grupos = useMemo(() => agruparPorMeliponario(doTask), [doTask]);

  // A inspeção em lote é de um meliponário só; o roteiro pode cruzar vários.
  const meliponariosSelecionados = useMemo(
    () => new Set(doTask.filter((p) => selected.includes(p.colonyId)).map((p) => p.apiaryId)).size,
    [doTask, selected]
  );
  const loteBloqueado = meliponariosSelecionados > 1;

  const toggle = (colonyId: string) =>
    setSelected((prev) =>
      prev.includes(colonyId) ? prev.filter((id) => id !== colonyId) : [...prev, colonyId]
    );

  const toggleApiary = (items: ManejoPendencia[]) => {
    const ids = items.map((i) => i.colonyId);
    const todasMarcadas = ids.every((id) => selected.includes(id));
    setSelected((prev) =>
      todasMarcadas
        ? prev.filter((id) => !ids.includes(id))
        : [...new Set([...prev, ...ids])]
    );
  };

  const copiarRoteiro = async () => {
    const escolhidas = doTask.filter((p) => selected.includes(p.colonyId));
    if (escolhidas.length === 0) return;

    const linhas: string[] = [
      (task?.labelPendente ?? 'Manejo') + ' — ' + escolhidas.length + ' caixa(s)',
    ];
    for (const grupo of agruparPorMeliponario(escolhidas)) {
      linhas.push('', grupo.apiaryName);
      for (const p of grupo.items) {
        const dias = p.daysSince === 1 ? '1 dia' : p.daysSince + ' dias';
        linhas.push('- ' + p.colonyCode + ' (' + dias + ')');
      }
    }
    const texto = linhas.join('\n');

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        // Fallback para contexto sem Clipboard API (http, WebView antiga)
        const ta = document.createElement('textarea');
        ta.value = texto;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch (err) {
      console.error('[ManejoTaskPage] falha ao copiar roteiro:', err);
    }
  };

  const inspecionarEmLote = () => {
    if (selected.length === 0 || loteBloqueado) return;
    navigate('/inspections/batch', { state: { colonyIds: selected, manejoKey: taskKey } });
  };

  if (!task) {
    return (
      <EmptyState
        icon="❓"
        title="Manejo não encontrado"
        description="Esse manejo não existe no catálogo."
        action={{ label: 'Voltar ao painel', onClick: voltar }}
      />
    );
  }

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    // pb generoso: a barra de ação é fixa e não pode cobrir a última linha
    <div className="space-y-6 pb-32">
      <div className="flex items-start gap-3">
        <button
          onClick={voltar}
          className="text-stone-500 hover:text-stone-300 text-2xl leading-none mt-1"
          aria-label="Voltar"
        >
          &lsaquo;
        </button>
        <span className={`text-2xl ${task.colorClass}`}>{task.icon}</span>
        <div>
          <h1 className="text-2xl font-bold text-stone-100">{task.labelPendente}</h1>
          <p className="text-stone-500 text-sm">
            {doTask.length} caixa{doTask.length !== 1 ? 's' : ''} pendente{doTask.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {doTask.length === 0 ? (
        <EmptyState
          icon="✅"
          title="Nada pendente aqui"
          description="Nenhuma caixa está com esse manejo pendente na última inspeção."
          action={{ label: 'Voltar ao painel', onClick: voltar }}
        />
      ) : (
        <div className="space-y-5">
          {grupos.map((grupo) => {
            const ids = grupo.items.map((i) => i.colonyId);
            const todasMarcadas = ids.every((id) => selected.includes(id));

            return (
              <div key={grupo.apiaryId} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-stone-300">
                    {grupo.apiaryName}
                    <span className="text-stone-600 font-normal"> · {grupo.items.length}</span>
                  </h2>
                  <button
                    onClick={() => toggleApiary(grupo.items)}
                    className="text-xs text-amber-400 hover:text-amber-300"
                  >
                    {todasMarcadas ? 'Desmarcar todas' : 'Selecionar todas'}
                  </button>
                </div>

                <div className="space-y-2">
                  {grupo.items.map((p) => {
                    const checked = selected.includes(p.colonyId);
                    return (
                      <Card
                        key={p.colonyId}
                        hover
                        className={checked ? 'border-amber-500/40' : undefined}
                        onClick={() => navigate(`/hives/${p.colonyId}`)}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(p.colonyId)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 w-5 h-5 shrink-0 accent-amber-500"
                            aria-label={`Selecionar ${p.colonyCode}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-stone-100">{p.colonyCode}</p>
                            <p className="text-xs text-stone-500 mt-0.5">
                              pendente desde {formatDate(p.inspectionDate)} · há {p.daysSince} dia{p.daysSince !== 1 ? 's' : ''}
                            </p>
                            {p.note && (
                              <p className="text-xs text-stone-400 mt-1 line-clamp-2">{p.note}</p>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Barra de ação fixa */}
      {selected.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-stone-900 border-t border-stone-800 pb-safe lg:left-60">
          <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm text-stone-300 font-medium">
                {selected.length} selecionada{selected.length !== 1 ? 's' : ''}
              </p>
              {loteBloqueado && (
                <p className="text-xs text-amber-400">
                  Lote é por meliponário: deixe marcadas caixas de um só.
                </p>
              )}
            </div>
            <div className="flex gap-2 ml-auto">
              <Button variant="secondary" size="sm" onClick={copiarRoteiro}>
                {copiado ? '✓ Copiado' : 'Copiar roteiro'}
              </Button>
              <Button size="sm" onClick={inspecionarEmLote} disabled={loteBloqueado}>
                Registrar manejo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
