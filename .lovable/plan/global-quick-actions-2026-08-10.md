# Global Quick Actions

Add a persistent "+ Quick Action" button in the top header that opens a compact menu of seven actions, reusing the CRM's existing forms, data and permissions. No schema changes, no redesign.

## Behaviour

Menu items: Create Lead, Add Client, Schedule Meeting, Create Follow-up, Create Task, Add Contact, Upload Document.

- Create Lead / Add Client open the existing creation dialogs directly.
- The other five first need a Lead/Client. If the user is already inside a lead or client workspace, that record is pre-selected and the dialog title reads e.g. "Schedule Meeting — Tata Asset Management". Otherwise a searchable record picker opens first.
- The picker searches company name, contact name and record ID, and each row shows company name, Lead vs Client, pipeline stage (leads) or status (clients), and the assigned RM. It queries through the normal client so existing row-level permissions decide what appears — users only see and can pick records they're allowed to access.
- Saving writes through the same code path as the workspace tabs, so every meeting, follow-up, task, contact and document is linked to the chosen record's parent type and ID. Nothing orphaned.

## Technical notes

- New `src/components/quick-actions/` with: `quick-actions-menu.tsx` (header button + dropdown + orchestration), `record-picker-dialog.tsx` (search over leads and clients, joined to owner for RM name).
- `src/components/workspace/tabs.tsx`: the create dialogs currently live inline inside `ContactsTab`, `MeetingsTab`, `FollowupsTab`, `TasksTab`, `DocumentsTab`. Extract each into an exported controlled dialog component (`AddContactDialog`, `ScheduleMeetingDialog`, `CreateFollowupDialog`, `CreateTaskDialog`, `UploadDocumentDialog`) taking `parentType`, `parentId`, `ownerId`, `open`, `onOpenChange`, plus an optional title suffix. The tabs render those same components, so existing behaviour (stage advancement, cache invalidation, toasts) is unchanged and shared.
- `clients.index.tsx`: export the existing `CreateClientDialog` and make its open state optionally controlled; `create-lead-wizard.tsx` gets the same optional controlled-open prop. Their in-page trigger buttons stay as-is.
- Current lead/client context is detected from the router match params on `/leads/$id` and `/clients/$id`, then the record's name and owner are read from the existing cached query.
- `top-bar.tsx` renders the button next to the global search; no other layout changes.

## Verification

Drive the running app to open the menu, confirm all seven actions open, search the picker by company and contact, create one record of each type from both a workspace page (pre-selected) and the dashboard (picker), and confirm each row lands against the right parent and existing screens are unaffected.
