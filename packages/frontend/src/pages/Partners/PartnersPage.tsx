import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePartners, useUpdatePartnerStatus } from '@/hooks/usePartners';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { PartnerForm } from './PartnerForm';
import type { PartnerSummary } from '@bee-forest/shared';

function statusLabel(s: string) {
  if (s === 'active') return { label: 'Ativo', color: 'success' as const };
  if (s === 'suspended') return { label: 'Suspenso', color: 'warning' as const };
  return { label: 'Inativo', color: 'default' as const };
}

export function PartnersPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;
  const canManage = user.role === 'socio' || user.role === 'master_admin';

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('active');
  const [showForm, setShowForm] = useState(false);

  const { data: partners = [], isLoading } = usePartners(
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  );
  const updateStatus = useUpdatePartnerStatus();

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Parceiros</h1>
          <p className="text-stone-500 text-sm">
            {partners.length} parceiro{partners.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status filter */}
          <div className="flex gap-1">
            {(['active', 'suspended', 'inactive', 'all'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  statusFilter === s
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'border-stone-700 text-stone-400 hover:text-stone-200'
                }`}
              >
                {s === 'active' ? 'Ativos' : s === 'suspended' ? 'Suspensos' : s === 'inactive' ? 'Inativos' : 'Todos'}
              </button>
            ))}
          </div>
          {canManage && (
            <Button onClick={() => setShowForm(true)}>+ Novo Parceiro</Button>
          )}
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => navigate('/partners/quality')}
          className="text-xs px-3 py-1.5 rounded-lg border border-stone-700 text-stone-400 hover:text-amber-400 hover:border-amber-500/40 transition-colors"
        >
          ⚗️ Painel de Qualidade
        </button>
        <button
          onClick={() => navigate('/partners/finance')}
          className="text-xs px-3 py-1.5 rounded-lg border border-stone-700 text-stone-400 hover:text-amber-400 hover:border-amber-500/40 transition-colors"
        >
          💰 Painel Financeiro
        </button>
      </div>

      {/* Cards */}
      {partners.length === 0 ? (
        <EmptyState
          icon="🤝"
          title="Nenhum parceiro encontrado"
          description="Cadastre meliponicultores parceiros para gerenciar compras e comodatos."
          action={canManage ? { label: '+ Novo Parceiro', onClick: () => setShowForm(true) } : undefined}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {partners.map((p) => (
            <PartnerCard
              key={p.local_id}
              partner={p}
              canManage={canManage}
              onClick={() => navigate(`/partners/${p.local_id}`)}
              onStatusChange={(status) =>
                updateStatus.mutate({ localId: p.local_id, status })
              }
            />
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Novo Parceiro">
        <PartnerForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}

function PartnerCard({
  partner, canManage, onClick, onStatusChange,
}: {
  partner: PartnerSummary;
  canManage: boolean;
  onClick: () => void;
  onStatusChange: (status: string) => void;
}) {
  const { label, color } = statusLabel(partner.status);
  const hasAlerts = partner.overdue_payments_count > 0 || partner.pending_delivery_count > 0;

  return (
    <Card hover onClick={onClick}>
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-stone-100 leading-snug truncate">{partner.full_name}</h3>
          {partner.city && (
            <p className="text-xs text-stone-500">{partner.city}{partner.state ? `, ${partner.state}` : ''}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge variant={color}>{label}</Badge>
          {hasAlerts && <Badge variant="danger">⚠ Alerta</Badge>}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 py-2 border-t border-stone-800 mb-2 text-center">
        <div>
          <p className="text-sm font-bold text-amber-400">{partner.total_hives}</p>
          <p className="text-xs text-stone-500">caixas</p>
        </div>
        <div>
          <p className="text-sm font-bold text-emerald-400">
            {partner.approval_rate != null ? `${partner.approval_rate}%` : '—'}
          </p>
          <p className="text-xs text-stone-500">aprovação</p>
        </div>
        <div>
          <p className="text-sm font-bold text-stone-300">{partner.active_loans_count}</p>
          <p className="text-xs text-stone-500">comodatos</p>
        </div>
      </div>

      {/* Alert badges */}
      {partner.overdue_payments_count > 0 && (
        <p className="text-xs text-red-400 mb-1">
          🔴 {partner.overdue_payments_count} pagamento{partner.overdue_payments_count !== 1 ? 's' : ''} atrasado{partner.overdue_payments_count !== 1 ? 's' : ''}
        </p>
      )}
      {partner.pending_delivery_count > 0 && (
        <p className="text-xs text-amber-400">
          ⏳ {partner.pending_delivery_count} entrega{partner.pending_delivery_count !== 1 ? 's' : ''} aguardando teste
        </p>
      )}

      {canManage && (
        <div className="flex gap-2 mt-2 border-t border-stone-800 pt-2">
          {partner.status === 'active' ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onStatusChange('suspended'); }}
              className="text-xs text-stone-500 hover:text-amber-400 transition-colors"
            >
              Suspender
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onStatusChange('active'); }}
              className="text-xs text-stone-500 hover:text-emerald-400 transition-colors"
            >
              Reativar
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
