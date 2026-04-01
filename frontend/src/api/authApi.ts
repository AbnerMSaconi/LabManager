import { User, UserRole } from "../types";

interface SyncResponse {
  id: number;
  identifier: string;
  full_name: string;
  role: string;
  is_active: boolean;
  access_token: string; // JWT HS256 Python-compatível gerado pelo C#
}

/**
 * Chama o endpoint C# /api/v1/auth/sync com o token do Keycloak.
 * O C# valida o token via OIDC e faz JIT Provisioning do usuário no banco.
 */
export async function syncWithBackend(accessToken: string): Promise<User> {
  const res = await fetch("/api/v1/auth/sync", {
    method: "POST",
    headers: { "Authorization": `Keycloak ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Erro ${res.status} ao sincronizar com o servidor.`);
  }

  const data: SyncResponse = await res.json();
  // Armazena o JWT Python-compatível — usado em todas as chamadas ao backend Python
  localStorage.setItem("access_token", data.access_token);
  return {
    id: data.id,
    registration_number: data.identifier,
    full_name: data.full_name,
    role: data.role as UserRole,
  };
}
