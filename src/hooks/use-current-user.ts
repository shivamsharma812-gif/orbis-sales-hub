import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AppUser {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  designation: string;
  department: string;
  reports_to_user_id: string | null;
  status: "active" | "inactive";
}

/**
 * Loads the app-user row for the signed-in Supabase user.
 * Called from the app shell after the auth gate has already ensured a session.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-app-user"],
    queryFn: async (): Promise<AppUser | null> => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) return null;
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("auth_user_id", auth.session.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as AppUser | null;
    },
    staleTime: 60_000,
  });
}
