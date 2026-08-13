import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { money, shortDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { productStatus } from "@/lib/format";
import { useRole } from "@/hooks/use-role";
import { FileText, ScanLine, Plus, ArrowUpRight, Boxes, Bell, TrendingUp, CircleDollarSign, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { isAdmin } = useRole();
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [products, invoices] = await Promise.all([
        api.get<any[]>("/products"),
        api.get<any[]>("/invoices"),
      ]);
      const recentInvoices = [...invoices]
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
        .slice(0, 6);
      return { products, invoices, recentInvoices };
    },
  });

  const { data: staffProfiles = [] } = useQuery({
    queryKey: ["staff-list"],
    enabled: isAdmin,
    queryFn: () => api.get<any[]>("/profiles"),
  });

  const products = data?.products ?? [];
  const invoices = data?.invoices ?? [];
  const totalInventoryValue = products.reduce(
    (s, p) => s + Number(p.unit_cost) * p.quantity,
    0,
  );
  const lowStock = products.filter((p) => p.quantity <= p.low_stock_threshold);
  
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthlyRevenue = invoices
    .filter((i) => i.status === "paid" && i.paid_at && new Date(i.paid_at) >= startOfMonth)
    .reduce((s, i) => s + Number(i.total), 0);
  const invoicedTotal = invoices.reduce((s, i) => s + Number(i.total), 0);
  const paidTotal = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.total), 0);

  // ── Cashier Performance Metrics (completely dynamic from MongoDB invoices)
  const cashierMetrics = useMemo(() => {
    if (!isAdmin) return [];
    const paidInvoices = invoices.filter((i: any) => i.status === "paid" && i.createdBy);
    const byUser = new Map<string, { userId: string; totalSales: number; totalRevenue: number; days: Set<string> }>();
    
    paidInvoices.forEach((inv: any) => {
      const uid = inv.createdBy;
      const cur = byUser.get(uid) ?? { userId: uid, totalSales: 0, totalRevenue: 0, days: new Set<string>() };
      cur.totalSales++;
      cur.totalRevenue += Number(inv.total ?? 0);
      if (inv.paid_at) {
        cur.days.add(new Date(inv.paid_at).toDateString());
      }
      byUser.set(uid, cur);
    });

    return Array.from(byUser.values())
      .map((m) => {
        const profile = (staffProfiles as any[]).find((p: any) => p.id === m.userId || p._id === m.userId);
        return {
          ...m,
          name: profile?.fullName || profile?.email || m.userId.slice(0, 8),
          role: profile?.role ?? "staff",
          avgTicket: m.totalSales > 0 ? m.totalRevenue / m.totalSales : 0,
          shiftDays: m.days.size,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [invoices, staffProfiles, isAdmin]);

  const allMetrics = [
    {
      key: "inventory",
      label: "Inventory value",
      value: money(totalInventoryValue),
      hint: `${products.length} products tracked`,
      icon: Boxes,
      adminOnly: true,
    },
    {
      key: "low",
      label: "Low stock alerts",
      value: lowStock.length.toString(),
      hint: lowStock.length ? "Needs attention" : "All good",
      icon: Bell,
      accent: lowStock.length > 0,
      adminOnly: false,
    },
    {
      key: "revenue",
      label: "Monthly revenue",
      value: money(monthlyRevenue),
      hint: "Paid invoices, month-to-date",
      icon: TrendingUp,
      adminOnly: true,
    },
    {
      key: "invoiced",
      label: "Invoiced vs paid",
      value: `${money(paidTotal)}`,
      hint: `of ${money(invoicedTotal)} invoiced`,
      icon: CircleDollarSign,
      adminOnly: true,
    },
  ];
  const metrics = allMetrics.filter((m) => isAdmin || !m.adminOnly);

  return (
    <div>
      <PageHeader
        title="Overview"
        description="A calm view of inventory, revenue and outstanding work."
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="rounded-xl gap-1.5">
              <Link to="/scan">
                <ScanLine className="mr-1.5 h-4 w-4" /> Scan
              </Link>
            </Button>
            <Button asChild size="sm" className="rounded-xl gap-1.5">
              <Link to="/invoices/new">
                <Plus className="mr-1.5 h-4 w-4" /> New invoice
              </Link>
            </Button>
          </>
        }
      />

      <div className="px-8 py-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m) => (
            <Card key={m.key} className="border-border/70 bg-surface p-5 shadow-card rounded-2xl hover:shadow-elevated transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {m.label}
                  </p>
                  <p className="mt-3 font-serif text-3xl leading-none">{m.value}</p>
                  <p className={`mt-2 text-xs ${(m as any).accent ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {m.hint}
                  </p>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                  <m.icon className="h-5 w-5" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <Card className="border-border/70 bg-surface p-6 shadow-card rounded-2xl lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl">Recent invoices</h2>
                <p className="text-xs text-muted-foreground">The last six documents.</p>
              </div>
              <Button asChild variant="ghost" size="sm" className="rounded-xl">
                <Link to="/invoices">
                  View all <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            <div className="divide-y divide-border/60">
              {(data?.recentInvoices ?? []).length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No invoices yet. Create your first from the button above.
                </p>
              )}
              {(data?.recentInvoices ?? []).map((inv: any) => (
                <Link
                  key={inv.id}
                  to="/invoices/$id"
                  params={{ id: inv.id }}
                  className="flex items-center justify-between py-3 transition hover:bg-muted/30 px-2 rounded-xl -mx-2"
                >
                  <div className="flex items-center gap-4">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.clients?.company || inv.clients?.name || "Walk-in"} · {shortDate(inv.issue_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={inv.status} />
                    <span className="w-24 text-right font-mono text-sm font-semibold">{money(inv.total)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="border-border/70 bg-surface p-6 shadow-card rounded-2xl">
            <div className="mb-4">
              <h2 className="font-serif text-xl">Low stock</h2>
              <p className="text-xs text-muted-foreground">Items at or below threshold.</p>
            </div>
            <div className="space-y-2">
              {lowStock.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">Everything stocked. ✓</p>
              )}
              {lowStock.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-background px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.quantity} left · threshold {p.low_stock_threshold}
                    </p>
                  </div>
                  <StatusBadge status={productStatus(p.quantity, p.low_stock_threshold)} />
                </div>
              ))}
              <Button asChild variant="ghost" size="sm" className="w-full justify-center rounded-xl">
                <Link to="/inventory">Manage inventory</Link>
              </Button>
            </div>
          </Card>
        </div>

        {/* ── Cashier Metrics Dashboard (Admin only) ────────────────────────── */}
        {isAdmin && cashierMetrics.length > 0 && (
          <div className="mt-8">
            <Card className="border-border/70 bg-surface p-6 shadow-card rounded-2xl">
              <div className="mb-5 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="font-serif text-xl">Cashier Performance Ledger</h2>
                <span className="ml-auto text-xs text-muted-foreground">All-time sales summary per staff member</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-border/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <th className="px-4 py-3 text-left font-medium">Cashier</th>
                      <th className="px-4 py-3 text-left font-medium">Role</th>
                      <th className="px-4 py-3 text-right font-medium">Sales Completed</th>
                      <th className="px-4 py-3 text-right font-medium">Revenue Generated</th>
                      <th className="px-4 py-3 text-right font-medium">Avg Ticket Size</th>
                      <th className="px-4 py-3 text-right font-medium">Total Shifts Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {cashierMetrics.map((m) => (
                      <tr key={m.userId} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-semibold">{m.name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${m.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {m.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{m.totalSales}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-primary">{money(m.totalRevenue)}</td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">{money(m.avgTicket)}</td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">{m.shiftDays} days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
