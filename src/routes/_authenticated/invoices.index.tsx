import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { money, shortDate } from "@/lib/format";
import { useRole } from "@/hooks/use-role";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/invoices/")({
  component: InvoicesList,
});

function InvoicesList() {
  const { isAdmin } = useRole();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api.get<any[]>("/invoices"),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter((inv: any) => {
      if (status !== "all" && inv.status !== status) return false;
      if (!q) return true;
      return (
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.clients?.name?.toLowerCase().includes(q) ||
        inv.clients?.company?.toLowerCase().includes(q)
      );
    });
  }, [invoices, search, status]);

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Every document, from draft to paid."
        actions={
          <Button asChild size="sm" className="rounded-xl">
            <Link to="/invoices/new"><Plus className="mr-1.5 h-4 w-4" /> New invoice</Link>
          </Button>
        }
      />
      <div className="px-8 py-6">
        <Card className="border-border/70 bg-surface p-4 shadow-card rounded-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="invoice-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice # or client…"
                className="pl-9 rounded-xl"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px] rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partially_paid">Partially Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="mt-4 overflow-hidden border-border/70 bg-surface p-0 shadow-card rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Invoice</TableHead>
                <TableHead>Client</TableHead>
                {isAdmin && <TableHead>Issued By</TableHead>}
                <TableHead>Issued</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 8 : 7} className="py-16 text-center text-sm text-muted-foreground">
                    No invoices found.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((inv: any) => {
                const total = Number(inv.total ?? 0);
                const paid = Number(inv.amount_paid ?? (inv.status === "paid" ? total : 0));
                const balance = Math.max(0, total - paid);
                const isDelivered = inv.delivery_status === "delivered";
                const issuerName = inv.created_by_user?.fullName || inv.created_by || inv.created_by_user?.email || "System";

                return (
                  <TableRow
                    key={inv.id}
                    className="cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => window.location.assign(`/invoices/${inv.id}`)}
                  >
                    <TableCell className="font-mono text-xs font-semibold">{inv.invoice_number}</TableCell>
                    <TableCell>
                      <div className="font-medium">{inv.custom_client?.name || inv.clients?.company || inv.clients?.name || "Walk-in Customer"}</div>
                      {(inv.custom_client?.company || inv.clients?.company) && (
                        <div className="text-xs text-muted-foreground">{inv.custom_client?.company || inv.clients?.company}</div>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="text-xs font-medium text-foreground">{issuerName}</div>
                        {inv.created_by_user?.role && (
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{inv.created_by_user.role}</div>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-xs">{shortDate(inv.issue_date)}</TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${isDelivered ? "bg-success/15 text-success border-success/30" : "bg-amber-500/15 text-amber-600 border-amber-500/30"}`}>
                        {isDelivered ? "Delivery Status: Yes" : "Delivery Status: No"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">{money(total)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold text-primary">
                      {balance > 0 ? money(balance) : <span className="text-success text-xs font-normal">Fully Paid</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

