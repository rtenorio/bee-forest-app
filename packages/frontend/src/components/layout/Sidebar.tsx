import { NavLink } from 'react-router-dom';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/cn';
import { usePendingInstructionsCount } from '@/hooks/useInstructions';
import type { UserRole } from '@bee-forest/shared';

type NavItem = { to: string; label: string; icon: string; end: boolean; roles?: UserRole[]; indent?: boolean; badge?: boolean };

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/apiaries', label: 'Meliponários', icon: '🏡', end: false, roles: ['socio', 'responsavel'] },
  { to: '/hives', label: 'Caixas de abelha', icon: '🏠', end: false },
  { to: '/inspections', label: 'Inspeções', icon: '🔍', end: false },
  { to: '/instructions', label: 'Orientações', icon: '💬', end: false, badge: true },
  { to: '/divisions', label: 'Divisões', icon: '✂️', end: false },
  { to: '/scan', label: 'Escanear QR', icon: '📷', end: false },
  { to: '/hives/print-labels', label: 'Etiquetas QR', icon: '🏷️', end: false, roles: ['socio', 'responsavel'] },
  { to: '/productions', label: 'Produções', icon: '🍯', end: false, roles: ['socio', 'responsavel'] },
  { to: '/feedings', label: 'Alimentações', icon: '🌺', end: false, roles: ['socio', 'responsavel'] },
  { to: '/harvests', label: 'Colheitas', icon: '🫙', end: false, roles: ['socio', 'responsavel'] },
  { to: '/batches', label: 'Lotes de Mel', icon: '🍯', end: true, roles: ['socio', 'responsavel'] },
  { to: '/batches/quality', label: 'Painel de Qualidade', icon: '⚠️', end: false, roles: ['master_admin', 'socio', 'responsavel'], indent: true },
  { to: '/batches/reports', label: 'Relatórios de Lotes', icon: '📈', end: false, roles: ['master_admin', 'socio', 'responsavel'], indent: true },
  { to: '/stock', label: 'Estoque', icon: '📦', end: true },
  { to: '/partners', label: 'Parceiros', icon: '🤝', end: true, roles: ['master_admin', 'socio', 'responsavel'] },
  { to: '/partners/quality', label: 'Qualidade Parceiros', icon: '⚗️', end: false, roles: ['master_admin', 'socio', 'responsavel'], indent: true },
  { to: '/partners/finance', label: 'Financeiro Parceiros', icon: '💰', end: false, roles: ['master_admin', 'socio', 'responsavel'], indent: true },
  { to: '/reports', label: 'Relatórios', icon: '📊', end: false, roles: ['socio', 'responsavel'] },
  { to: '/users', label: 'Usuários', icon: '👥', end: false, roles: ['master_admin', 'socio', 'responsavel'] },
  { to: '/notifications', label: 'Notificações', icon: '🔔', end: false },
  { to: '/settings', label: 'Configurações', icon: '⚙️', end: false },
];

function NavItemComponent({ to, label, icon, end, indent, badge, onClick }: NavItem & { onClick?: () => void }) {
  const { data: pendingCount } = usePendingInstructionsCount();

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          indent ? 'pl-8 py-1.5' : 'py-2.5',
          isActive
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800'
        )
      }
    >
      <span className={cn('text-center', indent ? 'text-base w-5' : 'text-lg w-6')}>{icon}</span>
      <span className={cn('flex-1', indent ? 'text-xs' : '')}>{label}</span>
      {badge && pendingCount != null && pendingCount > 0 && (
        <span className="ml-auto bg-amber-500 text-stone-950 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      )}
    </NavLink>
  );
}

function NavItems({ onItemClick }: { onItemClick?: () => void }) {
  const role = useAuthStore((s) => s.user?.role);
  const visible = navItems.filter((item) =>
    !item.roles || (role && (item.roles.includes(role) || role === 'master_admin'))
  );
  return (
    <>
      {visible.map((item) => (
        <NavItemComponent key={item.to} {...item} onClick={onItemClick} />
      ))}
    </>
  );
}

export function Sidebar({ mobile = false }: { mobile?: boolean }) {
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  if (mobile) {
    return (
      <>
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside
          className={cn(
            'fixed left-0 top-0 bottom-0 z-50 w-64 bg-stone-900 border-r border-stone-800 flex flex-col lg:hidden transition-transform duration-300',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="h-14 flex items-center px-4 border-b border-stone-800">
            <div className="flex items-center gap-2">
              <img src="/bee-icon.png" alt="Bee Forest" style={{ height: '52px', objectFit: 'contain' }} />
              <span className="font-bold text-amber-400 text-base">Bee Forest</span>
            </div>
          </div>
          <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
            <NavItems onItemClick={() => setSidebarOpen(false)} />
          </nav>
          <div className="px-4 py-3 border-t border-stone-800 text-xs text-stone-600">
            v1.0.0 • Bee Forest App
          </div>
        </aside>
      </>
    );
  }

  return (
    <aside className="hidden lg:flex w-60 flex-col bg-stone-900 border-r border-stone-800 h-screen sticky top-0">
      <div className="h-14 flex items-center px-4 border-b border-stone-800">
        <div className="flex items-center gap-2">
          <img src="/bee-icon.png" alt="Bee Forest" style={{ height: '52px', objectFit: 'contain' }} />
          <span className="font-bold text-amber-400 text-base">Bee Forest</span>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        <NavItems />
      </nav>
      <div className="px-4 py-3 border-t border-stone-800 text-xs text-stone-600">
        v1.0.0 • Bee Forest App
      </div>
    </aside>
  );
}
