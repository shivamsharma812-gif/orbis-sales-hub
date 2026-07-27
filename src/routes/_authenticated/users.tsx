import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { InviteUserDialog } from "@/components/invite-user-dialog";
import { InviteDirectoryUserDialog } from "@/components/invite-directory-user-dialog";
import { resendInvite, setUserStatus, setAdminRole } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Mail, Shield, ShieldOff, UserCheck, UserX } from "lucide-react";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users — Orbis CRM" }] }),
  component: UsersPage,
});

interface UserRow {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  designation: string;
  department: string;
  reports_to_user_id: string | null;
  status: string;
}

function UsersPage() {
  const qc = useQueryClient();
  const { data: isAdmin = false } = useIsAdmin();

  const { data: users = [] } = useQuery({
    queryKey: ["users-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("users").select("*").order("full_name");
      if (error) throw error;
      return (data ?? []) as UserRow[];
    },
  });

  const { data: adminIds = new Set<string>() } = useQuery({
    queryKey: ["admin-user-ids"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "system_admin");
      return new Set((data ?? []).map((r) => r.user_id as string));
    },
  });

  const resend = useServerFn(resendInvite);
  const status = useServerFn(setUserStatus);
  const role = useServerFn(setAdminRole);

  const resendMut = useMutation({
    mutationFn: (email: string) => resend({ data: { email } }),
    onSuccess: (r) =>
      r.ok ? toast.success("Invite re-sent") : toast.error(r.error ?? "Failed"),
  });
  const statusMut = useMutation({
    mutationFn: (v: { user_id: string; status: "active" | "inactive" }) =>
      status({ data: v }),
    onSuccess: () => {
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["users-all"] });
    },
  });
  const roleMut = useMutation({
    mutationFn: (v: { user_id: string; grant: boolean }) => role({ data: v }),
    onSuccess: (r) => {
      if (!r.ok) return toast.error(r.error ?? "Failed");
      toast.success("Admin role updated");
      qc.invalidateQueries({ queryKey: ["admin-user-ids"] });
    },
  });

  const byId = new Map(users.map((u) => [u.id, u]));

  return (
    <div>
      <PageHeader
        title="Users"
        description="Employee directory and reporting hierarchy."
        actions={isAdmin ? <InviteUserDialog /> : undefined}
      />
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
                    <TableHead>Login</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead className="text-right">Admin actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const isSysAdmin = u.auth_user_id ? adminIds.has(u.auth_user_id) : false;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                            {initials(u.full_name)}
                          </div>
                          {u.full_name}
                          {isSysAdmin && (
                            <Badge variant="secondary" className="ml-1">
                              Admin
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.designation}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.reports_to_user_id ? byId.get(u.reports_to_user_id)?.full_name ?? "—" : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell className="text-muted-foreground">{u.phone}</TableCell>
                        <TableCell>
                          {u.auth_user_id ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline">Not invited</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.status === "active" ? "secondary" : "outline"}>
                            {u.status}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {!u.auth_user_id && (
                                <InviteDirectoryUserDialog
                                  user={{
                                    id: u.id,
                                    full_name: u.full_name,
                                    email: u.email,
                                    phone: u.phone,
                                  }}
                                />
                              )}
                              {u.auth_user_id && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="Re-send invite / reset link"
                                  onClick={() => resendMut.mutate(u.email)}
                                >
                                  <Mail className="h-4 w-4" />
                                </Button>
                              )}
                              {u.auth_user_id && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title={isSysAdmin ? "Revoke admin" : "Grant admin"}
                                  onClick={() =>
                                    roleMut.mutate({ user_id: u.id, grant: !isSysAdmin })
                                  }
                                >
                                  {isSysAdmin ? (
                                    <ShieldOff className="h-4 w-4" />
                                  ) : (
                                    <Shield className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                title={u.status === "active" ? "Deactivate" : "Reactivate"}
                                onClick={() =>
                                  statusMut.mutate({
                                    user_id: u.id,
                                    status: u.status === "active" ? "inactive" : "active",
                                  })
                                }
                              >
                                {u.status === "active" ? (
                                  <UserX className="h-4 w-4" />
                                ) : (
                                  <UserCheck className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
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
                <li>Deletion: available to owners and any manager above them.</li>
                <li>Reassignment: managers can transfer records within their sub-tree.</li>
                <li>Notes and activity log are append-only for everyone.</li>
              </ul>
              <h3 className="font-semibold mt-6 mb-2">System administrators</h3>
              <p className="text-muted-foreground">
                System administrators can invite new users, re-send invites, deactivate accounts, and grant the
                admin role to others. Being an admin does not change what business data they can see — the
                hierarchy rules above still apply.
              </p>
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
