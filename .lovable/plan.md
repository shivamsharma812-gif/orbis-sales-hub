
# Orbis Sales CRM — MVP Build Plan

## 1. Architecture

- **Frontend**: React + TypeScript + Tailwind + shadcn/ui on TanStack Start (project's stack). Recharts for analytics, lucide-react for icons.
- **Backend**: Lovable Cloud (Supabase) — Postgres, Auth (email/password), Storage (documents).
- **Auth flow**: `/auth` public route. Protected app under `_authenticated/` (integration-managed gate).
- **Data access**: `supabase` browser client for reads/mutations. RLS enforces the hierarchy on every table.
- **Layout**: Left sidebar (Dashboard, Leads, Clients, Reports, Users, Settings) + top bar with global search + user menu. Desktop-first, dense enterprise styling (Linear/Stripe-inspired).

## 2. Permissions — hierarchy-driven, not role-driven

Every user has `reports_to_user_id`. Access = own records ∪ records owned by any descendant in the reporting tree. MD & CEO (`reports_to_user_id IS NULL` at the top) implicitly sees the whole organization.

Implementation:
- SQL security-definer function `is_descendant_of(manager_id, user_id)` using a recursive CTE.
- SQL security-definer function `can_access_user(auth_user, target_owner)` returning true when `auth_user = target_owner` OR `is_descendant_of(auth_user, target_owner)`.
- RLS policy on every owned table: `USING (public.can_access_user(auth.uid(), owner_id))` for SELECT/UPDATE. INSERT restricted to `owner_id = auth.uid()` (or descendants for managers). DELETE restricted to top-of-tree (`reports_to_user_id IS NULL`).
- Reassignment: managers can update `owner_id` to any descendant.

Audit log records every mutation via triggers.

## 3. Data model (schema)

```text
users                — mirrors auth.users + org fields
  id (uuid, PK = auth.users.id when linked, else generated)
  auth_user_id (uuid, nullable, unique)   -- only login-enabled users have this
  full_name, email, phone, designation, department
  reports_to_user_id (uuid → users.id)
  status ('active'|'inactive')

leads
  id, company_name, client_type, industry, lead_source
  pipeline_stage (enum), estimated_deal_value (numeric)
  status ('active'|'won'|'lost'|'archived')
  owner_id → users.id, converted_client_id → clients.id (nullable)
  created_at, updated_at

clients
  id, company_name, client_type, industry, service_type
  auc (numeric), annual_revenue (numeric), website, address, remarks
  owner_id → users.id, status ('active'|'inactive')
  originating_lead_id → leads.id (nullable)

contacts
  id, parent_type ('lead'|'client'), parent_id
  name, designation, department, email, phone, is_primary, notes

meetings
  id, parent_type, parent_id, owner_id
  meeting_date (timestamptz), meeting_type, status
  agenda, discussion_summary, action_items, next_followup_date

followups
  id, parent_type, parent_id, owner_id
  due_date, status ('pending'|'completed'|'overdue'), priority
  description, completed_at, notes

tasks
  id, parent_type, parent_id, owner_id, assigned_to
  title, description, due_date, priority, status

notes
  id, parent_type, parent_id, owner_id, body, created_at
  (append-only; no delete)

documents
  id, parent_type, parent_id, owner_id
  file_name, storage_path, mime_type, size_bytes, uploaded_at

activity_log
  id, actor_id, parent_type, parent_id, action, metadata (jsonb), created_at
  (append-only; no update/delete via RLS)

pipeline_stages          — configurable (Settings)
```

Enums: `pipeline_stage` = Prospect, Meeting Scheduled, Meeting Completed, Proposal Sent, Negotiation, Mandate Signed, Onboarding, Won, Lost.

## 4. Screens

1. **Dashboard** — 6 KPI cards + widgets (Today's Meetings, Today's Follow-ups, Recent Activity, Pending Tasks, Recent Leads, Recent Clients), quick actions. All values computed live from RLS-scoped queries.
2. **Leads** — List + Kanban toggle; filters (stage/RM/type/industry/source/status); create/edit/archive/convert-to-client; row click → Lead Workspace.
3. **Lead Workspace** — Tabs: Overview, Contacts, Meetings, Follow-ups, Tasks, Notes, Documents, Timeline.
4. **Clients** — List (Company / RM / Service / AUC / Revenue / Last Meeting / Status) + filters.
5. **Client Workspace** — Tabs: Overview, Contacts, Meetings, Follow-ups, Tasks, Notes, Documents, Timeline, Services.
6. **Reports** — Tabs: Revenue, Pipeline, Conversion, Team Performance, Client Analytics, Meeting Analytics, Follow-up Analytics. Recharts. CSV export.
7. **Users** — Tabs: Users (directory), Hierarchy (tree view), Permissions (read-only matrix explanation). Add/edit/deactivate/assign-manager (CEO only).
8. **Settings** — Pipeline stages, client categories, meeting types, follow-up priorities, notification prefs (stubs where non-functional).

Global: header search across leads/clients/contacts, notifications bell (from activity_log + followups).

## 5. Seed data

Migrations seed:
- **Full org from Organization_Structure.md** (~15 users) — as `users` rows with correct `reports_to_user_id` and designation. Only 4 have `auth_user_id` linked.
- **~30 leads**, **~20 clients**, contacts for each, meetings, follow-ups (mix of pending/completed/overdue), tasks, notes, activity_log entries — all with valid FKs distributed across owners.

**Demo Auth accounts** (shared password `Orbis@2026`):
- `ceo@orbis.demo` → Shyamsunder Agarwal (MD & CEO)
- `president@orbis.demo` → Rishav Bagrecha (President)
- `svp@orbis.demo` → Murlidhar Bakshi (SVP)
- `rm@orbis.demo` → Hamza Qazi (Deputy Manager)

Auth users created via `supabaseAdmin` in a one-shot seed server function invoked on first boot (idempotent).

## 6. Design system

Update `src/styles.css` with an enterprise palette: near-white background, deep slate foreground, single muted-blue primary (`oklch(0.45 0.12 250)`), tight radii (`0.375rem`), condensed typography (Inter). Table-first layouts, no gradients, subtle borders. Dark mode not included in v1.

## 7. Build order (single response, parallel where possible)

1. Enable Lovable Cloud.
2. Migration 1: schema + enums + `is_descendant_of` / `can_access_user` functions + RLS + grants + triggers for `updated_at` and activity_log.
3. Migration 2: seed users + leads + clients + contacts + meetings + follow-ups + tasks + notes + activity.
4. Storage bucket `crm-documents` (private) + RLS policies.
5. Design tokens + shadcn sidebar shell + `_authenticated` layout.
6. Auth page.
7. Dashboard + all data hooks (TanStack Query).
8. Leads list + Kanban + workspace tabs.
9. Clients list + workspace tabs.
10. Reports with Recharts.
11. Users + Hierarchy.
12. Settings (pipeline stages CRUD; others stub-labelled).
13. Seed demo auth accounts server function; run once.

## Out of scope (per PRD Non-Goals + your v1 exclusions)

KYC, Compliance, Fund Accounting, AI, WhatsApp/Email/Outlook integration, OCR, workflow automation, mobile, calendar sync, voice notes, document versioning, revenue forecasting, market intelligence, notifications delivery (in-app only, no email).

## Notes / assumptions

- Contacts are stored once and linked polymorphically to lead OR client via `(parent_type, parent_id)` — same pattern for meetings, follow-ups, tasks, notes, documents, activity.
- On Lead → Client conversion: the lead's contacts/meetings/etc. are re-parented to the new client (or optionally shared via `originating_lead_id` lookup); the lead is retained with `status='won'` and `converted_client_id` for history.
- Overdue follow-up detection is a computed view/derived filter (`due_date < now() AND status='pending'`), not stored state.
- All mutation actions write to `activity_log` via Postgres triggers so nothing depends on client-side discipline.

Approve to build.
