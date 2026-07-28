import { createAuthClient, createFamilyClient, createRecordsClient, createUserClient } from "@phr/shared";
import { getToken } from "./auth";

// Relative path proxied to the API by app/api/[...path]/route.ts (see API_INTERNAL_URL
// there) — the browser never needs to know the API's actual host/port. Override with
// NEXT_PUBLIC_API_URL only if you need the browser to call the API directly.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export const authClient = createAuthClient(API_URL);

function requireToken() {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }
  return token;
}

export function familyClient() {
  return createFamilyClient(API_URL, requireToken());
}

export function recordsClient() {
  return createRecordsClient(API_URL, requireToken());
}

export function userClient() {
  return createUserClient(API_URL, requireToken());
}

// Nav's pending-approvals badge is fetched once and doesn't otherwise know
// when a request has been acted on from the /approvals page (no navigation
// happens, so route-change-based refreshes don't fire) — this event lets it
// refetch immediately.
export const APPROVALS_CHANGED_EVENT = "phr-approvals-changed";

export function notifyApprovalsChanged() {
  window.dispatchEvent(new Event(APPROVALS_CHANGED_EVENT));
}
