import type { User } from "@phr/shared";

const TOKEN_KEY = "phr_token";
const USER_KEY = "phr_user";
export const SESSION_CHANGED_EVENT = "phr-session-changed";

function notifySessionChanged() {
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

export function setSession(user: User, token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifySessionChanged();
}

export function updateStoredUser(user: User) {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifySessionChanged();
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  notifySessionChanged();
}
