# Fix Lead / Client Delete

## Root cause (verified)

The DELETE policies on both tables are:

- `leads_delete_ceo` — `USING (is_top_of_tree())`
- `clients_delete_ceo` — `USING (is_top_of_tree())`

Only the CEO can delete. For any other signed-in user, PostgREST returns success with 0 rows affected — no error surfaces to the UI, so the button appears to do nothing.

## Fix

Migration to replace both DELETE policies so they match the existing hierarchy model used by SELECT/UPDATE:

- Drop `leads_delete_ceo` and `clients_delete_ceo`.
- Create `leads_delete_hierarchy` — `USING (can_access_owner(owner_id))`.
- Create `clients_delete_hierarchy` — `USING (can_access_owner(owner_id))`.

Result: the owner of a record and any manager above them in the reporting tree can delete it (same rule as edit). This is consistent with the "Delete" buttons already present on lead and client workspaces.

## Optional follow-up (not in this change)

The client-side mutations don't check `count`/rows-affected, so RLS blocks currently look like a no-op. Not fixing here since the policy fix removes the symptom, but worth noting for future writes — surfacing "nothing was deleted" as an error would catch this class of bug earlier.

## No code changes

Frontend already calls `.delete().eq('id', id)` correctly. Only the RLS policies need updating.
