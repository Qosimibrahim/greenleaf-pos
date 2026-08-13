import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money, shortDate } from "@/lib/format";
import { useRole } from "@/hooks/use-role";
import { TrendingUp, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { isAdmin, loading } = useRole();
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const { data } = useQuery({
    queryKey: ["reports", from, to],
    enabled: isAdmin,
    queryFn: async () => {
      // /api/reports returns { entries, accounts, banks } — the full double-entry ledger
      const [report, invoices, products] = await Promise.all([
        api.get<any>(`/reports?from=${from}&to=${to}`),
        api.get<any[]>("/invoices"),
        api.get<any[]>("/products"),
      ]);
      return { ...report, invoices, products };
    },
  });

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!isAdmin)
    return <div className="p-8 text-sm text-muted-foreground">Admin access required.</div>;

  // Aggregate by account
  const byAccount = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>();
  (data?.entries ?? []).forEach((e: any) => {
    (e.journal_lines ?? []).forEach((l: any) => {
      const acc = l.chart_of_accounts ?? data?.accounts.find((a: any) => a.id === l.account_id);
      if (!acc) return;
      const cur = byAccount.get(acc.code) ?? { code: acc.code, name: acc.name, type: acc.type, debit: 0, credit: 0 };
      cur.debit += Number(l.debit || 0);
      cur.credit += Number(l.credit || 0);
      byAccount.set(acc.code, cur);
    });
  });

  const rows = Array.from(byAccount.values());
  const revenue = rows.filter((r) => r.type === "revenue").reduce((s, r) => s + (r.credit - r.debit), 0);
  const expenses = rows.filter((r) => r.type === "expense").reduce((s, r) => s + (r.debit - r.credit), 0);
  const netIncome = revenue - expenses;

  const assets = rows.filter((r) => r.type === "asset").reduce((s, r) => s + (r.debit - r.credit), 0);
  const liabilities = rows.filter((r) => r.type === "liability").reduce((s, r) => s + (r.credit - r.debit), 0);
  const equity = rows.filter((r) => r.type === "equity").reduce((s, r) => s + (r.credit - r.debit), 0);

  return (
    <div>
      <PageHeader
        title="Financial reports"
        description="Real-time P&L and Balance Sheet aggregated from the local double-entry ledger."
      />
      <div className="space-y-6 px-8 py-6">
        <Card className="flex flex-wrap items-end gap-4 border-border/70 bg-surface p-5 shadow-card rounded-2xl">
          <div className="grid gap-1.5">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44 rounded-xl" />
          </div>
          <div className="grid gap-1.5">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44 rounded-xl" />
          </div>
          <p className="ml-auto text-xs text-muted-foreground">
            Period · {shortDate(from)} → {shortDate(to)}
          </p>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Revenue" value={money(revenue)} />
          <Metric label="Expenses" value={money(expenses)} />
          <Metric label="Net income" value={money(netIncome)} accent={netIncome >= 0 ? "positive" : "negative"} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/70 bg-surface p-5 shadow-card rounded-2xl">
            <h3 className="mb-4 font-serif text-lg">Profit & Loss</h3>
            <Section title="Revenue" rows={rows.filter((r) => r.type === "revenue")} valueFn={(r) => r.credit - r.debit} />
            <div className="mt-4 flex justify-between border-t border-border pt-3 text-sm">
              <span className="font-medium">Total revenue</span>
              <span className="font-mono font-semibold">{money(revenue)}</span>
            </div>
            <Section title="Expenses" rows={rows.filter((r) => r.type === "expense")} valueFn={(r) => r.debit - r.credit} className="mt-6" />
            <div className="mt-4 flex justify-between border-t border-border pt-3 text-sm">
              <span className="font-medium">Total expenses</span>
              <span className="font-mono font-semibold">{money(expenses)}</span>
            </div>
            <div className="mt-4 flex justify-between border-t-2 border-primary pt-3">
              <span className="font-serif text-lg">Net income</span>
              <span className="font-serif text-2xl text-primary">{money(netIncome)}</span>
            </div>
          </Card>

          <Card className="border-border/70 bg-surface p-5 shadow-card rounded-2xl">
            <h3 className="mb-4 font-serif text-lg">Balance Sheet</h3>
            <Section title="Assets" rows={rows.filter((r) => r.type === "asset")} valueFn={(r) => r.debit - r.credit} />
            <div className="mt-4 flex justify-between border-t border-border pt-3 text-sm">
              <span className="font-medium">Total assets</span>
              <span className="font-mono font-semibold">{money(assets)}</span>
            </div>
            <Section title="Liabilities" rows={rows.filter((r) => r.type === "liability")} valueFn={(r) => r.credit - r.debit} className="mt-6" />
            <div className="mt-4 flex justify-between border-t border-border pt-3 text-sm">
              <span className="font-medium">Total liabilities</span>
              <span className="font-mono font-semibold">{money(liabilities)}</span>
            </div>
            <Section title="Equity" rows={rows.filter((r) => r.type === "equity")} valueFn={(r) => r.credit - r.debit} className="mt-6" />
            <div className="mt-4 flex justify-between border-t-2 border-primary pt-3">
              <span className="font-serif text-lg">Liab + Equity + Net</span>
              <span className="font-serif text-2xl text-primary">{money(liabilities + equity + netIncome)}</span>
            </div>
          </Card>
        </div>

        <Card className="border-border/70 bg-surface p-5 shadow-card rounded-2xl">
          <h3 className="mb-4 font-serif text-lg">Bank / cash registers</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(data?.banks ?? []).map((b: any) => (
              <div key={b.id} className="rounded-xl border border-border/70 bg-background p-4 hover:shadow-soft transition-shadow">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{b.kind}</p>
                <p className="mt-1 text-sm font-semibold">{b.name}</p>
                <p className="mt-2 font-serif text-2xl font-bold text-primary">{money(b.balance)}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Stock Velocity Index ──────────────────────────────────────── */}
        <StockVelocityCard invoices={data?.invoices ?? []} from={from} to={to} />

        {/* ── Invoice Summary ─────────────────────────────────────────── */}
        <InvoiceSummaryCard invoices={data?.invoices ?? []} from={from} to={to} />
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: "positive" | "negative" }) {
  return (
    <Card className="border-border/70 bg-surface p-5 shadow-card rounded-2xl">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`mt-2 font-serif text-3xl font-bold ${accent === "negative" ? "text-destructive" : "text-primary"}`}>{value}</p>
    </Card>
  );
}

