import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, Undo2, Share2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatCurrencyCr, formatDate } from "@/lib/format";
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
import { useEndOwners } from "@/hooks/use-end-owners";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ShareTransferLeadDialog } from "@/components/share-transfer-lead-dialog";
import { EditRecordDialog } from "@/components/edit-record-dialog";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  head: () => ({ meta: [{ title: "Client — Orbis CRM" }] }),
  component: ClientWorkspace,
});

function ClientWorkspace() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [shareTransferOpen, setShareTransferOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { endOwnerName, userName } = useEndOwners();
  const { data: me } = useCurrentUser();

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*, owner:users!clients_owner_id_fkey(full_name, designation)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: users = [] } = useAssignableUsers();

  const reassign = useMutation({
    mutationFn: async (ownerId: string) => {
      const { error } = await supabase.from("clients").update({ owner_id: ownerId }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client", id] }),
  });

  const revertToLead = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("Client missing");
      let leadId = client.originating_lead_id as string | null;
      if (leadId) {
        // Reactivate original lead
        const { error: uErr } = await supabase
          .from("leads")
          .update({
            status: "active" as never,
            pipeline_stage: "Prospect" as never,
            converted_client_id: null,
          })
          .eq("id", leadId);
        if (uErr) throw uErr;
      } else {
        // Create a fresh lead from client data
        const { data: newLead, error: iErr } = await supabase
          .from("leads")
          .insert({
            company_name: client.company_name,
            client_type: client.client_type,
            owner_id: client.owner_id,
            pipeline_stage: "Prospect" as never,
            status: "active" as never,
            estimated_deal_value: client.annual_revenue,
          })
          .select()
          .single();
        if (iErr) throw iErr;
        leadId = newLead.id;
      }
      const { error: dErr } = await supabase.from("clients").delete().eq("id", id);
      if (dErr) throw dErr;
      return leadId!;
    },
    onSuccess: (leadId) => {
      toast.success("Reverted to lead");
      qc.invalidateQueries();
      navigate({ to: "/leads/$id", params: { id: leadId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteClient = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Client deleted");
      qc.invalidateQueries({ queryKey: ["clients"] });
      navigate({ to: "/clients" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!client) return <div className="p-6 text-sm text-muted-foreground">Client not found or access denied.</div>;

  return (
    <div>
      <PageHeader
        title={client.company_name}
        description={client.client_type ?? ""}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link to="/clients"><ArrowLeft className="w-4 h-4" /> Back</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4" /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { if (confirm("Revert this client back to a lead? The client record will be removed.")) revertToLead.mutate(); }}
              disabled={revertToLead.isPending}
            >
              <Undo2 className="w-4 h-4" /> Revert to lead
            </Button>
            {(me?.designation === "President" || me?.designation === "MD & CEO") && (
              <Button variant="outline" size="sm" onClick={() => setShareTransferOpen(true)}>
                <Share2 className="w-4 h-4" /> Share / Transfer
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => { if (confirm("Delete this client permanently? This cannot be undone.")) deleteClient.mutate(); }}
              disabled={deleteClient.isPending}
            >
              <Trash2 className="w-4 h-4 text-destructive" /> Delete
            </Button>
          </>
        }
      />

      <div className="p-6 pb-0 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Service</div>
          <div className="mt-1.5"><Badge variant="outline">{client.service_type ?? "—"}</Badge></div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">AUC</div>
          <div className="mt-1.5 text-lg font-semibold">{formatCurrencyCr(client.auc)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Annual revenue</div>
          <div className="mt-1.5 text-lg font-semibold">{formatCurrencyCr(client.annual_revenue)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Relationship manager</div>
          <div className="mt-1.5">
            <Select value={client.owner_id} onValueChange={(v) => reassign.mutate(v)}>
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
            {endOwnerName(client as { owner_id: string; end_owner_id?: string | null })}
          </div>
        </Card>
      </div>

      {editOpen && (
        <EditRecordDialog kind="client" row={client as unknown as Record<string, unknown>} open={editOpen} onOpenChange={setEditOpen} />
      )}

      <ShareTransferLeadDialog
        open={shareTransferOpen}
        onOpenChange={setShareTransferOpen}
        entity="client"
        leadId={client.id}
        ownerId={client.owner_id}
        currentEndOwnerId={(client as { end_owner_id?: string | null }).end_owner_id ?? null}
        currentCoOwnerId={(client as { co_owner_id?: string | null }).co_owner_id ?? null}
        currentUserDesignation={me?.designation ?? ""}
      />

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
            <TabsTrigger value="services">Services</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <Card className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <Field label="Company" value={client.company_name} />
                <Field label="Client type" value={client.client_type} />
                <Field label="Service" value={client.service_type} />
                <Field label="AUC" value={formatCurrencyCr(client.auc)} />
                <Field label="Annual revenue" value={formatCurrencyCr(client.annual_revenue)} />
                <Field label="Website" value={client.website} />
                <Field label="Address" value={client.address} />
                <Field label="Since" value={formatDate(client.created_at)} />
              </div>
              {client.remarks && (
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Remarks</div>
                  <div className="mt-1 text-sm">{client.remarks}</div>
                </div>
              )}
            </Card>
          </TabsContent>
          <TabsContent value="contacts"><ContactsTab parentType="client" parentId={client.id} ownerId={client.owner_id} /></TabsContent>
          <TabsContent value="meetings"><MeetingsTab parentType="client" parentId={client.id} ownerId={client.owner_id} /></TabsContent>
          <TabsContent value="followups"><FollowupsTab parentType="client" parentId={client.id} ownerId={client.owner_id} /></TabsContent>
          <TabsContent value="tasks"><TasksTab parentType="client" parentId={client.id} ownerId={client.owner_id} /></TabsContent>
          <TabsContent value="notes"><NotesTab parentType="client" parentId={client.id} ownerId={client.owner_id} /></TabsContent>
          <TabsContent value="documents"><DocumentsTab parentType="client" parentId={client.id} ownerId={client.owner_id} /></TabsContent>
          <TabsContent value="timeline"><TimelineTab parentType="client" parentId={client.id} ownerId={client.owner_id} /></TabsContent>
          <TabsContent value="services">
            <Card className="p-4">
              <div className="text-sm">Current service: <Badge variant="outline">{client.service_type ?? "—"}</Badge></div>
              <div className="text-xs text-muted-foreground mt-2">
                Additional services (Custody & Allied Services, PCM, Trusteeship, Fund Accounting, RTA, Compliance) will be
                managed here once the Client Onboarding module ships.
              </div>
            </Card>
          </TabsContent>
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
