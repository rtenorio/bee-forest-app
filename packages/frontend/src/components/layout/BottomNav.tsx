import { NavLink } from 'react-router-dom';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';

const iconCls = 'w-5 h-5';

function HomeIcon() {
  return (
    <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

const itemCls = (isActive: boolean) =>
  cn(
    'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors',
    isActive ? 'text-amber-400' : 'text-stone-500 hover:text-stone-300'
  );

export function BottomNav() {
  const { setSidebarOpen } = useUIStore();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-stone-900 border-t border-stone-800 pb-safe">
      <div className="flex">
        <NavLink to="/" end className={({ isActive }) => itemCls(isActive)}>
          <HomeIcon />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/apiaries" className={({ isActive }) => itemCls(isActive)}>
          <BuildingIcon />
          <span>Meliponários</span>
        </NavLink>

        <NavLink to="/hives" className={({ isActive }) => itemCls(isActive)}>
          <BoxIcon />
          <span>Caixas</span>
        </NavLink>

        <NavLink to="/inspections" className={({ isActive }) => itemCls(isActive)}>
          <ClipboardIcon />
          <span>Inspeções</span>
        </NavLink>

        <button
          onClick={() => setSidebarOpen(true)}
          className="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs text-stone-500 hover:text-stone-300 transition-colors"
        >
          <MenuIcon />
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}
