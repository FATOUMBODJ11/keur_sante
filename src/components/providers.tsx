"use client";

import { CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { dt, type RegisterBody } from "@/lib/client/api";
import type { PublicUser } from "@/lib/types";
import { Loading } from "./ui";

/* ---------- Notifications (toast) ---------- */

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div className="toast" role="status">
          <CircleCheck size={16} />
          {msg}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

/* ---------- Session ---------- */

interface AuthValue {
  user: PublicUser | null;
  login: (email: string, password: string) => Promise<PublicUser>;
  register: (body: RegisterBody) => Promise<PublicUser>;
  /** Met à jour l'utilisateur affiché (après modification du profil). */
  setUser: (u: PublicUser) => void;
  logout: () => void;
}

const AuthCtx = createContext<AuthValue>({
  user: null,
  login: async () => Promise.reject(),
  register: async () => Promise.reject(),
  setUser: () => {},
  logout: () => {},
});
export const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    dt.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true));
    const onLogout = () => setUser(null);
    window.addEventListener("ks:logout", onLogout);
    return () => window.removeEventListener("ks:logout", onLogout);
  }, []);

  const login = async (email: string, password: string) => {
    const r = await dt.login(email, password);
    setUser(r.user);
    return r.user;
  };
  const register: AuthValue["register"] = async (body) => {
    const r = await dt.register(body);
    setUser(r.user);
    return r.user;
  };
  const logout = () => {
    dt.logout();
    setUser(null);
    router.replace("/bienvenue");
  };

  return ready ? (
    <AuthCtx.Provider value={{ user, login, register, setUser, logout }}>{children}</AuthCtx.Provider>
  ) : (
    <Loading label="Ouverture de la session…" />
  );
}

/* ---------- Rafraîchissement du compteur « à valider » ---------- */

const RefreshCtx = createContext<() => void>(() => {});
export const useRefreshCounts = () => useContext(RefreshCtx);
export const RefreshProvider = RefreshCtx.Provider;

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  );
}

/** Redirige vers /bienvenue sans session, et inversement. */
export function useAuthRedirect(requireUser: boolean) {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (requireUser && !user) router.replace("/bienvenue");
    if (!requireUser && user) router.replace("/");
  }, [user, requireUser, router]);
  return user;
}