function Section({
  title, rows, valueFn, className = "",
}: {
  title: string;
  rows: { code: string; name: string; debit: number; credit: number }[];
  valueFn: (r: any) => number;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      <div className="mt-2 space-y-1.5 text-sm">
        {rows.length === 0 && <p className="text-xs text-muted-foreground">No activity in this period.</p>}
        {rows.map((r) => (
          <div key={r.code} className="flex justify-between">
            <span>
              <span className="mr-2 font-mono text-xs text-muted-foreground">{r.code}</span>
              {r.name}
            </span>
            <span className="font-mono font-medium">{money(valueFn(r))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stock Velocity Index ──────────────────────────────────────────────────────

function StockVelocityCard({ invoices, from, to }: { invoices: any[]; from: string; to: string }) {
  const velocity = useMemo(() => {
    const fromDate = new Date(from + "T00:00:00Z");
    const toDate = new Date(to + "T23:59:59Z");
    const tally = new Map<string, { description: string; units: number; revenue: number }>();
    invoices
      .filter((inv: any) => inv.status === "paid" && inv.paid_at && new Date(inv.paid_at) >= fromDate && new Date(inv.paid_at) <= toDate)
      .forEach((inv: any) => {
        (inv.line_items ?? []).forEach((l: any) => {
          const key = l.description;
          const cur = tally.get(key) ?? { description: key, units: 0, revenue: 0 };
          cur.units += l.quantity;
          cur.revenue += l.line_total;
          tally.set(key, cur);
        });
      });
    return Array.from(tally.values()).sort((a, b) => b.units - a.units).slice(0, 10);
  }, [invoices, from, to]);

  return (
    <Card className="border-border/70 bg-surface p-5 shadow-card rounded-2xl">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="font-serif text-lg">Stock Velocity Index</h3>
        <span className="ml-auto text-xs text-muted-foreground">Top selling products · {shortDate(from)} – {shortDate(to)}</span>
      </div>
      {velocity.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
          <Package className="h-8 w-8 opacity-20" />
          <p className="text-sm">No sales in this period.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {velocity.map((v, i) => {
            const pct = velocity[0].units > 0 ? (v.units / velocity[0].units) * 100 : 0;
            return (
              <div key={v.description} className="flex items-center gap-3 text-sm">
                <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="truncate font-medium">{v.description}</span>
                    <span className="ml-4 shrink-0 font-mono text-xs text-muted-foreground">{v.units} units</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-sm font-semibold text-primary">{money(v.revenue)}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── Invoice Summary ───────────────────────────────────────────────────────────

function InvoiceSummaryCard({ invoices, from, to }: { invoices: any[]; from: string; to: string }) {
  const stats = useMemo(() => {
    const fromDate = new Date(from + "T00:00:00Z");
    const toDate = new Date(to + "T23:59:59Z");
    const inRange = invoices.filter((inv: any) => {
      const d = new Date(inv.createdAt ?? inv.issue_date ?? 0);
      return d >= fromDate && d <= toDate;
    });
    const paid = inRange.filter((i: any) => i.status === "paid");
    const unpaid = inRange.filter((i: any) => i.status === "unpaid");
    const draft = inRange.filter((i: any) => i.status === "draft");
    const paidTotal = paid.reduce((s: number, i: any) => s + Number(i.total), 0);
    const unpaidTotal = unpaid.reduce((s: number, i: any) => s + Number(i.total), 0);
    const avgTicket = paid.length > 0 ? paidTotal / paid.length : 0;
    return { total: inRange.length, paid: paid.length, unpaid: unpaid.length, draft: draft.length, paidTotal, unpaidTotal, avgTicket };
  }, [invoices, from, to]);

  return (
    <Card className="border-border/70 bg-surface p-5 shadow-card rounded-2xl">
      <h3 className="mb-4 font-serif text-lg">Invoice Summary · {shortDate(from)} – {shortDate(to)}</h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total Invoices", value: stats.total.toString() },
          { label: "Paid", value: stats.paid.toString() },
          { label: "Unpaid", value: stats.unpaid.toString() },
          { label: "Draft", value: stats.draft.toString() },
          { label: "Revenue Collected", value: money(stats.paidTotal) },
          { label: "Avg. Ticket", value: money(stats.avgTicket) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-background p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{s.label}</p>
            <p className="mt-1.5 font-serif text-xl font-bold text-primary">{s.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
