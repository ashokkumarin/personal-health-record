import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { createAuthClient, type User } from "@phr/shared";
import { useServerConfig } from "./serverConfigContext";
import { serverConfigKv } from "./db/kv";
import { recordLocalAuditEvent } from "./audit/local";
import { ensureDefaultLocalFamily } from "./data/families";

const TOKEN_KEY = "phr_token";
const USER_KEY = "phr_user";
const LOCAL_USER_ID_KEY = "local_user_id";
// Not a real JWT — RootNavigator/screens only check truthiness of `token` to
// decide whether someone's "logged in"; standalone mode has no server to
// issue a real one, so this sentinel keeps every existing token-gated check
// working unmodified.
const STANDALONE_TOKEN = "standalone";

interface AuthContextValue {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadOrCreateLocalUser(): Promise<User> {
  let id = await serverConfigKv.get(LOCAL_USER_ID_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await serverConfigKv.set(LOCAL_USER_ID_KEY, id);
  }
  return {
    id,
    name: "You",
    email: "local@device",
    createdAt: new Date(0).toISOString(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const serverConfig = useServerConfig();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (serverConfig.loading) return;

    if (serverConfig.mode === "standalone") {
      loadOrCreateLocalUser().then(async (localUser) => {
        await ensureDefaultLocalFamily(localUser.id, localUser.name);
        setUserState(localUser);
        setToken(STANDALONE_TOKEN);
        setLoading(false);
      });
      return;
    }

    if (serverConfig.mode === "server") {
      (async () => {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUserState(JSON.parse(storedUser) as User);
        }
        setLoading(false);
      })();
      return;
    }

    // mode === null: server not configured yet — RootNavigator sends the
    // user to ServerSetupScreen before anything here matters.
    setLoading(false);
  }, [serverConfig.loading, serverConfig.mode]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading,
      async login(newUser, newToken) {
        await AsyncStorage.setItem(TOKEN_KEY, newToken);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
        setToken(newToken);
        setUserState(newUser);
      },
      async logout() {
        if (serverConfig.mode === "standalone") {
          // There's no session to end — "logging out" with no server
          // configured just resets the device back to first-run setup.
          await recordLocalAuditEvent({ actorType: "USER", eventType: "LOGOUT", entityType: "user", entityId: user?.id });
          await serverConfig.reset();
          setToken(null);
          setUserState(null);
          return;
        }

        if (token && serverConfig.serverUrl) {
          try {
            await createAuthClient(serverConfig.serverUrl).logout(token);
          } catch {
            // Offline or server unreachable — the audit event still gets
            // recorded locally below and flushed on the next successful sync.
          }
        }
        await recordLocalAuditEvent({ actorType: "USER", eventType: "LOGOUT", entityType: "user", entityId: user?.id });

        await AsyncStorage.removeItem(TOKEN_KEY);
        await AsyncStorage.removeItem(USER_KEY);
        setToken(null);
        setUserState(null);
      },
      async setUser(updatedUser) {
        if (serverConfig.mode !== "standalone") {
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
        }
        setUserState(updatedUser);
      },
    }),
    [token, user, loading, serverConfig]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
