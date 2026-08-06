# Outlook calendar sync for CRM meetings

Two-way sync between CRM meetings and each user's own Outlook calendar, using Microsoft Graph.

## How it will work

1. Each CRM user connects their own Microsoft account once, from a "Connect Outlook" card on Settings. Consent happens in a popup; nothing is shared between users.
2. When a meeting is created in the CRM, it is also created as a calendar event in the organiser's Outlook, with the lead/client contacts invited by email. Edits (date, agenda, attendees) and deletions/cancellations propagate to Outlook.
3. Every 15 minutes a background job pulls each connected user's calendar and updates the matching CRM meeting when the Outlook copy changed — reschedules, cancellations, and accepted/declined responses. Only events that came from a CRM meeting are read back; unrelated personal events are ignored.
4. The meeting row shows sync status: Synced / Not connected / Sync failed, with a manual "Sync now" action.

## What changes for the user

- Settings gains an **Outlook** tab: connect, show connected account, disconnect.
- The meeting form gains an optional **Invite attendees** field (pre-filled with the lead/client contacts that have an email) and a duration field, since Outlook events need an end time.
- Meetings created before the integration are not back-filled; they sync on next edit only if the user opts in.

## Technical section

**Connector.** Use the Microsoft Outlook App User Connector (`microsoft_outlook`) so each end user authorises their own mailbox. Scopes: `openid profile email offline_access Calendars.ReadWrite`. A workspace admin must confirm the connector client (`connector_app_user--connect_client`) and it must allow offline access; without it, per-user calls are not possible.

**Storage (migration).**
- `app_user_connections` — server-only table (`user_id`, `connector_id`, encrypted connection key, unique per pair). Service-role grants only, RLS on, no anon/authenticated access. Key encrypted with `APP_USER_CONNECTION_KEY_SECRET` (AES-256-GCM).
- `meetings` new columns: `duration_minutes int default 30`, `attendees jsonb default '[]'`, `outlook_event_id text`, `outlook_ical_uid text`, `outlook_last_synced_at timestamptz`, `outlook_sync_error text`, `outlook_change_key text`.
- Index on `outlook_event_id`.

**Server code (TanStack server fns, no edge functions).**
- `src/lib/outlook.functions.ts` — `startOutlookConnect`, `completeOutlookConnect`, `getOutlookStatus`, `disconnectOutlook`, `pushMeetingToOutlook(meetingId)`, `syncMeetingFromOutlook(meetingId)`. All behind `requireSupabaseAuth`, keyed on the signed-in user's id.
- `src/server/appUserConnections.server.ts` + `connectionKeyCrypto.ts` — save/load/decrypt the per-user connection key.
- `src/server/outlookGraph.server.ts` — thin Graph wrapper over `callAsAppUser`: `POST /me/events`, `PATCH /me/events/{id}`, `DELETE /me/events/{id}`, `GET /me/events/{id}`.

**Write path.** Meeting create/update/delete mutations in `src/components/workspace/tabs.tsx` call the push server fn after the Supabase write. Failures are non-fatal: the CRM row is saved, `outlook_sync_error` is set, and the UI shows a retry.

**Read path (polling).** `src/routes/api/public/hooks/outlook-sync.ts`, scheduled by `pg_cron` + `pg_net` every 15 minutes with the anon `apikey` header. It iterates rows in `meetings` with a non-null `outlook_event_id`, fetches the event as its owner via the stored connection key, and updates `meeting_date`, `duration_minutes`, `agenda`, and sets `status = 'cancelled'`-equivalent when the Outlook event is cancelled/deleted. Conflicts resolve last-writer-wins by comparing Outlook's `lastModifiedDateTime` against the CRM `updated_at`.

**Conflict/safety notes.** Sync writes use the service-role client inside the hook after resolving the owner, so RLS is not bypassed for anything other than this system job. The hook is idempotent and skips users whose connection is missing or revoked, flagging them for reconnect in the UI.

## Out of scope for this pass

- Creating CRM meetings from Outlook events that have no CRM origin.
- Teams meeting links, recurring events, and room booking.
- Real-time webhooks (can be added later on top of the same push/pull functions).
