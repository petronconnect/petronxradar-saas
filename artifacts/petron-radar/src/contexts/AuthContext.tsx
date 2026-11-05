import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

export type UserRole = "ADMIN_PETRON" | "CLIENTE_ADMIN" | "USUARIO_CLIENTE";

export interface AuthUser {
  id: number;
  email: string;
  nome: string;
  role: UserRole;
  companyId: number;
  companyName: string;
  mustSetPassword?: boolean;
  onboardingCompleted?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isClient: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((data) => setUser(data as AuthUser))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await queryClient.cancelQueries();
    queryClient.clear();
    setUser(data as AuthUser);
  }, [queryClient]);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    await queryClient.cancelQueries();
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch("/api/auth/me");
      if (user?.id !== data.id) {
        await queryClient.cancelQueries();
        queryClient.clear();
      }
      setUser(data as AuthUser);
    } catch {
      await queryClient.cancelQueries();
      queryClient.clear();
      setUser(null);
    }
  }, [user?.id, queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser,
        isAdmin: user?.role === "ADMIN_PETRON",
        isClient:
          user?.role === "CLIENTE_ADMIN" || user?.role === "USUARIO_CLIENTE",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
