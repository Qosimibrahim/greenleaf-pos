import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { money, shortDate } from "@/lib/format";
import { toast } from "sonner";
import { useRole } from "@/hooks/use-role";
import { useAuth } from "@/hooks/use-auth";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin, loading } = useRole();
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();

  const { data: tax } = useQuery({
    queryKey: ["tax-settings"],
    enabled: isAdmin,
    queryFn: () => api.get<any>("/tax_settings"),
  });
  const { data: banks = [] } = useQuery({
    queryKey: ["bank-accounts"],
    enabled: isAdmin,
    queryFn: () => api.get<any[]>("/bank-accounts"),
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    enabled: isAdmin,
    queryFn: () => api.get<any[]>("/expenses"),
  });
  const { data: expenseAccounts = [] } = useQuery({
    queryKey: ["coa", "expense"],
    enabled: isAdmin,
    queryFn: async () => {
      const all = await api.get<any[]>("/chart-of-accounts");
      return all.filter((a: any) => a.type === "expense");
    },
  });
  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-list"],
    enabled: isAdmin,
    queryFn: () => api.get<any[]>("/profiles"),
  });

  const [taxPercent, setTaxPercent] = useState(0);
  const [currency, setCurrency] = useState("NGN");
  const [exchangeRate, setExchangeRate] = useState<number>(1);

  useEffect(() => {
    if (tax) {
      setTaxPercent(Number(tax.rate) * 100);
      if (tax.currency) {
        setCurrency(tax.currency);
        localStorage.setItem("stockroom_currency", tax.currency);
      }
      if (tax.exchange_rate !== undefined) {
        setExchangeRate(Number(tax.exchange_rate));
        localStorage.setItem("stockroom_exchange_rate", String(tax.exchange_rate));
      }
    }
  }, [tax]);

  const [newBankName, setNewBankName] = useState("");
  const [newBankKind, setNewBankKind] = useState("cash");

  const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState(0);
  const [expBank, setExpBank] = useState("");
  const [expAcct, setExpAcct] = useState("");

  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "staff">("staff");
  const [creatingUser, setCreatingUser] = useState(false);

  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string; email: string } | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!isAdmin) return <div className="p-8 text-sm text-muted-foreground">Admin access required.</div>;

  async function saveTax() {
    const rate = Math.max(0, Number(taxPercent) / 100);
    const validRate = Number(exchangeRate) > 0 ? Number(exchangeRate) : 1;
    await api.post("/tax_settings", { rate, currency, exchange_rate: validRate });
    localStorage.setItem("stockroom_currency", currency);
    localStorage.setItem("stockroom_exchange_rate", String(validRate));
    toast.success("Settings saved successfully");
    qc.invalidateQueries({ queryKey: ["tax-settings"] });
    qc.invalidateQueries();
  }

  async function addBank() {
    if (!newBankName.trim()) return;
    await api.post("/bank-accounts", { name: newBankName.trim(), kind: newBankKind });
    setNewBankName("");
    qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    toast.success("Register added");
  }

  async function addExpense() {
    if (!expDesc.trim() || !expAmount || !expBank || !expAcct) {
      return toast.error("Fill all expense fields");
    }
    await api.post("/expenses", {
      expense_date: expDate,
      description: expDesc.trim(),
      amount: Number(expAmount),
      bank_account_id: expBank,
      expense_account_id: expAcct,
    });
    setExpDesc(""); setExpAmount(0);
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    toast.success("Expense logged");
  }

  async function createUser() {
    if (!newUserFullName.trim()) {
      return toast.error("Full Name is required");
    }
    if (!newUserEmail.trim() || !newUserPassword || newUserPassword.length < 6) {
      return toast.error("Enter a valid email and password (min 6 chars)");
    }
    setCreatingUser(true);
    try {
      await api.post("/admin/create-user", {
        full_name: newUserFullName.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword,
        role: newUserRole,
      });
      toast.success(`Created ${newUserRole === "staff" ? "Cashier" : "Admin"} account for ${newUserFullName.trim()}`);
      setNewUserFullName(""); setNewUserEmail(""); setNewUserPassword(""); setNewUserRole("staff");
      qc.invalidateQueries({ queryKey: ["staff-list"] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  }

  async function confirmDeleteUser() {
    if (!userToDelete) return;
    setDeletingUser(true);
    try {
      await api.delete(`/admin/users/${userToDelete.id}`);
      toast.success(`Account for ${userToDelete.name || userToDelete.email} deleted`);
      setUserToDelete(null);
      qc.invalidateQueries({ queryKey: ["staff-list"] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete user");
    } finally {
      setDeletingUser(false);
    }
  }

  return (
    <div>
      <PageHeader title="Settings" description="Tax, cash registers, expense tracking and user management." />
      <div className="space-y-6 px-8 py-6">

        {/* ── Tax & Currency Settings ────────────────────────────── */}
        <Card className="border-border/70 bg-surface p-5 shadow-card rounded-2xl">
          <h3 className="mb-2 font-serif text-lg">Store Configuration</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Strictly manual exchange rate engine — zero external API fetching. Custom exchange rates apply globally.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-1.5">
              <Label>Sales tax / VAT (%)</Label>
              <Input
                id="tax-rate-input"
                type="number"
                step="0.01"
                value={taxPercent}
                onChange={(e) => setTaxPercent(Number(e.target.value))}
                className="w-36 rounded-xl"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Global Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NGN">Nigerian Naira (₦)</SelectItem>
                  <SelectItem value="USD">US Dollar ($)</SelectItem>
                  <SelectItem value="EUR">Euro (€)</SelectItem>
                  <SelectItem value="GBP">Pound Sterling (£)</SelectItem>
                  <SelectItem value="GHS">Ghanaian Cedi (₵)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Manual Exchange Rate</Label>
              <Input
                id="exchange-rate-input"
                type="number"
                step="0.0001"
                min="0.0001"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(Number(e.target.value))}
                placeholder="e.g. 1500"
                className="w-40 rounded-xl"
              />
            </div>
            <Button id="save-tax-btn" onClick={saveTax} className="rounded-xl">Save Configuration</Button>
          </div>
        </Card>

        {/* ── Bank registers ────────────────────────────────────── */}
        <Card className="border-border/70 bg-surface p-5 shadow-card rounded-2xl">
          <h3 className="mb-4 font-serif text-lg">Bank & cash registers</h3>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input
                id="bank-name-input"
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
                placeholder="e.g. Back-office safe"
                className="w-64 rounded-xl"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={newBankKind} onValueChange={setNewBankKind}>
                <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash drawer</SelectItem>
                  <SelectItem value="bank">Bank account</SelectItem>
                  <SelectItem value="mobile">Mobile / POS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button id="add-bank-btn" onClick={addBank} className="rounded-xl">Add register</Button>
          </div>
          <div className="overflow-hidden rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Name</TableHead><TableHead>Type</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(banks as any[]).map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-semibold">{b.name}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{b.kind}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{money(b.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* ── Log expense ───────────────────────────────────────── */}
        <Card className="border-border/70 bg-surface p-5 shadow-card rounded-2xl">
          <h3 className="mb-4 font-serif text-lg">Log expense</h3>
          <div className="grid gap-3 md:grid-cols-6">
            <div className="grid gap-1.5">
              <Label>Date</Label>
              <Input id="exp-date" type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} className="rounded-xl" />
            </div>
            <div className="grid gap-1.5 md:col-span-2">
              <Label>Description</Label>
              <Input id="exp-desc" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="Rent, utilities…" className="rounded-xl" />
            </div>
            <div className="grid gap-1.5">
              <Label>Amount</Label>
              <Input id="exp-amount" type="number" step="0.01" value={expAmount} onChange={(e) => setExpAmount(Number(e.target.value))} className="rounded-xl" />
            </div>
            <div className="grid gap-1.5">
              <Label>Paid from</Label>
              <Select value={expBank} onValueChange={setExpBank}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Register" /></SelectTrigger>
                <SelectContent>{(banks as any[]).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={expAcct} onValueChange={setExpAcct}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Account" /></SelectTrigger>
                <SelectContent>{(expenseAccounts as any[]).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Button id="record-expense-btn" onClick={addExpense} className="rounded-xl">Record expense</Button>
          </div>
          <div className="mt-6 overflow-hidden rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Date</TableHead><TableHead>Description</TableHead>
                  <TableHead>Category</TableHead><TableHead>From</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(expenses as any[]).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No expenses yet.</TableCell></TableRow>
                )}
                {(expenses as any[]).map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell>{shortDate(e.expense_date)}</TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell className="text-muted-foreground">{e.chart_of_accounts?.name}</TableCell>
                    <TableCell className="text-muted-foreground">{e.bank_accounts?.name}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{money(e.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* ── User management ───────────────────────────────────── */}
        <Card className="border-border/70 bg-surface p-5 shadow-card rounded-2xl">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="font-serif text-lg">User management</h3>
            <p className="text-xs text-muted-foreground">Admin-only · Create staff or admin accounts</p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="grid gap-1.5">
              <Label>Full Name *</Label>
              <Input
                id="new-user-fullname"
                type="text"
                value={newUserFullName}
                onChange={(e) => setNewUserFullName(e.target.value)}
                placeholder="Full Name (e.g. Cashier 1)"
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Email *</Label>
              <Input
                id="new-user-email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="employee@company.com"
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Password *</Label>
              <Input
                id="new-user-password"
                type="text"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="min 6 characters"
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as "admin" | "staff")}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff">Cashier</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Button id="create-user-btn" onClick={createUser} disabled={creatingUser} className="rounded-xl">
              {creatingUser ? "Creating…" : "Create user"}
            </Button>
          </div>
          <div className="mt-6 overflow-hidden rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(staffList as any[]).length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">No users yet.</TableCell></TableRow>
                )}
                {(staffList as any[]).map((u: any) => {
                  const isSelf = currentUser?.id === u.id;
                  const userName = u.fullName || u.full_name || u.email?.split("@")[0] || "Staff";

                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-semibold">{userName}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium ${u.role === "admin" ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground"}`}>
                          {u.role === "staff" ? "Cashier" : "Admin"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {!isSelf ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setUserToDelete({ id: u.id, name: userName, email: u.email })}
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg"
                            title="Delete User"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">Active</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* ── User Delete Confirmation Modal ────────────────────── */}
        <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
          <DialogContent className="rounded-2xl max-w-md">
            <DialogHeader>
              <DialogTitle>Delete User Account</DialogTitle>
              <DialogDescription className="mt-2 text-sm text-muted-foreground">
                Are you sure you want to delete the staff account for <strong>{userToDelete?.name}</strong> ({userToDelete?.email})? This will permanently remove the account from MongoDB.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button variant="outline" onClick={() => setUserToDelete(null)} className="rounded-xl">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteUser}
                disabled={deletingUser}
                className="rounded-xl"
              >
                {deletingUser ? "Deleting…" : "Delete Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

