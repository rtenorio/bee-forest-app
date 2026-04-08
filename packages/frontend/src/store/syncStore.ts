import { create } from 'zustand';
import type { SyncConflict } from '@bee-forest/shared';

export interface FailedCriticalItem {
  id: string;
  entity_type: string;
  entity_local_id: string;
}

interface SyncState {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  conflicts: SyncConflict[];
  lastError: string | null;
  failedCriticalItems: FailedCriticalItem[];
  setIsSyncing: (v: boolean) => void;
  setPendingCount: (v: number) => void;
  setLastSyncAt: (v: string) => void;
  setConflicts: (v: SyncConflict[]) => void;
  setLastError: (v: string | null) => void;
  setFailedCriticalItems: (v: FailedCriticalItem[]) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  conflicts: [],
  lastError: null,
  failedCriticalItems: [],
  setIsSyncing: (v) => set({ isSyncing: v }),
  setPendingCount: (v) => set({ pendingCount: v }),
  setLastSyncAt: (v) => set({ lastSyncAt: v }),
  setConflicts: (v) => set({ conflicts: v }),
  setLastError: (v) => set({ lastError: v }),
  setFailedCriticalItems: (v) => set({ failedCriticalItems: v }),
}));
