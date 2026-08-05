import { useMemo } from "react";
import {
  createFamilyClient,
  createRecordsClient,
  createUserClient,
  createAdminClient,
} from "@phr/shared";
import { useAuth } from "./authContext";
import { useServerConfig } from "./serverConfigContext";

export function useApi() {
  const { token } = useAuth();
  const { serverUrl } = useServerConfig();

  return useMemo(() => {
    if (!token || !serverUrl) return null;
    return {
      familyClient: createFamilyClient(serverUrl, token),
      recordsClient: createRecordsClient(serverUrl, token),
      userClient: createUserClient(serverUrl, token),
      adminClient: createAdminClient(serverUrl, token),
    };
  }, [token, serverUrl]);
}
