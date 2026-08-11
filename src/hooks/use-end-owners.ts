import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DirectoryUser {
  id: string;
  full_name: string;
  designation: string | null;
  reports_to_user_id: string | null;
}

/**
 * End ownership = the vertical head (President) that a record's owner ultimately
 * reports to. It can be overridden per-record via `end_owner_id` when a lead or
 * client is transferred/shared between Presidents.
 *
 * Mirrors public.hierarchy_end_owner() in the database.
 */
export function useEndOwners() {
  const query = useQuery({
    queryKey: ["directory-users-for-end-owner"],
    staleTime: 300_000,
    queryFn: async (): Promise<DirectoryUser[]> => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, designation, reports_to_user_id");
      if (error) throw error;
      return (data ?? []) as DirectoryUser[];
    },
  });

  const byId = new Map((query.data ?? []).map((u) => [u.id, u]));

  /** Walk up the reporting tree to the top-most manager below the CEO. */
  function hierarchyEndOwnerId(ownerId: string | null | undefined): string | null {
    if (!ownerId) return null;
    let cur: DirectoryUser | undefined = byId.get(ownerId);
    if (!cur) return null;
    let guard = 0;
    while (guard++ < 20) {
      const node: DirectoryUser = cur;
      if (!node.reports_to_user_id) return node.id; // top of tree (CEO)
      const mgr: DirectoryUser | undefined = byId.get(node.reports_to_user_id);
      if (!mgr) return node.id; // manager not visible to us — stop here
      if (!mgr.reports_to_user_id) return node.id; // manager is the CEO → node is the President
      cur = mgr;
    }
    return cur.id;
  }

  /** Explicit end owner wins; otherwise derive it from the hierarchy. */
  function endOwnerOf(record: {
    owner_id?: string | null;
    end_owner_id?: string | null;
  }): DirectoryUser | null {
    const id = record.end_owner_id ?? hierarchyEndOwnerId(record.owner_id);
    return id ? byId.get(id) ?? null : null;
  }

  function endOwnerName(record: { owner_id?: string | null; end_owner_id?: string | null }) {
    return endOwnerOf(record)?.full_name ?? "—";
  }

  function userName(id: string | null | undefined) {
    return id ? byId.get(id)?.full_name ?? null : null;
  }

  return { ...query, byId, hierarchyEndOwnerId, endOwnerOf, endOwnerName, userName };
}
