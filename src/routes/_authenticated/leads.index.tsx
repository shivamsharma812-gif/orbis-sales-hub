import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { LayoutGrid, List, Filter, Check, X } from "lucide-react";
import { formatCurrencyCr, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { CreateLeadWizard } from "@/components/create-lead-wizard";
import {
  ConvertLeadDialog,
  MarkLostDialog,
  type ConvertibleLead,
} from "@/components/lead-outcome-dialogs";

const CLIENT_TYPES = [
  "AIF",
  "PMS",
  "FPI",
  "Mutual Fund",
  "Trading Member",
  "Corporate",
  "Family Office",
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthOptions() {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` });
  }
  return out;
}

export const Route = createFileRoute("/_authenticated/leads/")({
  head: () => ({ meta: [{ title: "Leads — Orbis CRM" }] }),
  component: LeadsPage,
});

interface Lead {
  id: string;
  company_name: string;
  client_type: string | null;
  lead_source: string | null;
  pipeline_stage: string;
  estimated_deal_value: number;
  status: string;
  owner_id: string;
  created_at: string;
  services?: string[] | null;
}


function LeadsPage() {
  const [view, setView] = useState<"list" | "kanban">("list");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [convertLead, setConvertLead] = useState<ConvertibleLead | null>(null);
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const months = monthOptions();
  const navigate = useNavigate({ from: "/leads" });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", { stageFilter, statusFilter, typeFilter, monthFilter, q }],
    queryFn: async () => {
      let query = supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (stageFilter !== "all") query = query.eq("pipeline_stage", stageFilter as never);
      if (statusFilter !== "all") query = query.eq("status", statusFilter as never);
      if (typeFilter !== "all") query = query.eq("client_type", typeFilter);
      if (monthFilter !== "all") {
        const [y, m] = monthFilter.split("-").map(Number);
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 1);
        query = query.gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
      }
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
        title="Pipeline"
        description="Prospective clients moving through the sales pipeline."
        actions={<CreateLeadWizard />}
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
        <Button
          variant={statusFilter === "lost" ? "default" : "outline"}
          size="sm"
          onClick={() => { setStatusFilter(statusFilter === "lost" ? "active" : "lost"); setView("list"); }}
        >
          {statusFilter === "lost" ? "Showing lost leads" : "View lost leads"}
        </Button>
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
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All client types</SelectItem>
              {CLIENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
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
                  <TableHead className="text-right">Est. Value</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                  <TableRow
                    key={l.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => navigate({ to: "/leads/$id", params: { id: l.id } })}
                  >
                    <TableCell className="font-medium">
                      {l.company_name}
                      <div className="text-xs text-muted-foreground">{l.client_type}</div>
                    </TableCell>
                    <TableCell>{ownerMap.get(l.owner_id) ?? "—"}</TableCell>
                    <TableCell>
                      <StageBadge stage={l.pipeline_stage} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{l.lead_source}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrencyCr(l.estimated_deal_value)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(l.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.status === "active" ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-success hover:text-success"
                            title="Convert to client"
                            aria-label={`Convert ${l.company_name} to client`}
                            onClick={(e) => { e.stopPropagation(); setConvertLead(l); }}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Mark lost"
                            aria-label={`Mark ${l.company_name} lost`}
                            onClick={(e) => { e.stopPropagation(); setLostLead(l); }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <KanbanBoard
            leads={leads}
            ownerMap={ownerMap}
            onConvert={(l) => setConvertLead(l)}
            onMarkLost={(l) => setLostLead(l)}
          />
        )}
      </div>

      <ConvertLeadDialog
        open={!!convertLead}
        onOpenChange={(v) => !v && setConvertLead(null)}
        lead={convertLead}
      />
      <MarkLostDialog
        open={!!lostLead}
        onOpenChange={(v) => !v && setLostLead(null)}
        leadId={lostLead?.id ?? null}
        leadName={lostLead?.company_name}
      />
    </div>

  );
}

function KanbanBoard({
  leads,
  ownerMap,
  onConvert,
  onMarkLost,
}: {
  leads: Lead[];
  ownerMap: Map<string, string>;
  onConvert: (lead: Lead) => void;
  onMarkLost: (lead: Lead) => void;
}) {
  const navigate = useNavigate({ from: "/leads" });
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
                onClick={() => navigate({ to: "/leads/$id", params: { id: l.id } })}
              >
                <div className="text-sm font-medium block truncate">
                  {l.company_name}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {ownerMap.get(l.owner_id) ?? "—"}
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <div className="text-xs font-mono">{formatCurrencyCr(l.estimated_deal_value)}</div>
                  <Select value={l.pipeline_stage} onValueChange={(v) => moveTo(l.id, v)}>
                    <SelectTrigger className="h-6 text-[10px] px-1.5 w-auto border-0 hover:bg-accent" onClick={(e) => e.stopPropagation()}>
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
                {l.status === "active" && (
                  <div className="mt-1.5 flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-success hover:text-success"
                      title="Convert to client"
                      aria-label={`Convert ${l.company_name} to client`}
                      onClick={(e) => { e.stopPropagation(); onConvert(l); }}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      title="Mark lost"
                      aria-label={`Mark ${l.company_name} lost`}
                      onClick={(e) => { e.stopPropagation(); onMarkLost(l); }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}

              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

