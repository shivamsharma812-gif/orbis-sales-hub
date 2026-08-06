import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getOutlookEvent } from "@/server/outlookGraph.server";
import { getConnectionKeyForUser } from "@/server/appUserConnections.server";

const CONNECTOR_ID = "microsoft_outlook";

type Attendee = { email: string; name?: string };

export const Route = createFileRoute("/api/public/hooks/outlook-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env['SUPABASE_PUBLISHABLE_KEY'];
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const supabaseAdmin = createClient<Database>(
          process.env['SUPABASE_URL']!,
          process.env['SUPABASE_SERVICE_ROLE_KEY']!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const { data: meetings, error } = await supabaseAdmin
          .from("meetings")
          .select("*, owner:users!meetings_owner_id_fkey(auth_user_id)")
          .not("outlook_event_id", "is", null)
          .neq("status", "cancelled");

        if (error) {
          console.error("outlook-sync: failed to list meetings", error);
          return Response.json({ success: false, error: error.message }, { status: 500 });
        }

        let processed = 0;
        let failed = 0;

        for (const m of meetings ?? []) {
          const owner = m.owner as { auth_user_id: string | null } | null;
          const authUserId = owner?.auth_user_id;
          if (!authUserId) {
            console.warn("outlook-sync: skipping meeting", m.id, "— owner has no auth_user_id");
            continue;
          }

          const connectionAPIKey = await getConnectionKeyForUser(authUserId, CONNECTOR_ID);
          if (!connectionAPIKey) {
            // Owner not connected; not an error, just skip.
            continue;
          }

          try {
            const res = await getOutlookEvent(connectionAPIKey, m.outlook_event_id!);
            if (!res.ok) {
              const body = await res.text();
              if (res.status === 404) {
                // Event deleted in Outlook; clear the link.
                await supabaseAdmin
                  .from("meetings")
                  .update({
                    outlook_event_id: null,
                    outlook_ical_uid: null,
                    outlook_change_key: null,
                    outlook_sync_error: "Event deleted in Outlook",
                    outlook_last_synced_at: new Date().toISOString(),
                  })
                  .eq("id", m.id);
              } else {
                await supabaseAdmin
                  .from("meetings")
                  .update({
                    outlook_sync_error: `Fetch failed (${res.status}): ${body}`,
                    outlook_last_synced_at: new Date().toISOString(),
                  })
                  .eq("id", m.id);
                failed++;
              }
              continue;
            }

            const event = (await res.json()) as {
              id: string;
              subject?: string;
              body?: { content?: string };
              start?: { dateTime?: string };
              end?: { dateTime?: string };
              attendees?: { emailAddress?: { address?: string; name?: string } }[];
              isCancelled?: boolean;
              lastModifiedDateTime?: string;
              changeKey?: string;
              iCalUId?: string;
            };

            const outlookModified = event.lastModifiedDateTime
              ? new Date(event.lastModifiedDateTime).getTime()
              : 0;
            const crmModified = new Date(m.updated_at).getTime();

            if (outlookModified > crmModified) {
              const start = event.start?.dateTime
                ? new Date(event.start.dateTime)
                : new Date(m.meeting_date);
              const end = event.end?.dateTime ? new Date(event.end.dateTime) : start;
              const durationMinutes = Math.max(
                1,
                Math.round((end.getTime() - start.getTime()) / 60_000),
              );
              const attendees: Attendee[] =
                event.attendees
                  ?.map((a) => ({
                    email: a.emailAddress?.address ?? "",
                    name: a.emailAddress?.name,
                  }))
                  .filter((a) => a.email.includes("@")) ?? [];

              const { error: updErr } = await supabaseAdmin
                .from("meetings")
                .update({
                  meeting_date: start.toISOString(),
                  duration_minutes: durationMinutes,
                  agenda: event.subject ?? m.agenda,
                  attendees: attendees as any,
                  status: event.isCancelled ? ("cancelled" as never) : m.status,
                  outlook_change_key: event.changeKey ?? m.outlook_change_key,
                  outlook_ical_uid: event.iCalUId ?? m.outlook_ical_uid,
                  outlook_last_synced_at: new Date().toISOString(),
                  outlook_sync_error: null,
                })
                .eq("id", m.id);
              if (updErr) throw updErr;
            } else {
              await supabaseAdmin
                .from("meetings")
                .update({
                  outlook_last_synced_at: new Date().toISOString(),
                  outlook_sync_error: null,
                })
                .eq("id", m.id);
            }
            processed++;
          } catch (e) {
            console.error("outlook-sync: error processing meeting", m.id, e);
            const message = e instanceof Error ? e.message : String(e);
            await supabaseAdmin
              .from("meetings")
              .update({ outlook_sync_error: message, outlook_last_synced_at: new Date().toISOString() })
              .eq("id", m.id);
            failed++;
          }
        }

        return Response.json({ success: true, processed, failed });
      },
    },
  },
});
