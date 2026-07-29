import { useMemo } from "react";
import { createFamilyClient, createRecordsClient, createUserClient } from "@phr/shared";
import { API_URL } from "./api";
import { useAuth } from "./authContext";

export function useApi() {
  const { token } = useAuth();

  return useMemo(() => {
    if (!token) return null;
    return {
      familyClient: createFamilyClient(API_URL, token),
      recordsClient: createRecordsClient(API_URL, token),
      userClient: createUserClient(API_URL, token),
    };
  }, [token]);
}
