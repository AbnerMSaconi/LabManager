import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth as useOidcAuth } from "react-oidc-context";
import { User, UserRole } from "../types";
import { syncWithBackend } from "../api/authApi";

// Roles válidas no sistema (devem existir no Keycloak como realm roles)
const VALID_ROLES: string[] = [
  "professor", "dti_estagiario", "dti_tecnico",
  "progex", "administrador", "super_admin",
];

// Decodifica o payload de um JWT sem verificar assinatura
// (a verificação é feita pelo backend — aqui só lemos as claims)
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const oidc = useOidcAuth();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  useEffect(() => {
    console.log("[useAuth] OIDC state:", {
      isLoading: oidc.isLoading,
      isAuthenticated: oidc.isAuthenticated,
      hasToken: !!oidc.user?.access_token,
      error: oidc.error?.message,
    });

    if (!oidc.isAuthenticated || !oidc.user?.access_token) return;

    const token = oidc.user.access_token;
    const claims = decodeJwtPayload(token);

    // Extrai role diretamente do token Keycloak (realm_access.roles)
    const realmRoles = (claims.realm_access as { roles?: string[] })?.roles ?? [];
    const role = VALID_ROLES.find(r => realmRoles.includes(r));

    if (!role) {
      setError(
        `Acesso negado: nenhuma role válida encontrada no token. ` +
        `Roles recebidas: [${realmRoles.join(", ")}]. ` +
        `Verifique as roles atribuídas ao usuário no Keycloak.`
      );
      localStorage.removeItem("access_token");
      return;
    }

    // JIT Provisioning — bloqueia o acesso até obter o JWT Python-compatível do C#
    // O JWT Keycloak NÃO é armazenado: o backend Python usa HS256 próprio
    setSyncLoading(true);
    setError(null);

    syncWithBackend(token)
      .then(dbUser => {
        // authApi.ts já armazenou o access_token Python em localStorage
        console.log("[useAuth] JIT provisioning OK, DB id:", dbUser.id);
        setUser(dbUser);
        setSyncLoading(false);
      })
      .catch(err => {
        console.error("[useAuth] JIT provisioning falhou:", err);
        setSyncLoading(false);
        setError("Não foi possível sincronizar com o servidor. Verifique se o serviço está disponível.");
        localStorage.removeItem("access_token");
      });

  }, [oidc.isAuthenticated, oidc.user?.access_token]);

  // Limpa estado ao deslogar
  useEffect(() => {
    if (!oidc.isLoading && !oidc.isAuthenticated) {
      localStorage.removeItem("access_token");
      setUser(null);
    }
  }, [oidc.isLoading, oidc.isAuthenticated]);

  const login = useCallback(async () => {
    try {
      await oidc.signinRedirect();
    } catch (err) {
      console.error("[useAuth] signinRedirect falhou:", err);
      setError(err instanceof Error ? err.message : "Não foi possível conectar ao Keycloak.");
    }
  }, [oidc]);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    setUser(null);
    oidc.removeUser();
  }, [oidc]);

  // loading = OIDC inicializando OU sync C# em andamento
  const loading = oidc.isLoading || syncLoading;

  const oidcError = oidc.error
    ? "Erro ao conectar com o servidor de autenticação. Verifique se o Keycloak está rodando."
    : null;

  return (
    <AuthContext.Provider value={{ user, loading, error: error ?? oidcError, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
