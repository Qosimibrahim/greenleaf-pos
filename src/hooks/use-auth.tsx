import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

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
  signIn: async () => {},
  signUp: async () => {},
  signOut: () => {},
});

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    fetch("/api/auth/session", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
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
    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).message || "Sign-in failed");
    }
    const data = await res.json();
    saveToken(data.access_token);
    setUser(parseUser(data.user));
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName?: string) => {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Sign-up failed");
      }
      const data = await res.json();
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
