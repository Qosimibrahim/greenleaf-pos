import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Mail, Phone } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
});

type Client = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<Client[]>("/clients"),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter((c) =>
      [c.name, c.company, c.email, c.phone].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [clients, search]);

  async function remove(id: string) {
    if (!confirm("Delete this client?")) return;
    await api.del(`/clients/${id}`);
    toast.success("Client removed");
    qc.invalidateQueries({ queryKey: ["clients"] });
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Contacts you invoice and issue receipts to."
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-xl gap-1.5"><Plus className="mr-1.5 h-4 w-4" /> New client</Button>
            </DialogTrigger>
            <ClientDialog
              client={editing}
              onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["clients"] }); }}
            />
          </Dialog>
        }
      />

      <div className="px-8 py-6">
        <Card className="border-border/70 bg-surface p-4 shadow-card rounded-2xl">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="client-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients…"
              className="pl-9 rounded-xl"
            />
          </div>
        </Card>

        <Card className="mt-4 overflow-hidden border-border/70 bg-surface p-0 shadow-card rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-16 text-center text-sm text-muted-foreground">
                    No clients yet.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((c) => (
                <TableRow key={c.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="font-semibold">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.company ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5 text-xs">
                      {c.email && <span className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-muted-foreground" />{c.email}</span>}
                      {c.phone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-muted-foreground" />{c.phone}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => { setEditing(c); setOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => remove(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

function ClientDialog({ client, onDone }: { client: Client | null; onDone: () => void }) {
  const [form, setForm] = useState({
    name: client?.name ?? "",
    company: client?.company ?? "",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
    address: client?.address ?? "",
    notes: client?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim()) return toast.error("Name required");
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        company: form.company.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (client) {
        await api.put(`/clients/${client.id}`, payload);
        toast.success("Client updated");
      } else {
        await api.post("/clients", payload);
        toast.success("Client created");
      }
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  }

  return (
    <DialogContent className="rounded-2xl">
      <DialogHeader>
        <DialogTitle className="font-serif text-2xl">{client ? "Edit client" : "New client"}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3 py-2 md:grid-cols-2">
        <div className="grid gap-1.5 md:col-span-2"><Label>Full name</Label><Input id="client-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl" /></div>
        <div className="grid gap-1.5"><Label>Company</Label><Input value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} className="rounded-xl" /></div>
        <div className="grid gap-1.5"><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl" /></div>
        <div className="grid gap-1.5"><Label>Phone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-xl" /></div>
        <div className="grid gap-1.5 md:col-span-2"><Label>Address</Label><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} className="rounded-xl" /></div>
        <div className="grid gap-1.5 md:col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl" /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" className="rounded-xl" onClick={onDone}>Cancel</Button>
        <Button id="client-save-btn" className="rounded-xl" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
