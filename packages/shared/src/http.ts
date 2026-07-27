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
  | "CANNOT_REMOVE_OWNER";

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

export async function apiRequest<TResponse>(
  baseUrl: string,
  path: string,
  options: ApiRequestOptions = {}
): Promise<TResponse> {
  const { method = "POST", token, body } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

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
