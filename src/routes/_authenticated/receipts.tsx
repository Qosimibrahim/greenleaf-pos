import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { money, shortDate } from "@/lib/format";
import { Printer, Receipt as ReceiptIcon } from "lucide-react";
import { ReceiptModal, type ReceiptData } from "@/components/receipt-modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/receipts")({
  component: ReceiptsPage,
});

function ReceiptsPage() {
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);

  const { data: receipts = [] } = useQuery({
    queryKey: ["receipts"],
    queryFn: () => api.get<any[]>("/receipts"),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api.get<any[]>("/invoices"),
  });

  function openReceipt(receipt: any) {
    const inv = invoices.find((i: any) => i.id === receipt.invoice_id);
    if (!inv) return;
    setSelectedReceipt({
      invoice_number: inv.invoice_number,
      issue_date: inv.issue_date,
      paid_at: inv.paid_at,
      payment_method: receipt.payment_method,
      subtotal: inv.subtotal,
      tax_amount: inv.tax_amount,
      tax_rate: inv.tax_rate,
      total: inv.total,
      discount_amount: inv.discount_amount,
      line_items: (inv.line_items ?? []).map((l: any) => ({
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        line_total: l.line_total,
      })),
      client_name: inv.clients?.name,
      client_company: inv.clients?.company,
    });
  }

  return (
    <div>
      <PageHeader
        title="Receipts"
        description="Every paid invoice — print or reprint on demand."
      />
      <div className="px-8 py-6">
        <Card className="overflow-hidden border-border/70 bg-surface p-0 shadow-card rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Invoice</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <ReceiptIcon className="h-10 w-10 opacity-30" />
                      <p className="text-sm">No receipts yet. Complete a checkout to generate one.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {receipts.map((r: any) => {
                const inv = invoices.find((i: any) => i.id === r.invoice_id);
                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => openReceipt(r)}
                  >
                    <TableCell className="font-mono text-xs font-semibold text-primary">
                      {inv?.invoice_number ?? r.invoice_id?.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">
                        {inv?.clients?.company || inv?.clients?.name || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-lg bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                        {r.payment_method ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {shortDate(r.createdAt)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {money(r.amount_paid)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 rounded-lg text-xs"
                        onClick={(e) => { e.stopPropagation(); openReceipt(r); }}
                        id={`print-receipt-${r.id}`}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Print
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      <ReceiptModal
        open={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        receipt={selectedReceipt}
      />
    </div>
  );
}
