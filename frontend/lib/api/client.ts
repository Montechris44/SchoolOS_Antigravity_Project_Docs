const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const TOKEN_STORAGE_KEY = "schoolos_token";
const SUPER_ADMIN_TOKEN_STORAGE_KEY = "schoolos_super_admin_token";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable (private mode, disabled cookies) — session simply won't persist.
  }
}

export function getStoredToken(): string | null {
  return readStorage(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  writeStorage(TOKEN_STORAGE_KEY, token);
}

// Kept in a separate storage key from the tenant session token above — a
// super admin is a wholly separate identity, so the two sessions coexist
// independently (e.g. a support engineer could have both open at once).
export function getSuperAdminToken(): string | null {
  return readStorage(SUPER_ADMIN_TOKEN_STORAGE_KEY);
}

export function setSuperAdminToken(token: string | null): void {
  writeStorage(SUPER_ADMIN_TOKEN_STORAGE_KEY, token);
}

interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, options: ApiRequestOptions, token: string | null): Promise<T> {
  const { method = "GET", body } = options;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json") ?? false;
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(response.status, payload?.message ?? "Request failed.", payload?.details);
  }

  return (payload?.data ?? payload) as T;
}

export function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { auth = true } = options;
  return request<T>(path, options, auth ? getStoredToken() : null);
}

export function superAdminApiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { auth = true } = options;
  return request<T>(path, options, auth ? getSuperAdminToken() : null);
}
