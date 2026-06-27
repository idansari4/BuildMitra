import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, loadToken, setToken } from "./api";

export type User = {
  id: string; name: string; mobile: string; role: "worker" | "contractor" | "client";
  photo?: string | null; skills?: string[]; experience_years?: number;
  daily_wage?: number; available?: boolean; city?: string; company_name?: string;
  rating_avg?: number; rating_count?: number; referral_code?: string;
  wallet_balance?: number;
};

type Ctx = {
  user: User | null;
  loading: boolean;
  login: (mobile: string, password: string) => Promise<User>;
  register: (b: { name: string; mobile: string; password: string; role: string }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const tok = await loadToken();
    if (!tok) { setUser(null); return; }
    try {
      const me = await api.me();
      setUser(me);
    } catch {
      await setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => { (async () => { await refresh(); setLoading(false); })(); }, [refresh]);

  const login = async (mobile: string, password: string) => {
    const r = await api.login({ mobile, password });
    await setToken(r.token);
    setUser(r.user);
    return r.user as User;
  };

  const register = async (b: { name: string; mobile: string; password: string; role: string }) => {
    const r = await api.register(b);
    await setToken(r.token);
    setUser(r.user);
    return r.user as User;
  };

  const logout = async () => {
    await setToken(null);
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, refresh, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}
