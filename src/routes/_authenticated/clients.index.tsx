import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  DialogDescription,
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
import { useCurrentUser } from "@/hooks/use-current-user";
import { BusinessFields } from "@/components/business-fields";
import {
  BusinessFormState,
  businessToClientColumns,
  emptyBusinessForm,
  validateBusinessForm,
} from "@/lib/business-fields";

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({ meta: [{ title: "Clients — Orbis CRM" }] }),
  component: ClientsPage,
});

function ClientsPage() {
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");
  const navigate = useNavigate();

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
            <SelectItem value="onboarded">Onboarded</SelectItem>
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
                <TableHead>Last meeting</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No clients match these filters.</TableCell></TableRow>
              )}
              {clients.map((c) => {
                const owner = (c as unknown as { owner?: { full_name: string } }).owner;
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => navigate({ to: "/clients/$id", params: { id: c.id } })}
                  >
                    <TableCell className="font-medium">
                      {c.company_name}
                      <div className="text-xs text-muted-foreground">{c.client_type}</div>
                    </TableCell>
                    <TableCell>{owner?.full_name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{c.service_type ?? "—"}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{formatCurrencyCr(c.auc)}</TableCell>
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

export function CreateClientDialog({
  openOverride,
  onOpenChange,
  hideTrigger,
}: {
  openOverride?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
} = {}) {
  const [openState, setOpenState] = useState(false);
  const open = openOverride ?? openState;
  const setOpen = (o: boolean) => { setOpenState(o); onOpenChange?.(o); };
  const { data: me } = useCurrentUser();
  const [form, setForm] = useState<BusinessFormState>(emptyBusinessForm);
  const [contact, setContact] = useState({ name: "", designation: "", email: "", phone: "" });
  const qc = useQueryClient();

  const update = <K extends keyof BusinessFormState>(k: K, v: BusinessFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleOpen = (o: boolean) => {
    if (o) {
      setForm((f) => ({ ...f, owner_id: f.owner_id || me?.id || "" }));
    } else {
      setForm(emptyBusinessForm);
      setContact({ name: "", designation: "", email: "", phone: "" });
    }
    setOpen(o);
  };

  const errors = validateBusinessForm(form);

  const create = useMutation({
    mutationFn: async () => {
      // `status` is intentionally not sent — the database forces "onboarded".
      const { data: client, error } = await supabase
        .from("clients")
        .insert(businessToClientColumns(form) as never)
        .select()
        .single();
      if (error) throw error;
      if (contact.name.trim()) {
        const { error: cErr } = await supabase.from("contacts").insert({
          parent_type: "client" as never,
          parent_id: client.id,
          name: contact.name.trim(),
          designation: contact.designation || null,
          email: contact.email || null,
          phone: contact.phone || null,
          is_primary: true,
        });
        if (cErr) throw cErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Client created");
      handleOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button size="sm"><Plus className="w-4 h-4" /> New client</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create client</DialogTitle>
          <DialogDescription>
            Same details as a pipeline record. New clients are always onboarded.
          </DialogDescription>
        </DialogHeader>
        <BusinessFields form={form} update={update} showProbability={false} showState={false} showAddress />
        <section className="grid grid-cols-2 gap-4 border-t pt-4">
          <div className="col-span-2 text-sm font-medium">Primary contact</div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Designation</Label>
            <Input value={contact.designation} onChange={(e) => setContact({ ...contact, designation: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
          </div>
        </section>
        {errors.length > 0 && (
          <ul className="text-xs text-destructive space-y-0.5">
            {errors.map((e) => <li key={e}>• {e}</li>)}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpen(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={errors.length > 0 || create.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

