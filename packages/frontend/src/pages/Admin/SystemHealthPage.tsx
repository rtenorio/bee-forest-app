import { useSystemHealth, useRefreshSystemHealth } from '@/hooks/useSystemHealth';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Status dot ──────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'ok' | 'error' | string }) {
  const ok = status === 'ok';
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-500'} shrink-0`}
    />
  );
}

// ─── Service card ─────────────────────────────────────────────────────────────

function ServiceCard({
  icon,
  label,
  status,
  detail,
}: {
  icon: string;
  label: string;
  status: 'ok' | 'error' | string;
  detail?: string;
}) {
  const ok = status === 'ok';
  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-xl border ${
        ok
          ? 'bg-emerald-950/30 border-emerald-800/40'
          : 'bg-red-950/30 border-red-800/40'
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-stone-200">{label}</p>
        {detail && <p className="text-xs text-stone-400 truncate">{detail}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <StatusDot status={status} />
        <span
          className={`text-xs font-semibold uppercase tracking-wide ${
            ok ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {ok ? 'Online' : 'Erro'}
        </span>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="bg-stone-800/60 border border-stone-700/50 rounded-xl p-4 text-center">
      <p className="text-2xl mb-1">{icon}</p>
      <p className="text-2xl font-bold text-stone-100">{value.toLocaleString('pt-BR')}</p>
      <p className="text-xs text-stone-400 mt-0.5">{label}</p>
    </div>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-3">
      {children}
    </h2>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SystemHealthPage() {
  const { data, isLoading, dataUpdatedAt } = useSystemHealth();
  const refresh = useRefreshSystemHealth();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Saúde do Sistema</h1>
          <p className="text-stone-500 text-sm">
            Atualização automática a cada 60s
            {dataUpdatedAt > 0 && (
              <> · Última: {new Date(dataUpdatedAt).toLocaleTimeString('pt-BR')}</>
            )}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-800 border border-stone-700 text-stone-300 text-sm hover:bg-stone-700 transition-colors disabled:opacity-50"
        >
          {isLoading ? <Spinner size="sm" /> : '↻'}
          Atualizar agora
        </button>
      </div>

      {isLoading && !data ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : !data ? null : (
        <>
          {/* ── Serviços ── */}
          <section>
            <SectionTitle>Serviços</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <ServiceCard
                icon="🗄️"
                label="Banco de dados"
                status={data.services.database}
              />
              <ServiceCard
                icon="☁️"
                label="Armazenamento R2"
                status={data.services.r2}
              />
              <div className="flex items-center gap-3 p-4 rounded-xl border bg-stone-800/40 border-stone-700/50">
                <span className="text-2xl">⏱️</span>
                <div>
                  <p className="text-sm font-semibold text-stone-200">Uptime</p>
                  <p className="text-lg font-bold text-amber-400">
                    {formatUptime(data.services.uptime_seconds)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Estatísticas ── */}
          <section>
            <SectionTitle>Estatísticas</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon="🏠" label="Caixas ativas"          value={data.stats.total_hives} />
              <StatCard icon="🔍" label="Total de inspeções"     value={data.stats.total_inspections} />
              <StatCard icon="👥" label="Usuários ativos"        value={data.stats.total_users} />
              <StatCard icon="📅" label="Inspeções (7 dias)"     value={data.stats.inspections_last_7_days} />
            </div>
          </section>

          {/* ── Último backup ── */}
          <section>
            <SectionTitle>Último backup</SectionTitle>
            <Card>
              <div className="flex items-center gap-4">
                <span className="text-3xl">💾</span>
                <div className="flex-1">
                  <p className="font-semibold text-stone-200">
                    {formatDate(data.last_backup.timestamp)}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Backup automático diário · PostgreSQL → Cloudflare R2
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StatusDot
                    status={data.last_backup.status === 'ok' ? 'ok' : 'error'}
                  />
                  <span
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      data.last_backup.status === 'ok'
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {data.last_backup.status === 'ok'
                      ? 'OK'
                      : data.last_backup.status === 'not_found'
                      ? 'Não encontrado'
                      : 'Desconhecido'}
                  </span>
                </div>
              </div>
            </Card>
          </section>

          {/* ── Atividade recente / sync ── */}
          <section>
            <SectionTitle>
              Atividade recente (24h)
              {data.sync_pending.total > 0 && (
                <span className="ml-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs px-2 py-0.5 rounded-full normal-case font-medium">
                  {data.sync_pending.total} operações
                </span>
              )}
            </SectionTitle>
            {data.sync_pending.by_user.length === 0 ? (
              <Card>
                <p className="text-stone-500 text-sm text-center py-4">
                  Nenhuma atividade registrada nas últimas 24h.
                </p>
              </Card>
            ) : (
              <Card>
                <div className="divide-y divide-stone-800">
                  {data.sync_pending.by_user.map((u) => (
                    <div key={u.user_id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-stone-700 flex items-center justify-center text-stone-300 text-xs font-bold shrink-0">
                          {u.user_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-stone-200">{u.user_name}</span>
                      </div>
                      <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        {u.count} op.
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </section>

          {/* ── Erros de mídia ── */}
          {data.media_errors_24h > 0 && (
            <section>
              <SectionTitle>Alertas</SectionTitle>
              <div className="flex items-center gap-3 p-4 rounded-xl border bg-red-950/30 border-red-800/40">
                <span className="text-2xl">⚠️</span>
                <p className="text-sm text-red-300">
                  <span className="font-bold">{data.media_errors_24h}</span> erro{data.media_errors_24h !== 1 ? 's' : ''} de upload de mídia nas últimas 24h.
                </p>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
