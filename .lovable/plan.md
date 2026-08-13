# Lost pipeline: DB design decision

## Should lost leads live in their own table?

Short answer: no — a separate `lost_leads` table would be worse, not safer. Here is the reasoning, then the design I recommend.

### ACID is not the problem

Moving a row (insert into `lost_leads` + delete from `leads`) inside one transaction is perfectly atomic and durable — Postgres guarantees that. So "will it be ACID" is a yes either way. ACID is not what breaks.

### What actually breaks is referential integrity and history

Every child record in this CRM points at a lead by `(parent_type = 'lead', parent_id)` or a direct foreign key:

- `contacts`, `meetings`, `followups`, `notes`, `documents`, `activity_log` — all keyed by `parent_id`
- `clients.originating_lead_id` — a real foreign key to `leads.id`

If the lead row leaves `leads`:

- `clients.originating_lead_id` blocks the delete (or cascades and destroys the link).
- Every `parent_id` reference becomes a dangling pointer — no constraint protects them, so the meetings, notes and documents of a lost lead silently orphan.
- Every access rule (`can_access_parent`, `can_access_owner`) and every RLS policy would need a duplicate written against the second table, and the two copies would drift.
- Reviving a lead becomes a second move, and every report that spans won/lost/active has to `UNION` two tables with two schemas that will diverge over time.

A single table with a `status` column is the standard, safer model here. The real problem you saw is not the table shape — it's that lost data is optional and unenforced.

## Recommended design

### 1. Keep `leads` as the single source of truth, make lost fields enforced

Add a real enum for the reason instead of free text, and make the invariant a database rule rather than a UI convention:

```text
leads
  status         lead_status        -- active | won | lost | archived
  lost_reason_code  lead_lost_reason  -- enum, NULL unless status = 'lost'
  lost_reason_note  text              -- required only when code = 'other'
  lost_at        timestamptz          -- NULL unless status = 'lost'
  lost_by_user_id uuid -> users.id    -- who marked it
```

`lead_lost_reason` enum values: `requires_bank_custodian`, `lack_of_follow_ups`, `inadequate_commercial_quotations`, `other`, `not_recorded` (only used by the backfill of historic rows).

Enforced by a `BEFORE INSERT OR UPDATE` trigger (not a CHECK, since it reads `now()` and other rows):

- entering `lost` → `lost_at` defaults to `now()`, `lost_by_user_id` defaults to the current app user, `lost_reason_code` defaults to `not_recorded` if the caller omitted it
- `lost_reason_code = 'other'` → `lost_reason_note` must be non-empty
- leaving `lost` (revive/convert) → all four lost fields are cleared

That makes it impossible to create the half-filled rows you have today, from any path: app, Excel import, or raw SQL.

### 2. Add an append-only history table

This is the table worth creating — not a copy of the lead, just the events:

```text
lead_status_events
  id            uuid pk
  lead_id       uuid -> leads.id on delete cascade
  from_status   lead_status
  to_status     lead_status
  reason_code   lead_lost_reason   -- null for non-lost transitions
  reason_note   text
  actor_id      uuid -> users.id
  created_at    timestamptz
```

Written by the same trigger on every status change. Benefits: a lead lost twice and revived twice keeps its full trail; "how many deals did we lose to bank-custodian requirements last quarter" becomes one grouped query; nothing is overwritten. Insert-only — no update or delete policy.

### 3. A view for convenience, not a second table

```text
lost_leads_v  =  SELECT ... FROM leads WHERE status = 'lost'
```

created with `security_invoker = on`, so it inherits the existing lead RLS exactly and needs no duplicated policies. The UI can read this view for the lost list and get owner, reason, date and stage in one shot.

### 4. Backfill the existing rows

96 lost leads exist; 77 have no reason and no date, and 92 still sit on the retired `Lost` pipeline stage. One migration sets `lost_reason_code = 'not_recorded'`, `lost_at = updated_at`, and moves the retired stage back to the last real stage so the badge and stage filter work again.

### 5. Fix the list toggle at the same time

You are right about won leads: converting sets `status = 'won'` and `pipeline_stage = 'Onboarding'`, writes `converted_client_id`, and the record then lives in the Clients list. All 3 won leads in the database match that exactly. So keeping them out of the default pipeline list is correct and stays as is — `status = 'active'` remains the default filter, not "not lost".

The one thing to fix is the control duplication: the "View lost leads" button and the status dropdown both write the same `statusFilter` state, so picking "All status" in the dropdown shows lost rows while the button still reads "View lost leads". The button's pressed state should be derived from the filter rather than owning a second copy, and the lost list should keep its own column set (reason, lost date) as described above.

## What the UI shows after this

- Lost list reads `lost_leads_v`: Company, Owner, Lost reason, Lost on, Stage — never blank, because the reason column is enforced.
- Lead detail always renders the Lost card for a lost lead (reason, note, who marked it, when), plus the status history from `lead_status_events`.
- Reports can group losses by reason code, which free text never allowed.

## Technical notes

- Migration: `CREATE TYPE lead_lost_reason`; add 4 columns to `leads`; `CREATE TABLE public.lead_status_events` with `GRANT SELECT, INSERT ... TO authenticated` and `GRANT ALL ... TO service_role`, RLS enabled with a select policy reusing `can_access_owner` on the parent lead and an insert-only policy; `CREATE FUNCTION public.sync_lead_lost_fields()` + trigger; `CREATE VIEW public.lost_leads_v WITH (security_invoker = on)`; two backfill `UPDATE`s.
- `lost_reason` (the old text column) is kept and populated from code + note for one release so nothing that reads it breaks, then dropped in a follow-up.
- Frontend: `src/components/lead-outcome-dialogs.tsx` writes the code instead of the label, `leads.index.tsx` (lost columns + toggle semantics), `leads.$id.tsx` (always-on Lost card + history).
