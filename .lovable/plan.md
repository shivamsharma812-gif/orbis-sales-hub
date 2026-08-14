# CRM edit, undo-delete, and client/pipeline parity

Implements the uploaded specification against the current app.

## 1. Editable follow-ups, tasks and notes

Today these three can only be created and deleted. Add:

- An **Edit** (pencil) action on each follow-up, task and note row, opening the same form pre-filled with current values and saving in place (same validation as create, no duplicate records).
- **Soft delete with Undo**: deleting hides the record from the list and shows a toast with an **Undo** button that restores the exact same record (no duplicate).

Database: add `is_deleted`, `deleted_at`, `deleted_by` to `followups`, `tasks` and `notes`; all existing list queries filter to non-deleted rows. Row-level security keeps the same access rules for update/restore. Existing dashboard/counters that read these tables get the same filter.

## 2. Client detail page — Edit

Add an **Edit** button on the client workspace header opening a dialog with the client's business fields pre-filled (company, type, service(s), AUC, annual revenue, website, address, remarks, status, plus the fields added in section 4). Saving updates only the changed fields on the existing record; identifiers, owner audit fields and creation data are untouched.

## 3. Pipeline detail page — Edit

Add an **Edit** button on the lead workspace header, using the same field set as the create-lead wizard (company, category/sub-category, country/city, source, referral, priority, probability, services, annual revenue with Lakhs/Crores toggle, AUC, expected close date, website, notes). Saves against the existing lead id; stage/owner/status keep their existing dedicated controls.

## 4. Client creation matches pipeline creation

The "New client" dialog currently asks for only 5 fields. It will be rebuilt on the same field definitions as the lead wizard: every business field from lead creation except status — company, client type + sub-category, country/city, contact details, source/referral, services, annual revenue (with unit toggle), AUC, expected/onboarding date, website, remarks, owner.

Status is not shown to the user and is forced server-side: new clients are stored as `onboarded`.

Database: extend `client_status` with `onboarded` and add the missing columns to `clients` (sub_category, country, city, lead_source, referral_by, services, expected_close_date, priority). A database trigger forces `status = 'onboarded'` on insert, so a tampered payload cannot set anything else. Existing clients keep their current status; the Clients list status filter gains "Onboarded".

## 5. Shared field definitions

Field lists, options and zod validation move into one shared module used by lead create, lead edit, client create and client edit, so the two forms cannot drift apart.

## Out of scope

Notes rich-text format stays as-is (plain text today). Concurrency uses last-write-wins per field patch, consistent with the rest of the app.
