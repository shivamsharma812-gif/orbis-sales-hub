import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./use-current-user";

export interface AssignableUser {
  id: string;
  full_name: string;
  designation: string | null;
  reports_to_user_id: string | null;
}

/**
 * Users the current signed-in user is allowed to assign records to:
 * themselves + every descendant in the reporting tree.
 * Mirrors the RLS visibility rule so the UI can't offer out-of-team owners.
 */
export function useAssignableUsers() {
  const { data: me } = useCurrentUser();
  return useQuery({
    queryKey: ["assignable-users", me?.id],
    enabled: !!me?.id,
    staleTime: 300_000,
    queryFn: async (): Promise<AssignableUser[]> => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, designation, reports_to_user_id")
        .eq("status", "active");
      if (error) throw error;
      const all = (data ?? []) as AssignableUser[];
      const childrenOf = new Map<string, AssignableUser[]>();
      for (const u of all) {
        const p = u.reports_to_user_id ?? "";
        if (!childrenOf.has(p)) childrenOf.set(p, []);
        childrenOf.get(p)!.push(u);
      }
      const meId = me!.id;
      const meRow = all.find((u) => u.id === meId);
      const result: AssignableUser[] = meRow ? [meRow] : [];
      const stack = [meId];
      while (stack.length) {
        const cur = stack.pop()!;
        for (const child of childrenOf.get(cur) ?? []) {
          result.push(child);
          stack.push(child.id);
        }
      }
      return result.sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
  });
}
