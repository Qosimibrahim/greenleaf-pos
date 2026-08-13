import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money, shortDate } from "@/lib/format";
import { toast } from "sonner";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/payroll")({
  component: PayrollPage,
});

function PayrollPage() {
  const { isAdmin, loading } = useRole();
  const qc = useQueryClient();

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles", "all"],
    enabled: isAdmin,
    queryFn: () => api.get<any[]>("/profiles"),
  });
  const { data: payroll = [] } = useQuery({
    queryKey: ["staff-payroll"],
    enabled: isAdmin,
    queryFn: () => api.get<any[]>("/staff-payroll"),
  });
  const { data: runs = [] } = useQuery({
    queryKey: ["payroll-runs"],
    enabled: isAdmin,
    queryFn: () => api.get<any[]>("/payroll-runs"),
  });
  const { data: banks = [] } = useQuery({
    queryKey: ["bank-accounts"],
    enabled: isAdmin,
    queryFn: () => api.get<any[]>("/bank-accounts"),
  });

  const [bank, setBank] = useState("");
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7) + "-01");
  const [localSalaries, setLocalSalaries] = useState<Record<string, { base: number; hourly: number; hours: number }>>({});

  const rows = useMemo(() => {
    return profiles.map((p: any) => {
      const rec = payroll.find((x: any) => x.user_id === p.id);
      const local = localSalaries[p.id];
      return {
        user_id: p.id,
        email: p.email,
        name: p.fullName || p.email,
        base_salary: local?.base ?? rec?.base_salary ?? 0,
        hourly_rate: local?.hourly ?? rec?.hourly_rate ?? 0,
        hours_per_month: local?.hours ?? rec?.hours_per_month ?? 0,
        active: rec?.active ?? true,
      };
    });
  }, [profiles, payroll, localSalaries]);

  const totalGross = rows.reduce(
    (s, r) => s + (r.active ? Number(r.base_salary) + Number(r.hourly_rate) * Number(r.hours_per_month) : 0),
    0,
  );

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!isAdmin) return <div className="p-8 text-sm text-muted-foreground">Admin access required.</div>;

  async function saveRow(r: any) {
    try {
      await api.post("/staff-payroll", {
        user_id: r.user_id,
        base_salary: Number(r.base_salary),
        hourly_rate: Number(r.hourly_rate),
        hours_per_month: Number(r.hours_per_month),
        active: r.active,
      });
      toast.success("Compensation parameters saved");
      qc.invalidateQueries({ queryKey: ["staff-payroll"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save parameters");
    }
  }

  async function runPayroll() {
    if (!bank) return toast.error("Choose a register");
    if (totalGross <= 0) return toast.error("Nothing to pay");
    try {
      const run = await api.post<any>("/payroll-runs", {
        period_month: period,
        bank_account_id: bank,
        total_gross: totalGross,
      });

      const items = rows
        .filter((r) => r.active)
        .map((r) => ({
          run_id: run.id,
          user_id: r.user_id,
          gross_pay: Number(r.base_salary) + Number(r.hourly_rate) * Number(r.hours_per_month),
        }))
        .filter((i) => i.gross_pay > 0);

      if (items.length) {
        await Promise.all(
          items.map((it) => api.post("/payroll-run-items", it))
        );
      }
      toast.success(`Payroll of ${money(totalGross)} processed`);
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    } catch (e: any) {
      toast.error(e.message ?? "Payroll run failed");
    }
  }

  function handleInputChange(userId: string, field: "base" | "hourly" | "hours", val: number) {
    setLocalSalaries(prev => {
      const current = prev[userId] || { base: 0, hourly: 0, hours: 0 };
      const rec = payroll.find((x: any) => x.user_id === userId);
      const base = field === "base" ? val : (current.base || rec?.base_salary || 0);
      const hourly = field === "hourly" ? val : (current.hourly || rec?.hourly_rate || 0);
      const hours = field === "hours" ? val : (current.hours || rec?.hours_per_month || 0);
      return {
        ...prev,
        [userId]: { base, hourly, hours }
      };
    });
  }

  return (
    <div>
      <PageHeader title="Payroll" description="Salaries, hourly parameters, and monthly payout runs." />
      <div className="space-y-6 px-8 py-6">
        <Card className="border-border/70 bg-surface p-5 shadow-card rounded-2xl">
          <h3 className="mb-4 font-serif text-lg">Staff compensation</h3>
          <div className="overflow-hidden rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right w-[140px]">Base salary</TableHead>
                  <TableHead className="text-right w-[120px]">Hourly</TableHead>
                  <TableHead className="text-right w-[120px]">Hrs / mo</TableHead>
                  <TableHead className="text-right w-[140px]">Gross / mo</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const gross = Number(r.base_salary) + Number(r.hourly_rate) * Number(r.hours_per_month);
                  return (
                    <TableRow key={r.user_id} className="hover:bg-muted/10 transition-colors">
                      <TableCell>
                        <p className="text-sm font-semibold">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.email}</p>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={r.base_salary}
                          onChange={(e) => handleInputChange(r.user_id, "base", Number(e.target.value))}
                          onBlur={() => saveRow(r)}
                          className="h-8 text-right text-sm rounded-lg"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={r.hourly_rate}
                          onChange={(e) => handleInputChange(r.user_id, "hourly", Number(e.target.value))}
                          onBlur={() => saveRow(r)}
                          className="h-8 text-right text-sm rounded-lg"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.5"
                          value={r.hours_per_month}
                          onChange={(e) => handleInputChange(r.user_id, "hours", Number(e.target.value))}
                          onBlur={() => saveRow(r)}
                          className="h-8 text-right text-sm rounded-lg"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-primary">{money(gross)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="rounded-lg h-8" onClick={() => saveRow(r)}>
                          Save
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="border-border/70 bg-surface p-5 shadow-card rounded-2xl">
          <h3 className="mb-4 font-serif text-lg">Run payroll</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label>Period (month)</Label>
              <Input type="date" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44 rounded-xl" />
            </div>
            <div className="grid gap-1.5">
              <Label>Pay from</Label>
              <Select value={bank} onValueChange={setBank}>
                <SelectTrigger className="w-56 rounded-xl">
                  <SelectValue placeholder="Register" />
                </SelectTrigger>
                <SelectContent>
                  {(banks as any[]).map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} · {money(b.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Total this period</p>
              <p className="font-serif text-2xl font-bold text-primary">{money(totalGross)}</p>
            </div>
            <Button onClick={runPayroll} className="rounded-xl shadow-soft">Run payroll</Button>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Period</TableHead><TableHead>Paid from</TableHead>
                  <TableHead>Run at</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">No payroll runs yet.</TableCell></TableRow>
                )}
                {(runs as any[]).map((r: any) => {
                  const bName = banks.find((b: any) => b.id === r.bank_account_id)?.name ?? r.bank_account_id;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{shortDate(r.period_month)}</TableCell>
                      <TableCell className="text-muted-foreground">{bName}</TableCell>
                      <TableCell>{shortDate(r.run_at)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{money(r.total_gross)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
