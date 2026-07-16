import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") {
      // SSR: send everyone to the sign-in surface; the client-side gate on
      // /_authenticated redirects authenticated visitors back into the app.
      throw redirect({ to: "/auth" });
    }
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
    throw redirect({ to: "/auth" });
  },
});
