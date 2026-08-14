import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      throw redirect({ to: "/auth" });
    }
    // Verify session with the centralized API client
    const data = await api.get<any>("/auth/session").catch(() => null);

    if (!data?.session?.user) {
      localStorage.removeItem("auth_token");
      throw redirect({ to: "/auth" });
    }

    return { user: data.session.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
