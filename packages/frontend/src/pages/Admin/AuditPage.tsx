import { useState } from 'react';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';

// ─── Constants ────────────────────────────────────────────────────────────────

const RESOURCE_TYPE_OPTIONS = [
  { value: '', label: 'Todos os recursos' },
  { value: 'hive', label: 'Caixa de abelha' },
  { value: 'inspection', label: 'Inspeção' },
  { value: 'instruction', label: 'Orientação' },
  { value: 'harvest', label: 'Colheita' },
  { value: 'feeding', label: 'Alimentação' },
  { value: 'production', label: 'Produção' },
  { value: 'division', label: 'Divisão' },
  { value: 'stock_item', label: 'Item de estoque' },
  { value: 'melgueira', label: 'Melgueira' },
  { value: 'apiary', label: 'Meliponário' },
  { value: 'user', label: 'Usuário' },
];

const ACTION_OPTIONS = [
  { value: '', label: 'Todas as ações' },
  { value: 'CREATE', label: 'Criação' },
  { value: 'UPDATE', label: 'Atualização' },
  { value: 'DELETE', label: 'Exclusão' },
];

const PERIOD_OPTIONS = [
  { value: '', label: 'Todo o período' },
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
];

// ─── Action badge ─────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    CREATE: 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50',
    UPDATE: 'bg-amber-900/40 text-amber-300 border border-amber-700/50',
    DELETE: 'bg-red-900/40 text-red-300 border border-red-700/50',
  };
  const labels: Record<string, string> = {
    CREATE: 'Criação',
    UPDATE: 'Atualização',
    DELETE: 'Exclusão',
  };
  const cls = styles[action] ?? 'bg-stone-800 text-stone-400 border border-stone-700';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
      {labels[action] ?? action}
    </span>
  );
}

// ─── Resource type label ──────────────────────────────────────────────────────

function resourceLabel(type: string | null): string {
  const map: Record<string, string> = {
    hive: 'Caixa',
    inspection: 'Inspeção',
    instruction: 'Orientação',
    harvest: 'Colheita',
    feeding: 'Alimentação',
    production: 'Produção',
    division: 'Divisão',
    stock_item: 'Estoque',
    melgueira: 'Melgueira',
    apiary: 'Meliponário',
    user: 'Usuário',
  };
  return type ? (map[type] ?? type) : '—';
}

// ─── Role label ───────────────────────────────────────────────────────────────

function roleLabel(role: string | null): string {
  const map: Record<string, string> = {
    master_admin: 'Master Admin',
    socio: 'Sócio',
    orientador: 'Orientador',
    responsavel: 'Responsável',
    tratador: 'Tratador',
  };
  return role ? (map[role] ?? role) : '—';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [resourceType, setResourceType] = useState('');
  const [action, setAction] = useState('');
  const [period, setPeriod] = useState('');

  function periodToDates(days: string): { date_from?: string; date_to?: string } {
    if (!days) return {};
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - parseInt(days, 10));
    return {
      date_from: from.toISOString(),
      date_to: to.toISOString(),
    };
  }

  const { date_from, date_to } = periodToDates(period);

  const { data, isLoading } = useAuditLogs({
    page,
    limit: 50,
    resource_type: resourceType || undefined,
    action: action || undefined,
    date_from,
    date_to,
  });

  function handleFilterChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLSelectElement>) => {
      setter(e.target.value);
      setPage(1);
    };
  }

  const selectCls =
    'bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500';

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-100">Trilha de Auditoria</h1>
        <p className="text-stone-500 text-sm">
          Registro de todas as operações realizadas no sistema
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <select value={resourceType} onChange={handleFilterChange(setResourceType)} className={selectCls}>
          {RESOURCE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={action} onChange={handleFilterChange(setAction)} className={selectCls}>
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={period} onChange={handleFilterChange(setPeriod)} className={selectCls}>
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {data && (
          <span className="text-stone-500 text-sm self-center ml-auto">
            {data.total} registro{data.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <>
          <Card>
            <div className="overflow-x-auto -mx-4 -my-4 sm:-mx-6 sm:-my-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-700 text-left">
                    <th className="px-4 py-3 text-stone-400 font-medium whitespace-nowrap">Data/hora</th>
                    <th className="px-4 py-3 text-stone-400 font-medium">Usuário</th>
                    <th className="px-4 py-3 text-stone-400 font-medium hidden sm:table-cell">Perfil</th>
                    <th className="px-4 py-3 text-stone-400 font-medium">Ação</th>
                    <th className="px-4 py-3 text-stone-400 font-medium hidden md:table-cell">Recurso</th>
                    <th className="px-4 py-3 text-stone-400 font-medium">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-stone-500">
                        Nenhum registro encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    data?.logs.map((log) => (
                      <tr key={log.id} className="border-b border-stone-800 hover:bg-stone-800/40 transition-colors">
                        <td className="px-4 py-3 text-stone-400 whitespace-nowrap font-mono text-xs">
                          {new Date(log.timestamp).toLocaleString('pt-BR', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3 text-stone-200">
                          {log.user_name ?? <span className="text-stone-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-stone-400 hidden sm:table-cell text-xs">
                          {roleLabel(log.user_role)}
                        </td>
                        <td className="px-4 py-3">
                          <ActionBadge action={log.action} />
                        </td>
                        <td className="px-4 py-3 text-stone-400 hidden md:table-cell text-xs">
                          {resourceLabel(log.resource_type)}
                        </td>
                        <td className="px-4 py-3 text-stone-300 max-w-xs">
                          <span className="truncate block">
                            {log.resource_label ?? log.resource_id ?? <span className="text-stone-600">—</span>}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Paginação */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg bg-stone-800 text-stone-300 text-sm disabled:opacity-40 hover:bg-stone-700 transition-colors"
              >
                ← Anterior
              </button>
              <span className="text-stone-500 text-sm">
                Página {data.page} de {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="px-3 py-1.5 rounded-lg bg-stone-800 text-stone-300 text-sm disabled:opacity-40 hover:bg-stone-700 transition-colors"
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
