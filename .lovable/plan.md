## Problem

The notes RLS policy requires `owner_id = current_app_user_id()` on insert — the note's owner must be the logged-in user. But `NotesTab` inserts with `owner_id: ownerId`, where `ownerId` is the parent lead/client's owner. When a manager (or anyone who isn't the record's owner) adds a note on a subordinate's lead, the insert fails RLS.

Vertex Capital is owned by Anita Chouhan, so any other user adding a note there hits this error.

## Fix

In `src/components/workspace/tabs.tsx` (`NotesTab.create` mutation), set `owner_id` to the current app user's id instead of the parent record's owner.

- Use the existing `useCurrentUser()` hook to get the app user id.
- Pass `owner_id: currentUser.id` when inserting into `notes`.
- Disable the "Add note" button while the current user is loading.

## Audit sibling tabs

Same anti-pattern likely exists in other tabs that insert with `owner_id: ownerId`. Check and apply the same fix where the table's RLS insert policy scopes `owner_id` to the acting user (notes, tasks-assignee, followups, meetings, contacts, documents). For each, only change the field the policy actually constrains to the caller — do not alter parent-scoping fields.

Specifically I'll re-check policies for `tasks`, `followups`, `meetings`, `contacts`, `documents` before editing, and only patch the ones whose WITH CHECK enforces `owner_id = current_app_user_id()`.

## Out of scope

No schema, policy, or business-logic changes. Purely a client-side correction so the insert satisfies existing RLS.