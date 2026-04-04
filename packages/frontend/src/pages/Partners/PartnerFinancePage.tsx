import { usePartnerFinancePanel } from '@/hooks/usePartners';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useNavigate } from 'react-router-dom';

function fmtCurrency(v: number | string | null | undefined) {
  const n = Number(v);
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

export function PartnerFinancePage() {
  const navigate = useNavigate();
  const { data: partners = [], isLoading } = usePartnerFinancePanel();

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  const totalPaid = partners.reduce((s, p) => s + Number(p.total_paid), 0);
  const totalPending = partners.reduce((s, p) => s + Number(p.total_pending), 0);
  const totalOverdue = partners.reduce((s, p) => s + Number(p.total_overdue), 0);
  const partnersWithOverdue = partners.filter((p) => Number(p.total_overdue) > 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <button
          onClick={() => navigate('/partners')}
          className="text-stone-400 hover:text-stone-200 text-sm mb-2 transition-colors"
        >
          ← Parceiros
        </button>
        <h1 className="text-2xl font-bold text-stone-100">Painel Financeiro</h1>
        <p className="text-stone-500 text-sm">Resumo de pagamentos a parceiros</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <p className="text-xl font-bold text-emerald-400">{fmtCurrency(totalPaid)}</p>
          <p className="text-xs text-stone-500 mt-0.5">Total pago</p>
        </Card>
        <Card className="text-center">
          <p className="text-xl font-bold text-amber-400">{fmtCurrency(totalPending)}</p>
          <p className="text-xs text-stone-500 mt-0.5">Total pendente</p>
        </Card>
        <Card className="text-center">
          <p className="text-xl font-bold text-red-400">{fmtCurrency(totalOverdue)}</p>
          <p className="text-xs text-stone-500 mt-0.5">Total atrasado</p>
        </Card>
      </div>

      {/* Overdue alerts */}
      {partnersWithOverdue.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-3">
          <p className="text-red-400 font-medium text-sm">🔴 Pagamentos atrasados</p>
          {partnersWithOverdue.map((p) => (
            <div key={p.partner_id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-stone-200 text-sm font-medium">{p.partner_name}</span>
                <span className="text-red-400 font-bold text-sm">{fmtCurrency(p.total_overdue)}</span>
              </div>
              {(p.overdue_payments as { id: number; installment: number; amount: number; due_date: string }[]).map((op) => (
                <div key={op.id} className="flex items-center justify-between text-xs text-stone-500 ml-3">
                  <span>Parcela {op.installment} — venc. {new Date(op.due_date).toLocaleDateString('pt-BR')}</span>
                  <span>{fmtCurrency(op.amount)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Per-partner breakdown */}
      <div>
        <h2 className="text-sm font-medium text-stone-400 uppercase tracking-wider mb-3">
          Por parceiro
        </h2>
        {partners.length === 0 ? (
          <p className="text-stone-500 text-sm">Nenhum dado financeiro disponível.</p>
        ) : (
          <div className="space-y-2">
            {partners.map((p) => (
              <Card
                key={p.partner_id}
                hover
                onClick={() => navigate(`/partners/${p.partner_local_id}`)}
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <p className="font-medium text-stone-200 truncate">{p.partner_name}</p>
                    {Number(p.total_overdue) > 0 && <Badge variant="danger">Atrasado</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-sm shrink-0">
                    <div className="text-right">
                      <p className="text-emerald-400 font-medium">{fmtCurrency(p.total_paid)}</p>
                      <p className="text-xs text-stone-500">pago</p>
                    </div>
                    {Number(p.total_pending) > 0 && (
                      <div className="text-right">
                        <p className="text-amber-400 font-medium">{fmtCurrency(p.total_pending)}</p>
                        <p className="text-xs text-stone-500">pendente</p>
                      </div>
                    )}
                    {Number(p.total_overdue) > 0 && (
                      <div className="text-right">
                        <p className="text-red-400 font-bold">{fmtCurrency(p.total_overdue)}</p>
                        <p className="text-xs text-stone-500">atrasado</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
