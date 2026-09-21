const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const TOKEN_STORAGE_KEY = "schoolos_token";
const REFRESH_TOKEN_STORAGE_KEY = "schoolos_refresh_token";
const SUPER_ADMIN_TOKEN_STORAGE_KEY = "schoolos_super_admin_token";

export const SESSION_EXPIRED_EVENT = "schoolos:session-expired";
export const PASSWORD_CHANGE_REQUIRED_EVENT = "schoolos:password-change-required";

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

export function getStoredRefreshToken(): string | null {
  return readStorage(REFRESH_TOKEN_STORAGE_KEY);
}

export function setStoredRefreshToken(token: string | null): void {
  writeStorage(REFRESH_TOKEN_STORAGE_KEY, token);
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

interface Envelope<T> {
  data?: T;
  message?: string;
  details?: unknown;
  meta?: unknown;
}

async function send<T>(path: string, method: string, body: BodyInit | undefined, headers: Record<string, string>): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { method, headers, body });

  const isJson = response.headers.get("content-type")?.includes("application/json") ?? false;
  const payload = (isJson ? await response.json() : null) as Envelope<T> | null;

  if (!response.ok) {
    throw new ApiError(response.status, payload?.message ?? "Request failed.", payload?.details);
  }

  return (payload?.data ?? payload) as T;
}

// One refresh at a time: parallel requests that all hit an expired token wait on the same renewal.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return false;

  try {
    const session = await send<{ token: string; refreshToken: string }>(
      "/auth/refresh",
      "POST",
      JSON.stringify({ refreshToken }),
      { "Content-Type": "application/json" }
    );
    setStoredToken(session.token);
    setStoredRefreshToken(session.refreshToken);
    return true;
  } catch {
    return false;
  }
}

function endSession(): void {
  setStoredToken(null);
  setStoredRefreshToken(null);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

async function request<T>(path: string, options: ApiRequestOptions, authed: boolean, isUpload = false): Promise<T> {
  const { method = "GET", body } = options;

  const build = (): { headers: Record<string, string>; payload: BodyInit | undefined } => {
    const headers: Record<string, string> = {};
    const token = authed ? getStoredToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    if (isUpload) return { headers, payload: body as FormData };
    headers["Content-Type"] = "application/json";
    return { headers, payload: body !== undefined ? JSON.stringify(body) : undefined };
  };

  try {
    const { headers, payload } = build();
    return await send<T>(path, method, payload, headers);
  } catch (error) {
    if (!(error instanceof ApiError) || !authed) throw error;

    if (error.status === 401) {
      refreshInFlight ??= refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });
      if (await refreshInFlight) {
        const { headers, payload } = build();
        return send<T>(path, method, payload, headers);
      }
      endSession();
    }

    if (error.status === 403 && /temporary password/i.test(error.message) && typeof window !== "undefined") {
      window.dispatchEvent(new Event(PASSWORD_CHANGE_REQUIRED_EVENT));
    }
    throw error;
  }
}

export function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { auth = true } = options;
  return request<T>(path, options, auth);
}

/** Multipart upload (photos, logos, assignment files). The browser sets the multipart boundary itself. */
export function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  return request<T>(path, { method: "POST", body: formData }, true, true);
}

export function superAdminApiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = auth ? getSuperAdminToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  return send<T>(path, options.method ?? "GET", options.body !== undefined ? JSON.stringify(options.body) : undefined, headers);
}
