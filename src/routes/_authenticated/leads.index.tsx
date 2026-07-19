import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { StageBadge, PIPELINE_STAGES, ACTIVE_STAGES } from "@/components/stage-badge";
import { LayoutGrid, List, Filter } from "lucide-react";
import { formatCurrencyCr, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { CreateLeadWizard } from "@/components/create-lead-wizard";


export const Route = createFileRoute("/_authenticated/leads/")({
  head: () => ({ meta: [{ title: "Leads — Orbis CRM" }] }),
  component: LeadsPage,
});

interface Lead {
  id: string;
  company_name: string;
  client_type: string | null;
  industry: string | null;
  lead_source: string | null;
  pipeline_stage: string;
  estimated_deal_value: number;
  status: string;
  owner_id: string;
  created_at: string;
}

function LeadsPage() {
  const [view, setView] = useState<"list" | "kanban">("list");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [q, setQ] = useState("");

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", { stageFilter, statusFilter, q }],
    queryFn: async () => {
      let query = supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (stageFilter !== "all") query = query.eq("pipeline_stage", stageFilter as never);
      if (statusFilter !== "all") query = query.eq("status", statusFilter as never);
      if (q.trim()) query = query.ilike("company_name", `%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, full_name, designation");
      return data ?? [];
    },
    staleTime: 300_000,
  });

  const ownerMap = new Map(users.map((u) => [u.id, u.full_name]));

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Prospective clients moving through the sales pipeline."
        actions={<CreateLeadDialog />}
      />
      <div className="px-6 pt-4 flex items-center gap-2 flex-wrap">
        <div className="flex items-center rounded-md border border-border overflow-hidden">
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${view === "list" ? "bg-accent" : ""}`}
          >
            <List className="w-3.5 h-3.5" /> List
          </button>
          <button
            onClick={() => setView("kanban")}
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 border-l border-border ${view === "kanban" ? "bg-accent" : ""}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Pipeline
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Search company…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-56 h-9"
          />
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-44 h-9">
              <Filter className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {PIPELINE_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="p-6 pt-4">
        {view === "list" ? (
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead className="text-right">Est. Value</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      No leads match these filters.
                    </TableCell>
                  </TableRow>
                )}
                {leads.map((l) => (
                  <TableRow key={l.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link to="/leads/$id" params={{ id: l.id }} className="hover:underline">
                        {l.company_name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{l.client_type}</div>
                    </TableCell>
                    <TableCell>{ownerMap.get(l.owner_id) ?? "—"}</TableCell>
                    <TableCell>
                      <StageBadge stage={l.pipeline_stage} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{l.lead_source}</TableCell>
                    <TableCell className="text-muted-foreground">{l.industry}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrencyCr(l.estimated_deal_value)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(l.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <KanbanBoard leads={leads} ownerMap={ownerMap} />
        )}
      </div>
    </div>
  );
}

function KanbanBoard({ leads, ownerMap }: { leads: Lead[]; ownerMap: Map<string, string> }) {
  const qc = useQueryClient();
  const stages = ACTIVE_STAGES;

  const grouped = new Map<string, Lead[]>();
  stages.forEach((s) => grouped.set(s, []));
  leads.forEach((l) => {
    const arr = grouped.get(l.pipeline_stage);
    if (arr) arr.push(l);
  });

  const totals = Object.fromEntries(
    stages.map((s) => [
      s,
      (grouped.get(s) ?? []).reduce((sum, l) => sum + Number(l.estimated_deal_value ?? 0), 0),
    ]),
  );

  async function moveTo(leadId: string, newStage: string) {
    const { error } = await supabase.from("leads").update({ pipeline_stage: newStage as never }).eq("id", leadId);
    if (error) toast.error(error.message);
    else {
      toast.success("Stage updated");
      qc.invalidateQueries({ queryKey: ["leads"] });
    }
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
      {stages.map((s) => (
        <div key={s} className="bg-surface-2 border border-border rounded-md p-2 min-h-[200px]">
          <div className="px-1 py-1 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {s}
            </div>
            <div className="text-xs text-muted-foreground">{grouped.get(s)?.length ?? 0}</div>
          </div>
          <div className="text-[10px] text-muted-foreground px-1">
            {formatCurrencyCr(totals[s])}
          </div>
          <div className="mt-2 space-y-2">
            {(grouped.get(s) ?? []).map((l) => (
              <div
                key={l.id}
                className="bg-card border border-border rounded p-2.5 cursor-pointer hover:border-primary/50 transition-colors"
              >
                <Link
                  to="/leads/$id"
                  params={{ id: l.id }}
                  className="text-sm font-medium block truncate"
                >
                  {l.company_name}
                </Link>
                <div className="text-xs text-muted-foreground truncate">
                  {ownerMap.get(l.owner_id) ?? "—"}
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <div className="text-xs font-mono">{formatCurrencyCr(l.estimated_deal_value)}</div>
                  <Select value={l.pipeline_stage} onValueChange={(v) => moveTo(l.id, v)}>
                    <SelectTrigger className="h-6 text-[10px] px-1.5 w-auto border-0 hover:bg-accent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PIPELINE_STAGES.map((st) => (
                        <SelectItem key={st} value={st}>
                          {st}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CreateLeadDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    client_type: "AIF",
    industry: "Financial Services",
    lead_source: "Referral",
    pipeline_stage: "Prospect",
    estimated_deal_value: "",
    notes: "",
  });
  const qc = useQueryClient();
  const { data: users = [] } = useQuery({
    queryKey: ["users-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, full_name");
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { data: me } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", auth.user.id)
        .maybeSingle();
      if (!me) throw new Error("Your account isn't linked to a user record yet");
      const { error, data } = await supabase
        .from("leads")
        .insert({
          company_name: form.company_name,
          client_type: form.client_type,
          industry: form.industry,
          lead_source: form.lead_source,
          pipeline_stage: form.pipeline_stage as never,
          estimated_deal_value: Number(form.estimated_deal_value) || 0,
          notes: form.notes,
          owner_id: me.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Lead created");
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setForm({
        company_name: "",
        client_type: "AIF",
        industry: "Financial Services",
        lead_source: "Referral",
        pipeline_stage: "Prospect",
        estimated_deal_value: "",
        notes: "",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  void users;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4" /> New lead
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create lead</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Company name</Label>
            <Input
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Client type</Label>
            <Select value={form.client_type} onValueChange={(v) => setForm({ ...form, client_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["AIF","PMS","Mutual Fund","REIT","InvIT","Corporate","Family Office"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Industry</Label>
            <Input
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={form.lead_source} onValueChange={(v) => setForm({ ...form, lead_source: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Referral","Cold Outreach","Event","Website","Regulatory Filing","Partner","Inbound Email"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Pipeline stage</Label>
            <Select
              value={form.pipeline_stage}
              onValueChange={(v) => setForm({ ...form, pipeline_stage: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Estimated deal value (₹ Cr)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.estimated_deal_value}
              onChange={(e) => setForm({ ...form, estimated_deal_value: e.target.value })}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!form.company_name || create.isPending}
          >
            {create.isPending ? "Creating…" : "Create lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// unused helper import guard
void useNavigate; void Tabs; void TabsList; void TabsTrigger; void TabsContent;
