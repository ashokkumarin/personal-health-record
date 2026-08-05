import { z } from "zod";
import { apiRequest } from "./http.js";

export type AuditActorType = "USER" | "DEVICE";
// The subset of events a mobile device can record locally (offline) and
// later flush via POST /audit/sync — admin/password-reset events only ever
// happen server-side, so they're deliberately excluded here.
export type MobileAuditEventType = "LOGIN" | "LOGOUT" | "REGISTER" | "UPLOAD" | "EDIT" | "DELETE";
export type AuditEventType =
  | "LOGIN"
  | "LOGOUT"
  | "REGISTER"
  | "UPLOAD"
  | "EDIT"
  | "DELETE"
  | "ADMIN_CREATE_USER"
  | "ADMIN_UPDATE_USER"
  | "ADMIN_DELETE_USER"
  | "ADMIN_RESET_PASSWORD"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_CHANGED";
export type AuditSource = "WEB" | "MOBILE" | "API";

export const auditLogEntrySchema = z.object({
  clientId: z.string().min(1),
  actorType: z.enum(["USER", "DEVICE"]),
  eventType: z.enum(["LOGIN", "LOGOUT", "REGISTER", "UPLOAD", "EDIT", "DELETE"]),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.string(),
});

export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

export const auditSyncRequestSchema = z.object({
  deviceId: z.string().min(1),
  entries: z.array(auditLogEntrySchema),
});

export type AuditSyncRequest = z.infer<typeof auditSyncRequestSchema>;

export interface AuditSyncResponse {
  applied: number;
}

export function createAuditClient(baseUrl: string, token: string) {
  return {
    syncEntries: (deviceId: string, entries: AuditLogEntry[]) =>
      apiRequest<AuditSyncResponse>(baseUrl, "/audit/sync", {
        token,
        body: { deviceId, entries },
      }),
  };
}

export type AuditClient = ReturnType<typeof createAuditClient>;
