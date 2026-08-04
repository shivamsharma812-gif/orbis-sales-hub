# Pipeline quick actions, filters, and an empty-meetings nudge

## 1. Tick / cross quick actions in the pipeline list

Each row in the pipeline list view gets two small icon buttons at the far right:

- Green tick — convert to client
- Red cross — mark lost

They open the same popups already used inside the lead workspace, so nothing is lost:

- Tick opens the mandate popup (checkbox list of services, pre-ticked from the lead's interested services, at least one required), then converts.
- Cross opens the lost-reason popup (Requires bank custodian / Lack of follow ups / Inadequate Commercial quotations / Other with manual text).

The buttons only appear for active leads (not for leads already won, lost, or archived). After the action the list refreshes and the lead drops out of the active view. Also added to the pipeline (kanban) cards for consistency.

## 2. New filters on the pipeline

Two filters added next to the existing stage/status filters:

- **Client type** — All types, AIF, PMS, FPI, Mutual Fund, REIT, InvIT, Corporate, Family Office.
- **Month** — a month picker (month + year). Selecting one shows only leads created in that month; "All time" clears it.

Both work together with search, stage, and status filters.

## 3. Empty-meetings message

Wherever a meetings list is empty, the placeholder text becomes:

"You have been sitting on your desk for long enough, Hustle up soldier :)"

This covers the Meetings tab on lead and client records, and the dashboard's "Today's meetings" panel.

## Technical notes

- Extract the mandate-selection and lost-reason dialogs from `src/routes/_authenticated/leads.$id.tsx` into a shared component (e.g. `src/components/lead-outcome-dialogs.tsx`) exporting the two dialogs plus the convert/mark-lost mutations, so both the detail page and `leads.index.tsx` use identical logic (client insert, `converted_client_id`, `status`, `lost_reason`/`lost_at`, activity refresh, query invalidation).
- `leads.index.tsx`: add `clientTypeFilter` and `monthFilter` state into the existing query key; client type via `.eq("client_type", ...)`, month via `.gte`/`.lt` on `created_at` for the month range. Add an actions column with `Check`/`X` lucide icon buttons.
- Empty-state copy changes in `src/components/workspace/tabs.tsx` (Meetings tab) and `src/routes/_authenticated/dashboard.tsx`.
- No database changes.
