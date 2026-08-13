import { useAuth } from "./use-auth";

export type AppRole = "admin" | "staff";

export function useRole() {
  const { user, role, loading } = useAuth();
  return {
    role: role ?? null,
    isAdmin: role === "admin",
    isStaff: role === "staff",
    loading,
  };
}
