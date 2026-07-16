import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users — Orbis CRM" }] }),
  component: UsersPage,
});

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  designation: string;
  department: string;
  reports_to_user_id: string | null;
  status: string;
}

function UsersPage() {
  const { data: users = [] } = useQuery({
    queryKey: ["users-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("users").select("*").order("full_name");
      if (error) throw error;
      return (data ?? []) as UserRow[];
    },
  });

  const byId = new Map(users.map((u) => [u.id, u]));

  return (
    <div>
      <PageHeader title="Users" description="Employee directory and reporting hierarchy." />
      <div className="p-6">
        <Tabs defaultValue="directory">
          <TabsList>
            <TabsTrigger value="directory">Directory</TabsTrigger>
            <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
          </TabsList>

          <TabsContent value="directory">
            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Reports to</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                          {initials(u.full_name)}
                        </div>
                        {u.full_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.designation}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.reports_to_user_id ? byId.get(u.reports_to_user_id)?.full_name ?? "—" : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell className="text-muted-foreground">{u.phone}</TableCell>
                      <TableCell>
                        <Badge variant={u.status === "active" ? "secondary" : "outline"}>{u.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="hierarchy">
            <Card className="p-4">
              <HierarchyTree users={users} />
            </Card>
          </TabsContent>

          <TabsContent value="permissions">
            <Card className="p-4 text-sm">
              <h3 className="font-semibold mb-2">Access model</h3>
              <p className="text-muted-foreground">
                Permissions in this CRM are <span className="font-medium text-foreground">hierarchy-driven</span>,
                not role-driven. Every user can view and manage records they own, plus everything owned by users
                who report to them (directly or indirectly). The MD &amp; CEO sits at the top of the reporting
                tree and therefore sees the entire organization.
              </p>
              <ul className="mt-3 space-y-1.5 text-muted-foreground list-disc pl-5">
                <li>Own records: full read, create, edit access.</li>
                <li>Team records: managers inherit read + edit access for every descendant in their tree.</li>
                <li>Cross-hierarchy: two Presidents cannot see each other's business.</li>
                <li>Deletion: restricted to the MD &amp; CEO.</li>
                <li>Reassignment: managers can transfer records within their sub-tree.</li>
                <li>Notes and activity log are append-only for everyone.</li>
              </ul>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function HierarchyTree({ users }: { users: UserRow[] }) {
  const children = new Map<string | null, UserRow[]>();
  users.forEach((u) => {
    const key = u.reports_to_user_id;
    if (!children.has(key)) children.set(key, []);
    children.get(key)!.push(u);
  });
  const roots = children.get(null) ?? [];

  function renderNode(u: UserRow, depth: number): React.ReactNode {
    const kids = children.get(u.id) ?? [];
    return (
      <li key={u.id} className="mt-1.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold">
            {initials(u.full_name)}
          </div>
          <div>
            <div className="text-sm font-medium">{u.full_name}</div>
            <div className="text-xs text-muted-foreground">{u.designation}</div>
          </div>
        </div>
        {kids.length > 0 && (
          <ul className="ml-4 mt-1 border-l border-border pl-4">
            {kids.map((k) => renderNode(k, depth + 1))}
          </ul>
        )}
      </li>
    );
  }

  return <ul>{roots.map((r) => renderNode(r, 0))}</ul>;
}
