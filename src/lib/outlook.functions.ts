import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  authorizeAppUserOAuth,
  exchangeAppUserOAuthCode,
  disconnectAppUser,
} from "@/integrations/lovable/appUserConnector";
import {
  saveConnectionKeyForUser,
  getConnectionKeyForUser,
  deleteConnectionKeyForUser,
} from "@/server/appUserConnections.server";
import {
  createOutlookEvent,
  updateOutlookEvent,
  deleteOutlookEvent,
  getOutlookEvent,
  OutlookEventPayload,
} from "@/server/outlookGraph.server";
import type { Database } from "@/integrations/supabase/types";

const CONNECTOR_ID = "microsoft_outlook";
const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const SCOPES = ["openid", "profile", "email", "offline_access", "Calendars.ReadWrite"];

type MeetingRow = Database["public"]["Tables"]["meetings"]["Row"];

function clientApiKey(): string {
  const key = process.env['MICROSOFT_OUTLOOK_APP_USER_CONNECTOR_CLIENT_API_KEY'];
  if (!key) throw new Error("Microsoft Outlook connector client is not configured.");
  return key;
}

function appOrigin(request: Request): string {
  const fromHeader = request.headers.get("origin") ?? undefined;
  if (fromHeader) return fromHeader;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      // fall through
    }
  }
  return "https://project--578df23e-8042-4ac1-8683-a82843cea2e9.lovable.app";
}

export const startOutlookConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const request = getRequest();
    if (!request) throw new Error("OAuth must start from an app request.");
    const returnUrl = `${appOrigin(request)}/oauth/microsoft_outlook/return`;
    const existingKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey: clientApiKey(),
      connectionAPIKey: existingKey ?? undefined,
      returnUrl,
      credentialsConfiguration: { scopes: SCOPES },
    });
    return { authorizationUrl };
  });

export const completeOutlookConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown): { code: string } => {
    const d = raw as Record<string, unknown>;
    if (!d.code || typeof d.code !== "string") throw new Error("code required");
    return { code: d.code };
  })
  .handler(async ({ data, context }) => {
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (connectorId !== CONNECTOR_ID) {
      throw new Error("OAuth completion returned the wrong connector");
    }
    await saveConnectionKeyForUser(context.userId, CONNECTOR_ID, connectionAPIKey);
    return { ok: true };
  });

export const getOutlookStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    return { connected: !!key };
  });

export const disconnectOutlook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (key) {
      await disconnectAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: CONNECTOR_ID,
      });
    }
    await deleteConnectionKeyForUser(context.userId, CONNECTOR_ID);
    return { ok: true };
  });

interface Attendee {
  email: string;
  name?: string;
}

function buildEventBody(meeting: MeetingRow): string {
  const parts: string[] = [];
  if (meeting.agenda) parts.push(`<b>Agenda:</b> ${meeting.agenda.replace(/\n/g, "<br/>")}`);
  if (meeting.discussion_summary) {
    parts.push(`<b>Notes:</b> ${meeting.discussion_summary.replace(/\n/g, "<br/>")}`);
  }
  if (meeting.action_items) {
    parts.push(`<b>Action items:</b> ${meeting.action_items.replace(/\n/g, "<br/>")}`);
  }
  return parts.join("<br/><br/>");
}

function buildEventPayload(meeting: MeetingRow, attendees: Attendee[]): OutlookEventPayload {
  const start = new Date(meeting.meeting_date);
  const end = new Date(start.getTime() + (meeting.duration_minutes ?? 30) * 60_000);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return {
    subject: meeting.agenda ?? "Orbis CRM meeting",
    body: { contentType: "HTML", content: buildEventBody(meeting) },
    start: { dateTime: start.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
    attendees: attendees.map((a) => ({
      emailAddress: { address: a.email, name: a.name ?? "" },
      type: "required" as const,
    })),
  };
}

export const pushMeetingToOutlook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown): { meetingId: string } => {
    const d = raw as Record<string, unknown>;
    if (!d.meetingId || typeof d.meetingId !== "string") throw new Error("meetingId required");
    return { meetingId: d.meetingId };
  })
  .handler(async ({ data, context }) => {
    const connectionAPIKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!connectionAPIKey) return { ok: false, error: "Outlook not connected" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: meeting, error: fetchErr } = await supabaseAdmin
      .from("meetings")
      .select("*")
      .eq("id", data.meetingId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!meeting) throw new Error("Meeting not found");

    const attendees: Attendee[] = ((meeting.attendees as Attendee[] | null) ?? []).filter(
      (a) => typeof a.email === "string" && a.email.includes("@"),
    );

    try {
      if (meeting.outlook_event_id) {
        const res = await updateOutlookEvent(
          connectionAPIKey,
          meeting.outlook_event_id,
          buildEventPayload(meeting, attendees),
        );
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Update failed (${res.status}): ${body}`);
        }
        const updated = await res.json() as { id: string; iCalUId?: string; changeKey?: string };
        await supabaseAdmin
          .from("meetings")
          .update({
            outlook_last_synced_at: new Date().toISOString(),
            outlook_sync_error: null,
            outlook_change_key: updated.changeKey ?? meeting.outlook_change_key,
            outlook_ical_uid: updated.iCalUId ?? meeting.outlook_ical_uid,
          })
          .eq("id", meeting.id);
      } else {
        const res = await createOutlookEvent(connectionAPIKey, buildEventPayload(meeting, attendees));
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Create failed (${res.status}): ${body}`);
        }
        const created = await res.json() as { id: string; iCalUId?: string; changeKey?: string };
        await supabaseAdmin
          .from("meetings")
          .update({
            outlook_event_id: created.id,
            outlook_ical_uid: created.iCalUId ?? null,
            outlook_change_key: created.changeKey ?? null,
            outlook_last_synced_at: new Date().toISOString(),
            outlook_sync_error: null,
          })
          .eq("id", meeting.id);
      }
      return { ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("meetings")
        .update({ outlook_sync_error: message, outlook_last_synced_at: new Date().toISOString() })
        .eq("id", meeting.id);
      return { ok: false, error: message };
    }
  });

