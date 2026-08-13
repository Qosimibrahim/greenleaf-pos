import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { ReceiptModal, type ReceiptData } from "@/components/receipt-modal";
import { cn } from "@/lib/utils";
import {
  Trash2,
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
  Keyboard,
  ScanLine,
  MoreHorizontal,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/scan")({
  component: ScanCheckoutPage,
});

// ── Types ────────────────────────────────────────────────────────────────────

type CartLine = {
  id: string;
  product_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  sku?: string;
  imageUrl?: string;
};

// ── Stock status helper ───────────────────────────────────────────────────────

function stockBadge(qty: number, threshold = 5) {
  if (qty <= 0) return { cls: "stock-badge-out", label: "Out of stock" };
  if (qty <= threshold) return { cls: "stock-badge-low", label: `Low: ${qty}` };
  return { cls: "stock-badge-ok", label: `In stock: ${qty}` };
}

// ── Payment method config ─────────────────────────────────────────────────────

const PAY_METHODS = [
  { id: "cash",     label: "Cash",          icon: Banknote,        color: "text-success" },
  { id: "card",     label: "POS Card",      icon: CreditCard,      color: "text-primary" },
  { id: "transfer", label: "Bank Transfer", icon: ArrowRightLeft,  color: "text-warning" },
  { id: "other",    label: "Other",         icon: MoreHorizontal,  color: "text-muted-foreground" },
] as const;

type PayMethod = typeof PAY_METHODS[number]["id"];

// ── Component ─────────────────────────────────────────────────────────────────

