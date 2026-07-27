import { z } from "zod";
import { apiRequest, ApiRequestError } from "./http.js";
import type { FilePart } from "./records.js";

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Enter a valid email address").optional(),
  phone: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export function createAuthClient(baseUrl: string) {
  return {
    register: (input: RegisterInput) =>
      apiRequest<AuthResponse>(baseUrl, "/auth/register", { body: input }),
    login: (input: LoginInput) =>
      apiRequest<AuthResponse>(baseUrl, "/auth/login", { body: input }),
    logout: () => apiRequest<{ ok: true }>(baseUrl, "/auth/logout", { body: {} }),
  };
}

export type AuthClient = ReturnType<typeof createAuthClient>;

async function uploadPhoto(baseUrl: string, token: string, file: FilePart): Promise<User> {
  const form = new FormData();
  if (file.blob) {
    form.append("file", file.blob, file.name);
  } else if (file.uri) {
    // React Native's FormData accepts { uri, name, type } file descriptors.
    form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  }

  const res = await fetch(`${baseUrl}/users/me/photo`, {
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

export function createUserClient(baseUrl: string, token: string) {
  return {
    getMe: () => apiRequest<User>(baseUrl, "/users/me", { method: "GET", token }),
    updateProfile: (input: UpdateProfileInput) =>
      apiRequest<User>(baseUrl, "/users/me", { method: "PATCH", token, body: input }),
    changePassword: (input: ChangePasswordInput) =>
      apiRequest<{ ok: true }>(baseUrl, "/users/me/password", { token, body: input }),
    uploadPhoto: (file: FilePart) => uploadPhoto(baseUrl, token, file),
  };
}

export type UserClient = ReturnType<typeof createUserClient>;
