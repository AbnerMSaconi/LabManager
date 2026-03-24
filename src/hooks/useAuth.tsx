import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User } from "../types";
import { login as apiLogin, getMe } from "../api/authApi";
import { ApiError } from "../api/client";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (registrationOrEmail: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Revalida token existente ao montar
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }

    getMe()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("access_token");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (registrationOrEmail: string, password: string) => {
    setError(null);
    try {
      const res = await apiLogin(registrationOrEmail, password);
      localStorage.setItem("access_token", res.access_token);
      // Monta User a partir da resposta do login
      setUser({
        id: res.user.id,
        registration_number: res.user.registration_number ?? registrationOrEmail,
        full_name: res.user.full_name ?? "Usuário",
        role: res.user.role as any,
        email: res.user.email,
      });
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Erro inesperado. Tente novamente.");
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
