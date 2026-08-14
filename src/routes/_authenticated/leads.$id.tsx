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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StageBadge, PIPELINE_STAGES } from "@/components/stage-badge";
import { formatCurrencyCr, formatDate, formatDateTime } from "@/lib/format";
import { ArrowLeft, CheckCircle2, XCircle, Trash2, RotateCcw, Check, Users, UserX, Share2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useEndOwners } from "@/hooks/use-end-owners";
import { ShareTransferLeadDialog } from "@/components/share-transfer-lead-dialog";
import { EditRecordDialog } from "@/components/edit-record-dialog";
import {
  ConvertLeadDialog,
  MarkLostDialog,
  SERVICE_OPTIONS,
  lostReasonText,
} from "@/components/lead-outcome-dialogs";

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
  const [lostOpen, setLostOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  const [shareTransferOpen, setShareTransferOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*, owner:users!leads_owner_id_fkey(full_name, designation), co_owner:users!leads_co_owner_id_fkey(id, full_name, designation)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: users = [] } = useAssignableUsers();
  const { data: me } = useCurrentUser();
  const { endOwnerName, userName } = useEndOwners();

  const toggleShare = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from("leads")
        .update({ shared_with_team: next } as never)
        .eq("id", id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      toast.success(next ? "Shared with your team" : "Sharing turned off");
      qc.invalidateQueries({ queryKey: ["lead", id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


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




  const revive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("leads")
        .update({
          status: "active" as never,
          pipeline_stage: "Prospect" as never,
          lost_reason: null,
          lost_reason_code: null,
          lost_reason_note: null,
          lost_at: null,
        } as never)
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
        description={`${lead.client_type ?? ""} · ${lead.lead_source ?? ""}`}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link to="/leads"><ArrowLeft className="w-4 h-4" /> Back</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4" /> Edit
            </Button>
            {lead.status === "active" && (
              <>
                <Button variant="outline" size="sm" onClick={() => setLostOpen(true)}>
                  <XCircle className="w-4 h-4" /> Mark lost
                </Button>
                <Button size="sm" onClick={() => setConvertOpen(true)}>
                  <CheckCircle2 className="w-4 h-4" /> Convert to client
                </Button>

              </>
            )}
            {lead.status === "lost" && (
              <Button variant="outline" size="sm" onClick={() => revive.mutate()} disabled={revive.isPending}>
                <RotateCcw className="w-4 h-4" /> Revive lead
              </Button>
            )}
            {me?.id === lead.owner_id && lead.status === "active" && (
              <Button
                variant={(lead as { shared_with_team?: boolean }).shared_with_team ? "default" : "outline"}
                size="sm"
                onClick={() => toggleShare.mutate(!(lead as { shared_with_team?: boolean }).shared_with_team)}
                disabled={toggleShare.isPending}
              >
                {(lead as { shared_with_team?: boolean }).shared_with_team ? (
                  <><UserX className="w-4 h-4" /> Unshare from team</>
                ) : (
                  <><Users className="w-4 h-4" /> Share with team</>
                )}
              </Button>
            )}
            {(me?.designation === "President" || me?.designation === "MD & CEO") && lead.status === "active" && (
              <Button variant="outline" size="sm" onClick={() => setShareTransferOpen(true)}>
                <Share2 className="w-4 h-4" /> Share / Transfer
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

      {lead.status === "lost" && (() => {
        const l = lead as {
          lost_reason_code?: string | null;
          lost_reason_note?: string | null;
          lost_at?: string | null;
        };
        const recorded = !!l.lost_reason_code && l.lost_reason_code !== "not_recorded";
        return (
          <div className="px-6 pt-4">
            <Card className="p-4 border-destructive/40">
              <div className="text-xs uppercase tracking-wider text-destructive">
                Lost reason {l.lost_at && `· ${formatDateTime(l.lost_at)}`}
              </div>
              <div
                className={`mt-1 text-sm whitespace-pre-wrap ${recorded ? "" : "italic text-muted-foreground"}`}
              >
                {lostReasonText(l.lost_reason_code, l.lost_reason_note)}
              </div>
              {recorded && l.lost_reason_code !== "other" && l.lost_reason_note && (
                <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                  {l.lost_reason_note}
                </div>
              )}
            </Card>
          </div>
        );
      })()}

      {(lead as { co_owner?: { full_name: string } | null }).co_owner && (
        <div className="px-6 pt-4">
          <Card className="p-3 border-primary/40 flex items-center gap-2 text-sm">
            <Share2 className="w-4 h-4 text-primary" />
            <span>
              Shared 50/50 with <span className="font-medium">{(lead as { co_owner?: { full_name: string } | null }).co_owner!.full_name}</span> — estimated revenue is split equally between both accounts.
            </span>
          </Card>
        </div>
      )}

      <ShareTransferLeadDialog
        open={shareTransferOpen}
        onOpenChange={setShareTransferOpen}
        entity="lead"
        leadId={lead.id}
        ownerId={lead.owner_id}
        currentEndOwnerId={(lead as { end_owner_id?: string | null }).end_owner_id ?? null}
        currentCoOwnerId={(lead as { co_owner_id?: string | null }).co_owner_id ?? null}
        currentUserDesignation={me?.designation ?? ""}
      />



      <MarkLostDialog
        open={lostOpen}
        onOpenChange={setLostOpen}
        leadId={lead.id}
        leadName={lead.company_name}
      />

      <ConvertLeadDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        lead={{
          id: lead.id,
          company_name: lead.company_name,
          client_type: lead.client_type,
          owner_id: lead.owner_id,
          estimated_deal_value: lead.estimated_deal_value,
          services: (lead.services as string[] | null) ?? [],
        }}
        onConverted={(clientId) => navigate({ to: "/clients/$id", params: { id: clientId } })}
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
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Annual revenue</div>
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
          <div className="text-xs text-muted-foreground uppercase tracking-wider">End owner</div>
          <div className="mt-1.5 text-sm font-medium">
            {endOwnerName(lead as { owner_id: string; end_owner_id?: string | null })}
          </div>
          {(lead as { co_owner_id?: string | null }).co_owner_id && (
            <div className="text-xs text-muted-foreground mt-0.5">
              shared 50/50 with {userName((lead as { co_owner_id?: string | null }).co_owner_id) ?? "another President"}
            </div>
          )}
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
                
                <Field label="Lead source" value={lead.lead_source} />
                <Field label="Pipeline stage" value={lead.pipeline_stage} />
                <Field label="AUC" value={formatCurrencyCr((lead as { auc?: number | null }).auc)} />
                <Field label="Annual revenue" value={formatCurrencyCr(lead.estimated_deal_value)} />
              </div>
              {lead.notes && (
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Notes</div>
                  <div className="mt-1 text-sm">{lead.notes}</div>
                </div>
              )}
              <div className="mt-6">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Services interested in
                </div>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_OPTIONS.map((s) => {
                    const current: string[] = Array.isArray(lead.services) ? (lead.services as string[]) : [];
                    const active = current.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={updateServices.isPending}
                        onClick={() => {
                          const next = active ? current.filter((x) => x !== s) : [...current, s];
                          updateServices.mutate(next);
                        }}
                        className="focus:outline-none"
                      >
                        <Badge variant={active ? "default" : "outline"} className="cursor-pointer gap-1">
                          {active && <Check className="w-3 h-3" />} {s}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
                {(!lead.services || (lead.services as string[]).length === 0) && (
                  <div className="mt-2 text-xs text-muted-foreground">No services selected yet — click to add.</div>
                )}
              </div>
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
