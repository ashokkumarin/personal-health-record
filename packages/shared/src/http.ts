export type ApiErrorCode =
  | "EMAIL_ALREADY_REGISTERED"
  | "INVALID_CREDENTIALS"
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "ALREADY_MEMBER"
  | "ALREADY_LINKED"
  | "FAMILY_NAME_TAKEN"
  | "CANNOT_REMOVE_OWNER"
  | "CANNOT_DELETE_SELF"
  | "CANNOT_MODIFY_ADMIN";

export interface ApiError {
  error: ApiErrorCode;
  details?: unknown;
}

export class ApiRequestError extends Error {
  constructor(public status: number, public body: ApiError) {
    super(body.error);
  }
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
}

// Set once at app startup (web/mobile each call this with their own value) so
// every request — without threading it through every client method — tells
// the server's audit log which app an action came from. Left unset, the
// server defaults to attributing the action to "API".
let clientSource: "web" | "mobile" | undefined;

export function setClientSource(source: "web" | "mobile") {
  clientSource = source;
}

export function getClientSource(): "web" | "mobile" | undefined {
  return clientSource;
}

export async function apiRequest<TResponse>(
  baseUrl: string,
  path: string,
  options: ApiRequestOptions = {}
): Promise<TResponse> {
  const { method = "POST", token, body } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (clientSource) headers["X-Client"] = clientSource;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = res.status === 204 ? undefined : await res.json();
  if (!res.ok) {
    throw new ApiRequestError(res.status, data as ApiError);
  }
  return data as TResponse;
}
