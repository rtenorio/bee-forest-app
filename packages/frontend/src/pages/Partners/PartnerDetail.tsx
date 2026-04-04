import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  usePartner,
  useCreatePartnerApiary,
  useCreateEquipmentLoan,
  useReturnLoan,
  useCreateDelivery,
  useCreateQualityTest,
  usePayInstallment,
} from '@/hooks/usePartners';
import { useUpdatePartner } from '@/hooks/usePartners';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { PartnerForm } from './PartnerForm';
import type {
  PartnerDelivery, PartnerEquipmentLoan, PartnerPayment, PartnerQualityTest,
  PartnerApiaryCreate, EquipmentLoanCreate, DeliveryCreate, QualityTestCreate,
} from '@bee-forest/shared';

type Tab = 'resumo' | 'apiaries' | 'loans' | 'deliveries' | 'payments';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'resumo', label: 'Resumo', icon: '📊' },
  { id: 'apiaries', label: 'Meliponários', icon: '🏡' },
  { id: 'loans', label: 'Comodato', icon: '📦' },
  { id: 'deliveries', label: 'Entregas', icon: '🫙' },
  { id: 'payments', label: 'Pagamentos', icon: '💰' },
];

function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('pt-BR');
}

function fmtCurrency(v: number | null | undefined) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function qualityBadge(status: string) {
  if (status === 'approved') return <Badge variant="success">Aprovado</Badge>;
  if (status === 'approved_with_observation') return <Badge variant="warning">Ap. c/ obs.</Badge>;
  if (status === 'rejected') return <Badge variant="danger">Reprovado</Badge>;
  return <Badge variant="default">Aguardando</Badge>;
}

function paymentBadge(status: string) {
  if (status === 'paid') return <Badge variant="success">Pago</Badge>;
  if (status === 'overdue') return <Badge variant="danger">Atrasado</Badge>;
  if (status === 'cancelled') return <Badge variant="default">Cancelado</Badge>;
  return <Badge variant="warning">Pendente</Badge>;
}

