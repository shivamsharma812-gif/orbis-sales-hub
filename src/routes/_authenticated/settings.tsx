import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

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
            <StaticList title="Client categories" values={["AIF","PMS","Mutual Fund","REIT","InvIT","Corporate","Family Office"]} />
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
