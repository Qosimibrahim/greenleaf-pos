import { Printer, X, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { money, shortDate } from "@/lib/format";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReceiptLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface ReceiptData {
  invoice_number: string;
  issue_date?: string | Date;
  paid_at?: string | Date;
  payment_method?: string;
  subtotal: number;
  tax_amount: number;
  tax_rate?: number;
  total: number;
  discount_amount?: number;
  line_items: ReceiptLineItem[];
  client_name?: string;
  client_company?: string;
  bank_name?: string;
}

interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  receipt: ReceiptData | null;
}

// ── Payment method label helper ───────────────────────────────────────────────

function payLabel(method?: string): string {
  if (!method) return "—";
  const m: Record<string, string> = {
    cash: "Cash",
    card: "POS Card",
    transfer: "Bank Transfer",
    other: "Other",
  };
  return m[method.toLowerCase()] ?? method;
}

// ── Printable Receipt Body (shared between screen + print portal) ─────────────

function ReceiptBody({ receipt, date }: { receipt: ReceiptData; date: string }) {
  return (
    <>
      {/* Store header */}
      <div className="mb-4 text-center">
        <p className="text-lg font-bold tracking-tight">StockRoom</p>
        <p className="text-[11px] text-muted-foreground">Operations · Point of Sale</p>
        <p className="mt-1 text-[10px] text-muted-foreground">{date}</p>
      </div>

      <div className="mb-3 border-t border-dashed border-border pt-3">
        <p className="text-[11px] text-muted-foreground">
          Invoice: <span className="font-semibold text-foreground">{receipt.invoice_number}</span>
        </p>
        {(receipt.client_name || receipt.client_company) && (
          <p className="text-[11px] text-muted-foreground">
            Client:{" "}
            <span className="text-foreground">
              {receipt.client_company || receipt.client_name}
            </span>
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">
          Payment: <span className="text-foreground">{payLabel(receipt.payment_method)}</span>
        </p>
      </div>

      {/* Line items */}
      <div className="mb-3 border-t border-dashed border-border pt-3">
        <div className="mb-1.5 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Item</span>
          <div className="flex gap-6">
            <span>Qty</span>
            <span className="w-20 text-right">Total</span>
          </div>
        </div>
        {receipt.line_items.map((item, i) => (
          <div key={i} className="mb-1 flex justify-between text-[11px]">
            <span className="max-w-[55%] truncate text-foreground">{item.description}</span>
            <div className="flex gap-6">
              <span className="text-muted-foreground">x{item.quantity}</span>
              <span className="w-20 text-right font-semibold">{money(item.line_total)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-t border-dashed border-border pt-3 space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{money(receipt.subtotal)}</span>
        </div>
        {(receipt.discount_amount ?? 0) > 0 && (
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Discount</span>
            <span className="text-success">−{money(receipt.discount_amount!)}</span>
          </div>
        )}
        {receipt.tax_amount > 0 && (
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">
              Tax {receipt.tax_rate ? `(${(receipt.tax_rate * 100).toFixed(1)}%)` : ""}
            </span>
            <span>{money(receipt.tax_amount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 text-sm font-bold">
          <span>TOTAL</span>
          <span>{money(receipt.total)}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 border-t border-dashed border-border pt-3 text-center text-[10px] text-muted-foreground">
        <p>Thank you for your business!</p>
        <p className="mt-0.5">Powered by StockRoom POS</p>
      </div>
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReceiptModal({ open, onClose, receipt }: ReceiptModalProps) {
  const printRootRef = useRef<HTMLDivElement | null>(null);

  // Create a hidden div appended directly to <body> for clean print isolation
  useEffect(() => {
    const el = document.createElement("div");
    el.id = "receipt-print-area";
    el.style.display = "none"; // hidden on screen; CSS reveals during print
    document.body.appendChild(el);
    printRootRef.current = el;
    return () => {
      document.body.removeChild(el);
    };
  }, []);

  if (!receipt) return null;

  const date = receipt.paid_at
    ? new Date(receipt.paid_at).toLocaleString("en-NG", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : shortDate(receipt.issue_date);

  function printReceipt() {
    document.body.classList.add("print-receipt");
    window.print();
    document.body.classList.remove("print-receipt");
  }

  return (
    <>
      {/* ── Print-only portal: appended directly to <body>, outside Dialog DOM ── */}
      {printRootRef.current &&
        createPortal(
          <ReceiptBody receipt={receipt} date={date} />,
          printRootRef.current,
        )}

      {/* ── Screen modal ── */}
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md p-0 overflow-hidden gap-0 border-border/70 shadow-modal">
          {/* Screen-only header bar */}
          <div className="flex items-center justify-between border-b border-border bg-white px-5 py-4 print:hidden">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-semibold text-foreground">Payment Receipt</p>
                <p className="text-xs text-muted-foreground">{receipt.invoice_number}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                id="receipt-print-btn"
                size="sm"
                onClick={printReceipt}
                className="gap-1.5 rounded-xl"
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl"
                onClick={onClose}
                aria-label="Close receipt"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Screen preview (not printed — the portal above handles print) */}
          <div className="bg-white px-6 py-5 font-mono text-xs leading-relaxed text-foreground print:hidden">
            <ReceiptBody receipt={receipt} date={date} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
