import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setApiToken, setUnauthorizedHandler } from "@/api";
import { tokenStorage } from "@/lib/storage";

interface AuthValue {
  token: string | null;
  ready: boolean; // false until the stored token has been read
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const apply = useCallback((t: string | null) => { setApiToken(t); setToken(t); }, []);

  useEffect(() => {
    let alive = true;
    tokenStorage.get().then((t) => { if (alive) { apply(t); setReady(true); } }).catch(() => alive && setReady(true));
    return () => { alive = false; };
  }, [apply]);

  const logout = useCallback(async () => {
    await tokenStorage.clear();
    apply(null);
    qc.clear(); // never show one user's cached data to the next
  }, [apply, qc]);

  useEffect(() => {
    setUnauthorizedHandler(() => { void logout(); }); // any 401 means the token is gone or expired
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await api.login(email, password);
    await tokenStorage.set(access_token);
    apply(access_token);
  }, [apply]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    await api.register(name, email, password);
    await login(email, password);
  }, [login]);

  const value = useMemo(() => ({ token, ready, login, register, logout }), [token, ready, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
