import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Boxes, Zap, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      const res = await fetch("/api/auth/session", {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (res?.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.session) throw redirect({ to: "/dashboard" });
      }
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(email, password, fullName || undefined);
        toast.success("Account created. You're signed in.");
      } else {
        await signIn(email, password);
        toast.success("Welcome back.");
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function demoLogin(demoEmail: string, demoPassword: string, role: string) {
    setLoading(true);
    try {
      await signIn(demoEmail, demoPassword);
      toast.success(`Signed in as ${role}`);
      navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "#FDFEFD" }}>
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* ── Left brand panel ─────────────────────────────────── */}
        <div
          className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12"
          style={{ background: "linear-gradient(160deg, #07102C 0%, #0d1e47 60%, #07102C 100%)" }}
        >
          {/* Subtle radial glows */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #FDFEFD 0%, transparent 70%)" }} />
            <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #FDFEFD 0%, transparent 70%)" }} />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full opacity-5" style={{ background: "radial-gradient(circle, #FDFEFD 0%, transparent 70%)" }} />
          </div>

          {/* Logo */}
          <div className="relative flex items-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center rounded-xl ring-1"
              style={{ background: "rgba(253,254,253,0.12)", ringColor: "rgba(253,254,253,0.2)" }}
            >
              <Boxes className="h-5 w-5" style={{ color: "#FDFEFD" }} />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight" style={{ color: "#FDFEFD" }}>Esoteric™</span>
              <span className="ml-1 text-sm font-light tracking-wide" style={{ color: "rgba(253,254,253,0.65)" }}>Stockroom</span>
            </div>
          </div>

          {/* Tagline block */}
          <div className="relative max-w-md">
            <p className="text-[11px] font-medium uppercase tracking-[0.25em]" style={{ color: "rgba(253,254,253,0.5)" }}>
              Operations, distilled
            </p>
            <h2 className="mt-5 font-serif text-4xl leading-tight" style={{ color: "#FDFEFD" }}>
              Inventory, invoicing and receipts — with the calm of a well-kept ledger.
            </h2>
            <p className="mt-6 text-sm leading-relaxed" style={{ color: "rgba(253,254,253,0.65)" }}>
              Scan a barcode. Draft an invoice. Print a receipt. Every action leaves a clean trail.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-4">
              {[
                { icon: Boxes, label: "Inventory" },
                { icon: BarChart3, label: "Reports" },
                { icon: Zap, label: "Fast Checkout" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="rounded-xl p-3 text-center"
                  style={{ background: "rgba(253,254,253,0.08)", border: "1px solid rgba(253,254,253,0.12)" }}
                >
                  <Icon className="mx-auto h-5 w-5 mb-1.5" style={{ color: "#FDFEFD" }} />
                  <p className="text-xs font-medium" style={{ color: "rgba(253,254,253,0.8)" }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="relative text-[11px] uppercase tracking-[0.2em]" style={{ color: "rgba(253,254,253,0.35)" }}>
            v2.0 · Built for modern teams
          </p>
        </div>

        {/* ── Right auth form ───────────────────────────────────── */}
        <div className="flex items-center justify-center px-6 py-16 lg:px-12" style={{ background: "#FDFEFD" }}>
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="mb-8 flex items-center gap-2.5 lg:hidden">
              <div
                className="grid h-9 w-9 place-items-center rounded-xl"
                style={{ background: "#07102C" }}
              >
                <Boxes className="h-4 w-4" style={{ color: "#FDFEFD" }} />
              </div>
              <div>
                <span className="text-sm font-bold tracking-tight" style={{ color: "#07102C" }}>Esoteric™</span>
                <span className="ml-1 text-sm font-light" style={{ color: "#6b7280" }}>Stockroom</span>
              </div>
            </div>

            <h1 className="font-serif text-3xl leading-none" style={{ color: "#07102C" }}>
              {mode === "signin" ? "Sign in" : "Create account"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Access your workspace."
                : "The first account becomes the workspace admin."}
            </p>

            <Card className="mt-8 p-6 shadow-card" style={{ background: "#ffffff", border: "1px solid #dde1eb" }}>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {mode === "signup" && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="fullname" style={{ color: "#07102C" }}>Full name</Label>
                    <Input
                      id="fullname"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Doe"
                    />
                  </div>
                )}
                <div className="grid gap-1.5">
                  <Label htmlFor="email" style={{ color: "#07102C" }}>Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="password" style={{ color: "#07102C" }}>Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button
                  id="auth-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="mt-2 font-semibold"
                  style={{ background: "#07102C", color: "#FDFEFD" }}
                >
                  {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>

              {/* ── Demo access ─────────────────────────────────── */}
              <div className="mt-5 rounded-xl border border-dashed p-3" style={{ borderColor: "#dde1eb", background: "#f5f6f9" }}>
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  One-click demo access
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Instantly sign in with a pre-seeded role account.
                </p>
                <div className="mt-2 grid gap-2">
                  {[
                    {
                      role: "Admin",
                      email: "admin@clientapp.demo",
                      password: "AdminDemo123!",
                      badge: "Full Access",
                    },
                    {
                      role: "Cashier",
                      email: "cashier@clientapp.demo",
                      password: "CashierDemo123!",
                      badge: "POS Only",
                    },
                  ].map((d) => (
                    <button
                      key={d.email}
                      id={`demo-login-${d.role.toLowerCase()}`}
                      type="button"
                      disabled={loading}
                      onClick={() => demoLogin(d.email, d.password, d.role)}
                      className="flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition disabled:opacity-50"
                      style={{
                        background: "#ffffff",
                        border: "1px solid #dde1eb",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#07102C";
                        (e.currentTarget as HTMLButtonElement).style.background = "#f0f1f4";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#dde1eb";
                        (e.currentTarget as HTMLButtonElement).style.background = "#ffffff";
                      }}
                    >
                      <div>
                        <p className="font-semibold" style={{ color: "#07102C" }}>Login as {d.role}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{d.email}</p>
                      </div>
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        style={{ background: "rgba(7,16,44,0.08)", color: "#07102C" }}
                      >
                        {d.badge}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signin" ? "New to Esoteric Stockroom?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="font-semibold underline-offset-4 hover:underline"
                style={{ color: "#07102C" }}
              >
                {mode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
