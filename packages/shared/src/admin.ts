import { z } from "zod";
import { apiRequest, ApiRequestError } from "./http.js";
import type { User } from "./auth.js";
import type { FilePart } from "./records.js";
import type { AuditActorType, AuditEventType, AuditSource } from "./audit.js";

export const adminCreateUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  forceChangePassword: z.boolean(),
});

export const adminUpdateUserSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Enter a valid email address").optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
});

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const auditLogQuerySchema = z.object({
  userId: z.string().optional(),
  eventType: z
    .enum([
      "LOGIN",
      "LOGOUT",
      "REGISTER",
      "UPLOAD",
      "EDIT",
      "DELETE",
      "ADMIN_CREATE_USER",
      "ADMIN_UPDATE_USER",
      "ADMIN_DELETE_USER",
      "ADMIN_RESET_PASSWORD",
      "PASSWORD_RESET_REQUESTED",
      "PASSWORD_CHANGED",
    ])
    .optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export type AdminUser = User & {
  families: { id: string; name: string; role: "OWNER" | "ADMIN" | "MEMBER" }[];
};

export interface AuditLogEntryRecord {
  id: string;
  actorType: AuditActorType;
  userId: string | null;
  deviceId: string | null;
  eventType: AuditEventType;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  source: AuditSource;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

export interface AuditLogPage {
  entries: AuditLogEntryRecord[];
  nextCursor: string | null;
}

export interface PasswordResetRequestRecord {
  id: string;
  userId: string;
  status: "PENDING" | "RESOLVED";
  createdAt: string;
  resolvedAt: string | null;
  resolvedById: string | null;
  user: { id: string; name: string; email: string };
}

async function uploadUserPhoto(baseUrl: string, token: string, userId: string, file: FilePart): Promise<User> {
  const form = new FormData();
  if (file.blob) {
    form.append("file", file.blob, file.name);
  } else if (file.uri) {
    form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  }

  const res = await fetch(`${baseUrl}/admin/users/${userId}/photo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new ApiRequestError(res.status, data);
  }
  return data as User;
}

export function createAdminClient(baseUrl: string, token: string) {
  return {
    listUsers: () => apiRequest<AdminUser[]>(baseUrl, "/admin/users", { method: "GET", token }),
    createUser: (input: AdminCreateUserInput) =>
      apiRequest<User>(baseUrl, "/admin/users", { token, body: input }),
    updateUser: (id: string, input: AdminUpdateUserInput) =>
      apiRequest<User>(baseUrl, `/admin/users/${id}`, { method: "PATCH", token, body: input }),
    uploadUserPhoto: (id: string, file: FilePart) => uploadUserPhoto(baseUrl, token, id, file),
    deleteUser: (id: string) =>
      apiRequest<void>(baseUrl, `/admin/users/${id}`, { method: "DELETE", token }),
    resetPassword: (id: string, input: AdminResetPasswordInput) =>
      apiRequest<{ ok: true }>(baseUrl, `/admin/users/${id}/reset-password`, { token, body: input }),
    listAuditLog: (query: Partial<AuditLogQuery> = {}) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) params.set(key, String(value));
      }
      const qs = params.toString();
      return apiRequest<AuditLogPage>(baseUrl, `/admin/audit-log${qs ? `?${qs}` : ""}`, {
        method: "GET",
        token,
      });
    },
    listPasswordResetRequests: () =>
      apiRequest<PasswordResetRequestRecord[]>(baseUrl, "/admin/password-reset-requests", {
        method: "GET",
        token,
      }),
    resolvePasswordResetRequest: (id: string, input: AdminResetPasswordInput) =>
      apiRequest<{ ok: true }>(baseUrl, `/admin/password-reset-requests/${id}/resolve`, {
        token,
        body: input,
      }),
  };
}

export type AdminClient = ReturnType<typeof createAdminClient>;
