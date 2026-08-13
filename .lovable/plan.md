# Lost pipeline: what's happening, and how to make it consistent

## What the data actually looks like

Everything about a lost lead lives on one table: `public.leads`. There is no separate "lost leads" table. Three columns matter:

- `status` — enum `lead_status` (`active`, `won`, `lost`, `archived`). Marking lost sets it to `lost`.
- `lost_reason` — free text (the dialog writes either the picked label or the typed "Other" text).
- `lost_at` — timestamp of when it was marked.

Plus `pipeline_stage` (enum `pipeline_stage`) and `owner_id` / `co_owner_id` / `end_owner_id`.

A check of the live data explains the inconsistency you're seeing:

- 96 leads have `status = 'lost'`.
- Only **19** of them have a `lost_reason` and a `lost_at`. The other **77** have both `NULL` — these are older/seeded/imported rows that were set to lost before the reason dialog existed, so there is nothing to display.
- **92** of them still sit on `pipeline_stage = 'Lost'`, a stage that was removed from the simplified stage list. It is still a valid enum value in the database, so those rows render as a plain grey badge and can't be matched by any stage filter in the UI.

So the "sometimes reason, sometimes not" is a data gap, not a rendering bug. The detail page only renders the red Lost-reason card when `lost_reason` is non-null, which is correct behaviour on bad data.

## Why owner sometimes shows as "—"

The pipeline list resolves owner names from a separate `users` query and falls back to "—" when the id isn't in that map. That query is filtered by the hierarchy visibility rule, so if a lost lead is visible to you through a co-owner or end-owner path but its actual `owner_id` sits in another vertical, the name can't be resolved and the cell blanks out. Same fallback shows up on kanban cards.

## The fix

### 1. Backfill the legacy lost leads
One migration:
- Set `lost_reason = 'Reason not recorded'` (and `lost_at = updated_at`) for every row where `status = 'lost'` and `lost_reason IS NULL`, so the Lost card always renders and reporting has no silent holes.
- Move every `pipeline_stage = 'Lost'` row back to a real stage. Use the last meaningful stage where it can be inferred, otherwise `Prospect`, so lost leads keep showing the stage they died at instead of a dead badge.

### 2. Stop new gaps at the source
Add a database trigger on `leads`: whenever `status` transitions into `lost`, force `lost_at = now()` if null and `lost_reason = 'Reason not recorded'` if null; whenever it transitions out of `lost` (revive), clear both. Today the revive path clears them in app code only, and any other write path (import, bulk update) can create a reason-less lost lead.

### 3. Make the lost view actually informative
When "Showing lost leads" is on, the pipeline list swaps two columns:
- **Stage** → **Lost reason** (with "Reason not recorded" shown in muted italics)
- **Created** → **Lost on** (`lost_at`)

The Actions column already shows "—" for non-active leads; leave that.

### 4. Always show an owner
Resolve owner names through a security-definer lookup that returns `id`/`full_name` for the owners of records you can already see, instead of relying on the hierarchy-filtered directory query. Falls back to "Unknown owner" rather than a bare dash.

### 5. Detail page consistency
Always render the Lost card for `status = 'lost'` (not only when a reason exists), showing the reason or "Reason not recorded", the lost date, and the owner. That removes the "some leads show it, some don't" difference between records.

## Technical notes

- Migration touches `public.leads` only: two `UPDATE`s plus `CREATE FUNCTION public.sync_lead_lost_fields()` and a `BEFORE INSERT OR UPDATE` trigger. No new tables, no schema/enum change — `'Lost'` stays in the enum for history, it just stops being used.
- New security-definer function `public.list_record_owners(uuid[])` returning `(id, full_name, designation)` for owner-name resolution; granted to `authenticated`.
- Frontend: `src/routes/_authenticated/leads.index.tsx` (conditional columns + owner lookup), `src/routes/_authenticated/leads.$id.tsx` (always-on Lost card), `src/components/lead-outcome-dialogs.tsx` unchanged apart from keeping `lost_at` writes.
