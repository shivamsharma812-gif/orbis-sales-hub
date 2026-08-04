import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Filter } from "lucide-react";
import { formatCurrencyCr, formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({ meta: [{ title: "Clients — Orbis CRM" }] }),
  component: ClientsPage,
});

function ClientsPage() {
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [q, setQ] = useState("");
  const navigate = useNavigate({ from: "/clients" });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", { serviceFilter, statusFilter, q }],
    queryFn: async () => {
      let query = supabase
        .from("clients")
        .select("*, owner:users!clients_owner_id_fkey(full_name)")
        .order("company_name");
      if (serviceFilter !== "all") query = query.eq("service_type", serviceFilter);
      if (statusFilter !== "all") query = query.eq("status", statusFilter as never);
      if (q.trim()) query = query.ilike("company_name", `%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  // last meeting per client (single query, group in memory)
  const { data: lastMeetings } = useQuery({
    queryKey: ["clients", "last-meetings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("meetings")
        .select("parent_id, meeting_date")
        .eq("parent_type", "client" as never)
        .order("meeting_date", { ascending: false });
      const map = new Map<string, string>();
      data?.forEach((m) => {
        if (!map.has(m.parent_id)) map.set(m.parent_id, m.meeting_date);
      });
      return map;
    },
  });

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Active client relationships."
        actions={<CreateClientDialog />}
      />
      <div className="px-6 pt-4 flex items-center gap-2 flex-wrap">
        <Input placeholder="Search company…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56 h-9" />
        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="w-44 h-9"><Filter className="w-3.5 h-3.5 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All services</SelectItem>
            {["Custody & Allied Services","PCM","Fund Accounting","Trusteeship","RTA"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="p-6 pt-4">
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">AUC</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead>Last meeting</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No clients match these filters.</TableCell></TableRow>
              )}
              {clients.map((c) => {
                const owner = (c as unknown as { owner?: { full_name: string } }).owner;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link to="/clients/$id" params={{ id: c.id }} className="hover:underline">
                        {c.company_name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{c.client_type}</div>
                    </TableCell>
                    <TableCell>{owner?.full_name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{c.service_type ?? "—"}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{formatCurrencyCr(c.auc)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrencyCr(c.annual_revenue)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(lastMeetings?.get(c.id))}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "active" ? "secondary" : "outline"}>{c.status}</Badge>
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

function CreateClientDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    client_type: "AIF",
    service_type: "Custody & Allied Services",
    auc: "",
    annual_revenue: "",
  });
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { data: me } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", auth.user.id)
        .maybeSingle();
      if (!me) throw new Error("Your account isn't linked to a user record");
      const { error } = await supabase.from("clients").insert({
        company_name: form.company_name,
        client_type: form.client_type,
        service_type: form.service_type,
        auc: Number(form.auc) || 0,
        annual_revenue: Number(form.annual_revenue) || 0,
        owner_id: me.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Client created");
      setOpen(false);
      setForm({ company_name: "", client_type: "AIF", service_type: "Custody & Allied Services", auc: "", annual_revenue: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-4 h-4" /> New client</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create client</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label>Company name</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Client type</Label>
            <Select value={form.client_type} onValueChange={(v) => setForm({ ...form, client_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["AIF","PMS","Mutual Fund","Trading Member","Corporate","Family Office"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Service</Label>
            <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Custody & Allied Services","PCM","Fund Accounting","Trusteeship","RTA"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>AUC (₹ Cr)</Label><Input type="number" step="0.01" value={form.auc} onChange={(e) => setForm({ ...form, auc: e.target.value })} /></div>
          <div className="col-span-2 space-y-1.5"><Label>Annual Revenue (₹ Cr)</Label><Input type="number" step="0.01" value={form.annual_revenue} onChange={(e) => setForm({ ...form, annual_revenue: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!form.company_name || create.isPending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
