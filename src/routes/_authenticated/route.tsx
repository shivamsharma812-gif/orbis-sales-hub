import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/app-shell";

/**
 * Auth gate for the entire app subtree.
 * ssr:false because the Supabase session lives in localStorage — the server
 * cannot see it. Client-only redirect avoids the double-redirect trap.
 *
 * Uses getSession() (not getUser()): it reads the persisted session and lets
 * supabase-js transparently refresh an expired access token. getUser() makes a
 * network call that fails on a flaky connection and would bounce a still-valid
 * session out to /auth.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },

  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
