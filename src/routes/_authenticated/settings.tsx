import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { startOutlookConnect, disconnectOutlook } from "@/lib/outlook.functions";
import { CalendarDays, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Orbis CRM" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: stages = [] } = useQuery({
    queryKey: ["pipeline-stages"],
    queryFn: async () => {
      const { data } = await supabase.from("pipeline_stages").select("*").order("display_order");
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader title="Settings" description="Configure CRM defaults and dictionaries." />
      <div className="p-6">
          <Tabs defaultValue="pipeline">
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline stages</TabsTrigger>
            <TabsTrigger value="categories">Client categories</TabsTrigger>
            <TabsTrigger value="meetings">Meeting types</TabsTrigger>
            <TabsTrigger value="followups">Follow-up priorities</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="outlook">Outlook</TabsTrigger>
            <TabsTrigger value="preferences">System</TabsTrigger>
          </TabsList>
          <TabsContent value="pipeline">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground mb-3">
                The stages used across the sales pipeline. Reordering and editing become writable
                for the MD &amp; CEO role.
              </div>
              <div className="divide-y divide-border">
                {stages.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground w-6">{s.display_order}</span>
                      <span className="text-sm font-medium">{s.name}</span>
                    </div>
                    {s.is_terminal && <Badge variant="outline">Terminal</Badge>}
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
          <TabsContent value="categories">
            <StaticList title="Client categories" values={["AIF","PMS","Mutual Fund","Trading Member","Corporate","Family Office"]} />
          </TabsContent>
          <TabsContent value="meetings">
            <StaticList title="Meeting types" values={["In-Person","Video Call","Phone Call"]} />
          </TabsContent>
          <TabsContent value="followups">
            <StaticList title="Follow-up priorities" values={["low","medium","high"]} />
          </TabsContent>
          <TabsContent value="notifications">
            <Card className="p-4 text-sm text-muted-foreground">
              In-app notifications only for MVP. Email &amp; WhatsApp delivery are planned for a future release.
            </Card>
          </TabsContent>
          <TabsContent value="outlook">
            <OutlookSettings />
          </TabsContent>
          <TabsContent value="preferences">
            <Card className="p-4 text-sm text-muted-foreground">
              System preferences will be added here as the platform grows.
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function OutlookSettings() {
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  const { data: status } = useQuery({
    queryKey: ["outlook-connection"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return { connected: false };
      const { data } = await supabase
        .from("app_user_connections")
        .select("created_at")
        .eq("user_id", user.user.id)
        .eq("connector_id", "microsoft_outlook")
        .maybeSingle();
      return { connected: !!data, createdAt: data?.created_at };
    },
  });

  const connect = useMutation({
    mutationFn: async () => {
      const { authorizationUrl } = await startOutlookConnect();
      return authorizationUrl;
    },
    onSuccess: (url) => {
      const popup = window.open("", "lovable-oauth", "width=600,height=720");
      if (!popup) {
        toast.error("Popup blocked. Allow popups and try again.");
        return;
      }
      const onMessage = (event: MessageEvent) => {
        if (
          event.origin !== window.location.origin ||
          event.source !== popup ||
          event.data?.connectorId !== "microsoft_outlook"
        ) return;
        window.removeEventListener("message", onMessage);
        popup.close();
        if (event.data?.type === "appUserConnectorOAuthComplete") {
          toast.success("Outlook connected");
          qc.invalidateQueries({ queryKey: ["outlook-connection"] });
        } else {
          toast.error("Outlook connection failed");
        }
      };
      window.addEventListener("message", onMessage);
      popup.location.href = url;
      setConnecting(true);
      const poll = window.setInterval(() => {
        if (!popup.closed) return;
        window.clearInterval(poll);
        window.removeEventListener("message", onMessage);
        setConnecting(false);
      }, 500);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnect = useMutation({
    mutationFn: disconnectOutlook,
    onSuccess: () => {
      toast.success("Outlook disconnected");
      qc.invalidateQueries({ queryKey: ["outlook-connection"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="w-4 h-4" /> Microsoft Outlook Calendar
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Connect your Outlook calendar to sync CRM meetings both ways.
          </div>
          {status?.connected && (
            <div className="text-xs text-muted-foreground mt-2">
              Connected since {status.createdAt ? new Date(status.createdAt).toLocaleDateString() : "—"}
            </div>
          )}
        </div>
        {status?.connected ? (
          <Button variant="outline" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
            Disconnect
          </Button>
        ) : (
          <Button size="sm" onClick={() => connect.mutate()} disabled={connect.isPending || connecting}>
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function StaticList({ title, values }: { title: string; values: string[] }) {
  return (
    <Card className="p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => <Badge key={v} variant="secondary">{v}</Badge>)}
      </div>
      <div className="text-xs text-muted-foreground mt-3">
        Editable dictionaries are on the roadmap; MVP ships with these defaults.
      </div>
    </Card>
  );
}
