import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getManejoTask, type ManejoPendencia } from './manejoTasks';
import { useManejoPendencias } from './useManejoPendencias';

const MAX_GRUPOS = 4;

/**
 * Resumo do Painel de Manejo para os dashboards. Usa o mesmo hook do painel,
 * então respeita o escopo do tratador. Some quando não há pendência — o
 * painel em si é quem explica o estado vazio.
 */
export function ManejoResumo() {
  const navigate = useNavigate();
  const { grupos, pendencias, isLoading } = useManejoPendencias();

  if (isLoading || grupos.length === 0) return null;

  const totalCaixas = new Set(pendencias.map((p) => p.colonyId)).size;
  const visiveis = grupos.slice(0, MAX_GRUPOS);
  const restantes = grupos.length - visiveis.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>🛠️ Manejo pendente</CardTitle>
        <button onClick={() => navigate('/manejo')} className="text-xs text-amber-500 hover:text-amber-400">
          Ver painel →
        </button>
      </CardHeader>
      <p className="text-xs text-stone-500 -mt-2 mb-3">
        {pendencias.length} pendência{pendencias.length !== 1 ? 's' : ''} em {totalCaixas} caixa{totalCaixas !== 1 ? 's' : ''}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {visiveis.map((grupo) => {
          const task = getManejoTask(grupo.taskKey);
          if (!task) return null;
          const count = grupo.pendencias.length;
          return (
            <button
              key={grupo.taskKey}
              onClick={() => navigate(`/manejo/${grupo.taskKey}`)}
              className="flex items-center gap-3 text-left px-3 py-2 rounded-lg bg-stone-800/50 hover:bg-stone-800 transition-colors"
            >
              <span className={`text-xl shrink-0 ${task.colorClass}`}>{task.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-stone-100 truncate">{task.labelPendente}</p>
                <p className="text-xs text-stone-500">
                  {count} caixa{count !== 1 ? 's' : ''} · mais antiga há {grupo.oldestDays} dia{grupo.oldestDays !== 1 ? 's' : ''}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      {restantes > 0 && (
        <p className="text-xs text-stone-500 mt-2">
          + {restantes} outro{restantes !== 1 ? 's' : ''} manejo{restantes !== 1 ? 's' : ''} no painel
        </p>
      )}
    </Card>
  );
}

/**
 * Pendências de uma colônia, para o detalhe da caixa. Recebe as pendências já
 * derivadas (a tela tem as inspeções da caixa em mãos) e oferece o registro
 * do manejo direto daqui, pelo mesmo fluxo do painel.
 */
export function ManejoPendenteDaCaixa({ pendencias }: { pendencias: ManejoPendencia[] }) {
  const navigate = useNavigate();
  if (pendencias.length === 0) return null;

  const ordenadas = [...pendencias].sort((a, b) => b.daysSince - a.daysSince);
  const note = ordenadas[0].note;

  return (
    <Card>
      <CardHeader><CardTitle>🛠️ Manejo pendente</CardTitle></CardHeader>
      <div className="space-y-2">
        {ordenadas.map((p) => {
          const task = getManejoTask(p.taskKey);
          if (!task) return null;
          return (
            <div key={p.taskKey} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-stone-800/50">
              <span className={`text-xl shrink-0 ${task.colorClass}`}>{task.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-stone-100">{task.labelPendente}</p>
                <p className="text-xs text-stone-500">há {p.daysSince} dia{p.daysSince !== 1 ? 's' : ''}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/inspections/batch', { state: { colonyIds: [p.colonyId], manejoKey: p.taskKey } })}
              >
                Registrar
              </Button>
            </div>
          );
        })}
      </div>
      {note && <p className="text-xs text-stone-400 italic mt-2">"{note}"</p>}
    </Card>
  );
}