function ScanCheckoutPage() {
  const qc = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: products = [] } = useQuery({
    queryKey: ["products", "scan"],
    queryFn: () => api.get<any[]>("/products"),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<any[]>("/clients"),
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get<any[]>("/bank-accounts"),
  });

  const { data: taxSettings } = useQuery({
    queryKey: ["tax-settings"],
    queryFn: () => api.get<any>("/tax_settings"),
  });

  // ── State ─────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartLine[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  // scanInput drives the visible <input> value
  const [scanInput, setScanInput] = useState("");
  // scannerBusy blocks re-entrant lookups
  const [scannerBusy, setScannerBusy] = useState(false);
  // scanFocused drives the animated focus ring on the scanner zone
  const [scanFocused, setScanFocused] = useState(false);
  // scanFlash briefly turns the zone green (✓) on a successful scan
  const [scanFlash, setScanFlash] = useState<"idle" | "hit" | "miss">("idle");
  const [clientId, setClientId] = useState("");
  const [bankId, setBankId] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  // Payment modal state
  const [payOpen, setPayOpen] = useState(false);
  const [payStep, setPayStep] = useState<"method" | "confirm">("method");
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");

  // Receipt state
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (taxSettings?.rate != null) setTaxRate(Number(taxSettings.rate));
  }, [taxSettings]);

  useEffect(() => {
    if (banks.length && !bankId) setBankId((banks[0] as any).id);
  }, [banks]);

  const totals = useMemo(() => {
    const subtotal  = cart.reduce((s, l) => s + l.quantity * l.unit_price, 0);
    const taxAmount = subtotal * taxRate;
    const total     = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  }, [cart, taxRate]);

  const itemCount = cart.reduce((s, l) => s + l.quantity, 0);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return products as any[];
    return (products as any[]).filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.barcode || "").includes(q),
    );
  }, [products, catalogSearch]);

  // ── Cart helpers ──────────────────────────────────────────────────────────

  function addProduct(p: any) {
    setCart((prev) => {
      const existing = prev.find((x) => x.product_id === p.id);
      if (existing) {
        toast.success(`+1 ${p.name}`);
        setLastAddedId(existing.id);
        setTimeout(() => setLastAddedId(null), 300);
        return prev.map((x) =>
          x.id === existing.id ? { ...x, quantity: x.quantity + 1 } : x,
        );
      }
      const newId = crypto.randomUUID();
      toast.success(`Added ${p.name}`);
      setLastAddedId(newId);
      setTimeout(() => setLastAddedId(null), 300);
      return [
        ...prev,
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
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((x) => (x.id === id ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x))
        .filter((x) => x.quantity > 0),
    );
  }

  function removeItem(id: string) {
    setCart((prev) => prev.filter((x) => x.id !== id));
  }

  function clearCart() {
    setCart([]);
    setCatalogSearch("");
    setClientId("");
  }

  // ── Hardware scanner integration ──────────────────────────────────────────

  // Global keyboard listener as a fallback (catches scanners when no input is focused)
  useBarcodeScanner({
    onMatch: (p) => addProduct(p),
    onNotFound: (code) => {
      toast.warning(`No product found for: ${code}`);
    },
    // Disable global listener when the dedicated barcode input has focus
    // to avoid double-processing the same scan
    enabled: document.activeElement !== barcodeInputRef.current,
  });

  // Auto-focus the dedicated barcode input on mount
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // ── handleScanInput ───────────────────────────────────────────────────────
  // Fires the instant the hardware scanner sends Enter (carriage return).
  // We read directly from the DOM input value (not React state) to guarantee
  // zero stale-closure lag — the value is always the most current character
  // stream even if React hasn't flushed the controlled update yet.
  async function handleScanInput(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" && e.key !== "Tab") return;
    e.preventDefault();

    // Read raw DOM value — faster than waiting for setState to propagate
    const code = (barcodeInputRef.current?.value ?? scanInput).trim();

    // ✦ INSTANTLY clear & refocus — happens synchronously before any await
    if (barcodeInputRef.current) {
      barcodeInputRef.current.value = "";
      barcodeInputRef.current.focus();
    }
    setScanInput("");

    if (!code || scannerBusy) return;
    setScannerBusy(true);

    try {
      // 1. Fast local lookup — no network round-trip if product is in cache
      const localMatch = (products as any[]).find(
        (p: any) =>
          (p.barcode && p.barcode === code) ||
          (p.sku && p.sku.toLowerCase() === code.toLowerCase()),
      );

      if (localMatch) {
        if (Number(localMatch.quantity) <= 0) {
          setScanFlash("miss");
          setTimeout(() => setScanFlash("idle"), 600);
          toast.warning(`${localMatch.name} is out of stock`);
        } else {
          setScanFlash("hit");
          setTimeout(() => setScanFlash("idle"), 400);
          addProduct(localMatch);
        }
        return;
      }

      // 2. Network fallback for codes not in the cached list
      const token = localStorage.getItem("stockroom_token");
      const res = await fetch(`/api/products?sku=${encodeURIComponent(code)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.status === 404) {
        setScanFlash("miss");
        setTimeout(() => setScanFlash("idle"), 600);
        toast.warning(`No product found for barcode: ${code}`);
        return;
      }
      if (!res.ok) throw new Error("Network error");

      const product = await res.json();
      if (product?.id) {
        if (Number(product.quantity) <= 0) {
          setScanFlash("miss");
          setTimeout(() => setScanFlash("idle"), 600);
          toast.warning(`${product.name} is out of stock`);
        } else {
          setScanFlash("hit");
          setTimeout(() => setScanFlash("idle"), 400);
          addProduct(product);
        }
      } else {
        setScanFlash("miss");
        setTimeout(() => setScanFlash("idle"), 600);
        toast.warning(`No product found for barcode: ${code}`);
      }
    } catch {
      setScanFlash("miss");
      setTimeout(() => setScanFlash("idle"), 600);
      toast.error("Scanner lookup failed — check connection");
    } finally {
      setScannerBusy(false);
      // Guarantee refocus even after async path
      barcodeInputRef.current?.focus();
    }
  }

  // ── Checkout flow ─────────────────────────────────────────────────────────

  function openCheckout() {
    if (cart.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    setPayStep("method");
    setPayOpen(true);
  }

  async function markSuccessful() {
    if (!bankId) {
      toast.error("Choose a register to receive funds");
      return;
    }
    setSaving(true);
    try {
      // 1. Create the invoice as draft
      const invoicePayload = {
        client_id: clientId || (clients[0] as any)?.id || "walk-in",
        status: "draft",
        issue_date: new Date().toISOString(),
        tax_rate: taxRate,
        tax_amount: totals.taxAmount,
        discount_amount: 0,
        subtotal: totals.subtotal,
        total: totals.total,
        line_items: cart.map((l) => ({
          product_id: l.product_id,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          line_total: l.quantity * l.unit_price,
        })),
      };

      const invoice = await api.post<any>("/invoices", invoicePayload);

      // 2. Post to ledger — decrements stock, creates journal entry, marks paid
      //    NOTE: The /api/ledger endpoint already creates a Receipt record internally.
      //    Do NOT call /api/receipts here — that would create a duplicate.
      const ledgerResult = await api.post<any>("/ledger", {
        invoice_id: invoice.id,
        payment_method: payMethod,
        bank_account_id: bankId,
      });

      toast.success(`Paid ${money(totals.total)} · stock updated`);
      setPayOpen(false);

      // 4. Show receipt modal
      const clientObj = clients.find((c: any) => c.id === clientId) as any;
      setReceiptData({
        invoice_number: invoice.invoice_number ?? ledgerResult.invoice_number,
        issue_date: invoice.issue_date,
        paid_at: new Date().toISOString(),
        payment_method: payMethod,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        tax_rate: taxRate,
        total: totals.total,
        discount_amount: 0,
        line_items: cart.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          line_total: l.quantity * l.unit_price,
        })),
        client_name: clientObj?.name,
        client_company: clientObj?.company,
        bank_name: (banks.find((b: any) => b.id === bankId) as any)?.name,
      });

      // Invalidate caches
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["receipts"] });
    } catch (err: any) {
      toast.error(err.message ?? "Checkout failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    if (cart.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    setSaving(true);
    try {
      const clientObj = clients[0] as any;
      await api.post<any>("/invoices", {
        client_id: clientId || clientObj?.id,
        status: "unpaid",
        issue_date: new Date().toISOString(),
        tax_rate: taxRate,
        tax_amount: totals.taxAmount,
        discount_amount: 0,
        subtotal: totals.subtotal,
        total: totals.total,
        line_items: cart.map((l) => ({
          product_id: l.product_id,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          line_total: l.quantity * l.unit_price,
        })),
      });
      toast.warning("Saved as unpaid draft");
      setPayOpen(false);
      qc.invalidateQueries({ queryKey: ["invoices"] });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save draft");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-white px-6 py-3 shadow-soft">
        <div className="flex items-center gap-3">
          <ScanLine className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Point of Sale</p>
            <p className="text-[11px] text-muted-foreground">
              Scan or tap products → cart builds on the right
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Optional client selector */}
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="h-8 w-52 text-sm rounded-xl" id="pos-client-select">
              <SelectValue placeholder="Walk-in customer…" />
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

      {/* ── Split layout ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ══ LEFT PANEL — Product Catalog (62%) ══════════════════════ */}
        <div className="flex w-[62%] flex-col overflow-hidden border-r border-border bg-background">

          {/* ══ SCANNER ZONE + SEARCH BAR ══════════════════════════════ */}
          <div className="shrink-0 border-b border-border bg-white px-5 pt-4 pb-3 space-y-3">

            {/* ─── PRIMARY SCANNER ZONE ─────────────────────────────── */}
            <div
              className={cn(
                "relative rounded-2xl border-2 transition-all duration-150",
                // Flash states
                scanFlash === "hit"  && "border-success bg-success/5 shadow-[0_0_0_4px_rgba(34,197,94,0.15)]",
                scanFlash === "miss" && "border-destructive bg-destructive/5 shadow-[0_0_0_4px_rgba(239,68,68,0.12)]",
                // Normal states
                scanFlash === "idle" && scanFocused && !scannerBusy &&
                  "border-primary bg-primary-soft/20 shadow-[0_0_0_4px_rgba(37,99,235,0.12)] scan-pulse",
                scanFlash === "idle" && scannerBusy &&
                  "border-warning/70 bg-warning/5",
                scanFlash === "idle" && !scanFocused && !scannerBusy &&
                  "border-primary/30 bg-muted/30 hover:border-primary/50",
              )}
            >
              {/* Left icon — animated when busy */}
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
                {scanFlash === "hit" ? (
                  <CheckCircle2 className="h-6 w-6 text-success" />
                ) : scanFlash === "miss" ? (
                  <XCircle className="h-6 w-6 text-destructive" />
                ) : scannerBusy ? (
                  <ScanLine className="h-6 w-6 text-warning animate-pulse" />
                ) : (
                  <ScanLine className={cn("h-6 w-6 transition-colors", scanFocused ? "text-primary" : "text-muted-foreground")} />
                )}
              </div>

              {/* The actual input */}
              <input
                ref={barcodeInputRef}
                id="pos-barcode-scan-input"
                type="text"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={handleScanInput}
                onFocus={() => setScanFocused(true)}
                onBlur={() => {
                  setScanFocused(false);
                  // Return focus unless the user clicked another interactive element (inputs, buttons, dropdowns)
                  setTimeout(() => {
                    const active = document.activeElement;
                    if (
                      !active ||
                      active === document.body ||
                      (active.tagName !== "INPUT" &&
                       active.tagName !== "TEXTAREA" &&
                       active.tagName !== "SELECT" &&
                       active.tagName !== "BUTTON")
                    ) {
                      barcodeInputRef.current?.focus();
                    }
                  }, 80);
                }}
                placeholder={
                  scanFlash === "hit"  ? "✓ Added!" :
                  scanFlash === "miss" ? "Not found — try again" :
                  scannerBusy         ? "Looking up barcode…" :
                  scanFocused         ? "Scan barcode now…" :
                                        "Point scanner here & scan barcode"
                }
                className={cn(
                  "w-full rounded-2xl border-0 bg-transparent py-0 pl-14 pr-28 outline-none",
                  "h-14 text-xl font-mono font-bold tracking-widest placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal",
                  scanFlash === "hit"  ? "text-success placeholder:text-success/70" :
                  scanFlash === "miss" ? "text-destructive placeholder:text-destructive/70" :
                  scannerBusy         ? "text-warning placeholder:text-warning/70" :
                                        "text-foreground placeholder:text-muted-foreground",
                )}
              />

              {/* Right badge */}
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {scannerBusy ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-warning">
                    <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                    READING
                  </span>
                ) : (
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    scanFocused
                      ? "bg-primary text-white"
                      : "bg-primary/10 text-primary",
                  )}>
                    <Zap className="h-3 w-3" />
                    SCANNER
                  </span>
                )}
              </div>
            </div>

            {/* Status hint row */}
            <div className="flex items-center justify-between px-1">
              <p className={cn(
                "text-[11px] transition-colors",
                scanFocused ? "text-primary font-medium" : "text-muted-foreground",
              )}>
                {scanFocused
                  ? "⚡ Ready — hardware scanner will trigger instantly on Enter"
                  : "Click the field above to activate the scanner"}
              </p>
              {cart.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {cart.reduce((s, l) => s + l.quantity, 0)} item{cart.reduce((s, l) => s + l.quantity, 0) !== 1 ? "s" : ""} in cart
                </span>
              )}
            </div>

            {/* ─── MANUAL SEARCH (secondary, compact) ──────────────── */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <input
                ref={searchRef}
                id="pos-catalog-search"
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search catalog by name, SKU, or barcode…"
                className="w-full rounded-xl border border-border bg-muted/30 py-1.5 pl-8 pr-4 text-[13px] outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-5">
            {filteredCatalog.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <Package className="h-12 w-12 opacity-20" />
                <p className="text-sm">No products found</p>
                {catalogSearch && (
                  <button
                    className="text-xs text-primary underline"
                    onClick={() => setCatalogSearch("")}
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(156px,1fr))] gap-4">
                {(filteredCatalog as any[]).map((p: any) => {
                  const { cls, label } = stockBadge(Number(p.quantity), Number(p.low_stock_threshold) || 5);
                  const outOfStock = Number(p.quantity) <= 0;
                  const cartLine = cart.find((c) => c.product_id === p.id);
                  return (
                    <button
                      key={p.id}
                      id={`product-card-${p.id}`}
                      type="button"
                      onClick={() => !outOfStock && addProduct(p)}
                      disabled={outOfStock}
                      title={outOfStock ? "Out of stock" : `Add ${p.name}`}
                      className={cn(
                        "pos-product-card text-left relative transition-transform",
                        outOfStock && "cursor-not-allowed opacity-40",
                        !outOfStock && "hover:scale-[1.02] active:scale-[0.98]",
                      )}
                    >
                      {/* Cart qty badge */}
                      {cartLine && (
                        <div className="absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-primary text-[11px] font-bold text-white shadow-elevated">
                          {cartLine.quantity}
                        </div>
                      )}

                      {/* Product image */}
                      <div className="relative aspect-square w-full overflow-hidden rounded-t-xl bg-muted">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Package className="h-8 w-8 text-muted-foreground/30" />
                          </div>
                        )}
                        {/* Stock badge */}
                        <div className="absolute bottom-2 left-2">
                          <span className={cls}>{label}</span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-3">
                        <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
                          {p.name}
                        </p>
                        {(p.sku || p.barcode) && (
                          <span className="sku-tag mt-1 inline-block">
                            {p.sku || p.barcode}
                          </span>
                        )}
                        <p className="mt-2 font-mono text-base font-bold text-primary">
                          {money(p.selling_price)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT PANEL — Live Cart (38%) ════════════════════════════ */}
        <div className="flex w-[38%] flex-col bg-white">

          {/* Cart header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Active Ticket
                {itemCount > 0 && (
                  <span className="ml-2 inline-flex h-5 items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
                    {itemCount}
                  </span>
                )}
              </span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-[11px] text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Cart lines */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-muted">
                  <ShoppingCart className="h-7 w-7 opacity-30" />
                </div>
                <p className="text-sm font-medium">Cart is empty</p>
                <p className="max-w-[200px] text-xs text-muted-foreground/70">
                  Scan a barcode or tap a product to start a ticket
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((line) => (
                  <div
                    key={line.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-3 shadow-soft transition-all",
                      lastAddedId === line.id && "ring-2 ring-primary/40 scale-[1.01]",
                    )}
                  >
                    {/* Product thumbnail */}
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {line.imageUrl ? (
                        <img
                          src={line.imageUrl}
                          alt={line.description}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>

                    {/* Name + sku */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
                        {line.description}
                      </p>
                      {line.sku && (
                        <p className="font-mono text-[10px] text-muted-foreground">{line.sku}</p>
                      )}
                      <p className="mt-0.5 font-mono text-[13px] font-bold text-primary">
                        {money(line.quantity * line.unit_price)}
                      </p>
                    </div>

                    {/* Qty controls */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQty(line.id, -1)}
                        className="grid h-6 w-6 place-items-center rounded-lg border border-border bg-white text-foreground transition hover:bg-muted"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="min-w-[1.5rem] text-center text-sm font-semibold">
                        {line.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(line.id, +1)}
                        className="grid h-6 w-6 place-items-center rounded-lg border border-primary/30 bg-primary-soft text-primary transition hover:bg-primary hover:text-white"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removeItem(line.id)}
                        className="ml-1 grid h-6 w-6 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals + checkout */}
          <div className="shrink-0 border-t border-border bg-white px-5 py-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono">{money(totals.subtotal)}</span>
              </div>
              {totals.taxAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({(taxRate * 100).toFixed(1)}%)</span>
                  <span className="font-mono">{money(totals.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-foreground">
                <span>Total</span>
                <span className="font-mono text-primary">{money(totals.total)}</span>
              </div>
            </div>

            <Button
              id="pos-checkout-btn"
              size="lg"
              className="mt-4 w-full rounded-xl text-sm font-semibold shadow-elevated"
              disabled={cart.length === 0 || saving}
              onClick={openCheckout}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Checkout · {money(totals.total)}
            </Button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          STEP 1 — Payment Method Modal
      ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={payOpen && payStep === "method"} onOpenChange={(v) => !v && setPayOpen(false)}>
        <DialogContent className="max-w-sm rounded-2xl border-border/70 shadow-modal">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Select Payment Method</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              How is the customer paying for this order?
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            {PAY_METHODS.map(({ id, label, icon: Icon, color }) => (
              <button
                key={id}
                id={`pay-method-${id}`}
                onClick={() => setPayMethod(id)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-all",
                  payMethod === id
                    ? "border-primary bg-primary-soft text-primary shadow-elevated"
                    : "border-border bg-white text-foreground hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <Icon className={cn("h-6 w-6", payMethod === id ? "text-primary" : color)} />
                {label}
              </button>
            ))}
          </div>

          {/* Bank register selector */}
          <div className="space-y-2 border-t border-border pt-3">
            <label className="text-xs font-medium text-muted-foreground">Receiving Register</label>
            <Select value={bankId} onValueChange={setBankId}>
              <SelectTrigger className="rounded-xl" id="pos-bank-select">
                <SelectValue placeholder="Select register…" />
              </SelectTrigger>
              <SelectContent>
                {(banks as any[]).map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setPayOpen(false)}
            >
              Cancel
            </Button>
            <Button
              id="pos-confirm-method-btn"
              className="flex-1 rounded-xl shadow-elevated"
              onClick={() => setPayStep("confirm")}
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════
          STEP 2 — Confirm Transaction Modal
      ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={payOpen && payStep === "confirm"} onOpenChange={(v) => { if (!v) { setPayStep("method"); setPayOpen(false); } }}>
        <DialogContent className="max-w-sm rounded-2xl border-border/70 shadow-modal">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Confirm Transaction</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Verify that the payment was received before marking as paid.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount Due</p>
            <p className="mt-1 font-mono text-3xl font-bold text-foreground">{money(totals.total)}</p>
            <p className="mt-1 text-sm text-muted-foreground capitalize">
              via {PAY_METHODS.find((m) => m.id === payMethod)?.label}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <Button
              id="pos-mark-paid-btn"
              size="lg"
              className="w-full rounded-xl gap-2 bg-success hover:bg-success/90 text-white shadow-elevated"
              onClick={markSuccessful}
              disabled={saving}
            >
              <CheckCircle2 className="h-5 w-5" />
              {saving ? "Processing…" : "Payment Successful — Mark Paid"}
            </Button>
            <Button
              id="pos-save-draft-btn"
              variant="outline"
              size="lg"
              className="w-full rounded-xl gap-2"
              onClick={saveDraft}
              disabled={saving}
            >
              <XCircle className="h-4 w-4 text-muted-foreground" />
              Save as Unpaid Draft
            </Button>
            <button
              onClick={() => setPayStep("method")}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              ← Back to payment method
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════
          Receipt preview modal (shown after successful payment)
      ═══════════════════════════════════════════════════════════════ */}
      <ReceiptModal
        open={!!receiptData}
        onClose={() => { setReceiptData(null); clearCart(); }}
        receipt={receiptData}
      />
    </div>
  );
}
