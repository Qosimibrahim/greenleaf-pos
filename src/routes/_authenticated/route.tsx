import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { getApiBaseUrl } from "@/lib/api";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      throw redirect({ to: "/auth" });
    }
    // Verify session with the local JWT API
    const res = await fetch(`${getApiBaseUrl()}/auth/session`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);

    if (!res || !res.ok) {
      localStorage.removeItem("auth_token");
      throw redirect({ to: "/auth" });
    }

    const data = await res.json().catch(() => ({}));
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
