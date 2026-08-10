import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { LogOut, ChevronDown } from "lucide-react";
import { initials } from "@/lib/format";
import { GlobalSearch } from "./global-search";
import { QuickActionsMenu } from "@/components/quick-actions/quick-actions-menu";

import { useQueryClient } from "@tanstack/react-query";

export function TopBar() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex-1 flex items-center gap-3">
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-2">
        <QuickActionsMenu />

        {me && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 gap-2 px-2"
                aria-label="Account menu"
              >
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                  {initials(me.full_name)}
                </div>
                <div className="hidden md:block text-left leading-tight">
                  <div className="text-sm font-medium">{me.full_name}</div>
                  <div className="text-[10px] text-muted-foreground">{me.designation}</div>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-sm">{me.full_name}</div>
                <div className="text-xs text-muted-foreground font-normal">{me.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
