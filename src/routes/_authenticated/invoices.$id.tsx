import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { money, shortDate, getCurrencyCode, getExchangeRate } from "@/lib/format";
import { toast } from "sonner";
import { useRole } from "@/hooks/use-role";
import {
  ArrowLeft,
  Printer,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  FileCheck,
  Truck,
  Edit3,
  Phone,
  MapPin,
  Percent,
  Coins,
  AlertCircle,
} from "lucide-react";
import { ReceiptModal, type ReceiptData } from "@/components/receipt-modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { isAdmin } = useRole();
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Pay / Deposit Dialog states
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "transfer" | "other">("cash");
  const [bankId, setBankId] = useState("");
  const [payAmountInput, setPayAmountInput] = useState<string>("");
  const [paying, setPaying] = useState(false);

  // Delivery status toggle state
  const [updatingDelivery, setUpdatingDelivery] = useState(false);

  // Edit details dialog state
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [editClient, setEditClient] = useState({ name: "", phone: "", address: "", company: "" });
  const [editBank, setEditBank] = useState({ bank_name: "", account_name: "", account_number: "" });
  const [editNotes, setEditNotes] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  // ── Dual Discount Engine State ──
  const [discountMode, setDiscountMode] = useState<"percentage" | "fixed">("percentage");
  const [discountVal, setDiscountVal] = useState<number>(0);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountDirty, setDiscountDirty] = useState(false);

  const initializedRef = useRef<string | null>(null);

  const { data: inv, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.get<any>(`/invoices/${id}`),
    staleTime: 0,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<any[]>("/products"),
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get<any[]>("/bank-accounts"),
  });

  // Initialize discount and edit form ONCE when inv is loaded or ID changes
  useEffect(() => {
    if (inv && initializedRef.current !== (inv.id || inv._id)) {
      initializedRef.current = inv.id || inv._id;

      if (inv.discount_type) setDiscountMode(inv.discount_type);
      if (inv.discount_value !== undefined && inv.discount_value > 0) {
        setDiscountVal(inv.discount_value);
        setDiscountEnabled(true);
      } else if (inv.discount_amount > 0) {
        setDiscountVal(inv.discount_amount);
        setDiscountMode("fixed");
        setDiscountEnabled(true);
      }

      const client = inv.clients;
      setEditClient({
        name: inv.custom_client?.name || client?.name || "",
        company: inv.custom_client?.company || client?.company || "",
        phone: inv.custom_client?.phone || client?.phone || "",
        address: inv.custom_client?.address || client?.address || "",
      });

      setEditBank({
        bank_name: inv.custom_bank_details?.bank_name || "Moniepoint MFB",
        account_name: inv.custom_bank_details?.account_name || "ESOTERIC STOCKROOM LTD",
        account_number: inv.custom_bank_details?.account_number || "9162527000",
      });

      setEditNotes(inv.notes || "");
    }
  }, [inv]);

  // Open Edit Details Modal with fresh initial values if state is clean
  const openEditDetailsModal = () => {
    if (inv) {
      const client = inv.clients;
      setEditClient({
        name: inv.custom_client?.name || client?.name || "",
        company: inv.custom_client?.company || client?.company || "",
        phone: inv.custom_client?.phone || client?.phone || "",
        address: inv.custom_client?.address || client?.address || "",
      });
      setEditBank({
        bank_name: inv.custom_bank_details?.bank_name || "Moniepoint MFB",
        account_name: inv.custom_bank_details?.account_name || "ESOTERIC STOCKROOM LTD",
        account_number: inv.custom_bank_details?.account_number || "9162527000",
      });
      setEditNotes(inv.notes || "");
    }
    setEditDetailsOpen(true);
  };

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!inv) return <div className="p-8 text-sm text-destructive">Invoice not found.</div>;

  const client = inv.clients;
  const activeBanks = banks.filter((b: any) => b.is_active !== false);

  // ── Computed Financial Totals ──────────────────────────────────────────
  const baseSubtotal = Number(inv.subtotal ?? 0);
  const savedTaxRate = Number(inv.tax_rate ?? 0.075);

  let discountAmt = 0;
  if (discountEnabled && discountVal > 0) {
    if (discountMode === "percentage") {
      discountAmt = parseFloat(((discountVal / 100) * baseSubtotal).toFixed(2));
    } else {
      discountAmt = parseFloat(discountVal.toFixed(2));
    }
  } else if (!discountDirty && inv.discount_amount > 0) {
    discountAmt = Number(inv.discount_amount);
  }
  discountAmt = Math.min(baseSubtotal, Math.max(0, discountAmt));

  const netAfterDisc = baseSubtotal - discountAmt;
  const taxAmt = parseFloat((netAfterDisc * savedTaxRate).toFixed(2));
  const grandTotal = parseFloat((netAfterDisc + taxAmt).toFixed(2));

  // ── Requirement 1: Explicit Ledger Math & Exchange Rate Normalization ──
  const displayRate = getExchangeRate();
  const amountPaid = Number(inv.amount_paid ?? (inv.status === "paid" ? grandTotal : 0));
  const balanceDue = Math.max(0, parseFloat((grandTotal - amountPaid).toFixed(2)));
  const deliveryStatus = inv.delivery_status || "pending";
  const currencyCode = getCurrencyCode();
  const isPartiallyPaid = inv.status === "partially_paid" || (amountPaid > 0 && balanceDue > 0);

  // Effective Balance Due in Displayed/Converted Currency
  const displayBalanceDue = parseFloat((balanceDue * displayRate).toFixed(2));

  // Display information merged with custom editable overrides
  const displayClient = {
    name: editClient.name || client?.name || "Walk-in Customer",
    company: editClient.company || client?.company || "",
    phone: editClient.phone || client?.phone || "",
    address: editClient.address || client?.address || "",
  };

  const displayBank = {
    bank_name: editBank.bank_name || inv.custom_bank_details?.bank_name || "Moniepoint MFB",
    account_name: editBank.account_name || inv.custom_bank_details?.account_name || "ESOTERIC STOCKROOM LTD",
    account_number: editBank.account_number || inv.custom_bank_details?.account_number || "9162527000",
  };

  function openReceipt() {
    if (inv.status !== "paid" && inv.status !== "partially_paid") {
      toast.error("Only paid or deposit invoices have receipts");
      return;
    }
    setReceiptData({
      invoice_number: inv.invoice_number,
      issue_date: inv.issue_date,
      paid_at: inv.paid_at || new Date().toISOString(),
      payment_method: inv.payment_method || "cash",
      subtotal: inv.subtotal,
      tax_amount: taxAmt,
      tax_rate: inv.tax_rate,
      total: grandTotal,
      discount_amount: discountAmt,
      line_items: (inv.line_items ?? []).map((l: any) => ({
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        line_total: l.line_total,
      })),
      client_name: displayClient.name,
      client_company: displayClient.company,
      bank_name: displayBank.bank_name,
    });
  }

  // ── Requirement 2: Persistent & Decoupled Delivery Status Toggle ───────
  async function toggleDeliveryStatus() {
    if (updatingDelivery) return;
    const nextStatus = deliveryStatus === "delivered" ? "pending" : "delivered";
    setUpdatingDelivery(true);
    try {
      const invoiceId = inv._id || inv.id || id;
      // Optimistic Query Cache update for zero-lag UI response
      qc.setQueryData(["invoice", id], (old: any) =>
        old ? { ...old, delivery_status: nextStatus } : old
      );
      // Try PATCH first, fallback to PUT to ensure 100% route compatibility
      try {
        await api.patch(`/invoices/${invoiceId}/delivery-status`, { delivery_status: nextStatus });
      } catch {
        await api.put(`/invoices/${invoiceId}`, { delivery_status: nextStatus });
      }
      toast.success(
        nextStatus === "delivered"
          ? "✅ Delivery Status: Yes (Delivered)"
          : "🚚 Delivery Status: No (Pending)"
      );
      await qc.invalidateQueries({ queryKey: ["invoice", id] });
      await qc.refetchQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update delivery status");
      qc.invalidateQueries({ queryKey: ["invoice", id] });
    } finally {
      setUpdatingDelivery(false);
    }
  }

  // ── Requirement 1: Robust Partial Payment & Math Validation ───────────
  async function submitPayment() {
    if (!bankId) {
      toast.error("Please choose a receiving register/bank account");
      return;
    }

    // Strip non-numeric formatting characters (commas, ₦, spaces) to prevent NaN or string comparison errors
    const rawInput = String(payAmountInput || "").replace(/[^0-9.]/g, "");
    const enteredAmount = parseFloat(rawInput);

    if (!payAmountInput || isNaN(enteredAmount) || enteredAmount <= 0) {
      toast.error("Please enter a valid payment/deposit amount greater than 0");
      return;
    }

    // Clean numeric comparison against effective balance due in displayed currency
    if (enteredAmount > displayBalanceDue + 0.01) {
      toast.error(`Payment amount cannot exceed remaining balance due of ${money(balanceDue)}`);
      return;
    }

    // Convert entered amount back to base database currency if exchange rate is configured
    const basePaymentAmount = displayRate !== 1 ? parseFloat((enteredAmount / displayRate).toFixed(2)) : enteredAmount;

    setPaying(true);
    try {
      if (discountDirty) {
        await api.put(`/invoices/${inv._id || inv.id || id}`, {
          discount_type: discountMode,
          discount_value: discountVal,
          discount_amount: discountAmt,
          tax_amount: taxAmt,
          total: grandTotal,
        });
      }
      await api.post("/ledger", {
        invoice_id: inv._id || inv.id || id,
        payment_method: payMethod,
        bank_account_id: bankId,
        payment_amount: basePaymentAmount,
      });

      const isFullyPaid = enteredAmount >= (displayBalanceDue - 0.01);
      toast.success(
        isFullyPaid
          ? "🎉 Invoice paid in full!"
          : `💰 Deposit of ${money(basePaymentAmount)} recorded successfully!`
      );
      setPayOpen(false);
      setPayAmountInput("");

      // Optimistic local cache update for instant reflection across UI
      const newPaid = amountPaid + basePaymentAmount;
      const newBalance = Math.max(0, grandTotal - newPaid);
      const newStatus = newBalance <= 0.01 ? "paid" : "partially_paid";

      qc.setQueryData(["invoice", id], (old: any) =>
        old
          ? {
              ...old,
              amount_paid: newPaid,
              status: newStatus,
            }
          : old
      );

      await qc.invalidateQueries({ queryKey: ["invoice", id] });
      await qc.refetchQueries({ queryKey: ["invoice", id], type: "active" });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    } catch (e: any) {
      toast.error(e.message ?? "Payment registration failed");
    } finally {
      setPaying(false);
    }
  }

  // ── Persist Edit Details Modal Payload ──────────────────────────────────
  async function saveInvoiceDetails() {
    setSavingDetails(true);
    try {
      await api.put(`/invoices/${inv._id || inv.id || id}`, {
        custom_client: editClient,
        custom_bank_details: editBank,
        notes: editNotes,
      });
      toast.success("Invoice details saved successfully");
      setEditDetailsOpen(false);
      await qc.invalidateQueries({ queryKey: ["invoice", id] });
      await qc.refetchQueries({ queryKey: ["invoice", id], type: "active" });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save invoice details");
    } finally {
      setSavingDetails(false);
    }
  }

  function handlePrintInvoice() {
    document.body.classList.add("print-invoice");
    window.print();
    document.body.classList.remove("print-invoice");
  }

  return (
    <div>
      <PageHeader
        title={inv.invoice_number}
        description={`Issued ${shortDate(inv.issue_date)}${inv.due_date ? ` · Due ${shortDate(inv.due_date)}` : ""}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button asChild variant="outline" size="sm" className="rounded-xl gap-1.5">
              <Link to="/invoices"><ArrowLeft className="h-4 w-4" /> Back</Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl gap-1.5"
              onClick={handlePrintInvoice}
            >
              <Printer className="h-4 w-4" /> Print / Export PDF
            </Button>

            {/* Requirement 2: Independent Delivery Status Toggle Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={toggleDeliveryStatus}
              disabled={updatingDelivery}
              className={`rounded-xl gap-1.5 transition-all ${deliveryStatus === "delivered"
                ? "border-success text-success bg-success/10 hover:bg-success/20"
                : "border-amber-500/40 text-amber-600 bg-amber-500/10 hover:bg-amber-500/20"}`}
            >
              <Truck className="h-4 w-4" />
              {updatingDelivery
                ? "Updating…"
                : deliveryStatus === "delivered"
                  ? "Delivery Status: Yes"
                  : "Delivery Status: No"}
            </Button>

            {/* Edit Invoice Details Trigger */}
            <Button
              size="sm"
              variant="outline"
              onClick={openEditDetailsModal}
              className="rounded-xl gap-1.5"
            >
              <Edit3 className="h-4 w-4" /> Edit Details
            </Button>

            {(inv.status === "paid" || inv.status === "partially_paid") && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-1.5"
                onClick={openReceipt}
                id="invoice-print-receipt-btn"
              >
                <Printer className="h-4 w-4" /> Print Receipt
              </Button>
            )}

            {/* Mark / Deposit Payment Button */}
            {inv.status !== "paid" && (
              <Dialog open={payOpen} onOpenChange={(v) => {
                setPayOpen(v);
                if (v) setPayAmountInput(""); // Requirement 1: Initialize completely empty so cashier types freely
              }}>
                <Button
                  size="sm"
                  className="rounded-xl gap-1.5 bg-success hover:bg-success/90 text-white"
                  onClick={() => {
                    setPayAmountInput("");
                    setPayOpen(true);
                  }}
                >
                  <FileCheck className="h-4 w-4" />
                  {inv.status === "partially_paid" ? "Record Balance/Deposit" : "Record Payment / Deposit"}
                </Button>
                <DialogContent className="max-w-md rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Record Payment / Deposit</DialogTitle>
                    <DialogDescription>
                      Invoice Total: <span className="font-bold text-foreground">{money(grandTotal)}</span> · Paid: <span className="font-semibold text-success">{money(amountPaid)}</span> · Balance Due: <span className="font-bold text-primary">{money(balanceDue)}</span>
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-3">
                    <div className="grid gap-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">Payment / Deposit Amount</Label>
                        <button
                          type="button"
                          onClick={() => setPayAmountInput(String(displayBalanceDue))}
                          className="text-[11px] font-semibold text-primary hover:underline"
                        >
                          Fill Full Balance ({money(balanceDue)})
                        </button>
                      </div>
                      {/* Requirement 1: Clean empty default input */}
                      <Input
                        type="number"
                        step="0.01"
                        max={displayBalanceDue}
                        value={payAmountInput}
                        onChange={(e) => setPayAmountInput(e.target.value)}
                        placeholder={`Enter deposit amount (up to ${money(balanceDue)})`}
                        className="rounded-xl font-mono font-semibold"
                        autoFocus
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Type any deposit amount. Entering less than {money(balanceDue)} automatically sets the invoice status to <span className="font-semibold text-amber-600">Partially Paid</span>.
                      </p>
                    </div>

                    <Label className="text-xs uppercase text-muted-foreground tracking-wider">Payment Method</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "cash", label: "Cash", icon: Banknote },
                        { id: "card", label: "POS Card", icon: CreditCard },
                        { id: "transfer", label: "Bank Transfer", icon: ArrowRightLeft },
                      ].map(({ id: pid, label, icon: Icon }) => (
                        <button
                          key={pid}
                          type="button"
                          onClick={() => setPayMethod(pid as any)}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2.5 text-xs font-semibold transition-all ${payMethod === pid
                            ? "border-primary bg-primary-soft text-primary shadow-soft"
                            : "border-border bg-white text-foreground hover:border-primary/40"
                            }`}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="grid gap-1.5 mt-2">
                      <Label>Receiving Bank / Register Account</Label>
                      <Select value={bankId} onValueChange={setBankId}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Choose account to deposit funds…" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeBanks.map((b: any) => (
                            <SelectItem key={b.id || b._id} value={b.id || b._id}>
                              {b.name} ({money(b.balance)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setPayOpen(false)} className="rounded-xl">
                      Cancel
                    </Button>
                    <Button onClick={submitPayment} disabled={paying} className="rounded-xl bg-success text-white hover:bg-success/90">
                      {paying ? "Processing..." : "Confirm Payment"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            <StatusBadge status={inv.status} />
          </div>
        }
      />

      {/* Requirement 1: Partially Paid Outstanding Status Banner */}
      {isPartiallyPaid && (
        <div className="mx-8 mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs flex items-center justify-between text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Payment Incomplete / Deposit Received</span>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400 mt-0.5">
                Deposit of <span className="font-mono font-semibold">{money(amountPaid)}</span> recorded. Remaining balance due is <span className="font-mono font-bold text-amber-900 dark:text-amber-200">{currencyCode} {money(balanceDue)}</span>.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setPayAmountInput("");
              setPayOpen(true);
            }}
            className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white shrink-0 font-semibold"
          >
            Record Outstanding Balance
          </Button>
        </div>
      )}

      <div className="px-8 py-6 grid gap-6 lg:grid-cols-3">
        {/* ── Line items ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden border-border/70 bg-surface p-0 shadow-card rounded-2xl">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-16">Item</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(inv.line_items ?? []).map((l: any, i: number) => {
                  const matchingProd = products.find((p: any) => p.id === l.product_id || p._id === l.product_id || p.sku === l.product_id);
                  const img = matchingProd?.imageUrl || l.imageUrl;

                  return (
                    <TableRow key={i}>
                      {/* Requirement 3: Restored Product Images in Live Table */}
                      <TableCell className="py-2.5">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted flex items-center justify-center">
                          {img ? (
                            <img src={img} alt={l.description} className="h-full w-full object-cover" />
                          ) : (
                            <Printer className="h-4 w-4 text-muted-foreground/30" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="font-semibold text-foreground">{l.description}</div>
                        {matchingProd?.sku && (
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">SKU: {matchingProd.sku}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">{l.quantity}</TableCell>
                      <TableCell className="text-right font-mono">{money(l.unit_price)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{money(l.line_total)}</TableCell>
                    </TableRow>
                  );
                })}
                {(!inv.line_items || inv.line_items.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                      No line items.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Dual Discount & Financial Breakdown */}
          <Card className="border-border/70 bg-surface p-5 shadow-card rounded-2xl">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono">{money(baseSubtotal)}</span>
              </div>

              {/* Dual Discount Mode Control */}
              {inv.status !== "paid" && (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none" htmlFor="disc-toggle">
                      Apply Discount
                    </label>
                    <input
                      id="disc-toggle"
                      type="checkbox"
                      checked={discountEnabled}
                      onChange={(e) => {
                        setDiscountEnabled(e.target.checked);
                        setDiscountDirty(true);
                        if (!e.target.checked) setDiscountVal(0);
                      }}
                      className="h-4 w-4 rounded accent-primary cursor-pointer"
                    />
                  </div>
                  {discountEnabled && (
                    <div className="flex items-center gap-2 pt-1">
                      <Select
                        value={discountMode}
                        onValueChange={(v: "percentage" | "fixed") => {
                          setDiscountMode(v);
                          setDiscountDirty(true);
                        }}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs rounded-lg bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">
                            <span className="flex items-center gap-1"><Percent className="h-3 w-3" /> Percentage (%)</span>
                          </SelectItem>
                          <SelectItem value="fixed">
                            <span className="flex items-center gap-1"><Coins className="h-3 w-3" /> Fixed Value (₦)</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        type="number"
                        min={0}
                        step={discountMode === "percentage" ? "1" : "100"}
                        value={discountVal || ""}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value));
                          setDiscountVal(discountMode === "percentage" ? Math.min(100, val) : val);
                          setDiscountDirty(true);
                        }}
                        placeholder={discountMode === "percentage" ? "e.g. 20" : "e.g. 5000"}
                        className="flex-1 h-8 rounded-lg bg-background text-sm font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Dynamic Discount Display Row */}
              {discountAmt > 0 && (
                <div className="flex justify-between font-medium">
                  <span className="text-success">
                    Discount ({discountMode === "percentage" ? `${discountVal}%` : `Fixed ${money(discountVal)}`})
                  </span>
                  <span className="font-mono text-success">−{money(discountAmt)}</span>
                </div>
              )}

              {/* VAT */}
              <div className="flex justify-between text-muted-foreground">
                <span>VAT ({(savedTaxRate * 100).toFixed(1)}%)</span>
                <span className="font-mono">{money(taxAmt)}</span>
              </div>

              {/* Requirement 1: Explicit Financial Ledger Rows */}
              <div className="flex justify-between border-t border-border pt-2 text-sm font-bold">
                <span>TOTAL AMOUNT</span>
                <span className="font-mono text-foreground">{money(grandTotal)}</span>
              </div>

              <div className="flex justify-between text-success font-medium">
                <span>AMOUNT PAID (DEPOSIT)</span>
                <span className="font-mono">−{money(amountPaid)}</span>
              </div>

              <div className="flex justify-between border-t-2 border-primary/30 pt-2 text-base font-bold text-primary">
                <span>BALANCE DUE</span>
                <span className="font-mono">{currencyCode} {money(balanceDue)}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Sidebar Info ───────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Bill To Card */}
          <Card className="border-border/70 bg-surface p-5 shadow-card rounded-2xl relative">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Bill To</p>
              <button
                onClick={openEditDetailsModal}
                className="text-xs text-primary flex items-center gap-1 hover:underline"
              >
                <Edit3 className="h-3 w-3" /> Edit
              </button>
            </div>
            <p className="font-semibold text-foreground">{displayClient.company || displayClient.name}</p>
            {displayClient.company && <p className="text-sm text-muted-foreground">{displayClient.name}</p>}
            {displayClient.phone && <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1"><Phone className="h-3 w-3 text-muted-foreground/60" /> {displayClient.phone}</p>}
            {displayClient.address && <p className="text-xs text-muted-foreground mt-2 border-t border-border/60 pt-2 flex items-start gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 mt-0.5" /> {displayClient.address}</p>}
          </Card>

          {/* Payment Bank Instructions Card */}
          <Card className="border-border/70 bg-surface p-5 shadow-card rounded-2xl relative">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Bank Instructions</p>
              <button
                onClick={openEditDetailsModal}
                className="text-xs text-primary flex items-center gap-1 hover:underline"
              >
                <Edit3 className="h-3 w-3" /> Edit
              </button>
            </div>
            <div className="text-xs space-y-2 leading-relaxed">
              <p className="font-medium text-muted-foreground">Kindly pay to the below account details:</p>
              <div className="rounded-xl bg-muted/40 p-3 border border-border/40 font-mono space-y-1 text-[11px]">
                <div>Bank Name: <span className="font-semibold text-foreground">{displayBank.bank_name}</span></div>
                <div>Account Name: <span className="font-semibold text-foreground">{displayBank.account_name}</span></div>
                <div>Account Number: <span className="font-bold text-primary">{displayBank.account_number}</span></div>
              </div>
              <p className="text-muted-foreground italic text-[10px]">Reference invoice number {inv.invoice_number} on transfer descriptions.</p>
            </div>
          </Card>

          {/* Requirement 2: Document & Delivery Details Card */}
          <Card className="border-border/70 bg-surface p-5 shadow-card rounded-2xl">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Document Details</p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <dt className="text-muted-foreground">Payment Status</dt>
                <dd><StatusBadge status={inv.status} /></dd>
              </div>

              <div className="flex justify-between items-center">
                <dt className="text-muted-foreground">Delivery Status</dt>
                <dd>
                  <button
                    onClick={toggleDeliveryStatus}
                    disabled={updatingDelivery}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border transition-all ${deliveryStatus === "delivered"
                      ? "bg-success/15 text-success border-success/30 hover:bg-success/25"
                      : "bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/25"}`}
                  >
                    <Truck className="h-3.5 w-3.5" />
                    {updatingDelivery ? "…" : deliveryStatus === "delivered" ? "Delivery Status: Yes" : "Delivery Status: No"}
                  </button>
                </dd>
              </div>

              {inv.payment_method && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Payment Method</dt>
                  <dd className="capitalize font-semibold">{inv.payment_method}</dd>
                </div>
              )}
              {inv.paid_at && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Settled on</dt>
                  <dd className="font-mono">{shortDate(inv.paid_at)}</dd>
                </div>
              )}
              {(inv.notes || editNotes) && (
                <div className="border-t border-border/60 pt-2">
                  <dt className="text-muted-foreground mb-1">Additional Notes</dt>
                  <dd className="text-xs leading-relaxed">{editNotes || inv.notes}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>

      {/* Controlled Input Binding for Edit Details Modal */}
      <Dialog open={editDetailsOpen} onOpenChange={setEditDetailsOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Invoice Information</DialogTitle>
            <DialogDescription>
              Customize Client Bill-To, Destination Bank Account Details, and Additional Notes before printing/exporting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Bill-To Section */}
            <div className="space-y-2 border-b border-border/60 pb-3">
              <Label className="font-semibold text-foreground">Client / Bill-To Information</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Client Name</Label>
                  <Input
                    value={editClient.name}
                    onChange={(e) => setEditClient((prev) => ({ ...prev, name: e.target.value }))}
                    className="h-8 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Company</Label>
                  <Input
                    value={editClient.company}
                    onChange={(e) => setEditClient((prev) => ({ ...prev, company: e.target.value }))}
                    className="h-8 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Phone</Label>
                  <Input
                    value={editClient.phone}
                    onChange={(e) => setEditClient((prev) => ({ ...prev, phone: e.target.value }))}
                    className="h-8 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Address</Label>
                  <Input
                    value={editClient.address}
                    onChange={(e) => setEditClient((prev) => ({ ...prev, address: e.target.value }))}
                    className="h-8 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Bank Details Section */}
            <div className="space-y-2 border-b border-border/60 pb-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-foreground">Destination Bank Account</Label>
                {!isAdmin && (
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Restricted to Admin Accounts
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Bank Name</Label>
                  <Input
                    value={editBank.bank_name}
                    onChange={(e) => setEditBank((prev) => ({ ...prev, bank_name: e.target.value }))}
                    disabled={!isAdmin}
                    className="h-8 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Account Name</Label>
                  <Input
                    value={editBank.account_name}
                    onChange={(e) => setEditBank((prev) => ({ ...prev, account_name: e.target.value }))}
                    disabled={!isAdmin}
                    className="h-8 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Account Number</Label>
                  <Input
                    value={editBank.account_number}
                    onChange={(e) => setEditBank((prev) => ({ ...prev, account_number: e.target.value }))}
                    disabled={!isAdmin}
                    className="h-8 rounded-lg font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground">Additional Notes / Footer Message</Label>
              <Textarea
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Type custom footer message or payment instructions…"
                className="rounded-xl text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditDetailsOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={saveInvoiceDetails} disabled={savingDetails} className="rounded-xl">
              {savingDetails ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ESOTERIC™ CORPORATE A4 PRINT PORTAL ────────────────────────── */}
      <div id="invoice-print-area" className="hidden">
        {/* HEADER: Logo (left) + Title (right) - Clean Print without VAT/Delivery Badges */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "2px solid #000", paddingBottom: "20px", marginBottom: "24px" }}>
          <div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "28px", fontWeight: "bold", letterSpacing: "-0.5px", color: "#111" }}>
              Esoteric™
            </div>
            <div style={{ fontSize: "10px", fontWeight: "600", letterSpacing: "3px", color: "#555", marginTop: "2px", textTransform: "uppercase" }}>
              Stockroom &amp; Designs Ltd
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: "300", color: "#1a56db", letterSpacing: "-0.3px" }}>
              Sales Invoice
            </div>
          </div>
        </div>

        {/* SUB-HEADER: 4-column metadata grid */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "16px", paddingBottom: "20px", borderBottom: "1px solid #e5e7eb", marginBottom: "24px", fontSize: "11px" }}>
          <div>
            <div style={{ fontWeight: "700", fontSize: "8px", letterSpacing: "2px", textTransform: "uppercase", color: "#6b7280", marginBottom: "6px" }}>BILL TO</div>
            <div style={{ fontWeight: "800", fontSize: "13px", color: "#111", textTransform: "uppercase" }}>
              {(displayClient.company || displayClient.name)}
            </div>
            {displayClient.company && (
              <div style={{ color: "#374151", marginTop: "2px", fontSize: "10px" }}>{displayClient.name}</div>
            )}
            {displayClient.phone && (
              <div style={{ color: "#6b7280", marginTop: "4px", fontSize: "10px" }}>📞 {displayClient.phone}</div>
            )}
            {displayClient.address && (
              <div style={{ color: "#6b7280", marginTop: "4px", fontSize: "10px", lineHeight: "1.5" }}>{displayClient.address}</div>
            )}
          </div>
          <div>
            <div style={{ fontWeight: "700", fontSize: "8px", letterSpacing: "2px", textTransform: "uppercase", color: "#6b7280", marginBottom: "6px" }}>INVOICE #</div>
            <div style={{ fontFamily: "monospace", fontWeight: "700", fontSize: "12px", color: "#111" }}>#{inv.invoice_number}</div>
          </div>
          <div>
            <div style={{ fontWeight: "700", fontSize: "8px", letterSpacing: "2px", textTransform: "uppercase", color: "#6b7280", marginBottom: "6px" }}>DATE</div>
            <div style={{ fontWeight: "600", fontSize: "11px", color: "#111" }}>
              {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: "700", fontSize: "8px", letterSpacing: "2px", textTransform: "uppercase", color: "#6b7280", marginBottom: "6px" }}>TERMS</div>
            <div style={{ fontWeight: "600", fontSize: "11px", color: "#111" }}>
              {inv.due_date
                ? `Due ${new Date(inv.due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`
                : "Due on Receipt"}
            </div>
          </div>
        </div>

        {/* ITEMIZATION TABLE */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #111", background: "#f9fafb" }}>
              <th style={{ textAlign: "left", padding: "8px 4px", fontSize: "8px", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase", color: "#374151" }}>DATE</th>
              <th style={{ textAlign: "left", padding: "8px 4px", fontSize: "8px", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase", color: "#374151" }}>ACTIVITY</th>
              <th style={{ textAlign: "left", padding: "8px 4px", fontSize: "8px", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase", color: "#374151" }}>DESCRIPTION</th>
              <th style={{ textAlign: "right", padding: "8px 4px", fontSize: "8px", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase", color: "#374151", width: "40px" }}>QTY</th>
              <th style={{ textAlign: "right", padding: "8px 4px", fontSize: "8px", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase", color: "#374151", width: "100px" }}>RATE</th>
              <th style={{ textAlign: "right", padding: "8px 4px", fontSize: "8px", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase", color: "#374151", width: "100px" }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {(inv.line_items ?? []).map((l: any, idx: number) => {
              const matchingProd = products.find((p: any) => p.id === l.product_id || p._id === l.product_id || p.sku === l.product_id);
              const imgUrl = matchingProd?.imageUrl || l.imageUrl;
              const formattedDate = inv.issue_date
                ? new Date(inv.issue_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                : "—";
              return (
                <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 4px", color: "#6b7280", fontFamily: "monospace", fontSize: "10px" }}>{formattedDate}</td>
                  <td style={{ padding: "10px 4px", color: "#6b7280" }}>Sales</td>
                  {/* Requirement 3: Restored Product Thumbnail Images in Printed Invoice */}
                  <td style={{ padding: "10px 4px", fontWeight: "600", color: "#111" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={l.description}
                          style={{ width: "36px", height: "36px", objectFit: "cover", borderRadius: "4px", flexShrink: 0, border: "1px solid #e5e7eb" }}
                        />
                      ) : null}
                      <div>
                        <div>{l.description}</div>
                        {matchingProd?.sku && (
                          <div style={{ fontSize: "9px", fontFamily: "monospace", color: "#6b7280", marginTop: "1px" }}>SKU: {matchingProd.sku}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "10px 4px", textAlign: "right", fontFamily: "monospace" }}>{l.quantity}</td>
                  <td style={{ padding: "10px 4px", textAlign: "right", fontFamily: "monospace" }}>{money(l.unit_price)}</td>
                  <td style={{ padding: "10px 4px", textAlign: "right", fontFamily: "monospace", fontWeight: "700" }}>{money(l.line_total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* FINANCIAL SUMMARY + BANK DETAILS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", marginTop: "40px", paddingTop: "24px", borderTop: "1px solid #e5e7eb" }}>

          {/* LEFT: Bank Payment Instructions */}
          <div style={{ fontSize: "11px" }}>
            <div style={{ fontWeight: "700", fontSize: "8px", letterSpacing: "2px", textTransform: "uppercase", color: "#6b7280", marginBottom: "10px" }}>PAYMENT SETTLEMENT</div>
            <div style={{ color: "#374151", marginBottom: "8px" }}>Kindly pay to the below account details:</div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px", background: "#f9fafb", fontFamily: "monospace" }}>
              <div style={{ fontWeight: "700", fontSize: "12px", color: "#111", marginBottom: "6px" }}>{displayBank.bank_name}</div>
              <div style={{ fontSize: "10px", color: "#374151", marginBottom: "3px" }}>
                Account Name: <span style={{ fontWeight: "600", color: "#111" }}>{displayBank.account_name}</span>
              </div>
              <div style={{ fontSize: "10px", color: "#374151" }}>
                Account Number: <span style={{ fontWeight: "800", color: "#1a56db", fontSize: "12px" }}>{displayBank.account_number}</span>
              </div>
            </div>
            <div style={{ marginTop: "12px", fontSize: "10px", color: "#9ca3af", fontStyle: "italic" }}>
              Ref: Invoice #{inv.invoice_number} on transfer description.
            </div>
            {editNotes && (
              <div style={{ marginTop: "12px", padding: "8px 10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", fontSize: "10px", color: "#92400e", lineHeight: "1.6" }}>
                {editNotes}
              </div>
            )}
          </div>

          {/* RIGHT: Financial Breakdown */}
          <div style={{ fontSize: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#6b7280" }}>
              <span>SUBTOTAL</span>
              <span style={{ fontFamily: "monospace", fontWeight: "600" }}>{money(baseSubtotal)}</span>
            </div>
            {discountAmt > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#059669", fontWeight: "600" }}>
                <span>DISCOUNT ({discountMode === "percentage" ? `${discountVal}%` : `Fixed ${money(discountVal)}`})</span>
                <span style={{ fontFamily: "monospace" }}>−{money(discountAmt)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#6b7280" }}>
              <span>TAX ({(savedTaxRate * 100).toFixed(1)}% VAT)</span>
              <span style={{ fontFamily: "monospace", fontWeight: "600" }}>{money(taxAmt)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "2px solid #d1d5db", marginTop: "4px", fontWeight: "800", fontSize: "13px" }}>
              <span>TOTAL AMOUNT</span>
              <span style={{ fontFamily: "monospace" }}>{money(grandTotal)}</span>
            </div>
            {amountPaid > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#059669", fontWeight: "600" }}>
                <span>AMOUNT PAID (DEPOSIT)</span>
                <span style={{ fontFamily: "monospace" }}>−{money(amountPaid)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: "3px solid #1a56db", marginTop: "4px", fontWeight: "800", fontSize: "15px", color: "#1a56db" }}>
              <span>BALANCE DUE</span>
              <span style={{ fontFamily: "monospace" }}>{currencyCode} {money(balanceDue)}</span>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ marginTop: "48px", paddingTop: "20px", borderTop: "1px solid #e5e7eb", textAlign: "center", fontSize: "10px", color: "#9ca3af", lineHeight: "1.8" }}>
          <div>Thank you for your business! We appreciate your patronage and look forward to serving you again.</div>
          <div style={{ marginTop: "6px", fontSize: "9px", letterSpacing: "1px" }}>
            Esoteric™ Stockroom &amp; Designs Ltd · VAT 7.5% Registered · Page 1 of 1
          </div>
        </div>
      </div>

      <ReceiptModal
        open={!!receiptData}
        onClose={() => setReceiptData(null)}
        receipt={receiptData}
      />
    </div>
  );
}
