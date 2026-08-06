import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Cron endpoint (daily): emails any active portal user who has not signed in
 * for 7+ days, at most once per week per user.
 */
export const Route = createFileRoute("/api/public/hooks/inactivity-monitor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const supabaseAdmin = createClient<Database>(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const now = Date.now();
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data: users, error } = await supabaseAdmin
          .from("users")
          .select("id, full_name, email, last_login_at, inactivity_email_sent_at")
          .eq("status", "active")
          .not("auth_user_id", "is", null);

        if (error) {
          console.error("inactivity-monitor: failed to list users", error);
          return Response.json({ success: false, error: error.message }, { status: 500 });
        }

        const due = (users ?? []).filter((u) => {
          if (!u.email) return false;
          const last = (u as any).last_login_at as string | null;
          if (last && last > weekAgo) return false;
          const sent = (u as any).inactivity_email_sent_at as string | null;
          if (sent && sent > weekAgo) return false;
          return true;
        });

        const resendKey = process.env["RESEND_API_KEY"];
        const from = process.env["INACTIVITY_EMAIL_FROM"] ?? "Orbis CRM <onboarding@resend.dev>";
        const appUrl = process.env["APP_URL"] ?? "";

        if (!resendKey) {
          console.warn("inactivity-monitor: RESEND_API_KEY not configured — nothing sent");
          return Response.json({ success: true, candidates: due.length, sent: 0, emailConfigured: false });
        }

        let sent = 0;
        let failed = 0;

        for (const u of due) {
          const body = `<p>Hi ${u.full_name.split(" ")[0]},</p>
<p>We haven't seen you on Orbis CRM for over a week. Your leads, meetings and follow-ups are waiting.</p>
${appUrl ? `<p><a href="${appUrl}/dashboard">Open your dashboard</a></p>` : ""}
<p>— Orbis Automation</p>`;

          try {
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from,
                to: [u.email],
                subject: "It's been a week — your Orbis CRM pipeline needs you",
                html: body,
              }),
            });
            if (!res.ok) {
              failed++;
              console.error("inactivity-monitor: send failed", u.email, await res.text());
              continue;
            }
            await supabaseAdmin
              .from("users")
              .update({ inactivity_email_sent_at: new Date().toISOString() } as never)
              .eq("id", u.id);
            sent++;
          } catch (e) {
            failed++;
            console.error("inactivity-monitor: send error", u.email, e);
          }
        }

        return Response.json({ success: true, candidates: due.length, sent, failed, emailConfigured: true });
      },
    },
  },
});
