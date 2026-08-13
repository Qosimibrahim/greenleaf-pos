import { createFileRoute } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { money, productStatus } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Upload,
  Download,
  ImageIcon,
  Trash2,
  Pencil,
  Lock,
  Package,
  CheckCircle2,
  ScanLine,
  Filter,
  Printer,
  Sparkles,
} from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BarcodeSVG } from "@/components/barcode-svg";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
});

type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  category_id: string | null;
  quantity: number;
  low_stock_threshold: number;
  unit_cost: string | number;
  selling_price: string | number;
  imageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
};

function InventoryPage() {
  const { isAdmin } = useRole();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>("/products"),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["product_categories"],
    queryFn: () => api.get<any[]>("/product_categories"),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = products.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q),
    );
    if (statusFilter !== "all") {
      list = list.filter(
        (p) => productStatus(p.quantity, p.low_stock_threshold) === statusFilter,
      );
    }
    if (categoryFilter !== "all") {
      list = list.filter((p) => p.category_id === categoryFilter);
    }
    list = [...list].sort((a, b) => {
      if (sortBy === "quantity") return a.quantity - b.quantity;
      if (sortBy === "price") return Number(a.selling_price) - Number(b.selling_price);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [products, search, statusFilter, categoryFilter, sortBy]);

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/products/${id}`),
    onSuccess: () => {
      toast.success("Product removed");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── CSV Export ────────────────────────────────────────────────────────────

  function handleExportCSV() {
    const catMap = new Map((categories as any[]).map((c: any) => [c.id, c.name]));
    const headers = ["Name", "SKU", "Barcode", "Cost Price", "Retail Price", "Quantity", "Low Stock Threshold", "Category", "Description"];
    const rows = products.map((p: any) => [
      p.name ?? "",
      p.sku ?? "",
      p.barcode ?? "",
      Number(p.unit_cost ?? 0),
      Number(p.selling_price ?? 0),
      p.quantity ?? 0,
      p.low_stock_threshold ?? 5,
      catMap.get(p.category_id) ?? "",
      p.description ?? "",
    ]);
    const csvLines = [headers, ...rows].map(
      (row) => row.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stockroom_inventory_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Inventory exported successfully");
  }

  // ── CSV Import ────────────────────────────────────────────────────────────

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text?.trim()) { toast.error("CSV file is empty"); return; }

        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) { toast.error("CSV must have a header row and at least one data row"); return; }

        // Parse headers — flexible matching
        const rawHeaders = lines[0].split(",").map((h) =>
          h.trim().replace(/^["']|["']$/g, "").toLowerCase()
        );
        const idx = (terms: string[]) => rawHeaders.findIndex((h) => terms.some((t) => h.includes(t)));

        const nameIdx  = idx(["name"]);
        const skuIdx   = idx(["sku"]);
        const bcIdx    = idx(["barcode", "bar code"]);
        const costIdx  = idx(["cost"]);
        const priceIdx = idx(["retail", "price", "sell"]);
        const qtyIdx   = idx(["qty", "quantity", "stock", "level"]);
        const threshIdx= idx(["threshold", "reorder", "low"]);
        const catIdx   = idx(["cat", "category"]);
        const descIdx  = idx(["desc", "description"]);

        if (nameIdx === -1 || (skuIdx === -1 && bcIdx === -1)) {
          toast.error("CSV must include columns for Name and at least SKU or Barcode");
          return;
        }

        // CSV-safe line splitter (handles quoted commas)
        function splitCSVLine(line: string): string[] {
          const cols: string[] = [];
          let cur = "";
          let inQ = false;
          for (const ch of line) {
            if (ch === '"') { inQ = !inQ; continue; }
            if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; continue; }
            cur += ch;
          }
          cols.push(cur.trim());
          return cols;
        }

        const items: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = splitCSVLine(lines[i]);
          const name = cols[nameIdx]?.trim();
          if (!name) continue;
          items.push({
            name,
            sku:           skuIdx  !== -1 ? cols[skuIdx]?.trim()  : undefined,
            barcode:       bcIdx   !== -1 ? cols[bcIdx]?.trim()   : undefined,
            unit_cost:     costIdx !== -1 ? parseFloat(cols[costIdx])  || 0 : 0,
            selling_price: priceIdx!== -1 ? parseFloat(cols[priceIdx]) || 0 : 0,
            quantity:      qtyIdx  !== -1 ? parseInt(cols[qtyIdx])     || 0 : 0,
            low_stock_threshold: threshIdx !== -1 ? parseInt(cols[threshIdx]) || 5 : 5,
            categoryName:  catIdx  !== -1 ? cols[catIdx]?.trim()  : undefined,
            description:   descIdx !== -1 ? cols[descIdx]?.trim() : undefined,
          });
        }

        if (items.length === 0) { toast.error("No valid products found in CSV"); return; }

        const result = await api.post<any>("/products/bulk", { products: items });
        toast.success(`Imported: ${result.createdCount} new, ${result.updatedCount} updated`);
        qc.invalidateQueries({ queryKey: ["products"] });
        qc.invalidateQueries({ queryKey: ["product_categories"] });
      } catch (err: any) {
        toast.error(err.message ?? "Import failed");
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = "";
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        description={
          isAdmin
            ? "Track products, stock levels, prices and attachments."
            : "Read-only view of stock and product details."
        }
        actions={
          isAdmin ? (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Hidden file input for CSV import */}
              <input
                ref={importRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImportCSV}
              />
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-1.5"
                onClick={() => importRef.current?.click()}
              >
                <Upload className="h-4 w-4" /> Import CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-1.5"
                onClick={handleExportCSV}
              >
                <Download className="h-4 w-4" /> Export CSV
              </Button>
              <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="rounded-xl gap-1.5">
                    <Plus className="h-4 w-4" /> New product
                  </Button>
                </DialogTrigger>
                <ProductDialog
                  product={editing}
                  onDone={() => {
                    setOpen(false);
                    setEditing(null);
                    qc.invalidateQueries({ queryKey: ["products"] });
                  }}
                />
              </Dialog>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
              <Lock className="h-3 w-3" /> Read-only
            </span>
          )
        }
      />

      <div className="px-8 py-6">
        <Card className="border-border/70 bg-surface p-4 shadow-card rounded-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="inventory-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, SKU or barcode…"
                className="pl-9 rounded-xl"
              />
            </div>
            {/* Category filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[170px] rounded-xl">
                <Filter className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(categories as any[]).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="in_stock">In stock</SelectItem>
                <SelectItem value="low_stock">Low stock</SelectItem>
                <SelectItem value="out_of_stock">Out of stock</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px] rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Sort: Name</SelectItem>
                <SelectItem value="quantity">Sort: Quantity</SelectItem>
                <SelectItem value="price">Sort: Price</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {isAdmin ? (
          <Card className="mt-4 overflow-hidden border-border/70 bg-surface p-0 shadow-card rounded-2xl">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[72px]"></TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU / Barcode</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date Modified</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Package className="h-10 w-10 opacity-20" />
                        <p className="text-sm">No products match your filters.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    categories={categories as any[]}
                    onEdit={() => { setEditing(p); setOpen(true); }}
                    onDelete={() => { if (confirm(`Delete ${p.name}?`)) del.mutate(p.id); }}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          /* Cashier read-only card grid */
          <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {filtered.map((p) => (
              <CashierProductCard key={p.id} product={p} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Package className="h-10 w-10 opacity-20" />
                  <p className="text-sm">No products found.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Admin Table Row ───────────────────────────────────────────────────────────

function ProductRow({
  product: p,
  categories,
  onEdit,
  onDelete,
}: {
  product: Product;
  categories: any[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const catName = categories.find((c) => c.id === p.category_id)?.name ?? "—";
  return (
    <TableRow className="hover:bg-muted/20 transition-colors">
      <TableCell>
        <div className="h-12 w-12 overflow-hidden rounded-lg border border-border/60 bg-muted flex-shrink-0">
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-5 w-5 text-muted-foreground/30" />
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <p className="font-semibold text-sm">{p.name}</p>
        {p.description && (
          <p className="text-xs text-muted-foreground line-clamp-1 max-w-[220px]">{p.description}</p>
        )}
      </TableCell>
      <TableCell>
        <div className="font-mono text-xs font-semibold text-foreground">{p.sku}</div>
        {p.barcode && (
          <div className="font-mono text-[10px] text-muted-foreground">{p.barcode}</div>
        )}
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center rounded-lg bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {catName}
        </span>
      </TableCell>
      <TableCell className="text-right font-mono font-semibold">{p.quantity}</TableCell>
      <TableCell className="text-right font-mono text-muted-foreground">{money(p.unit_cost)}</TableCell>
      <TableCell className="text-right font-mono font-semibold text-primary">{money(p.selling_price)}</TableCell>
      <TableCell>
        <StatusBadge status={productStatus(p.quantity, p.low_stock_threshold)} />
      </TableCell>
      <TableCell>
        <div className="text-xs text-muted-foreground">
          {p.updatedAt
            ? new Date(p.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
            : p.createdAt
              ? new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
              : "—"}
        </div>
        <div className="text-[10px] text-muted-foreground/60">
          {p.updatedAt
            ? new Date(p.updatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
            : ""}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg hover:bg-primary/10"
            onClick={onEdit}
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ── Cashier read-only card (staff view) ──────────────────────────────────────

function CashierProductCard({ product: p }: { product: Product }) {
  return (
    <Card className="overflow-hidden border-border/70 bg-surface p-0 shadow-card rounded-2xl">
      <div className="aspect-square w-full overflow-hidden bg-muted">
        {p.imageUrl ? (
          <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Package className="h-8 w-8 opacity-20" />
          </div>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <div className="line-clamp-2 text-sm font-semibold leading-tight">{p.name}</div>
        <div className="font-mono text-[11px] text-muted-foreground">{p.sku}</div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">
            Qty: <span className="font-mono font-semibold text-foreground">{p.quantity}</span>
          </span>
          <StatusBadge status={productStatus(p.quantity, p.low_stock_threshold)} />
        </div>
        <p className="font-mono text-sm font-bold text-primary">{money(p.selling_price)}</p>
      </div>
    </Card>
  );
}

// ── Product Dialog ────────────────────────────────────────────────────────────

function ProductDialog({ product, onDone }: { product: Product | null; onDone: () => void }) {
  const isEdit = !!product;

  const emptyForm = {
    name: "",
    sku: "",
    barcode: "",
    description: "",
    category_id: "",
    quantity: 0,
    low_stock_threshold: 5,
    unit_cost: 0,
    selling_price: 0,
    imageUrl: "",
  };

  const [form, setForm] = useState({ ...emptyForm });
  const [margin, setMargin] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const qcInner = useQueryClient();
  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (product) {
      const cost = Number(product.unit_cost ?? 0);
      const price = Number(product.selling_price ?? 0);
      setForm({
        name: product.name ?? "",
        sku: product.sku ?? "",
        barcode: product.barcode ?? "",
        description: product.description ?? "",
        category_id: product.category_id ?? "",
        quantity: product.quantity ?? 0,
        low_stock_threshold: product.low_stock_threshold ?? 5,
        unit_cost: cost,
        selling_price: price,
        imageUrl: product.imageUrl ?? "",
      });
      setMargin(cost > 0 && price > 0 ? parseFloat((((price - cost) / cost) * 100).toFixed(2)) : 0);
      setPreviewUrl(product.imageUrl ?? "");
      setSavedId(product.id);
    } else {
      setForm({ ...emptyForm });
      setMargin(0);
      setPreviewUrl("");
      setSavedId(null);
    }
  }, [product]);

  // Bi-directional profit margin & price calculators
  function handleCostChange(val: number) {
    const cost = Math.max(0, val);
    let newPrice = form.selling_price;
    if (cost > 0 && margin > 0) {
      newPrice = parseFloat((cost * (1 + margin / 100)).toFixed(2));
    } else if (cost > 0 && newPrice > 0) {
      setMargin(parseFloat((((newPrice - cost) / cost) * 100).toFixed(2)));
    }
    setForm((f) => ({ ...f, unit_cost: cost, selling_price: newPrice }));
  }

  function handleMarginChange(val: number) {
    const m = Number(val);
    setMargin(m);
    const cost = Number(form.unit_cost || 0);
    if (cost > 0) {
      const newPrice = parseFloat((cost * (1 + m / 100)).toFixed(2));
      setForm((f) => ({ ...f, selling_price: newPrice }));
    }
  }

  function handlePriceChange(val: number) {
    const price = Math.max(0, val);
    const cost = Number(form.unit_cost || 0);
    if (cost > 0) {
      const computedMargin = parseFloat((((price - cost) / cost) * 100).toFixed(2));
      setMargin(computedMargin);
    }
    setForm((f) => ({ ...f, selling_price: price }));
  }

  function generateAutoBarcode() {
    const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const code = `GL-${randomDigits}`;
    setForm((f) => ({
      ...f,
      barcode: code,
      sku: f.sku ? f.sku : `SKU-${randomDigits.slice(0, 6)}`,
    }));
    toast.success(`Generated scannable barcode: ${code}`);
  }

  function handlePrintBarcode() {
    if (!form.barcode) {
      toast.error("Please enter or auto-generate a barcode first");
      return;
    }
    // Set a short timeout so the portal DOM has time to mount
    document.body.classList.add("print-barcode-only");
    setTimeout(() => {
      window.print();
      document.body.classList.remove("print-barcode-only");
    }, 80);
  }

  // Keyboard wedge barcode scanner listener
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = Date.now();

    function handleDialogScan(e: KeyboardEvent) {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      
      const now = Date.now();
      const diff = now - lastKeyTime;
      lastKeyTime = now;

      if (diff > 50) {
        buffer = "";
      }

      if (e.key === "Enter") {
        if (buffer.length >= 3) {
          e.preventDefault();
          e.stopPropagation();
          setForm((f) => ({ ...f, barcode: buffer }));
          toast.success(`Barcode wedge intercepted: ${buffer}`);
          setTimeout(() => {
            document.getElementById("product-name")?.focus();
          }, 50);
          buffer = "";
        }
        return;
      }

      if (e.key.length === 1) {
        buffer += e.key;
      }
    }

    window.addEventListener("keydown", handleDialogScan, true);
    return () => window.removeEventListener("keydown", handleDialogScan, true);
  }, []);

  const { data: categories = [] } = useQuery({
    queryKey: ["product_categories"],
    queryFn: () => api.get<any[]>("/product_categories"),
  });

  const [newCategory, setNewCategory] = useState("");
  async function createCategory() {
    const name = newCategory.trim();
    if (!name) return;
    const cat = await api.post<any>("/product_categories", { name });
    setForm((f) => ({ ...f, category_id: cat.id }));
    setNewCategory("");
    qcInner.invalidateQueries({ queryKey: ["product_categories"] });
    toast.success(`Category "${name}" created`);
  }

  async function handleImageUpload(file: File) {
    if (!file) return;
    setUploadingImage(true);
    try {
      setPreviewUrl(URL.createObjectURL(file));
      const { url } = await api.upload("/storage/upload", file);
      setForm((f) => ({ ...f, imageUrl: url }));
      setPreviewUrl(url);

      if (savedId) {
        await api.put(`/products/${savedId}`, { imageUrl: url });
        toast.success("Image uploaded and saved");
        qcInner.invalidateQueries({ queryKey: ["products"] });
      } else {
        toast.success("Image ready — will be saved with the product");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploadingImage(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      if (!form.name.trim() || !form.sku.trim()) {
        toast.error("Name and SKU are required");
        setSaving(false);
        return;
      }

      const payload: any = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        barcode: form.barcode?.trim() || null,
        description: form.description?.trim() || null,
        category_id: form.category_id || null,
        quantity: Number(form.quantity),
        low_stock_threshold: Number(form.low_stock_threshold),
        unit_cost: Number(form.unit_cost),
        selling_price: Number(form.selling_price),
        imageUrl: form.imageUrl || null,
      };

      if (isEdit && product) {
        await api.put(`/products/${product.id}`, payload);
        toast.success("Product updated");
      } else {
        const created = await api.post<any>("/products", payload);
        setSavedId(created.id);
        toast.success("Product created");
      }

      qcInner.invalidateQueries({ queryKey: ["products"] });
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEdit ? "Edit product" : "New product"}
          </DialogTitle>
          <DialogDescription>
            Basic details, live margin pricing calculator, auto-barcode generation and thermal printing.
          </DialogDescription>
        </DialogHeader>

      <div className="grid gap-4 py-2 md:grid-cols-2">
        {/* Product Image Upload */}
        <div className="md:col-span-2">
          <Label className="mb-2 block">Product Image</Label>
          <div className="flex items-start gap-4">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                  <ImageIcon className="h-6 w-6 opacity-40" />
                  <span className="text-[9px]">No image</span>
                </div>
              )}
            </div>
            <label className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 p-4 text-center transition hover:bg-muted/50">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
              />
              {uploadingImage ? (
                <span className="text-xs text-muted-foreground">Uploading…</span>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Click to upload or drag &amp; drop
                  </span>
                  {previewUrl && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-success">
                      <CheckCircle2 className="h-3 w-3" /> Image ready
                    </span>
                  )}
                </>
              )}
            </label>
          </div>
        </div>

        <div className="md:col-span-2 grid gap-1.5">
          <Label>Product name <span className="text-destructive">*</span></Label>
          <Input
            id="product-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-xl"
          />
        </div>

        <div className="grid gap-1.5">
          <Label className="flex items-center gap-1.5">
            SKU <span className="text-destructive">*</span>
          </Label>
          <Input
            id="product-sku"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            className="rounded-xl"
          />
        </div>

        {/* Auto Barcode Generator section */}
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5">
              <ScanLine className="h-3.5 w-3.5 text-primary" />
              Barcode SKU
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateAutoBarcode}
              className="h-6 rounded-lg px-2 text-[11px] text-primary hover:bg-primary/10 border-primary/30 gap-1"
            >
              <Sparkles className="h-3 w-3" /> Auto-Generate
            </Button>
          </div>
          <Input
            ref={barcodeRef}
            id="product-barcode"
            value={form.barcode ?? ""}
            onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                document.getElementById("product-qty")?.focus();
              }
            }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Scan or type barcode…"
            className="rounded-xl border-primary/30 bg-primary-soft/20 focus:border-primary focus:bg-white"
          />
        </div>

        {/* Live Barcode Graphical SVG Preview */}
        {form.barcode && (
          <div className="md:col-span-2 flex flex-col items-center justify-center p-3 border border-border/60 bg-muted/20 rounded-xl">
            <p className="text-[11px] font-medium text-muted-foreground mb-1">Scannable Barcode Preview (Code 128)</p>
            <BarcodeSVG value={form.barcode} width={260} height={70} />
          </div>
        )}

        <div className="grid gap-1.5">
          <Label>Quantity</Label>
          <Input
            id="product-qty"
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            className="rounded-xl"
          />
        </div>

        <div className="grid gap-1.5">
          <Label>Low-stock threshold</Label>
          <Input
            id="product-threshold"
            type="number"
            value={form.low_stock_threshold}
            onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })}
            className="rounded-xl"
          />
        </div>

        {/* Profit Margin Auto-Calculator Grid */}
        <div className="md:col-span-2 grid gap-3 md:grid-cols-3 p-3 border border-primary/20 bg-primary/5 rounded-xl">
          <div className="grid gap-1.5">
            <Label className="text-xs">Cost Price ({money(form.unit_cost)})</Label>
            <Input
              id="product-cost"
              type="number"
              step="0.01"
              value={form.unit_cost}
              onChange={(e) => handleCostChange(Number(e.target.value))}
              className="rounded-xl bg-background"
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold text-primary">Profit Margin (%)</Label>
            <Input
              id="product-margin"
              type="number"
              step="0.1"
              value={margin}
              onChange={(e) => handleMarginChange(Number(e.target.value))}
              className="rounded-xl bg-background border-primary/40 font-semibold"
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Selling Price ({money(form.selling_price)})</Label>
            <Input
              id="product-price"
              type="number"
              step="0.01"
              value={form.selling_price}
              onChange={(e) => handlePriceChange(Number(e.target.value))}
              className="rounded-xl bg-background"
            />
          </div>
        </div>

        {/* Category selector + create */}
        <div className="md:col-span-2 grid gap-1.5">
          <Label>Category</Label>
          <div className="flex gap-2">
            <Select value={form.category_id || ""} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger className="flex-1 rounded-xl">
                <SelectValue placeholder="Select category…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— No category —</SelectItem>
                {(categories as any[]).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1.5">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createCategory(); } }}
                placeholder="New category…"
                className="w-36 rounded-xl text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={createCategory}
                className="rounded-xl shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 grid gap-1.5">
          <Label>Description</Label>
          <Textarea
            id="product-description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="rounded-xl resize-none"
          />
        </div>
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        {form.barcode ? (
          <Button
            type="button"
            variant="outline"
            onClick={handlePrintBarcode}
            className="rounded-xl gap-1.5 text-foreground border-border/80"
          >
            <Printer className="h-4 w-4" /> Print Barcode Label
          </Button>
        ) : (
          <div />
        )}
        <Button
          id="product-save-btn"
          onClick={save}
          disabled={saving}
          className="rounded-xl min-w-[120px]"
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create product"}
        </Button>
      </DialogFooter>

    </DialogContent>

      {/* Fix 2: Barcode print portal — rendered directly under <body> so CSS can isolate it during print */}
      {form.barcode && createPortal(
        <div
          id="barcode-print-area"
          style={{
            display: "none",
            position: "fixed",
            top: 0,
            left: 0,
            width: "58mm",
            background: "#fff",
            zIndex: -1,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4px", textAlign: "center", color: "#000", width: "58mm" }}>
            <div style={{ fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px", fontFamily: "sans-serif" }}>
              {form.name || "ESOTERIC STOCKROOM"}
            </div>
            <div style={{ fontSize: "9px", fontFamily: "monospace", marginBottom: "4px", color: "#333" }}>
              {form.sku}{form.selling_price > 0 ? ` · ${money(form.selling_price)}` : ""}
            </div>
            <BarcodeSVG value={form.barcode} width={200} height={60} showText={true} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