export const deleteOutlookMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown): { meetingId: string } => {
    const d = raw as Record<string, unknown>;
    if (!d.meetingId || typeof d.meetingId !== "string") throw new Error("meetingId required");
    return { meetingId: d.meetingId };
  })
  .handler(async ({ data, context }) => {
    const connectionAPIKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!connectionAPIKey) return { ok: false, error: "Outlook not connected" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: meeting } = await supabaseAdmin
      .from("meetings")
      .select("outlook_event_id")
      .eq("id", data.meetingId)
      .maybeSingle();
    if (!meeting?.outlook_event_id) return { ok: true };

    const res = await deleteOutlookEvent(connectionAPIKey, meeting.outlook_event_id);
    if (!res.ok && res.status !== 404) {
      const body = await res.text();
      return { ok: false, error: `Delete failed (${res.status}): ${body}` };
    }
    await supabaseAdmin
      .from("meetings")
      .update({
        outlook_event_id: null,
        outlook_ical_uid: null,
        outlook_change_key: null,
        outlook_last_synced_at: new Date().toISOString(),
        outlook_sync_error: null,
      })
      .eq("id", data.meetingId);
    return { ok: true };
  });

export const syncMeetingFromOutlook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown): { meetingId: string } => {
    const d = raw as Record<string, unknown>;
    if (!d.meetingId || typeof d.meetingId !== "string") throw new Error("meetingId required");
    return { meetingId: d.meetingId };
  })
  .handler(async ({ data, context }) => {
    const connectionAPIKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!connectionAPIKey) return { ok: false, error: "Outlook not connected" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: meeting } = await supabaseAdmin
      .from("meetings")
      .select("*")
      .eq("id", data.meetingId)
      .maybeSingle();
    if (!meeting?.outlook_event_id) return { ok: false, error: "No Outlook event linked" };

    const res = await getOutlookEvent(connectionAPIKey, meeting.outlook_event_id);
    if (!res.ok) {
      const body = await res.text();
      await supabaseAdmin
        .from("meetings")
        .update({ outlook_sync_error: `Fetch failed (${res.status}): ${body}` })
        .eq("id", data.meetingId);
      return { ok: false, error: body };
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
    const crmModified = new Date(meeting.updated_at).getTime();

    // Only apply Outlook-side changes if Outlook was modified more recently than CRM.
    if (outlookModified > crmModified) {
      const start = event.start?.dateTime ? new Date(event.start.dateTime) : new Date(meeting.meeting_date);
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

      await supabaseAdmin
        .from("meetings")
        .update({
          meeting_date: start.toISOString(),
          duration_minutes: durationMinutes,
          agenda: event.subject ?? meeting.agenda,
          attendees: attendees as any,
          status: event.isCancelled ? ("cancelled" as never) : meeting.status,
          outlook_change_key: event.changeKey ?? meeting.outlook_change_key,
          outlook_ical_uid: event.iCalUId ?? meeting.outlook_ical_uid,
          outlook_last_synced_at: new Date().toISOString(),
          outlook_sync_error: null,
        })
        .eq("id", data.meetingId);
    } else {
      await supabaseAdmin
        .from("meetings")
        .update({ outlook_last_synced_at: new Date().toISOString(), outlook_sync_error: null })
        .eq("id", data.meetingId);
    }
    return { ok: true };
  });
