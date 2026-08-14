import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

export type AppRole = "admin" | "staff";

export interface AuthUser {
  id: string;
  email: string;
  role: AppRole;
  fullName?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => void;
}

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  loading: true,
  signIn: async () => { },
  signUp: async () => { },
  signOut: () => { },
});

// ── Config & Helpers ─────────────────────────────────────────────────────────

const TOKEN_KEY = "auth_token";

function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Convert raw API user payload to AuthUser */
function parseUser(raw: any): AuthUser {
  return {
    id: raw.id,
    email: raw.email,
    role: (raw.user_metadata?.demo_role ?? raw.role ?? "staff") as AppRole,
    fullName: raw.user_metadata?.full_name ?? raw.fullName,
  };
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api.get<any>("/auth/session")
      .then((data: any) => {
        if (data?.session?.user) {
          setUser(parseUser(data.session.user));
        } else {
          clearToken();
        }
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await api.post<any>("/auth/signin", { email, password });
    if (!data?.access_token) {
      throw new Error("Sign-in failed: Invalid token response");
    }
    saveToken(data.access_token);
    setUser(parseUser(data.user));
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName?: string) => {
      const data = await api.post<any>("/auth/signup", { email, password, fullName });
      if (!data?.access_token) {
        throw new Error("Sign-up failed: Invalid token response");
      }
      saveToken(data.access_token);
      setUser(parseUser(data.user));
    },
    [],
  );

  const signOut = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);