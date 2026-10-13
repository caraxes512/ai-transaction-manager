import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, TOKEN_KEY, UNAUTHORIZED_EVENT } from "../api";

interface AuthValue {
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * The JWT lives in localStorage. That is simple and fine for a portfolio project, but any XSS bug
 * could read it; a production app would use an httpOnly cookie (needs a small backend change).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    qc.clear(); // never show one user's cached data to the next
  }, [qc]);

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await api.login(email, password);
    localStorage.setItem(TOKEN_KEY, access_token);
    setToken(access_token);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await api.register(name, email, password);
      await login(email, password);
    },
    [login],
  );

  const value = useMemo(() => ({ token, login, register, logout }), [token, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
