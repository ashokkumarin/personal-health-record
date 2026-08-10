import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as Crypto from "expo-crypto";
import { serverConfigKv, syncStateKv } from "./db/kv";
import { CURSOR_KEY } from "./sync/syncEngine";
import { resetLocalServerMirror } from "./db/reset";

export type ServerMode = "server" | "standalone";

export const MIN_SYNC_INTERVAL_MINUTES = 1;
export const MAX_SYNC_INTERVAL_MINUTES = 180;
export const DEFAULT_SYNC_INTERVAL_MINUTES = 15;

function clampSyncInterval(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_SYNC_INTERVAL_MINUTES;
  return Math.min(MAX_SYNC_INTERVAL_MINUTES, Math.max(MIN_SYNC_INTERVAL_MINUTES, Math.round(minutes)));
}

const HEALTH_CHECK_TIMEOUT_MS = 5000;

async function checkServerHealth(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

interface ServerConfigValue {
  // True until the first-run check (SQLite read) has completed. RootNavigator
  // waits on this the same way it already waits on auth's `loading`.
  loading: boolean;
  // null means "not yet configured" — first run, before the user has chosen
  // a server address or standalone mode.
  mode: ServerMode | null;
  serverUrl: string | null;
  // null = not yet checked (or check in flight); true/false = last known
  // result. Only meaningful when mode === "server" — RootNavigator uses this
  // to avoid showing the Login screen against a server it can't reach.
  serverReachable: boolean | null;
  // Stable per-install id, generated once and persisted — sent as deviceId
  // on every sync/audit call so the server can distinguish devices.
  deviceId: string;
  syncIntervalMinutes: number;
  setServerUrl: (url: string) => Promise<void>;
  setStandalone: () => Promise<void>;
  setSyncIntervalMinutes: (minutes: number) => Promise<void>;
  recheckServer: () => Promise<void>;
  reset: () => Promise<void>;
}

const ServerConfigContext = createContext<ServerConfigValue | null>(null);

const MODE_KEY = "mode";
const URL_KEY = "server_url";
const DEVICE_ID_KEY = "device_id";
const SYNC_INTERVAL_KEY = "sync_interval_minutes";

export function ServerConfigProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ServerMode | null>(null);
  const [serverUrl, setServerUrlState] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  const [syncIntervalMinutes, setSyncIntervalMinutesState] = useState<number>(
    DEFAULT_SYNC_INTERVAL_MINUTES
  );
  const [serverReachable, setServerReachable] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      let id = await serverConfigKv.get(DEVICE_ID_KEY);
      if (!id) {
        id = Crypto.randomUUID();
        await serverConfigKv.set(DEVICE_ID_KEY, id);
      }
      setDeviceId(id);

      const storedMode = await serverConfigKv.get(MODE_KEY);
      const storedUrl = await serverConfigKv.get(URL_KEY);
      const storedInterval = await serverConfigKv.get(SYNC_INTERVAL_KEY);
      if (storedMode === "server" || storedMode === "standalone") {
        setMode(storedMode);
      }
      if (storedUrl) setServerUrlState(storedUrl);
      if (storedInterval) setSyncIntervalMinutesState(clampSyncInterval(Number(storedInterval)));
      setLoading(false);

      if (storedMode === "server" && storedUrl) {
        setServerReachable(await checkServerHealth(storedUrl));
      }
    })();
  }, []);

  const value = useMemo<ServerConfigValue>(
    () => ({
      loading,
      mode,
      serverUrl,
      serverReachable,
      deviceId,
      syncIntervalMinutes,
      async setServerUrl(url: string) {
        const normalized = url.trim().replace(/\/+$/, "");
        // A different server has no idea what this device has already
        // pulled — reset the cursor so the next pull is a full snapshot.
        // Any not-yet-pushed local mutations queued against the OLD server
        // are NOT retargeted and will not transfer; pending_mutations only
        // records intent, not which server it was queued for.
        if (normalized !== serverUrl) {
          await syncStateKv.delete(CURSOR_KEY);
        }
        await serverConfigKv.set(URL_KEY, normalized);
        await serverConfigKv.set(MODE_KEY, "server");
        setServerUrlState(normalized);
        setMode("server");
        // ServerSetupScreen already confirmed /health right before calling
        // this, so it's known-reachable — no need to re-check immediately.
        setServerReachable(true);
      },
      async setStandalone() {
        // Whatever's cached locally (families/members/documents) mirrors the
        // server account being left behind, not the device's offline-only
        // identity — clear it so offline mode starts from a clean slate
        // instead of showing the previous account's family group.
        await resetLocalServerMirror();
        await serverConfigKv.set(MODE_KEY, "standalone");
        await serverConfigKv.delete(URL_KEY);
        setServerUrlState(null);
        setMode("standalone");
      },
      async recheckServer() {
        if (!serverUrl) return;
        setServerReachable(null);
        setServerReachable(await checkServerHealth(serverUrl));
      },
      async setSyncIntervalMinutes(minutes: number) {
        const clamped = clampSyncInterval(minutes);
        await serverConfigKv.set(SYNC_INTERVAL_KEY, String(clamped));
        setSyncIntervalMinutesState(clamped);
      },
      async reset() {
        await serverConfigKv.delete(MODE_KEY);
        await serverConfigKv.delete(URL_KEY);
        setServerUrlState(null);
        setMode(null);
      },
    }),
    [loading, mode, serverUrl, serverReachable, deviceId, syncIntervalMinutes]
  );

  return <ServerConfigContext.Provider value={value}>{children}</ServerConfigContext.Provider>;
}

export function useServerConfig(): ServerConfigValue {
  const ctx = useContext(ServerConfigContext);
  if (!ctx) throw new Error("useServerConfig must be used within a ServerConfigProvider");
  return ctx;
}
