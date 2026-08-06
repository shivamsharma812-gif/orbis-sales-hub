import { callAsAppUser } from "@/integrations/lovable/appUserConnector";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "microsoft_outlook";

export interface OutlookAttendee {
  emailAddress: { address: string; name?: string };
  type?: "required" | "optional";
}

export interface OutlookEventPayload {
  subject: string;
  body?: { contentType: "HTML" | "Text"; content: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: OutlookAttendee[];
  isOnlineMeeting?: boolean;
  onlineMeetingProvider?: "teamsForBusiness" | "teamsForConsumer" | "skypeForConsumer" | "skypeForBusiness";
  location?: { displayName: string };
}

export async function createOutlookEvent(
  connectionAPIKey: string,
  payload: OutlookEventPayload,
) {
  return callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CONNECTOR_ID,
    path: "/me/events",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  });
}

export async function updateOutlookEvent(
  connectionAPIKey: string,
  eventId: string,
  payload: Partial<OutlookEventPayload>,
) {
  return callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CONNECTOR_ID,
    path: `/me/events/${encodeURIComponent(eventId)}`,
    init: {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  });
}

export async function deleteOutlookEvent(connectionAPIKey: string, eventId: string) {
  return callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CONNECTOR_ID,
    path: `/me/events/${encodeURIComponent(eventId)}`,
    init: { method: "DELETE" },
  });
}

export async function getOutlookEvent(connectionAPIKey: string, eventId: string) {
  return callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CONNECTOR_ID,
    path: `/me/events/${encodeURIComponent(eventId)}?$select=id,subject,body,start,end,attendees,isCancelled,lastModifiedDateTime,changeKey,iCalUId,onlineMeeting`,
    init: { method: "GET" },
  });
}
