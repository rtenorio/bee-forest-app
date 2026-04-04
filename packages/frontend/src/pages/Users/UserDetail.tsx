import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  useUser, useUserAudit, useToggleUserStatus, useChangeUserRole,
  type ManagedUser,
} from '@/hooks/useUsers';
import { useApiaries } from '@/hooks/useApiaries';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { UserForm } from './UserForm';
import { ROLE_LABELS, creatableRoles, visibleRoles } from '@bee-forest/shared';
import type { UserRole } from '@bee-forest/shared';

// ─── Badge helpers ─────────────────────────────────────────────────────────────

const ROLE_BADGE_CLS: Record<UserRole, string> = {
  master_admin: 'bg-violet-900/40 text-violet-300 border-violet-700/50',
  socio:        'bg-amber-900/40 text-amber-300 border-amber-700/50',
  responsavel:  'bg-blue-900/40 text-blue-300 border-blue-700/50',
  tratador:     'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
};

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${ROLE_BADGE_CLS[role] ?? ''}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

const ACTION_LABELS: Record<string, string> = {
  user_created:         '🆕 Usuário criado',
  user_updated:         '✏️ Dados editados',
  user_activated:       '✅ Ativado',
  user_deactivated:     '🚫 Desativado',
  user_role_changed:    '🔄 Perfil alterado',
  user_apiaries_updated:'🏡 Meliponários atualizados',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const actor = useAuthStore((s) => s.user)!;

  const userId = id ? parseInt(id, 10) : null;
  const { data: user, isLoading } = useUser(userId);
  const { data: audit = [] } = useUserAudit(userId);
  const { data: apiaries = [] } = useApiaries();
  const toggleStatus = useToggleUserStatus();
  const changeRole = useChangeUserRole();

  const [editOpen, setEditOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!user) return (
    <div className="text-stone-400 text-center py-16">
      Usuário não encontrado.{' '}
      <button onClick={() => navigate(-1)} className="text-amber-400 underline">Voltar</button>
    </div>
  );

  const isSelf = user.id === actor.id;
  const canManageThis = visibleRoles(actor.role).includes(user.role);
  const canEditRole = !isSelf && canManageThis && creatableRoles(actor.role).length > 0;
  const allowedNewRoles = creatableRoles(actor.role).filter((r) => r !== user.role);

  const apiaryNames = user.apiary_local_ids.map(
    (id) => apiaries.find((a) => a.local_id === id)?.name ?? id
  );

  const handleToggle = () => {
    if (!confirm(`${user.active ? 'Desativar' : 'Ativar'} o usuário "${user.name}"?`)) return;
    toggleStatus.mutate(user.id);
  };

  const handleRoleChange = async () => {
    if (!pendingRole) return;
    setRoleError(null);
    try {
      await changeRole.mutateAsync({ id: user.id, role: pendingRole });
      setRoleOpen(false);
    } catch (err: unknown) {
      setRoleError((err as Error).message ?? 'Erro ao alterar perfil');
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-stone-400 hover:text-stone-100 text-sm transition-colors">
            ← Voltar
          </button>
          <div className="w-11 h-11 rounded-full bg-stone-700 flex items-center justify-center text-stone-200 font-bold text-lg">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-stone-100">{user.name}</h1>
              {isSelf && <span className="text-xs text-stone-500">(você)</span>}
              <RoleBadge role={user.role} />
              {!user.active && <Badge variant="danger">Inativo</Badge>}
            </div>
            <p className="text-sm text-stone-500">{user.email}</p>
          </div>
        </div>

        {canManageThis && !isSelf && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              Editar
            </Button>
            {canEditRole && allowedNewRoles.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setRoleOpen(true)}>
                Alterar Perfil
              </Button>
            )}
            <Button
              variant={user.active ? 'danger' : 'secondary'}
              size="sm"
              onClick={handleToggle}
              disabled={toggleStatus.isPending}
            >
              {user.active ? 'Desativar' : 'Ativar'}
            </Button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Perfil', value: ROLE_LABELS[user.role] },
          { label: 'Status', value: user.active ? 'Ativo' : 'Inativo' },
          { label: 'Cadastrado em', value: new Date(user.created_at).toLocaleDateString('pt-BR') },
          { label: 'Criado por', value: user.created_by_name ?? '—' },
        ].map((item) => (
          <Card key={item.label} className="text-center">
            <p className="text-sm font-bold text-amber-400">{item.value}</p>
            <p className="text-xs text-stone-500">{item.label}</p>
          </Card>
        ))}
      </div>

      {/* Contato */}
      <Card>
        <CardHeader><CardTitle>Informações de Contato</CardTitle></CardHeader>
        <div className="space-y-2 mt-3">
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">E-mail</span>
            <span className="text-stone-200">{user.email}</span>
          </div>
          {user.phone && (
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Telefone</span>
              <span className="text-stone-200">{user.phone}</span>
            </div>
          )}
          {user.observations && (
            <div className="pt-2 border-t border-stone-800">
              <p className="text-xs text-stone-500 mb-1">Observações</p>
              <p className="text-sm text-stone-300">{user.observations}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Vínculos */}
      {(user.role === 'responsavel' || user.role === 'tratador') && (
        <Card>
          <CardHeader>
            <CardTitle>
              {user.role === 'responsavel' ? 'Meliponários Vinculados' : 'Colmeias Vinculadas'}
            </CardTitle>
          </CardHeader>
          <div className="mt-3">
            {(user.role === 'responsavel' ? apiaryNames : user.hive_local_ids).length === 0 ? (
              <p className="text-stone-500 text-sm">Nenhum vínculo configurado.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(user.role === 'responsavel' ? apiaryNames : user.hive_local_ids).map((item, i) => (
                  <span key={i} className="text-xs bg-stone-800 text-stone-300 px-2 py-1 rounded-lg">
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Auditoria */}
      <Card>
        <CardHeader><CardTitle>Histórico de Auditoria</CardTitle></CardHeader>
        <div className="mt-3">
          {audit.length === 0 ? (
            <p className="text-stone-500 text-sm">Nenhuma ação registrada.</p>
          ) : (
            <div className="space-y-2">
              {audit.map((log) => (
                <div key={log.id} className="flex items-start gap-3 py-2 border-b border-stone-800/60 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-200">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </p>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <AuditMeta action={log.action} metadata={log.metadata} />
                    )}
                    <p className="text-xs text-stone-600 mt-0.5">
                      por {log.actor_name ?? '—'}
                      {log.actor_role ? ` (${ROLE_LABELS[log.actor_role as UserRole] ?? log.actor_role})` : ''}
                    </p>
                  </div>
                  <p className="text-xs text-stone-600 shrink-0 whitespace-nowrap">
                    {formatDateTime(log.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Modal: Editar */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar Usuário" size="lg">
        <UserForm
          initial={user as ManagedUser}
          onSuccess={() => setEditOpen(false)}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>

      {/* Modal: Alterar perfil */}
      <Modal open={roleOpen} onClose={() => setRoleOpen(false)} title="Alterar Perfil">
        <div className="space-y-4 py-1">
          <p className="text-stone-400 text-sm">
            Selecionando um novo perfil para <strong className="text-stone-200">{user.name}</strong>:
          </p>
          <div className="flex flex-wrap gap-2">
            {allowedNewRoles.map((r) => (
              <button
                key={r}
                onClick={() => setPendingRole(r)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  pendingRole === r
                    ? `${ROLE_BADGE_CLS[r]} border-current`
                    : 'border-stone-700 text-stone-400 hover:border-stone-500'
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          {roleError && (
            <p className="text-red-400 text-sm">{roleError}</p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setRoleOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleRoleChange}
              disabled={!pendingRole || changeRole.isPending}
            >
              {changeRole.isPending ? 'Alterando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Audit metadata renderer ──────────────────────────────────────────────────

function AuditMeta({ action, metadata }: { action: string; metadata: Record<string, unknown> }) {
  if (action === 'user_role_changed') {
    return (
      <p className="text-xs text-stone-500">
        {ROLE_LABELS[metadata.from as UserRole] ?? metadata.from as string}
        {' → '}
        {ROLE_LABELS[metadata.to as UserRole] ?? metadata.to as string}
      </p>
    );
  }
  if (action === 'user_created') {
    return (
      <p className="text-xs text-stone-500">
        Perfil: {ROLE_LABELS[metadata.role as UserRole] ?? metadata.role as string}
      </p>
    );
  }
  return null;
}
