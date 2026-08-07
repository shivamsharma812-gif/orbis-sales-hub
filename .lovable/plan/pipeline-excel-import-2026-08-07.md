# Pipeline Excel Import

## Overview
Add an "Import Excel" button to the Pipeline page that parses an uploaded spreadsheet, maps columns by header name (order-independent), validates each row, and upserts leads into the database. Duplicates (same Company Name + Category) update the existing lead; everything else inserts a new lead.

No database changes required — the `leads` table already has every field the import needs (`company_name`, `client_type`, `owner_id`, `pipeline_stage`, `lead_source`, `estimated_deal_value`, `created_at`, `status`, `priority`, `services`).

## Resolved rules (from clarifying answers)
- **Stage**: normalize common synonyms to the app enum (`Closed`→`Won`, `Lead`→`Prospect`, `Negotiating`→`Negotiation`, `Meeting`→`Meeting Scheduled`, `Proposal`→`Proposal Sent`, `Mandate`→`Mandate Signed`). Reject rows with unmapped stage values.
- **Category**: free-text, stored in `client_type`. Any non-empty string accepted.
- **Owner**: match by email first, then by full name (case-insensitive). Reject ambiguous (multiple) matches and unmatched owners. RLS will also reject owners outside the importer's reporting subtree — validate against the assignable-users list first so the error message is clear.
- **Source** (`lead_source`, plain text column, no enum): normalize common synonyms (`Inbound`→`Inbound Email`, `Outbound`→`Cold Outreach`), otherwise store the raw string.
- **Duplicates** (Company Name + Category): update the existing active lead's fields rather than inserting a new row.
- **Est. Value**: numeric / parseable currency (strip `₹`, `Cr`, `Lakh`, commas); store in crores to match the app convention. Invalid → row skipped.
- **Created**: parseable date; invalid or missing → defaults to today. Stored as ISO timestamp.
- **Actions column**: ignored (it is a UI control, not data).

## Implementation

### 1. Install SheetJS
Add `xlsx` to dependencies (browser-side parsing only; not used in server functions).

### 2. New component: `src/components/import-leads-dialog.tsx`
A dialog triggered from the Pipeline page. Responsibilities:
- File input accepting `.xlsx` / `.xls` / `.csv`.
- Parse with SheetJS, read the first sheet, treat row 1 as headers.
- **Header mapping**: normalize each header (trim, lowercase, collapse spaces/underscores) and match against an alias table:
  - Company Name ← `company name`, `company`, `companyname`, `company_name`
  - Category ← `category`, `client type`, `client_type`, `clienttype`
  - Owner ← `owner`, `owner name`, `owner email`, `assigned to`
  - Stage ← `stage`, `pipeline stage`, `pipeline_stage`, `status`
  - Source ← `source`, `lead source`, `lead_source`
  - Est. Value ← `est. value`, `estimated value`, `deal value`, `estimated_deal_value`, `value`
  - Created ← `created`, `created date`, `created_at`, `created date`
  - Actions ← `actions` (ignored)
- **Mandatory check**: if Company Name, Category, or Owner headers are absent entirely, abort and toast the missing columns.
- **Owner resolution**: load the `users-lite` list (already fetched on the page) and the assignable-users subtree. Resolve each row's owner by email (exact, case-insensitive) then by full name. If the resolved owner is not in the importer's assignable subtree, flag the row as failed with reason "Owner outside your team".
- **Stage normalization**: map synonyms; reject unmapped stages.
- **Row validation** (per the doc's junk-data rules):
  - Company Name / Category / Owner / Source: must be non-empty strings, not pure numbers or dates.
  - Est. Value: must parse to a finite number after stripping currency tokens.
  - Created: must parse to a valid date.
  - Invalid rows are skipped and logged with row number + reason.
- **Duplicate detection**: before inserting, fetch existing active leads whose `company_name` matches any row's company (case-insensitive `ilike`) and compare `client_type`. Matching pairs are queued for UPDATE; others for INSERT.
- **Upsert**: batch insert new leads and update existing leads via the Supabase client (RLS enforces ownership). New leads default to `status: active`, `priority: medium`, `pipeline_stage` from row (or `Prospect`), `services: []`.
- **Feedback**: toast summary ("Imported X, updated Y, skipped Z rows") plus an in-dialog report listing skipped rows with reasons and the columns that were mapped, so the user can fix and re-upload.

### 3. Wire into `src/routes/_authenticated/leads.index.tsx`
- Add an "Import Excel" button next to the existing "Create lead" action in the `PageHeader` actions.
- Add state for the dialog open/close and render `<ImportLeadsDialog />`.
- On successful import, invalidate the `["leads"]` query so the list refreshes.

## Technical notes
- All parsing + validation runs client-side; inserts go through the existing Supabase client so RLS and the activity-log triggers apply automatically.
- No server function or migration needed.
- The importer respects hierarchy: RLS on `leads` insert requires `can_access_owner(owner_id)`, so an owner outside the subtree is rejected at the DB too — we pre-check against assignable users for a friendly message.
