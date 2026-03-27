/**
 * client.ts — fetch wrapper centralizado
 * - Injeta Bearer token em todas as requisições autenticadas
 * - Redireciona para / em caso de 401
 * - Lança ApiError com detail da FastAPI
 */

const API_BASE = ""; // path relativo — o proxy do Vite/Express resolve para :8000

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem("access_token");
  } catch (e) {
    console.error("[getToken] localStorage bloqueado:", e);
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (authenticated) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { 
    ...options, 
    headers,
    cache: "no-store" 
  });
  // const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    try { localStorage.removeItem("access_token"); } catch {}
    window.location.href = "/";
    throw new ApiError(401, "Sessão expirada. Faça login novamente.");
  }

  if (!res.ok) {
    let detail = `Erro ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") {
        detail = body.detail;
      } else if (Array.isArray(body.detail)) {
        // Pydantic v2 retorna [{loc, msg, type}] — extrai as mensagens legíveis
        detail = body.detail
          .map((e: { msg?: string; loc?: unknown[] }) => {
            const loc = Array.isArray(e.loc) ? e.loc.join(".") : "";
            return loc ? `[${loc}] ${e.msg ?? JSON.stringify(e)}` : (e.msg ?? JSON.stringify(e));
          })
          .join("; ");
        console.error("[API 422] Validation errors:", body.detail);
      }
    } catch (_) {}
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) =>
    request<T>(path, { method: "GET" }),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),

  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),

  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),

  postForm: <T>(path: string, form: URLSearchParams) =>
    request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" } as HeadersInit,
      body: form.toString(),
    }),
};