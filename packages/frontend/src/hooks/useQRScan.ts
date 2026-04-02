import { useCallback, useEffect } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { qrScanRepo } from '@/db/repositories/qrScan.repository';
import { useAuthStore } from '@/store/authStore';

const BASE = import.meta.env.VITE_API_URL ?? '';

async function flushPending(token: string | null): Promise<void> {
  const pending = await qrScanRepo.getAll();
  if (pending.length === 0) return;

  const flushed: string[] = [];
  for (const scan of pending) {
    try {
      const res = await fetch(`${BASE}/api/qr/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          hive_local_id: scan.hive_local_id,
          scanned_at: scan.scanned_at,
        }),
      });
      if (res.ok) flushed.push(scan.id);
    } catch {
      // offline or error — leave in IDB for next attempt
    }
  }
  if (flushed.length > 0) await qrScanRepo.removeMany(flushed);
}

export function useQRScan() {
  const isOnline = useOnlineStatus();
  const token = useAuthStore((s) => s.token);

  // Flush any pending scans when we come back online
  useEffect(() => {
    if (isOnline) flushPending(token);
  }, [isOnline, token]);

  const recordScan = useCallback(
    async (hive_local_id: string): Promise<void> => {
      await qrScanRepo.add(hive_local_id);
      if (isOnline) await flushPending(token);
    },
    [isOnline, token]
  );

  return { recordScan };
}
