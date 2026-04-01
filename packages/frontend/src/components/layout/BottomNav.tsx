import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/cn';
import type { UserRole } from '@bee-forest/shared';

type Item = { to: string; icon: string; label: string; end: boolean; roles?: UserRole[] };

const items: Item[] = [
  { to: '/', icon: '📊', label: 'Dashboard', end: true },
  { to: '/hives', icon: '🏠', label: 'Colmeias', end: false },
  { to: '/inspections/new', icon: '🔍', label: 'Inspecionar', end: false },
  { to: '/productions', icon: '🍯', label: 'Produção', end: false, roles: ['socio', 'responsavel'] },
  { to: '/settings', icon: '⚙️', label: 'Config', end: false },
];

export function BottomNav() {
  const role = useAuthStore((s) => s.user?.role);
  const visible = items.filter((item) => !item.roles || (role && item.roles.includes(role)));

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-stone-900 border-t border-stone-800 pb-safe">
      <div className="flex">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors',
                isActive ? 'text-amber-400' : 'text-stone-500 hover:text-stone-300'
              )
            }
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
