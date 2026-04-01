import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  activeApiaryId: string | null;
  sidebarOpen: boolean;
  inspectorName: string;
  setActiveApiaryId: (id: string | null) => void;
  setSidebarOpen: (v: boolean) => void;
  setInspectorName: (name: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeApiaryId: null,
      sidebarOpen: false,
      inspectorName: '',
      setActiveApiaryId: (id) => set({ activeApiaryId: id }),
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      setInspectorName: (name) => set({ inspectorName: name }),
    }),
    { name: 'bee-forest-ui' }
  )
);
