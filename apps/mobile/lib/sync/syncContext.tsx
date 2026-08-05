import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { useAuth } from "../authContext";
import { useServerConfig } from "../serverConfigContext";
import { syncStateKv } from "../db/kv";
import { runSync, type SyncResult } from "./syncEngine";

export type SyncStatus = "idle" | "syncing" | "error";

const LAST_SYNCED_KEY = "last_synced_at";

interface SyncContextValue {
  status: SyncStatus;
  lastResult: SyncResult | null;
  lastSyncedAt: string | null;
  canSync: boolean;
  sync: () => Promise<SyncResult | undefined>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

// Mounted once (see App.tsx) so foreground/AppState-triggered syncs never
// race each other — every screen reads from this same instance via
// useSyncContext() rather than each running its own sync loop.
export function SyncProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const { mode, serverUrl, deviceId, syncIntervalMinutes } = useServerConfig();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const canSync = mode === "server" && Boolean(serverUrl) && Boolean(token) && Boolean(deviceId);

  const sync = useCallback(async (): Promise<SyncResult | undefined> => {
    if (!canSync || syncingRef.current) return undefined;
    syncingRef.current = true;
    setStatus("syncing");
    try {
      const result = await runSync(serverUrl as string, token as string, deviceId);
      setLastResult(result);
      setStatus(result.ok ? "idle" : "error");
      if (result.ok) {
        const now = new Date().toISOString();
        await syncStateKv.set(LAST_SYNCED_KEY, now);
        setLastSyncedAt(now);
      }
      return result;
    } finally {
      syncingRef.current = false;
    }
  }, [canSync, serverUrl, token, deviceId]);

  useEffect(() => {
    syncStateKv.get(LAST_SYNCED_KEY).then(setLastSyncedAt);
  }, []);

  useEffect(() => {
    if (!canSync) return;
    sync();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSync]);

  // Keeps syncing while the app stays open in the foreground — the AppState
  // listener above only fires on a background→foreground transition, so a
  // session left open for hours would otherwise never sync again.
  useEffect(() => {
    if (!canSync) return;
    const intervalId = setInterval(() => sync(), syncIntervalMinutes * 60_000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSync, syncIntervalMinutes]);

  const value = useMemo<SyncContextValue>(
    () => ({ status, lastResult, lastSyncedAt, canSync, sync }),
    [status, lastResult, lastSyncedAt, canSync, sync]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSyncContext(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSyncContext must be used within a SyncProvider");
  return ctx;
}
