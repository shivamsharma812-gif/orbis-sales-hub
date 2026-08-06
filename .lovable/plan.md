# Outlook calendar sync for CRM meetings

Two-way sync between CRM meetings and each user's own Outlook calendar, using Microsoft Graph, plus editable meeting notes.

## How it will work

1. Each CRM user connects their own Microsoft account once, from a "Connect Outlook" card on Settings. Consent happens in a popup; nothing is shared between users.
2. When a meeting is created in the CRM, it is also created as a calendar event in the organiser's Outlook, with the lead/client contacts invited by email. Edits (date, agenda, notes, attendees) and deletions/cancellations propagate to Outlook.
3. Every 15 minutes a background job pulls the linked Outlook events and updates the matching CRM meeting — reschedules and cancellations. Only events that came from a CRM meeting are read back; unrelated personal events are ignored.
4. The meeting row shows sync status: Synced / Not connected / Sync failed, with a manual "Sync now" action.

## Meeting notes on the edit tab

Today notes can only be captured when a meeting is marked complete. The edit dialog will gain **Meeting notes** and **Action items** textareas, editable at any time (before or after the meeting), saved to the existing `discussion_summary` and `action_items` fields. The notes are also written into the Outlook event body so both sides show the same context.

## What changes for the user

- Settings gains an **Outlook** tab: connect, show connected account, disconnect.
- The meeting form gains an optional **Invite attendees** field (pre-filled with the lead/client contacts that have an email) and a duration field, since Outlook events need an end time.
- Meetings created before the integration are not back-filled; they sync on next edit only if the user opts in.

## Why polling, not webhooks (for now)

Outlook-to-CRM updates will land within 15 minutes. Real-time webhooks were considered and deferred because they require: a published public endpoint (they cannot be tested in preview), per-mailbox subscriptions that expire every ~3 days and need a renewal cron anyway, a reconciliation poll as a backstop since delivery is not guaranteed, and extra failure modes that look like "nothing changed". Webhooks can be layered on later using the same read path.




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

**Write path.** Meeting create/update/delete mutations in `src/components/workspace/tabs.tsx` call the push server fn after the Supabase write. Failures are non-fatal: the CRM row is saved, `outlook_sync_error` is set, and the UI shows a retry. Meeting notes and action items are included in the event body.

**Read path (polling).** `src/routes/api/public/hooks/outlook-sync.ts`, scheduled by `pg_cron` + `pg_net` every 15 minutes with the anon `apikey` header. It iterates `meetings` rows with a non-null `outlook_event_id`, fetches the event as its owner via the stored connection key, and updates `meeting_date`, `duration_minutes`, `agenda`, marking the CRM meeting cancelled when the Outlook event is cancelled or deleted. Conflicts resolve last-writer-wins by comparing Outlook's `lastModifiedDateTime` against the CRM `updated_at`.

**Conflict/safety notes.** Sync writes use the service-role client inside the hook after resolving the owner, so RLS is not bypassed for anything other than this system job. The hook is idempotent and skips users whose connection is missing or revoked, flagging them for reconnect in the UI.

## Out of scope for this pass

- Creating CRM meetings from Outlook events that have no CRM origin. Issue: there is no reliable link from an arbitrary calendar event back to a lead or client, so auto-matching (e.g. by attendee email) risks importing personal/non-sales events as CRM records. Resolution: buildable later as a manual "calendar import" list where the user picks the parent lead/client per event, reusing the same read path. Not needed for the core two-way sync.
- Teams meeting links. Issue: none significant — Graph supports `isOnlineMeeting: true` and generates a join link. Resolution: cheap follow-up on the event-create payload.
- Recurring events. Issue: recurrence uses a complex pattern object (weekly/monthly rules, series master vs. single occurrences, exceptions); mapping a series back to individual CRM meeting rows is ambiguous and error-prone. Resolution: solvable but a meaningful chunk of work; deferred.
- Room booking. Issue: uses separate resource/scheduling APIs outside event creation; low CRM value. Resolution: solvable but deferred.

