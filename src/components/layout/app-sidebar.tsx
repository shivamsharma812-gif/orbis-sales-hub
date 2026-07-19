import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Target,
  Building2,
  BarChart3,
  Users,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { initials } from "@/lib/format";

const NAV = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Pipeline", url: "/leads", icon: Target },
  { title: "Clients", url: "/clients", icon: Building2 },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Users", url: "/users", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { data: me } = useCurrentUser();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="w-7 h-7 shrink-0 rounded bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary font-semibold text-xs">
            O
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold text-sidebar-foreground truncate">
                Orbis Automation
              </div>
              <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
                Sales CRM
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active =
                  pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {me && (
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-8 h-8 shrink-0 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold">
              {initials(me.full_name)}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-medium text-sidebar-foreground truncate">
                  {me.full_name}
                </div>
                <div className="text-[11px] text-sidebar-foreground/60 truncate">
                  {me.designation}
                </div>
              </div>
            )}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
