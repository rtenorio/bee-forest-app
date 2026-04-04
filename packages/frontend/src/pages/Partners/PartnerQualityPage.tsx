import { usePartnerQualityPanel } from '@/hooks/usePartners';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useNavigate } from 'react-router-dom';

export function PartnerQualityPage() {
  const navigate = useNavigate();
  const { data: partners = [], isLoading } = usePartnerQualityPanel();

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  const withPendingTests = partners.filter((p) => p.pending_test_count > 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button
            onClick={() => navigate('/partners')}
            className="text-stone-400 hover:text-stone-200 text-sm mb-2 transition-colors"
          >
            ← Parceiros
          </button>
          <h1 className="text-2xl font-bold text-stone-100">Painel de Qualidade</h1>
          <p className="text-stone-500 text-sm">Análise de qualidade por parceiro</p>
        </div>
      </div>

      {/* Alertas: testes pendentes */}
      {withPendingTests.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <p className="text-amber-400 font-medium text-sm mb-2">⏳ Entregas aguardando teste de qualidade</p>
          <div className="space-y-1">
            {withPendingTests.map((p) => (
              <div key={p.partner_id} className="flex items-center justify-between text-sm">
                <span className="text-stone-300">{p.partner_name}</span>
                <Badge variant="warning">{p.pending_test_count} pendente{p.pending_test_count !== 1 ? 's' : ''}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ranking */}
      <div>
        <h2 className="text-sm font-medium text-stone-400 uppercase tracking-wider mb-3">
          Ranking por taxa de aprovação
        </h2>
        {partners.length === 0 ? (
          <p className="text-stone-500 text-sm">Nenhum dado disponível.</p>
        ) : (
          <div className="space-y-2">
            {partners.map((p, i) => (
              <Card
                key={p.partner_id}
                hover
                onClick={() => navigate(`/partners/${p.partner_local_id}`)}
              >
                <div className="flex items-center gap-4">
                  <span className="text-stone-600 font-bold text-lg w-6 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-stone-200">{p.partner_name}</p>
                      {p.approval_rate != null && (
                        <Badge variant={p.approval_rate >= 80 ? 'success' : p.approval_rate >= 50 ? 'warning' : 'danger'}>
                          {p.approval_rate}%
                        </Badge>
                      )}
                      {p.pending_test_count > 0 && (
                        <Badge variant="warning">{p.pending_test_count} aguardando</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-stone-500">
                      <span>{p.total_deliveries} entrega{p.total_deliveries !== 1 ? 's' : ''}</span>
                      <span className="text-emerald-400">{p.approved} aprovadas</span>
                      {p.rejected > 0 && <span className="text-red-400">{p.rejected} reprovadas</span>}
                      {p.avg_hmf != null && <span>HMF médio: {p.avg_hmf} mg/kg</span>}
                      {p.avg_moisture != null && <span>Umidade média: {p.avg_moisture}%</span>}
                    </div>

                    {/* Progress bar */}
                    {p.total_deliveries > 0 && (
                      <div className="mt-2 h-1.5 bg-stone-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            (p.approval_rate ?? 0) >= 80 ? 'bg-emerald-500' :
                            (p.approval_rate ?? 0) >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${p.approval_rate ?? 0}%` }}
                        />
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
