import { useMemo } from "react";
import { createAuthClient } from "@phr/shared";
import { useServerConfig } from "./serverConfigContext";

// authClient used to be a module-level singleton built from a bundle-time
// constant (EXPO_PUBLIC_API_URL). Now that the server address is chosen at
// runtime and can change, it has to be constructed lazily from whatever's
// currently configured.
export function useAuthClient() {
  const { serverUrl } = useServerConfig();
  return useMemo(() => (serverUrl ? createAuthClient(serverUrl) : null), [serverUrl]);
}
