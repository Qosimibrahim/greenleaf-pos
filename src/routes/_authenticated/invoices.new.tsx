import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money } from "@/lib/format";
import { toast } from "sonner";
import {
  Trash2,
  ArrowLeft,
  Minus,
  Plus,
  Package,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Search,
  Zap,
  ShoppingCart,
  Receipt as ReceiptIcon,
  Printer,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { ReceiptModal, type ReceiptData } from "@/components/receipt-modal";

const searchSchema = z.object({ product: z.string().optional() });

export const Route = createFileRoute("/_authenticated/invoices/new")({
  validateSearch: (s) => searchSchema.parse(s),
  component: NewInvoice,
});

type Line = {
  id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  sku?: string;
  imageUrl?: string;
};

function stockStatus(qty: number, reorder: number = 5) {
  if (qty <= 0) return { cls: "stock-badge-out", label: "Out of stock" };
  if (qty <= reorder) return { cls: "stock-badge-low", label: `Low: ${qty}` };
  return { cls: "stock-badge-ok", label: `In stock: ${qty}` };
}

function NewInvoice() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const qc = useQueryClient();

  // ── Data Querying ────────────────────────────────────────────────────────
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<any[]>("/clients"),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", "new-invoice"],
    queryFn: () => api.get<any[]>("/products"),
  });

  const { data: taxSettings } = useQuery({
    queryKey: ["tax-settings"],
    queryFn: () => api.get<any>("/tax_settings"),
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get<any[]>("/bank-accounts"),
  });

  // ── Form State ───────────────────────────────────────────────────────────
  const [clientId, setClientId]       = useState("");
  const [issueDate, setIssueDate]     = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate]         = useState(() => new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10));
  const [taxRate, setTaxRate]         = useState(0);
  const [notes, setNotes]             = useState("");
  const [lines, setLines]             = useState<Line[]>([]);
  const [saving, setSaving]           = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  // Discount options
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState(0);

  // Checkout modal
  const [payOpen, setPayOpen]     = useState(false);
  const [payStep, setPayStep]     = useState<"method" | "confirm">("method");
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "transfer" | "other">("cash");
  const [bankId, setBankId]       = useState("");

  // Receipt Modal State
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Cart animation indicator
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  useEffect(() => {
    if (taxSettings?.rate != null) setTaxRate(Number(taxSettings.rate));
  }, [taxSettings]);

  useEffect(() => {
    if (banks.length && !bankId) setBankId((banks[0] as any).id || (banks[0] as any)._id);
  }, [banks]);

  useEffect(() => {
    if (search.product && products.length && !lines.length) {
      const p = products.find((x: any) => x.id === search.product);
      if (p) addProduct(p);
    }
  }, [search.product, products]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
    let discountAmount = 0;
    if (hasDiscount && discountValue > 0) {
      if (discountType === "percent") {
        discountAmount = (subtotal * discountValue) / 100;
      } else {
        discountAmount = discountValue;
      }
    }
    discountAmount = Math.min(subtotal, Math.max(0, discountAmount));
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxAmount = taxableAmount * taxRate;
    const total = Math.max(0, taxableAmount + taxAmount);
    return { subtotal, discountAmount, taxAmount, total };
  }, [lines, taxRate, hasDiscount, discountType, discountValue]);

  const clientObj = useMemo(
    () => clients.find((c: any) => c.id === clientId),
    [clients, clientId],
  );

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p: any) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.barcode || "").includes(q),
    );
  }, [products, catalogSearch]);

  function addProduct(p: any) {
    setLines((l) => {
      const existing = l.find((x) => x.product_id === p.id);
      if (existing) {
        toast.success(`+1 ${p.name}`);
        setLastAddedId(existing.id);
        return l.map((x) =>
          x.id === existing.id ? { ...x, quantity: x.quantity + 1 } : x,
        );
      }
      const newId = crypto.randomUUID();
      toast.success(`Added ${p.name}`);
      setLastAddedId(newId);
      return [
        ...l,
        {
          id: newId,
          product_id: p.id,
          description: p.name,
          quantity: 1,
          unit_price: Number(p.selling_price),
          sku: p.sku || p.barcode,
          imageUrl: p.imageUrl,
        },
      ];
    });
    setTimeout(() => setLastAddedId(null), 300);
  }

  // Scanner Hook
  useBarcodeScanner({
    onMatch: (p) => addProduct(p),
    onNotFound: (code) => {
      toast.error(`Product not found for SKU: ${code}`);
    },
  });

  function updateQty(id: string, delta: number) {
    setLines((l) =>
      l
        .map((x) => (x.id === id ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x))
        .filter((x) => x.quantity > 0),
    );
  }

  function removeItem(id: string) {
    setLines((l) => l.filter((x) => x.id !== id));
  }

  // ── Database persist ─────────────────────────────────────────────────────

  async function persistInvoice(status: "unpaid" | "draft" | "paid") {
    if (!clientId) {
      toast.error("Select a client first");
      return null;
    }
    if (lines.length === 0) {
      toast.error("Add at least one item to cart");
      return null;
    }
    if (status === "paid" && !bankId) {
      toast.error("Choose a register to receive funds");
      return null;
    }

    const payload = {
      client_id: clientId,
      status: status === "paid" ? "draft" : status, // Server requires draft status first to log paid via ledger API
      issue_date: new Date(issueDate).toISOString(),
      due_date: new Date(dueDate).toISOString(),
      tax_rate: taxRate,
      tax_amount: totals.taxAmount,
      discount_type: hasDiscount ? (discountType === "percent" ? "percentage" : "fixed") : "percentage",
      discount_value: hasDiscount ? discountValue : 0,
      discount_amount: totals.discountAmount,
      subtotal: totals.subtotal,
      total: totals.total,
      notes: notes || null,
      custom_bank_details: {
        bank_name: "Moniepoint MFB",
        account_name: "ESOTERIC STOCKROOM LTD",
        account_number: "9162527000",
      },
      line_items: lines.map((l) => ({
        product_id: l.product_id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        line_total: l.quantity * l.unit_price,
      })),
    };

    const invoice = await api.post<any>("/invoices", payload);

    if (status === "paid") {
      // Post transaction to double-entry ledger to mark paid + decrement stock
      await api.post("/ledger", {
        invoice_id: invoice.id,
        payment_method: payMethod,
        bank_account_id: bankId,
      });
    }

    return invoice;
  }

  async function saveDraft() {
    setSaving(true);
    try {
      const inv = await persistInvoice("unpaid");
      if (inv) {
        toast.warning("Saved as unpaid invoice");
        navigate({ to: "/invoices/$id", params: { id: inv.id } });
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save unpaid draft");
    } finally {
      setSaving(false);
    }
  }

  async function markSuccessful() {
    setSaving(true);
    try {
      const inv = await persistInvoice("paid");
      if (inv) {
        toast.success(`Charged ${money(totals.total)} · Stock updated`);
        setPayOpen(false);

        // Open Receipt Modal
        setReceiptData({
          invoice_number: inv.invoice_number,
          issue_date: inv.issue_date,
          paid_at: new Date().toISOString(),
          payment_method: payMethod,
          subtotal: totals.subtotal,
          tax_amount: totals.taxAmount,
          tax_rate: taxRate,
          total: totals.total,
          discount_amount: 0,
          line_items: lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unit_price: l.unit_price,
            line_total: l.quantity * l.unit_price,
          })),
          client_name: (clientObj as any)?.name,
          client_company: (clientObj as any)?.company,
          bank_name: (banks.find((b: any) => b.id === bankId) as any)?.name,
        });

        qc.invalidateQueries({ queryKey: ["products"] });
        qc.invalidateQueries({ queryKey: ["invoices"] });
        qc.invalidateQueries({ queryKey: ["receipts"] });
      }
    } catch (e: any) {
      toast.error(e.message ?? "Checkout failed");
    } finally {
      setSaving(false);
    }
  }

  function resetAfterReceipt() {
    setReceiptData(null);
    setLines([]);
    setNotes("");
  }

  function openCheckout() {
    setPayStep("method");
    setPayOpen(true);
  }

  async function markUnpaidDraft() {
    setSaving(true);
    try {
      const inv = await persistInvoice("unpaid");
      if (inv) {
        toast.warning("Saved as unpaid invoice");
        setPayOpen(false);
        navigate({ to: "/invoices/$id", params: { id: inv.id } });
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save unpaid draft");
    } finally {
      setSaving(false);
    }
  }

  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-white px-6 py-3 shadow-soft">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="rounded-xl gap-1.5 hover:bg-muted">
            <Link to="/invoices">
              <ArrowLeft className="h-4 w-4" /> Invoices
            </Link>
          </Button>
          <div className="h-5 w-px bg-border" />
          <div>
            <p className="text-sm font-semibold text-foreground">New Invoice Checkout</p>
            <p className="text-[11px] text-muted-foreground">
              Draft formal billing or complete instant POS checkout
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Client selector in top bar */}
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="h-8 w-56 text-sm rounded-xl" id="invoice-client-select">
              <SelectValue placeholder="Select client…" />
            </SelectTrigger>
            <SelectContent>
              {(clients as any[]).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company ? `${c.company} — ${c.name}` : c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary-soft px-2.5 py-1 text-[11px] font-medium text-primary">
            <Zap className="h-3 w-3" /> Scanner active
          </span>
        </div>
      </div>

      {/* ── Split Layout ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ══ Left panel: product selection (62%) ═════════════════════ */}
        <div className="flex w-[62%] flex-col overflow-hidden border-r border-border bg-background">
          <div className="shrink-0 border-b border-border bg-white px-5 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="invoice-catalog-search"
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Type name, SKU or scan barcode…"
                className="w-full rounded-xl border border-border bg-muted/40 py-2 pl-9 pr-4 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {filteredCatalog.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <Package className="h-12 w-12 opacity-20" />
                <p className="text-sm">No items match search filter</p>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(156px,1fr))] gap-4">
                {(filteredCatalog as any[]).map((p: any) => {
                  const { cls, label } = stockStatus(Number(p.quantity), Number(p.low_stock_threshold));
                  const out = Number(p.quantity) <= 0;
                  const cartQty = lines.find((l) => l.product_id === p.id)?.quantity ?? 0;
                  return (
                    <button
                      key={p.id}
                      id={`product-tile-${p.id}`}
                      type="button"
                      disabled={out}
                      onClick={() => addProduct(p)}
                      className={cn(
                        "pos-product-card text-left relative transition-all rounded-2xl border bg-surface overflow-hidden",
                        out ? "opacity-40 cursor-not-allowed" : "hover:scale-[1.02] hover:shadow-soft active:scale-[0.98]",
                      )}
                    >
                      {cartQty > 0 && (
                        <div className="absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-primary text-[11px] font-bold text-white shadow-elevated">
                          {cartQty}
                        </div>
                      )}
                      <div className="aspect-square bg-muted relative">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
                            <Package className="h-8 w-8" />
                          </div>
                        )}
                        <span className={cn("absolute bottom-2 left-2", cls)}>{label}</span>
                      </div>
                      <div className="p-3">
                        <p className="truncate text-xs font-semibold text-foreground leading-tight">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{p.sku}</p>
                        <p className="mt-1.5 font-mono text-sm font-bold text-primary">{money(p.selling_price)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ══ Right panel: Cart ticket + Invoice details (38%) ════════════════ */}
        <div className="flex w-[38%] flex-col bg-white overflow-hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Cart Lines</span>
            </div>
            {lines.length > 0 && (
              <button
                onClick={() => setLines([])}
                className="text-xs text-muted-foreground hover:text-destructive underline"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Due date picker / configurations */}
            <div className="grid grid-cols-2 gap-2 border-b border-border/60 pb-3">
              <div className="grid gap-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Issue Date</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="h-8 text-xs rounded-lg" />
              </div>
              <div className="grid gap-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 text-xs rounded-lg" />
              </div>
            </div>

            {lines.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                <ShoppingCart className="h-8 w-8 mx-auto opacity-20 mb-2" />
                <p className="text-xs">Ticket empty. Tap catalog items to add.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lines.map((line) => (
                  <div
                    key={line.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-2.5 shadow-soft",
                      lastAddedId === line.id && "ring-2 ring-primary/30"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold leading-tight text-foreground">{line.description}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{line.sku ?? "No SKU"}</p>
                      <p className="font-mono text-xs font-bold text-primary mt-1">{money(line.quantity * line.unit_price)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(line.id, -1)} className="p-1 border border-border rounded hover:bg-muted"><Minus className="h-3 w-3" /></button>
                      <span className="w-6 text-center text-xs font-semibold">{line.quantity}</span>
                      <button onClick={() => updateQty(line.id, 1)} className="p-1 border border-border rounded hover:bg-muted"><Plus className="h-3 w-3" /></button>
                      <button onClick={() => removeItem(line.id)} className="p-1 ml-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Discount Section ─────────────────────────────── */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5 space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-widest">Apply Discount</Label>
                <input
                  type="checkbox"
                  checked={hasDiscount}
                  onChange={(e) => setHasDiscount(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                />
              </div>
              {hasDiscount && (
                <div className="flex items-center gap-2 pt-1">
                  <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                    <SelectTrigger className="w-28 h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent %</SelectItem>
                      <SelectItem value="fixed">Fixed (₦)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
                    className="flex-1 h-8 text-xs rounded-lg font-mono"
                    placeholder={discountType === "percent" ? "e.g. 10 for 10%" : "Amount…"}
                  />
                </div>
              )}
              {hasDiscount && totals.discountAmount > 0 && (
                <p className="text-[10px] text-success font-mono">
                  Saving {money(totals.discountAmount)} on this invoice
                </p>
              )}
            </div>

            <div className="grid gap-1 pt-2">
              <Label className="text-[10px] uppercase text-muted-foreground">Invoice Notes</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal logs or client notes…"
                className="w-full rounded-xl border border-border p-2 text-xs outline-none focus:border-primary"
                rows={2}
              />
            </div>
          </div>

          <div className="shrink-0 border-t border-border bg-white px-5 py-4">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{money(totals.subtotal)}</span>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-success font-medium">
                  <span>Discount ({discountType === "percent" ? `${discountValue}%` : "Fixed"})</span>
                  <span>−{money(totals.discountAmount)}</span>
                </div>
              )}
              {totals.taxAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({(taxRate * 100).toFixed(1)}%)</span>
                  <span>{money(totals.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1.5 font-bold text-sm text-foreground">
                <span>Total</span>
                <span className="text-primary font-mono">{money(totals.total)}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                className="flex-1 rounded-xl text-xs h-10"
                onClick={saveDraft}
                disabled={saving || lines.length === 0}
              >
                Save as Unpaid
              </Button>
              <Button
                className="flex-1 rounded-xl text-xs h-10 shadow-elevated"
                onClick={openCheckout}
                disabled={saving || lines.length === 0}
                id="invoice-checkout-btn"
              >
                Checkout POS
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment methods stage 1 */}
      <Dialog open={payOpen && payStep === "method"} onOpenChange={(v) => !v && setPayOpen(false)}>
        <DialogContent className="max-w-sm rounded-2xl border-border/70 shadow-modal">
          <DialogHeader>
            <DialogTitle>Receive Payment</DialogTitle>
            <DialogDescription>Select method and receiving register.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-2">
            {[
              { id: "cash",     label: "Cash",          icon: Banknote,        color: "text-success" },
              { id: "card",     label: "POS Card",      icon: CreditCard,      color: "text-primary" },
              { id: "transfer", label: "Bank Transfer", icon: ArrowRightLeft,  color: "text-warning" },
              { id: "other",    label: "Other",         icon: MoreHorizontal,  color: "text-muted-foreground" },
            ].map(({ id, label, icon: Icon, color }) => (
              <button
                key={id}
                onClick={() => setPayMethod(id as any)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-xs font-semibold transition-all",
                  payMethod === id
                    ? "border-primary bg-primary-soft text-primary shadow-soft"
                    : "border-border bg-white text-foreground hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <Icon className={cn("h-5 w-5", payMethod === id ? "text-primary" : color)} />
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-1 pt-2">
            <Label className="text-xs text-muted-foreground">Cash Drawer / Register</Label>
            <Select value={bankId} onValueChange={setBankId}>
              <SelectTrigger className="rounded-xl h-9" id="invoice-bank-select">
                <SelectValue placeholder="Select register…" />
              </SelectTrigger>
              <SelectContent>
                {(banks as any[]).map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-3">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button id="invoice-confirm-method-btn" className="flex-1 rounded-xl shadow-elevated" onClick={() => setPayStep("confirm")}>Continue</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment confirmation stage 2 */}
      <Dialog open={payOpen && payStep === "confirm"} onOpenChange={(v) => { if (!v) { setPayStep("method"); setPayOpen(false); } }}>
        <DialogContent className="max-w-sm rounded-2xl border-border/70 shadow-modal">
          <DialogHeader>
            <DialogTitle>Confirm Checkout</DialogTitle>
            <DialogDescription>Mark paid and decrement inventory records.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Charge Amount</p>
            <p className="mt-1 font-mono text-2xl font-bold text-foreground">{money(totals.total)}</p>
            <p className="mt-1 text-xs text-muted-foreground capitalize">via {payMethod}</p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              id="invoice-mark-paid-btn"
              className="w-full rounded-xl bg-success hover:bg-success/90 text-white shadow-elevated"
              onClick={markSuccessful}
              disabled={saving}
            >
              {saving ? "Processing…" : "Mark Paid & Issue Receipt"}
            </Button>
            <Button
              id="invoice-save-unpaid-btn"
              variant="outline"
              className="w-full rounded-xl"
              onClick={markUnpaidDraft}
              disabled={saving}
            >
              Save as Unpaid
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ReceiptModal
        open={!!receiptData}
        onClose={resetAfterReceipt}
        receipt={receiptData}
      />
    </div>
  );
}
