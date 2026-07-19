import { createFileRoute, Link } from "@tanstack/react-router";
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
import { ArrowLeft } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/clients/$id")({
  head: () => ({ meta: [{ title: "Client — Orbis CRM" }] }),
  component: ClientWorkspace,
});

function ClientWorkspace() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

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

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!client) return <div className="p-6 text-sm text-muted-foreground">Client not found or access denied.</div>;

  return (
    <div>
      <PageHeader
        title={client.company_name}
        description={`${client.client_type ?? ""} · ${client.industry ?? ""}`}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/clients"><ArrowLeft className="w-4 h-4" /> Back</Link>
          </Button>
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
      </div>

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
                <Field label="Industry" value={client.industry} />
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
                Additional services (Custody, Trusteeship, Fund Accounting, RTA, Escrow, Compliance) will be
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
