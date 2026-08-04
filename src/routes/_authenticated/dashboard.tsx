import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StageBadge } from "@/components/stage-badge";
import {
  Target,
  Building2,
  CalendarClock,
  ClipboardList,
  BellRing,
  Wallet,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { formatCurrencyCr, formatDate, relativeDay } from "@/lib/format";
import type { LucideIcon } from "lucide-react";
import { MarketTicker } from "@/components/layout/market-ticker";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Orbis CRM" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["dashboard", "metrics"],
    queryFn: async () => {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
      const todayStr = new Date().toISOString().split("T")[0];

      const [leadsA, clientsA, pipelineA, meetingsA, followupsA, tasksA] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("leads").select("estimated_deal_value").eq("status", "active"),
        supabase
          .from("meetings")
          .select("id", { count: "exact", head: true })
          .gte("meeting_date", startOfDay)
          .lt("meeting_date", endOfDay),
        supabase.from("followups").select("id, due_date", { count: "exact" }).eq("status", "pending"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
      ]);

      const pipelineValue =
        pipelineA.data?.reduce((s, r) => s + Number(r.estimated_deal_value ?? 0), 0) ?? 0;
      const overdue = followupsA.data?.filter((f) => f.due_date < todayStr).length ?? 0;

      return {
        activeLeads: leadsA.count ?? 0,
        activeClients: clientsA.count ?? 0,
        todaysMeetings: meetingsA.count ?? 0,
        pendingFollowups: followupsA.count ?? 0,
        overdue,
        openTasks: tasksA.count ?? 0,
        pipelineValue,
      };
    },
  });

  const { data: todaysMeetings } = useQuery({
    queryKey: ["dashboard", "todays-meetings"],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const { data } = await supabase
        .from("meetings")
        .select("id, parent_type, parent_id, meeting_date, meeting_type, agenda, status")
        .gte("meeting_date", startOfDay.toISOString())
        .lte("meeting_date", endOfDay.toISOString())
        .order("meeting_date", { ascending: true })
        .limit(6);
      return data ?? [];
    },
  });

  const { data: todaysFollowups } = useQuery({
    queryKey: ["dashboard", "todays-followups"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("followups")
        .select("id, parent_type, parent_id, due_date, description, priority")
        .eq("status", "pending")
        .lte("due_date", today)
        .order("due_date", { ascending: true })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: recentActivity } = useQuery({
    queryKey: ["dashboard", "activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("id, action, metadata, created_at, parent_type, parent_id")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const { data: recentLeads } = useQuery({
    queryKey: ["dashboard", "recent-leads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, company_name, pipeline_stage, estimated_deal_value, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: recentClients } = useQuery({
    queryKey: ["dashboard", "recent-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, company_name, service_type, annual_revenue, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Live view of your work and pipeline."
        actions={
          <Button asChild size="sm">
            <Link to="/leads">
              Open pipeline <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        <Card className="p-3">
          <MarketTicker />
        </Card>
        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Active Leads" value={metrics?.activeLeads} icon={Target} loading={isLoading} />
          <KpiCard label="Active Clients" value={metrics?.activeClients} icon={Building2} loading={isLoading} />
          <KpiCard label="Today's Meetings" value={metrics?.todaysMeetings} icon={CalendarClock} loading={isLoading} />
          <KpiCard
            label="Pending Follow-ups"
            value={metrics?.pendingFollowups}
            sub={metrics?.overdue ? `${metrics.overdue} overdue` : undefined}
            subTone={metrics?.overdue ? "warn" : undefined}
            icon={BellRing}
            loading={isLoading}
          />
          <KpiCard label="Open Tasks" value={metrics?.openTasks} icon={ClipboardList} loading={isLoading} />
          <KpiCard
            label="Pipeline Value"
            value={metrics ? formatCurrencyCr(metrics.pipelineValue) : undefined}
            icon={Wallet}
            loading={isLoading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Today's meetings */}
          <Card className="p-4 lg:col-span-2">
            <SectionTitle title="Today's meetings" count={todaysMeetings?.length} icon={CalendarClock} />
            <div className="mt-3 divide-y divide-border">
              {todaysMeetings?.length === 0 && <EmptyRow>You have been sitting on your desk for long enough, Hustle up soldier :)</EmptyRow>}
              {todaysMeetings?.map((m) => (
                <Link
                  key={m.id}
                  to={m.parent_type === "lead" ? "/leads/$id" : "/clients/$id"}
                  params={{ id: m.parent_id }}
                  className="flex items-center gap-3 py-2.5 hover:bg-accent rounded px-2 -mx-2"
                >
                  <div className="text-sm font-mono text-muted-foreground w-14 shrink-0">
                    {new Date(m.meeting_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{m.agenda ?? "Meeting"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {m.meeting_type} · {m.parent_type}
                    </div>
                  </div>
                  <StageBadge stage={m.status === "completed" ? "Won" : "Meeting Scheduled"} />
                </Link>
              ))}
            </div>
          </Card>

          {/* Follow-ups */}
          <Card className="p-4">
            <SectionTitle title="Follow-ups due" count={todaysFollowups?.length} icon={BellRing} />
            <div className="mt-3 divide-y divide-border">
              {todaysFollowups?.length === 0 && <EmptyRow>No follow-ups due.</EmptyRow>}
              {todaysFollowups?.map((f) => {
                const overdue = f.due_date < new Date().toISOString().split("T")[0];
                return (
                  <Link
                    key={f.id}
                    to={f.parent_type === "lead" ? "/leads/$id" : "/clients/$id"}
                    params={{ id: f.parent_id }}
                    className="flex items-start gap-2 py-2.5 hover:bg-accent rounded px-2 -mx-2"
                  >
                    {overdue && <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{f.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {relativeDay(f.due_date)} · {f.priority}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>

          {/* Recent activity */}
          <Card className="p-4 lg:col-span-2">
            <SectionTitle title="Recent activity" icon={ClipboardList} />
            <div className="mt-3 space-y-2">
              {recentActivity?.map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">
                      <span className="font-medium">{a.action}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              {recentActivity?.length === 0 && <EmptyRow>No activity yet.</EmptyRow>}
            </div>
          </Card>

          {/* Recent leads + clients */}
          <Card className="p-4">
            <SectionTitle title="Recently added" icon={Target} />
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Leads</div>
                {recentLeads?.map((l) => (
                  <Link
                    key={l.id}
                    to="/leads/$id"
                    params={{ id: l.id }}
                    className="flex items-center justify-between text-sm py-1.5 hover:bg-accent rounded px-1.5 -mx-1.5"
                  >
                    <span className="truncate">{l.company_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatCurrencyCr(l.estimated_deal_value)}
                    </span>
                  </Link>
                ))}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Clients</div>
                {recentClients?.map((c) => (
                  <Link
                    key={c.id}
                    to="/clients/$id"
                    params={{ id: c.id }}
                    className="flex items-center justify-between text-sm py-1.5 hover:bg-accent rounded px-1.5 -mx-1.5"
                  >
                    <span className="truncate">{c.company_name}</span>
                    <span className="text-xs text-muted-foreground">{c.service_type}</span>
                  </Link>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  subTone,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number | string | undefined;
  sub?: string;
  subTone?: "warn";
  icon: LucideIcon;
  loading?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">
        {loading ? <Skeleton className="h-8 w-16" /> : value ?? "—"}
      </div>
      {sub && (
        <div className={`text-xs mt-1 ${subTone === "warn" ? "text-destructive" : "text-muted-foreground"}`}>
          {sub}
        </div>
      )}
    </Card>
  );
}

function SectionTitle({
  title,
  count,
  icon: Icon,
}: {
  title: string;
  count?: number;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <div className="text-sm font-semibold">{title}</div>
      </div>
      {typeof count === "number" && (
        <div className="text-xs text-muted-foreground">{count}</div>
      )}
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground py-4 text-center">{children}</div>;
}

// keep formatDate imported for future use
void formatDate;
