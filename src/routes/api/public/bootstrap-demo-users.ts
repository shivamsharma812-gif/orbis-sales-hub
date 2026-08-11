import { createFileRoute } from "@tanstack/react-router";

/**
 * One-shot demo bootstrapper. Idempotent — safe to call every sign-in attempt.
 * Creates the four demo auth users, links them to their public.users rows,
 * and sets a shared demo password. Uses supabaseAdmin loaded inside the handler.
 */
const DEMO = [
  { email: "ceo@orbis.demo",       app_user_id: "11111111-1111-1111-1111-000000000001" },
  { email: "president@orbis.demo", app_user_id: "11111111-1111-1111-1111-000000000002" },
  { email: "svp@orbis.demo",       app_user_id: "11111111-1111-1111-1111-000000000007" },
  { email: "rm@orbis.demo",        app_user_id: "11111111-1111-1111-1111-000000000009" },
  { email: "upendra.tripathi@orbis.demo", app_user_id: "11111111-1111-1111-1111-000000000003" },
  { email: "chirag.sharma@orbis.demo",    app_user_id: "11111111-1111-1111-1111-000000000019" },
];
const PASSWORD = "Orbis@2026";

export const Route = createFileRoute("/api/public/bootstrap-demo-users")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const results: Array<{ email: string; ok: boolean; note: string }> = [];

        for (const d of DEMO) {
          // Check if this app user is already linked
          const { data: appUser } = await supabaseAdmin
            .from("users")
            .select("id, auth_user_id, full_name, email")
            .eq("id", d.app_user_id)
            .maybeSingle();

          if (!appUser) {
            results.push({ email: d.email, ok: false, note: "app user row missing" });
            continue;
          }

          let authId = appUser.auth_user_id;

          if (!authId) {
            // Try to create the auth user
            const created = await supabaseAdmin.auth.admin.createUser({
              email: d.email,
              password: PASSWORD,
              email_confirm: true,
              user_metadata: { full_name: appUser.full_name },
            });
            if (created.error) {
              // Might already exist — look it up.
              const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
              const existing = list.data?.users.find((u) => u.email === d.email);
              if (!existing) {
                results.push({ email: d.email, ok: false, note: created.error.message });
                continue;
              }
              authId = existing.id;
              // reset password so demo works
              await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: PASSWORD });
            } else {
              authId = created.data.user!.id;
            }
            await supabaseAdmin.from("users").update({ auth_user_id: authId }).eq("id", d.app_user_id);
            results.push({ email: d.email, ok: true, note: "created" });
          } else {
            // Ensure password is the shared demo password
            await supabaseAdmin.auth.admin.updateUserById(authId, { password: PASSWORD });
            results.push({ email: d.email, ok: true, note: "refreshed" });
          }
        }

        return Response.json({ ok: true, results });
      },
    },
  },
});
