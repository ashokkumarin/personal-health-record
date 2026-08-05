import { z } from "zod";
import { apiRequest } from "./http.js";
import type { Family, FamilyMembership, PatientProfile } from "./family.js";
import type { MedicalRecord } from "./records.js";

export type SyncEntity = "record";

export type Change<T> = T & { deleted: boolean };

export interface SyncPullResponse {
  serverTime: string;
  families: Change<Family>[];
  memberships: Change<FamilyMembership>[];
  patients: Change<PatientProfile>[];
  records: Change<MedicalRecord>[];
}

export const syncMutationSchema = z.object({
  clientId: z.string().min(1),
  entity: z.literal("record"),
  op: z.enum(["create", "update", "delete"]),
  data: z.record(z.string(), z.unknown()),
  updatedAt: z.string(),
});

export type SyncMutation = z.infer<typeof syncMutationSchema>;

export const syncPushRequestSchema = z.object({
  deviceId: z.string().min(1),
  mutations: z.array(syncMutationSchema),
});

export type SyncPushRequest = z.infer<typeof syncPushRequestSchema>;

export type SyncMutationStatus = "applied" | "stale" | "rejected";

export interface SyncPushResult {
  clientId: string;
  status: SyncMutationStatus;
}

export interface SyncPushResponse {
  serverTime: string;
  results: SyncPushResult[];
}

export function createSyncClient(baseUrl: string, token: string) {
  return {
    pull: (since: string | undefined, deviceId: string) => {
      const params = new URLSearchParams({ deviceId });
      if (since) params.set("since", since);
      return apiRequest<SyncPullResponse>(baseUrl, `/sync/pull?${params.toString()}`, {
        method: "GET",
        token,
      });
    },
    push: (body: SyncPushRequest) =>
      apiRequest<SyncPushResponse>(baseUrl, "/sync/push", { token, body }),
  };
}

export type SyncClient = ReturnType<typeof createSyncClient>;
