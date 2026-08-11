import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatCurrencyCr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Orbis CRM" }] }),
  component: ReportsPage,
});

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function ReportsPage() {
  return (
    <div>
      <PageHeader title="Reports" description="Analytical insights, computed live from your data." />
      <div className="p-6">
        <Tabs defaultValue="pipeline">
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="conversion">Conversion</TabsTrigger>
            <TabsTrigger value="team">Team performance</TabsTrigger>
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
            <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          </TabsList>
          <TabsContent value="pipeline"><PipelineReport /></TabsContent>
          <TabsContent value="revenue"><RevenueReport /></TabsContent>
          <TabsContent value="conversion"><ConversionReport /></TabsContent>
          <TabsContent value="team"><TeamReport /></TabsContent>
          <TabsContent value="meetings"><MeetingsReport /></TabsContent>
          <TabsContent value="followups"><FollowupsReport /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      <div className="h-72">{children}</div>
    </Card>
  );
}

function PipelineReport() {
  const { data = [] } = useQuery({
    queryKey: ["report", "pipeline"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("pipeline_stage, estimated_deal_value")
        .eq("status", "active");
      const map = new Map<string, { stage: string; count: number; value: number }>();
      data?.forEach((l) => {
        const s = l.pipeline_stage;
        const cur = map.get(s) ?? { stage: s, count: 0, value: 0 };
        cur.count += 1;
        cur.value += Number(l.estimated_deal_value ?? 0);
        map.set(s, cur);
      });
      return Array.from(map.values());
    },
  });

  const { data: sourceData = [] } = useQuery({
    queryKey: ["report", "client-sources"],
    queryFn: async () => {
      const [clients, leads] = await Promise.all([
        supabase.from("clients").select("id, originating_lead_id"),
        supabase.from("leads").select("id, lead_source"),
      ]);
      const leadMap = new Map(
        (leads.data ?? []).map((l) => [l.id, l.lead_source]),
      );
      const map = new Map<string, number>();
      (clients.data ?? []).forEach((c) => {
        const raw =
          c.originating_lead_id && leadMap.get(c.originating_lead_id);
        const source = raw && raw.trim() ? raw : "Direct";
        map.set(source, (map.get(source) ?? 0) + 1);
      });
      return Array.from(map.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Leads by pipeline stage">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
              <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Pipeline value by stage (₹ Cr)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
              <Bar dataKey="value" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <ChartCard title="Client sources">
        {sourceData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            No converted clients yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sourceData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={110}
                paddingAngle={2}
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
              >
                {sourceData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

function RevenueReport() {
  const { data: byService = [] } = useQuery({
    queryKey: ["report", "revenue-service"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("service_type, annual_revenue, auc").eq("status", "active");
      const map = new Map<string, { name: string; revenue: number; auc: number }>();
      data?.forEach((c) => {
        const s = c.service_type ?? "—";
        const cur = map.get(s) ?? { name: s, revenue: 0, auc: 0 };
        cur.revenue += Number(c.annual_revenue ?? 0);
        cur.auc += Number(c.auc ?? 0);
        map.set(s, cur);
      });
      return Array.from(map.values());
    },
  });

  const totalRevenue = byService.reduce((s, r) => s + r.revenue, 0);
  const totalAuc = byService.reduce((s, r) => s + r.auc, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Total revenue</div><div className="text-2xl font-semibold mt-1">{formatCurrencyCr(totalRevenue)}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Total AUC</div><div className="text-2xl font-semibold mt-1">{formatCurrencyCr(totalAuc)}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Active clients</div><div className="text-2xl font-semibold mt-1">{byService.reduce((s, r) => s + 1, 0)}</div></Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Revenue by service">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byService}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
              <Bar dataKey="revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="AUC distribution">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byService} dataKey="auc" nameKey="name" outerRadius={95} label={{ fontSize: 11 }}>
                {byService.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ConversionReport() {
  const { data } = useQuery({
    queryKey: ["report", "conversion"],
    queryFn: async () => {
      const { data: all } = await supabase.from("leads").select("status");
      const total = all?.length ?? 0;
      const won = all?.filter((l) => l.status === "won").length ?? 0;
      const lost = all?.filter((l) => l.status === "lost").length ?? 0;
      const active = all?.filter((l) => l.status === "active").length ?? 0;
      return { total, won, lost, active, winRate: total ? (won / (won + lost || 1)) * 100 : 0 };
    },
  });

  const pieData = [
    { name: "Won", value: data?.won ?? 0 },
    { name: "Lost", value: data?.lost ?? 0 },
    { name: "Active", value: data?.active ?? 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Total leads</div><div className="text-2xl font-semibold mt-1">{data?.total ?? 0}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Won</div><div className="text-2xl font-semibold mt-1 text-success">{data?.won ?? 0}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Lost</div><div className="text-2xl font-semibold mt-1 text-destructive">{data?.lost ?? 0}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Win rate</div><div className="text-2xl font-semibold mt-1">{data?.winRate.toFixed(1) ?? 0}%</div></Card>
      </div>
      <ChartCard title="Lead outcome distribution">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={110} label={{ fontSize: 11 }}>
              {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function TeamReport() {
  const { data = [] } = useQuery({
    queryKey: ["report", "team"],
    queryFn: async () => {
      const [users, leads, clients] = await Promise.all([
        supabase.from("users").select("id, full_name, designation"),
        supabase.from("leads").select("owner_id, co_owner_id, estimated_deal_value, status"),
        supabase.from("clients").select("owner_id, annual_revenue").eq("status", "active"),
      ]);
      const rows = (users.data ?? []).map((u) => {
        const asOwner = leads.data?.filter((l) => l.owner_id === u.id) ?? [];
        const asCo = leads.data?.filter((l) => (l as { co_owner_id?: string | null }).co_owner_id === u.id) ?? [];
        const myLeads = [...asOwner, ...asCo];
        const myClients = clients.data?.filter((c) => c.owner_id === u.id) ?? [];
        const share = (l: { co_owner_id?: string | null }) => (l.co_owner_id ? 0.5 : 1);
        const pipeline = myLeads
          .filter((l) => l.status === "active")
          .reduce((s, l) => s + Number(l.estimated_deal_value ?? 0) * share(l as { co_owner_id?: string | null }), 0);
        const won = myLeads.filter((l) => l.status === "won").length;
        const rev = myClients.reduce((s, c) => s + Number(c.annual_revenue ?? 0), 0);
        return {
          name: u.full_name.split(" ")[0],
          fullName: u.full_name,
          leads: myLeads.length,
          pipeline,
          won,
          revenue: rev,
          clients: myClients.length,
        };
      }).filter((r) => r.leads > 0 || r.clients > 0)
        .sort((a, b) => b.pipeline - a.pipeline);
      return rows;
    },
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ChartCard title="Pipeline value by user (₹ Cr)">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
            <Bar dataKey="pipeline" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Active client revenue by user (₹ Cr)">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
            <Bar dataKey="revenue" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function MeetingsReport() {
  const { data = [] } = useQuery({
    queryKey: ["report", "meetings"],
    queryFn: async () => {
      const { data } = await supabase.from("meetings").select("meeting_date, status");
      const byWeek = new Map<string, { week: string; count: number }>();
      data?.forEach((m) => {
        const d = new Date(m.meeting_date);
        const week = `${d.getFullYear()}-W${Math.ceil((((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000) + new Date(d.getFullYear(), 0, 1).getDay() + 1) / 7)}`;
        const cur = byWeek.get(week) ?? { week, count: 0 };
        cur.count += 1;
        byWeek.set(week, cur);
      });
      return Array.from(byWeek.values()).sort((a, b) => a.week.localeCompare(b.week));
    },
  });

  return (
    <ChartCard title="Meetings by week">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
          <Line type="monotone" dataKey="count" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function FollowupsReport() {
  const { data } = useQuery({
    queryKey: ["report", "followups"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase.from("followups").select("status, due_date");
      const pending = data?.filter((f) => f.status === "pending").length ?? 0;
      const overdue = data?.filter((f) => f.status === "pending" && f.due_date < today).length ?? 0;
      const completed = data?.filter((f) => f.status === "completed").length ?? 0;
      return { pending, overdue, completed, total: data?.length ?? 0 };
    },
  });

  const pieData = [
    { name: "Pending", value: (data?.pending ?? 0) - (data?.overdue ?? 0) },
    { name: "Overdue", value: data?.overdue ?? 0 },
    { name: "Completed", value: data?.completed ?? 0 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Total</div><div className="text-2xl font-semibold mt-1">{data?.total ?? 0}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Pending</div><div className="text-2xl font-semibold mt-1">{data?.pending ?? 0}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Overdue</div><div className="text-2xl font-semibold mt-1 text-destructive">{data?.overdue ?? 0}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Completed</div><div className="text-2xl font-semibold mt-1 text-success">{data?.completed ?? 0}</div></Card>
      </div>
      <ChartCard title="Follow-up status">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={95} label={{ fontSize: 11 }}>
              {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
