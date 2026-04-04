import { NavLink } from 'react-router-dom';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/cn';
import type { UserRole } from '@bee-forest/shared';

type NavItem = { to: string; label: string; icon: string; end: boolean; roles?: UserRole[]; indent?: boolean };

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/apiaries', label: 'Meliponários', icon: '🏡', end: false, roles: ['socio', 'responsavel'] },
  { to: '/hives', label: 'Caixas de abelha', icon: '🏠', end: false },
  { to: '/inspections', label: 'Inspeções', icon: '🔍', end: false },
  { to: '/scan', label: 'Escanear QR', icon: '📷', end: false },
  { to: '/hives/print-labels', label: 'Etiquetas QR', icon: '🏷️', end: false, roles: ['socio', 'responsavel'] },
  { to: '/productions', label: 'Produções', icon: '🍯', end: false, roles: ['socio', 'responsavel'] },
  { to: '/feedings', label: 'Alimentações', icon: '🌺', end: false, roles: ['socio', 'responsavel'] },
  { to: '/harvests', label: 'Colheitas', icon: '🫙', end: false, roles: ['socio', 'responsavel'] },
  { to: '/batches', label: 'Lotes de Mel', icon: '🍯', end: true, roles: ['socio', 'responsavel'] },
  { to: '/batches/quality', label: 'Painel de Qualidade', icon: '⚠️', end: false, roles: ['master_admin', 'socio', 'responsavel'], indent: true },
  { to: '/batches/reports', label: 'Relatórios de Lotes', icon: '📈', end: false, roles: ['master_admin', 'socio', 'responsavel'], indent: true },
  { to: '/reports', label: 'Relatórios', icon: '📊', end: false, roles: ['socio', 'responsavel'] },
  { to: '/users', label: 'Usuários', icon: '👥', end: false, roles: ['master_admin', 'socio', 'responsavel'] },
  { to: '/settings', label: 'Configurações', icon: '⚙️', end: false },
];

function NavItem({ to, label, icon, end, indent, onClick }: NavItem & { onClick?: () => void }) {
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
      <span className={indent ? 'text-xs' : ''}>{label}</span>
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
        <NavItem key={item.to} {...item} onClick={onItemClick} />
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
          <div className="h-14 flex items-center px-4 border-b border-stone-800 gap-2">
            <span className="text-2xl">🐝</span>
            <span className="font-bold text-amber-400 text-lg">Bee Forest</span>
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
      <div className="h-14 flex items-center px-4 border-b border-stone-800 gap-2">
        <span className="text-2xl">🐝</span>
        <span className="font-bold text-amber-400 text-lg">Bee Forest</span>
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
