import { z } from "zod";
import { apiRequest } from "./http.js";
import type { User } from "./auth.js";

export const createFamilySchema = z.object({
  name: z.string().min(1, "Family name is required"),
});

export type CreateFamilyInput = z.infer<typeof createFamilySchema>;

const memberCommonFields = {
  name: z.string().min(1, "Name is required"),
  relation: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
};

export const addMemberSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("no_account"), ...memberCommonFields }),
  z.object({
    mode: z.literal("new_account"),
    ...memberCommonFields,
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
  }),
  z.object({
    mode: z.literal("link_existing"),
    ...memberCommonFields,
    existingUserEmail: z.string().email("Enter a valid email address"),
  }),
]);

export type AddMemberInput = z.infer<typeof addMemberSchema>;

export type FamilyRole = "OWNER" | "ADMIN" | "MEMBER";
export type MembershipStatus = "ACTIVE" | "PENDING";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface FamilyMembership {
  id: string;
  familyId: string;
  userId: string;
  role: FamilyRole;
  status: MembershipStatus;
  relation: string | null;
  user: Pick<User, "id" | "name" | "email">;
  createdAt: string;
}

export interface PatientProfile {
  id: string;
  familyId: string;
  linkedUserId: string | null;
  name: string;
  dateOfBirth: string | null;
  gender: string | null;
  visibleToFamily: boolean;
  createdAt: string;
}

export interface Family {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  myRole?: FamilyRole;
}

export interface FamilyDetail extends Family {
  memberships: FamilyMembership[];
  patients: PatientProfile[];
}

export interface ApprovalRequest {
  id: string;
  patientId: string;
  targetUserId: string;
  requestedById: string;
  status: ApprovalStatus;
  createdAt: string;
  patient: PatientProfile;
}

export function createFamilyClient(baseUrl: string, token: string) {
  return {
    createFamily: (input: CreateFamilyInput) =>
      apiRequest<Family>(baseUrl, "/families", { token, body: input }),
    listFamilies: () =>
      apiRequest<Family[]>(baseUrl, "/families", { method: "GET", token }),
    getFamily: (familyId: string) =>
      apiRequest<FamilyDetail>(baseUrl, `/families/${familyId}`, { method: "GET", token }),
    renameFamily: (familyId: string, name: string) =>
      apiRequest<Family>(baseUrl, `/families/${familyId}`, {
        method: "PATCH",
        token,
        body: { name },
      }),
    deleteFamily: (familyId: string) =>
      apiRequest<void>(baseUrl, `/families/${familyId}`, { method: "DELETE", token }),
    promoteAdmin: (familyId: string, userId: string) =>
      apiRequest<FamilyMembership>(baseUrl, `/families/${familyId}/admins`, {
        token,
        body: { userId },
      }),
    addMember: (familyId: string, input: AddMemberInput) =>
      apiRequest<PatientProfile>(baseUrl, `/families/${familyId}/members`, {
        token,
        body: input,
      }),
    removeMember: (familyId: string, userId: string) =>
      apiRequest<void>(baseUrl, `/families/${familyId}/members/${userId}`, {
        method: "DELETE",
        token,
      }),
    listApprovals: () =>
      apiRequest<ApprovalRequest[]>(baseUrl, "/approval-requests", { method: "GET", token }),
    approve: (id: string) =>
      apiRequest<ApprovalRequest>(baseUrl, `/approval-requests/${id}/approve`, { token, body: {} }),
    reject: (id: string) =>
      apiRequest<ApprovalRequest>(baseUrl, `/approval-requests/${id}/reject`, { token, body: {} }),
  };
}

export type FamilyClient = ReturnType<typeof createFamilyClient>;
