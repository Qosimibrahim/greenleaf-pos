/**
 * api.ts — Centralized Express/MongoDB API client
 * Injects Authorization: Bearer <token> from localStorage on every request.
 */

const RENDER_BACKEND_URL = "https://greenleaf-pos-api.onrender.com";

/**
 * Returns the base origin server URL without trailing slash (e.g. "https://greenleaf-pos-api.onrender.com").
 */
export function getApiOrigin(): string {
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://localhost:5000";
  }
  return RENDER_BACKEND_URL;
}

/**
 * Returns the centralized API base URL including the `/api` prefix (e.g. "https://greenleaf-pos-api.onrender.com/api").
 */
export function getApiBaseUrl(): string {
  const origin = getApiOrigin();
  return `${origin}/api`;
}

function normalizeApiPath(path: string): string {
  const base = getApiBaseUrl(); // "https://greenleaf-pos-api.onrender.com/api"

  // If full URL was passed in by mistake, return as-is
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  // Strip leading /api, api/, or / if present
  let cleanPath = path;
  if (cleanPath.startsWith("/api/")) {
    cleanPath = cleanPath.slice(5); // Removes '/api/'
  } else if (cleanPath.startsWith("api/")) {
    cleanPath = cleanPath.slice(4); // Removes 'api/'
  } else if (cleanPath.startsWith("/api")) {
    cleanPath = cleanPath.slice(4); // Removes '/api'
  } else if (cleanPath.startsWith("/")) {
    cleanPath = cleanPath.slice(1); // Removes leading '/'
  }

  return `${base}/${cleanPath}`;
}

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

function headers(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", ...extra };
  const token = getToken();
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const fullUrl = normalizeApiPath(path);
  const res = await fetch(fullUrl, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      message = err.message || message;
    } catch { }
    throw new Error(message);
  }
  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  delete: <T>(path: string) => request<T>("DELETE", path),

  /** Upload a file via multipart/form-data. Returns { url, path }. */
  upload: async (path: string, file: File): Promise<{ url: string; path: string }> => {
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    const fullUrl = normalizeApiPath(path);
    const res = await fetch(fullUrl, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).message || `Upload failed: HTTP ${res.status}`);
    }
    return res.json();
  },
};

export { getToken };