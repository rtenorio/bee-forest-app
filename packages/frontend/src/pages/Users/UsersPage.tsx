import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useUsers } from '@/hooks/useUsers';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { UserForm } from './UserForm';
import type { ManagedUser } from '@/hooks/useUsers';
import type { UserRole } from '@bee-forest/shared';
import { ROLE_LABELS, creatableRoles } from '@bee-forest/shared';

// ─── Badge de perfil ──────────────────────────────────────────────────────────

const ROLE_BADGE: Record<UserRole, string> = {
  master_admin: 'bg-violet-900/40 text-violet-300 border border-violet-700/50',
  socio:        'bg-amber-900/40 text-amber-300 border border-amber-700/50',
  orientador:   'bg-teal-900/40 text-teal-300 border border-teal-700/50',
  responsavel:  'bg-blue-900/40 text-blue-300 border border-blue-700/50',
  tratador:     'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50',
};

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[role] ?? ''}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const FILTER_ROLES: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos os perfis' },
  { value: 'master_admin', label: 'Master Admin' },
  { value: 'socio', label: 'Sócio' },
  { value: 'orientador', label: 'Orientador Técnico' },
  { value: 'responsavel', label: 'Responsável' },
  { value: 'tratador', label: 'Tratador' },
];

export function UsersPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;
  const { data: users = [], isLoading } = useUsers();

  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const canCreate = creatableRoles(user.role).length > 0;

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (filterRole && u.role !== filterRole) return false;
      if (filterStatus === 'active' && !u.active) return false;
      if (filterStatus === 'inactive' && u.active) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [users, filterRole, filterStatus, search]);

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Usuários</h1>
          <p className="text-stone-500 text-sm">{users.length} usuário{users.length !== 1 ? 's' : ''} no sistema</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowForm(true)}>+ Novo Usuário</Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Buscar nome ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-stone-800 border border-stone-700 text-stone-100 placeholder-stone-500 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500 min-w-[200px]"
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500"
        >
          {FILTER_ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="👤"
          title="Nenhum usuário encontrado"
          description={canCreate ? 'Crie o primeiro usuário usando o botão acima.' : 'Nenhum usuário dentro do seu alcance.'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              isSelf={u.id === user.id}
              onClick={() => navigate(`/users/${u.id}`)}
            />
          ))}
        </div>
      )}

      {/* Modal Novo Usuário */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Novo Usuário" size="lg">
        <UserForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}

// ─── User Row ─────────────────────────────────────────────────────────────────

function UserRow({
  user,
  isSelf,
  onClick,
}: {
  user: ManagedUser;
  isSelf: boolean;
  onClick: () => void;
}) {
  return (
    <Card hover onClick={onClick}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar inicial */}
          <div className="w-9 h-9 rounded-full bg-stone-700 flex items-center justify-center text-stone-300 font-bold text-sm shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-stone-100 truncate">{user.name}</p>
              {isSelf && (
                <span className="text-xs text-stone-500">(você)</span>
              )}
              <RoleBadge role={user.role} />
              {!user.active && (
                <Badge variant="danger">Inativo</Badge>
              )}
            </div>
            <p className="text-xs text-stone-500 truncate">{user.email}</p>
            {user.phone && (
              <p className="text-xs text-stone-600">{user.phone}</p>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-stone-600 shrink-0 hidden sm:block">
          <p>Criado em</p>
          <p>{new Date(user.created_at).toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
    </Card>
  );
}
