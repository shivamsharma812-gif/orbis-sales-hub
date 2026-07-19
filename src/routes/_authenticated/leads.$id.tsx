import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StageBadge, PIPELINE_STAGES } from "@/components/stage-badge";
import { formatCurrencyCr, formatDate } from "@/lib/format";
import { ArrowLeft, CheckCircle2, XCircle, Trash2, RotateCcw, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const SERVICE_OPTIONS = [
  "Custody & Allied Services",
  "RTA",
  "Trusteeship",
  "Fund Accounting",
  "Fund Administration",
] as const;
import { toast } from "sonner";
import {
  ContactsTab,
  MeetingsTab,
  FollowupsTab,
  TasksTab,
  NotesTab,
  TimelineTab,
  DocumentsTab,
} from "@/components/workspace/tabs";
import { useAssignableUsers } from "@/hooks/use-assignable-users";

export const Route = createFileRoute("/_authenticated/leads/$id")({
  head: () => ({ meta: [{ title: "Lead — Orbis CRM" }] }),
  component: LeadWorkspace,
});

function LeadWorkspace() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*, owner:users!leads_owner_id_fkey(full_name, designation)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: users = [] } = useAssignableUsers();

  const updateStage = useMutation({
    mutationFn: async (stage: string) => {
      const { error } = await supabase.from("leads").update({ pipeline_stage: stage as never }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const reassign = useMutation({
    mutationFn: async (ownerId: string) => {
      const { error } = await supabase.from("leads").update({ owner_id: ownerId }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead", id] }),
  });

  const updateServices = useMutation({
    mutationFn: async (services: string[]) => {
      const { error } = await supabase.from("leads").update({ services }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Services updated");
      qc.invalidateQueries({ queryKey: ["lead", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convert = useMutation({
    mutationFn: async () => {
      if (!lead) throw new Error("Lead missing");
      const { data: client, error: cErr } = await supabase
        .from("clients")
        .insert({
          company_name: lead.company_name,
          client_type: lead.client_type,
          industry: lead.industry,
          owner_id: lead.owner_id,
          originating_lead_id: lead.id,
          annual_revenue: lead.estimated_deal_value,
        })
        .select()
        .single();
      if (cErr) throw cErr;
      const { error: uErr } = await supabase
        .from("leads")
        .update({
          status: "won" as never,
          pipeline_stage: "Won" as never,
          converted_client_id: client.id,
        })
        .eq("id", id);
      if (uErr) throw uErr;
      return client;
    },
    onSuccess: (client) => {
      toast.success("Converted to client");
      qc.invalidateQueries();
      navigate({ to: "/clients/$id", params: { id: client.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markLost = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("leads")
        .update({ status: "lost" as never, pipeline_stage: "Lost" as never })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked lost");
      qc.invalidateQueries({ queryKey: ["lead", id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const revive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("leads")
        .update({ status: "active" as never, pipeline_stage: "Prospect" as never })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead revived");
      qc.invalidateQueries({ queryKey: ["lead", id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead deleted");
      qc.invalidateQueries({ queryKey: ["leads"] });
      navigate({ to: "/leads" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!lead) return <div className="p-6 text-sm text-muted-foreground">Lead not found or access denied.</div>;

  return (
    <div>
      <PageHeader
        title={lead.company_name}
        description={`${lead.client_type ?? ""} · ${lead.industry ?? ""} · ${lead.lead_source ?? ""}`}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link to="/leads"><ArrowLeft className="w-4 h-4" /> Back</Link>
            </Button>
            {lead.status === "active" && (
              <>
                <Button variant="outline" size="sm" onClick={() => markLost.mutate()}>
                  <XCircle className="w-4 h-4" /> Mark lost
                </Button>
                <Button size="sm" onClick={() => convert.mutate()} disabled={convert.isPending}>
                  <CheckCircle2 className="w-4 h-4" /> Convert to client
                </Button>
              </>
            )}
            {lead.status === "lost" && (
              <Button variant="outline" size="sm" onClick={() => revive.mutate()} disabled={revive.isPending}>
                <RotateCcw className="w-4 h-4" /> Revive lead
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => { if (confirm("Delete this lead permanently? This cannot be undone.")) deleteLead.mutate(); }}
              disabled={deleteLead.isPending}
            >
              <Trash2 className="w-4 h-4 text-destructive" /> Delete
            </Button>
          </>
        }
      />

      {/* Overview strip */}
      <div className="p-6 pb-0 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Stage</div>
          <div className="mt-1.5">
            <Select value={lead.pipeline_stage} onValueChange={(v) => updateStage.mutate(v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Estimated value</div>
          <div className="mt-1.5 text-lg font-semibold">{formatCurrencyCr(lead.estimated_deal_value)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Owner</div>
          <div className="mt-1.5">
            <Select value={lead.owner_id} onValueChange={(v) => reassign.mutate(v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Status</div>
          <div className="mt-1.5 flex items-center gap-2">
            <StageBadge stage={lead.pipeline_stage} />
            <span className="text-xs text-muted-foreground">Created {formatDate(lead.created_at)}</span>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="p-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
            <TabsTrigger value="followups">Follow-ups</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <Card className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <Field label="Company" value={lead.company_name} />
                <Field label="Client type" value={lead.client_type} />
                <Field label="Industry" value={lead.industry} />
                <Field label="Lead source" value={lead.lead_source} />
                <Field label="Pipeline stage" value={lead.pipeline_stage} />
                <Field label="Estimated value" value={formatCurrencyCr(lead.estimated_deal_value)} />
              </div>
              {lead.notes && (
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Notes</div>
                  <div className="mt-1 text-sm">{lead.notes}</div>
                </div>
              )}
            </Card>
          </TabsContent>
          <TabsContent value="contacts"><ContactsTab parentType="lead" parentId={lead.id} ownerId={lead.owner_id} /></TabsContent>
          <TabsContent value="meetings"><MeetingsTab parentType="lead" parentId={lead.id} ownerId={lead.owner_id} /></TabsContent>
          <TabsContent value="followups"><FollowupsTab parentType="lead" parentId={lead.id} ownerId={lead.owner_id} /></TabsContent>
          <TabsContent value="tasks"><TasksTab parentType="lead" parentId={lead.id} ownerId={lead.owner_id} /></TabsContent>
          <TabsContent value="notes"><NotesTab parentType="lead" parentId={lead.id} ownerId={lead.owner_id} /></TabsContent>
          <TabsContent value="documents"><DocumentsTab parentType="lead" parentId={lead.id} ownerId={lead.owner_id} /></TabsContent>
          <TabsContent value="timeline"><TimelineTab parentType="lead" parentId={lead.id} ownerId={lead.owner_id} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value ?? "—"}</div>
    </div>
  );
}