export function PartnerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;
  const canManage = user.role === 'responsavel' || user.role === 'socio' || user.role === 'master_admin';
  const canEdit = user.role === 'socio' || user.role === 'master_admin';

  const [tab, setTab] = useState<Tab>('resumo');
  const [editOpen, setEditOpen] = useState(false);
  const [apiaryModal, setApiaryModal] = useState(false);
  const [loanModal, setLoanModal] = useState(false);
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [qualityModal, setQualityModal] = useState<number | null>(null); // delivery.id
  const [payModal, setPayModal] = useState<string | null>(null); // payment.local_id

  const { data: partner, isLoading } = usePartner(id!);

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!partner) return <div className="text-stone-400 text-center py-16">Parceiro não encontrado.</div>;

  const totalVolume = partner.deliveries
    .filter((d) => d.quality_status !== 'rejected')
    .reduce((s, d) => s + (d.accepted_volume_ml ?? 0), 0);
  const totalWeight = partner.deliveries
    .filter((d) => d.quality_status !== 'rejected')
    .reduce((s, d) => s + (Number(d.accepted_weight_kg) ?? 0), 0);
  const totalPaid = partner.payments
    .filter((p) => p.status === 'paid')
    .reduce((s, p) => s + Number(p.amount), 0);
  const approvalRate = partner.deliveries.length > 0
    ? (partner.deliveries.filter((d) => d.quality_status === 'approved' || d.quality_status === 'approved_with_observation').length / partner.deliveries.length * 100).toFixed(0)
    : null;
  const activeLoans = partner.loans.filter((l) => l.status === 'active');
  const pendingPayments = partner.payments.filter((p) => p.status === 'pending' || p.status === 'overdue');

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={() => navigate('/partners')}
            className="text-stone-400 hover:text-stone-200 text-sm mb-2 transition-colors"
          >
            ← Parceiros
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-stone-100">{partner.full_name}</h1>
            <Badge variant={partner.status === 'active' ? 'success' : partner.status === 'suspended' ? 'warning' : 'default'}>
              {partner.status === 'active' ? 'Ativo' : partner.status === 'suspended' ? 'Suspenso' : 'Inativo'}
            </Badge>
          </div>
          {partner.city && (
            <p className="text-stone-500 text-sm mt-0.5">{partner.city}{partner.state ? `, ${partner.state}` : ''}</p>
          )}
        </div>
        {canEdit && (
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            Editar
          </Button>
        )}
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-stone-800 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
              tab === t.id
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            )}
          >
            <span className="text-base">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab: Resumo ─────────────────────────────────────────────────────── */}
      {tab === 'resumo' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Volume aprovado', value: totalVolume > 0 ? `${(totalVolume / 1000).toFixed(1)} L` : '—', color: 'text-amber-400' },
              { label: 'Peso aprovado', value: totalWeight > 0 ? `${totalWeight.toFixed(2)} kg` : '—', color: 'text-amber-400' },
              { label: 'Taxa de aprovação', value: approvalRate != null ? `${approvalRate}%` : '—', color: 'text-emerald-400' },
              { label: 'Total pago', value: fmtCurrency(totalPaid), color: 'text-emerald-400' },
            ].map((s) => (
              <Card key={s.label} className="text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-stone-500 mt-0.5">{s.label}</p>
              </Card>
            ))}
          </div>

          {/* Últimas entregas */}
          {partner.deliveries.length > 0 && (
            <Card>
              <h3 className="font-medium text-stone-200 mb-3 text-sm">Últimas entregas</h3>
              <div className="space-y-2">
                {partner.deliveries.slice(0, 4).map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-stone-300">{fmtDate(d.delivery_date)}</span>
                      <span className="text-stone-500 ml-2">{d.honey_type === 'vivo' ? 'Mel Vivo' : 'Mel Maturado'}</span>
                      {d.weight_kg && <span className="text-stone-500 ml-2">{d.weight_kg} kg</span>}
                    </div>
                    {qualityBadge(d.quality_status)}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Pagamentos pendentes */}
          {pendingPayments.length > 0 && (
            <Card>
              <h3 className="font-medium text-stone-200 mb-3 text-sm">Pagamentos pendentes</h3>
              <div className="space-y-2">
                {pendingPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-stone-300">Parcela {p.installment}</span>
                      <span className="text-stone-500 ml-2">Entrega {fmtDate(p.delivery_date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-200">{fmtCurrency(Number(p.amount))}</span>
                      {paymentBadge(p.status)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Comodatos ativos */}
          {activeLoans.length > 0 && (
            <Card>
              <h3 className="font-medium text-stone-200 mb-3 text-sm">Equipamentos em comodato</h3>
              <div className="space-y-1">
                {activeLoans.map((l) => (
                  <div key={l.id} className="flex items-center justify-between text-sm">
                    <span className="text-stone-300">{l.item_name} <span className="text-stone-500">({l.quantity} {l.unit})</span></span>
                    <span className="text-stone-500 text-xs">desde {fmtDate(l.delivery_date)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Contact info */}
          <Card>
            <h3 className="font-medium text-stone-200 mb-3 text-sm">Contato</h3>
            <dl className="grid sm:grid-cols-2 gap-2 text-sm">
              {partner.phone && <div><dt className="text-stone-500 text-xs">Telefone</dt><dd className="text-stone-300">{partner.phone}</dd></div>}
              {partner.whatsapp && <div><dt className="text-stone-500 text-xs">WhatsApp</dt><dd className="text-stone-300">{partner.whatsapp}</dd></div>}
              {partner.email && <div><dt className="text-stone-500 text-xs">E-mail</dt><dd className="text-stone-300">{partner.email}</dd></div>}
              {partner.document && <div><dt className="text-stone-500 text-xs">CPF/CNPJ</dt><dd className="text-stone-300 font-mono">{partner.document}</dd></div>}
              {partner.pix_key && <div><dt className="text-stone-500 text-xs">Chave PIX</dt><dd className="text-stone-300 font-mono">{partner.pix_key}</dd></div>}
            </dl>
          </Card>
        </div>
      )}

      {/* ── Tab: Meliponários ─────────────────────────────────────────────── */}
      {tab === 'apiaries' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            {canManage && (
              <Button size="sm" onClick={() => setApiaryModal(true)}>+ Meliponário</Button>
            )}
          </div>
          {partner.apiaries.length === 0 ? (
            <p className="text-stone-500 text-sm py-8 text-center">Nenhum meliponário cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {partner.apiaries.map((a) => (
                <Card key={a.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-stone-200">{a.name}</p>
                      <p className="text-xs text-stone-500">
                        {[a.city, a.state].filter(Boolean).join(', ')}
                        {a.bee_species && ` · ${a.bee_species}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-amber-400">{a.active_hives_count}</p>
                      <p className="text-xs text-stone-500">caixas</p>
                    </div>
                  </div>
                  {a.management_type && (
                    <p className="text-xs text-stone-500 mt-1">
                      Manejo: {a.management_type === 'rational' ? 'Racional' : 'Semi-racional'}
                      {a.technical_responsible && ` · Resp.: ${a.technical_responsible}`}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Comodato ──────────────────────────────────────────────────── */}
      {tab === 'loans' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            {canManage && (
              <Button size="sm" onClick={() => setLoanModal(true)}>+ Comodato</Button>
            )}
          </div>
          {partner.loans.length === 0 ? (
            <p className="text-stone-500 text-sm py-8 text-center">Nenhum equipamento em comodato.</p>
          ) : (
            <div className="space-y-2">
              {partner.loans.map((l) => (
                <LoanRow
                  key={l.id}
                  loan={l}
                  canManage={canManage}
                  onReturn={() => {
                    if (confirm(`Registrar devolução de "${l.item_name}"?`)) {
                      // handled inline
                    }
                  }}
                  partnerId={id!}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Entregas ──────────────────────────────────────────────────── */}
      {tab === 'deliveries' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            {canManage && (
              <Button size="sm" onClick={() => setDeliveryModal(true)}>+ Registrar entrega</Button>
            )}
          </div>
          {partner.deliveries.length === 0 ? (
            <p className="text-stone-500 text-sm py-8 text-center">Nenhuma entrega registrada.</p>
          ) : (
            <div className="space-y-2">
              {partner.deliveries.map((d) => (
                <DeliveryRow
                  key={d.id}
                  delivery={d}
                  canManage={canManage}
                  onAddTest={() => setQualityModal(d.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Pagamentos ────────────────────────────────────────────────── */}
      {tab === 'payments' && (
        <div className="space-y-3">
          {partner.payments.length === 0 ? (
            <p className="text-stone-500 text-sm py-8 text-center">Nenhum pagamento registrado.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Card className="text-center">
                  <p className="text-xl font-bold text-emerald-400">{fmtCurrency(totalPaid)}</p>
                  <p className="text-xs text-stone-500">Total pago</p>
                </Card>
                <Card className="text-center">
                  <p className="text-xl font-bold text-amber-400">
                    {fmtCurrency(partner.payments.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0))}
                  </p>
                  <p className="text-xs text-stone-500">Pendente</p>
                </Card>
                <Card className="text-center">
                  <p className="text-xl font-bold text-red-400">
                    {fmtCurrency(partner.payments.filter(p => p.status === 'overdue').reduce((s, p) => s + Number(p.amount), 0))}
                  </p>
                  <p className="text-xs text-stone-500">Atrasado</p>
                </Card>
              </div>
              <div className="space-y-2">
                {partner.payments.map((p) => (
                  <Card key={p.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-stone-200">
                          Parcela {p.installment} — Entrega {fmtDate(p.delivery_date)}
                        </p>
                        <p className="text-xs text-stone-500">
                          Vencimento: {fmtDate(p.due_date)}
                          {p.paid_date && ` · Pago em: ${fmtDate(p.paid_date)}`}
                          {p.payment_method && ` · ${p.payment_method}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-stone-200">{fmtCurrency(Number(p.amount))}</span>
                        {paymentBadge(p.status)}
                        {(p.status === 'pending' || p.status === 'overdue') && canManage && (
                          <Button size="sm" onClick={() => setPayModal(p.local_id)}>Pagar</Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar Parceiro">
        <PartnerForm initial={partner} onSuccess={() => setEditOpen(false)} onCancel={() => setEditOpen(false)} />
      </Modal>

      <Modal open={apiaryModal} onClose={() => setApiaryModal(false)} title="Novo Meliponário">
        <ApiaryFormInline partnerId={id!} onSuccess={() => setApiaryModal(false)} onCancel={() => setApiaryModal(false)} />
      </Modal>

      <Modal open={loanModal} onClose={() => setLoanModal(false)} title="Novo Comodato">
        <LoanFormInline partnerId={id!} onSuccess={() => setLoanModal(false)} onCancel={() => setLoanModal(false)} />
      </Modal>

      <Modal open={deliveryModal} onClose={() => setDeliveryModal(false)} title="Registrar Entrega">
        <DeliveryFormInline
          partnerId={id!}
          apiaries={partner.apiaries}
          maxPurchasePct={partner.max_purchase_pct}
          onSuccess={() => setDeliveryModal(false)}
          onCancel={() => setDeliveryModal(false)}
        />
      </Modal>

      {qualityModal != null && (
        <Modal open onClose={() => setQualityModal(null)} title="Teste de Qualidade">
          <QualityTestFormInline
            partnerId={id!}
            deliveryLocalId={partner.deliveries.find((d) => d.id === qualityModal)?.local_id ?? ''}
            onSuccess={() => setQualityModal(null)}
            onCancel={() => setQualityModal(null)}
          />
        </Modal>
      )}

      {payModal && (
        <Modal open onClose={() => setPayModal(null)} title="Registrar Pagamento">
          <PayFormInline
            partnerId={id!}
            paymentLocalId={payModal}
            onSuccess={() => setPayModal(null)}
            onCancel={() => setPayModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

// ── Inline sub-components ──────────────────────────────────────────────────────

function LoanRow({ loan, canManage, partnerId }: { loan: PartnerEquipmentLoan; canManage: boolean; onReturn: () => void; partnerId: string }) {
  const returnLoan = useReturnLoan(partnerId);
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-stone-200">{loan.item_name}</p>
          <p className="text-xs text-stone-500">
            {loan.item_type} · {loan.quantity} {loan.unit} · Entregue: {new Date(loan.delivery_date).toLocaleDateString('pt-BR')}
            {loan.expected_return_date && ` · Prevista devolução: ${new Date(loan.expected_return_date).toLocaleDateString('pt-BR')}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={loan.status === 'active' ? 'warning' : loan.status === 'returned' ? 'success' : 'danger'}>
            {loan.status === 'active' ? 'Em uso' : loan.status === 'returned' ? 'Devolvido' : 'Perdido'}
          </Badge>
          {loan.status === 'active' && canManage && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => returnLoan.mutate({ loanLocalId: loan.local_id })}
              disabled={returnLoan.isPending}
            >
              Devolver
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function DeliveryRow({ delivery, canManage, onAddTest }: {
  delivery: PartnerDelivery & { quality_test?: PartnerQualityTest | null; payments?: PartnerPayment[] };
  canManage: boolean;
  onAddTest: () => void;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-stone-200">
              {new Date(delivery.delivery_date).toLocaleDateString('pt-BR')}
            </span>
            <span className="text-xs text-stone-500">{delivery.honey_type === 'vivo' ? 'Mel Vivo' : 'Mel Maturado'}</span>
            {delivery.bee_species && <span className="text-xs text-stone-500">{delivery.bee_species}</span>}
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            {delivery.weight_kg && `${delivery.weight_kg} kg entregues`}
            {delivery.accepted_weight_kg && ` · ${delivery.accepted_weight_kg} kg comprados (${delivery.purchase_pct}%)`}
            {delivery.price_per_kg && ` · ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(delivery.price_per_kg))}/kg`}
          </p>
          {delivery.partner_apiary_name && (
            <p className="text-xs text-stone-500">{delivery.partner_apiary_name}</p>
          )}
          {delivery.quality_test && (
            <p className="text-xs text-stone-500 mt-1">
              Teste: HMF {delivery.quality_test.hmf ?? '—'} mg/kg · Umidade {delivery.quality_test.moisture_pct ?? '—'}%
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {qualityBadge(delivery.quality_status)}
          {delivery.total_value && (
            <span className="text-sm font-bold text-emerald-400">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(delivery.total_value))}
            </span>
          )}
          {delivery.quality_status === 'pending' && canManage && (
            <Button size="sm" onClick={onAddTest}>Registrar teste</Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function ApiaryFormInline({ partnerId, onSuccess, onCancel }: { partnerId: string; onSuccess: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<Partial<PartnerApiaryCreate>>({ active_hives_count: 0 });
  const create = useCreatePartnerApiary(partnerId);
  function s(k: keyof PartnerApiaryCreate, v: unknown) { setForm((f) => ({ ...f, [k]: v })); }
  return (
    <form onSubmit={async (e) => { e.preventDefault(); await create.mutateAsync(form as PartnerApiaryCreate); onSuccess(); }} className="space-y-4">
      <div>
        <label className="text-xs text-stone-400 block mb-1">Nome *</label>
        <input required value={form.name ?? ''} onChange={(e) => s('name', e.target.value)}
          className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-stone-400 block mb-1">Cidade</label>
          <input value={form.city ?? ''} onChange={(e) => s('city', e.target.value)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">UF</label>
          <input maxLength={2} value={form.state ?? ''} onChange={(e) => s('state', e.target.value.toUpperCase())}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">Espécie</label>
          <input value={form.bee_species ?? ''} onChange={(e) => s('bee_species', e.target.value)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">Caixas ativas</label>
          <input type="number" min={0} value={form.active_hives_count ?? 0} onChange={(e) => s('active_hives_count', Number(e.target.value))}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">Tipo de manejo</label>
          <select value={form.management_type ?? ''} onChange={(e) => s('management_type', e.target.value || null)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
            <option value="">—</option>
            <option value="rational">Racional</option>
            <option value="semi_rational">Semi-racional</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">Responsável técnico</label>
          <input value={form.technical_responsible ?? ''} onChange={(e) => s('technical_responsible', e.target.value)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
      </div>
      {create.error && <p className="text-xs text-red-400">{create.error.message}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={create.isPending}>Cadastrar</Button>
      </div>
    </form>
  );
}

function LoanFormInline({ partnerId, onSuccess, onCancel }: { partnerId: string; onSuccess: () => void; onCancel: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Partial<EquipmentLoanCreate>>({
    quantity: 1, unit: 'unidade', delivery_date: today, item_type: 'equipamento',
  });
  const create = useCreateEquipmentLoan(partnerId);
  function s(k: keyof EquipmentLoanCreate, v: unknown) { setForm((f) => ({ ...f, [k]: v })); }
  return (
    <form onSubmit={async (e) => { e.preventDefault(); await create.mutateAsync(form as EquipmentLoanCreate); onSuccess(); }} className="space-y-4">
      <div>
        <label className="text-xs text-stone-400 block mb-1">Item *</label>
        <input required value={form.item_name ?? ''} onChange={(e) => s('item_name', e.target.value)}
          className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-stone-400 block mb-1">Tipo</label>
          <select value={form.item_type ?? 'equipamento'} onChange={(e) => s('item_type', e.target.value)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
            <option value="bombona">Bombona</option>
            <option value="caixa">Caixa</option>
            <option value="equipamento">Equipamento</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">Quantidade</label>
          <input type="number" min={1} value={form.quantity ?? 1} onChange={(e) => s('quantity', Number(e.target.value))}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">Unidade</label>
          <input value={form.unit ?? 'unidade'} onChange={(e) => s('unit', e.target.value)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">Data de entrega *</label>
          <input type="date" required value={form.delivery_date ?? today} onChange={(e) => s('delivery_date', e.target.value)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">Devolução prevista</label>
          <input type="date" value={form.expected_return_date ?? ''} onChange={(e) => s('expected_return_date', e.target.value || null)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
      </div>
      <div>
        <label className="text-xs text-stone-400 block mb-1">Condição na entrega</label>
        <input value={form.delivery_condition ?? ''} onChange={(e) => s('delivery_condition', e.target.value)}
          className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
      </div>
      {create.error && <p className="text-xs text-red-400">{create.error.message}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={create.isPending}>Registrar</Button>
      </div>
    </form>
  );
}

function DeliveryFormInline({ partnerId, apiaries, maxPurchasePct, onSuccess, onCancel }: {
  partnerId: string;
  apiaries: { id: number; name: string }[];
  maxPurchasePct: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Partial<DeliveryCreate>>({
    delivery_date: today, honey_type: 'vivo', purchase_pct: maxPurchasePct,
  });
  const create = useCreateDelivery(partnerId);
  function s(k: keyof DeliveryCreate, v: unknown) { setForm((f) => ({ ...f, [k]: v })); }

  const weightKg = Number(form.weight_kg) || 0;
  const purchasePct = Number(form.purchase_pct) || maxPurchasePct;
  const pricePerKg = Number(form.price_per_kg) || 0;
  const acceptedKg = weightKg * purchasePct / 100;
  const totalValue = acceptedKg * pricePerKg;

  return (
    <form onSubmit={async (e) => { e.preventDefault(); await create.mutateAsync(form as DeliveryCreate); onSuccess(); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-stone-400 block mb-1">Data da entrega *</label>
          <input type="date" required value={form.delivery_date ?? today} onChange={(e) => s('delivery_date', e.target.value)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">Tipo de mel *</label>
          <select value={form.honey_type ?? 'vivo'} onChange={(e) => s('honey_type', e.target.value)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
            <option value="vivo">Mel Vivo</option>
            <option value="maturado">Mel Maturado</option>
          </select>
        </div>
        {apiaries.length > 0 && (
          <div className="col-span-2">
            <label className="text-xs text-stone-400 block mb-1">Meliponário de origem</label>
            <select value={form.partner_apiary_id ?? ''} onChange={(e) => s('partner_apiary_id', e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
              <option value="">—</option>
              {apiaries.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs text-stone-400 block mb-1">Espécie</label>
          <input value={form.bee_species ?? ''} onChange={(e) => s('bee_species', e.target.value)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">Volume (ml)</label>
          <input type="number" min={0} value={form.volume_ml ?? ''} onChange={(e) => s('volume_ml', Number(e.target.value) || null)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">Peso (kg)</label>
          <input type="number" min={0} step="0.001" value={form.weight_kg ?? ''} onChange={(e) => s('weight_kg', Number(e.target.value) || null)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">% a comprar</label>
          <input type="number" min={0} max={100} value={form.purchase_pct ?? maxPurchasePct} onChange={(e) => s('purchase_pct', Number(e.target.value))}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">Preço por kg (R$)</label>
          <input type="number" min={0} step="0.01" value={form.price_per_kg ?? ''} onChange={(e) => s('price_per_kg', Number(e.target.value) || null)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
      </div>

      {weightKg > 0 && (
        <div className="bg-stone-900/60 border border-stone-700 rounded-xl p-3 text-sm">
          <p className="text-stone-400">Kg comprados: <span className="text-amber-400 font-medium">{acceptedKg.toFixed(3)} kg</span></p>
          {pricePerKg > 0 && (
            <p className="text-stone-400 mt-1">
              Valor total: <span className="text-emerald-400 font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
              </span>
              <span className="text-stone-500 ml-2">(Parcela 1: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue * 0.5)})</span>
            </p>
          )}
        </div>
      )}

      <div>
        <label className="text-xs text-stone-400 block mb-1">Observações</label>
        <textarea rows={2} value={form.notes ?? ''} onChange={(e) => s('notes', e.target.value)}
          className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none" />
      </div>

      {create.error && <p className="text-xs text-red-400">{create.error.message}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={create.isPending}>Registrar entrega</Button>
      </div>
    </form>
  );
}

function QualityTestFormInline({ partnerId, deliveryLocalId, onSuccess, onCancel }: {
  partnerId: string;
  deliveryLocalId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<QualityTestCreate>({});
  const create = useCreateQualityTest(partnerId, deliveryLocalId);
  function s(k: keyof QualityTestCreate, v: unknown) { setForm((f) => ({ ...f, [k]: v })); }

  const hmfApproved = form.hmf != null ? form.hmf < 50 : null;
  const moistureApproved = form.moisture_pct != null ? form.moisture_pct < 28 : null;
  let previewResult: string | null = null;
  if (hmfApproved !== null || moistureApproved !== null) {
    if (hmfApproved === false || moistureApproved === false) previewResult = 'rejected';
    else if (form.visual_aspect === 'turvo') previewResult = 'approved_with_observation';
    else previewResult = 'approved';
  }

  return (
    <form onSubmit={async (e) => { e.preventDefault(); await create.mutateAsync(form); onSuccess(); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-stone-400 block mb-1">
            HMF (mg/kg)
            {form.hmf != null && (
              <span className={`ml-2 font-medium ${hmfApproved ? 'text-emerald-400' : 'text-red-400'}`}>
                {hmfApproved ? '✓ < 50' : '✗ ≥ 50'}
              </span>
            )}
          </label>
          <input type="number" min={0} step="0.01" value={form.hmf ?? ''} onChange={(e) => s('hmf', Number(e.target.value) || null)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">
            Umidade (%)
            {form.moisture_pct != null && (
              <span className={`ml-2 font-medium ${moistureApproved ? 'text-emerald-400' : 'text-red-400'}`}>
                {moistureApproved ? '✓ < 28%' : '✗ ≥ 28%'}
              </span>
            )}
          </label>
          <input type="number" min={0} max={100} step="0.1" value={form.moisture_pct ?? ''} onChange={(e) => s('moisture_pct', Number(e.target.value) || null)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">Brix</label>
          <input type="number" min={0} step="0.1" value={form.brix ?? ''} onChange={(e) => s('brix', Number(e.target.value) || null)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-stone-400 block mb-1">Aspecto visual</label>
          <select value={form.visual_aspect ?? ''} onChange={(e) => s('visual_aspect', e.target.value || null)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
            <option value="">—</option>
            <option value="limpido">Límpido</option>
            <option value="levemente_turvo">Levemente turvo</option>
            <option value="turvo">Turvo</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-stone-400 block mb-1">Aroma</label>
          <input value={form.aroma ?? ''} onChange={(e) => s('aroma', e.target.value)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-stone-400 block mb-1">Observações técnicas</label>
          <textarea rows={2} value={form.observations ?? ''} onChange={(e) => s('observations', e.target.value)}
            className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none" />
        </div>
      </div>

      {previewResult && (
        <div className={cn(
          'flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium',
          previewResult === 'approved' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
            : previewResult === 'rejected' ? 'border-red-500/40 bg-red-500/10 text-red-400'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
        )}>
          {previewResult === 'approved' ? '✓ Resultado: Aprovado' : previewResult === 'rejected' ? '✗ Resultado: Reprovado' : '⚠ Resultado: Aprovado com observação'}
          {previewResult === 'approved' && ' — Parcela 2 será criada automaticamente'}
          {previewResult === 'rejected' && ' — Parcela 2 não será liberada'}
        </div>
      )}

      {create.error && <p className="text-xs text-red-400">{create.error.message}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={create.isPending}>Registrar teste</Button>
      </div>
    </form>
  );
}

function PayFormInline({ partnerId, paymentLocalId, onSuccess, onCancel }: {
  partnerId: string; paymentLocalId: string; onSuccess: () => void; onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [paidDate, setPaidDate] = useState(today);
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');
  const pay = usePayInstallment(partnerId);
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      await pay.mutateAsync({ paymentLocalId, paid_date: paidDate, payment_method: method || undefined, notes: notes || undefined });
      onSuccess();
    }} className="space-y-4">
      <div>
        <label className="text-xs text-stone-400 block mb-1">Data do pagamento *</label>
        <input type="date" required value={paidDate} onChange={(e) => setPaidDate(e.target.value)}
          className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
      </div>
      <div>
        <label className="text-xs text-stone-400 block mb-1">Forma de pagamento</label>
        <input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="PIX, transferência, etc."
          className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
      </div>
      <div>
        <label className="text-xs text-stone-400 block mb-1">Observações</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
      </div>
      {pay.error && <p className="text-xs text-red-400">{pay.error.message}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={pay.isPending}>Confirmar pagamento</Button>
      </div>
    </form>
  );
}
