/**
 * Centralized REST API Client: src/api/client.ts
 * Directly targets https://greenleaf-pos-api.onrender.com/api for all REST requests.
 * Injects Authorization: Bearer <token> from localStorage on all authenticated requests.
 */

export const API_BASE_URL = "https://greenleaf-pos-api.onrender.com/api";
export const API_ORIGIN = "https://greenleaf-pos-api.onrender.com";

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function getApiOrigin(): string {
  return API_ORIGIN;
}

function normalizeApiPath(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  let cleanPath = path;
  if (cleanPath.startsWith("/api/")) {
    cleanPath = cleanPath.slice(5);
  } else if (cleanPath.startsWith("api/")) {
    cleanPath = cleanPath.slice(4);
  } else if (cleanPath.startsWith("/api")) {
    cleanPath = cleanPath.slice(4);
  } else if (cleanPath.startsWith("/")) {
    cleanPath = cleanPath.slice(1);
  }

  return `${API_BASE_URL}/${cleanPath}`;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", ...extra };
  const token = getToken();
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const fullUrl = normalizeApiPath(path);
  const res = await fetch(fullUrl, {
    method,
    headers: buildHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      message = err.message || message;
    } catch {}
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  delete: <T>(path: string) => request<T>("DELETE", path),

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

export default api;
