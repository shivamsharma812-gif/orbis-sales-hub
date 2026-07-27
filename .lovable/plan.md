
# Plan: User Provisioning & Automated Reminder Emails

## Part 1 — User Provisioning (System Administrators)

### Roles model
- Introduce an `app_role` enum with `system_admin` and a `user_roles` table (separate from `users`, keyed to `auth.users.id`), plus a `has_role()` security-definer function.
- Seed the MD & CEO as the initial `system_admin`. New admins can be granted later via the Users screen — no code changes needed.
- All admin-only actions (invite user, resend invite, deactivate) are gated by `has_role(auth.uid(), 'system_admin')` in both UI and RLS/server-fn checks.

### Admin "Users" screen
Extend the existing hierarchy view with an admin panel (only rendered when the current user is `system_admin`):
- **Invite user** dialog: name, email, designation, reports-to (dropdown from the org tree). Creates a `public.users` row (if not already seeded) and dispatches a Supabase invite email.
- **Row actions**: Resend invite (if not yet accepted), Deactivate (soft-disable login), Grant/Revoke admin role.
- Presidents & others keep read-only access to the hierarchy view; the invite/admin controls are hidden.

### Invite flow (email invite + set-own-password)
- New protected server function `inviteUser` (in `src/lib/admin.functions.ts`) using `supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: '<origin>/auth/set-password', data: { user_id: <public.users.id> } })`.
- Handler first verifies caller has `system_admin` via `context.supabase.rpc('has_role', …)`, then loads `supabaseAdmin` and sends the invite. On success it links the returned `auth.users.id` back into `public.users.auth_user_id`.
- New public route `/auth/set-password` that reads the recovery/invite token from the URL hash, calls `supabase.auth.updateUser({ password })`, then redirects to `/dashboard`.
- The 4 existing demo bootstrap accounts remain untouched; the bootstrap route is left in place for dev.

### Sender domain
Supabase's default sender is used for MVP — no domain setup required now. Later switching to `@orbisfinancial.in` is a config-only change (add domain in Cloud → Emails, run `email_domain--scaffold_auth_email_templates`); no application code changes.

## Part 2 — Automated Reminder Emails

### Email infrastructure
- Scaffold app-email templates via `email_domain--scaffold_transactional_email_templates`. This creates the send helper + template registry with **no** domain requirement blocking dev — until a custom domain is verified, sends will fall back to Lovable's default managed sender. When Orbis wires up `orbisfinancial.in` later, only the sender config changes.
- Three templates in `src/lib/email-templates/`:
  1. `daily-digest.tsx` — subject "Your day at Orbis — <date>". Sections: today's meetings, follow-ups due today, overdue items, a KPI line (open leads / pipeline value).
  2. `meeting-reminder.tsx` — subject "Meeting in 1 hour: <lead/client> — <time>". Body: counterparty, attendees, notes, deep-link to the workspace.
  3. `followup-reminder.tsx` — subject "Follow-up due today: <lead/client>". Body: description, due time, deep-link.

### Trigger 1 — Daily 8:00 AM digest
- New server route `POST /api/public/hooks/send-daily-digests`.
- Handler (using `supabaseAdmin`) iterates every active user with a linked auth account, queries their meetings for today + follow-ups due today + overdue, and calls `sendTemplateEmail('daily-digest', user.email, { templateData, idempotencyKey: 'digest-<user_id>-<yyyy-mm-dd>' })`. Skips users with nothing to send.
- Scheduled via `pg_cron` at `30 2 * * *` UTC (= 08:00 IST) hitting the stable `project--<id>.lovable.app` URL with `apikey` header.

### Trigger 2 — Real-time per-item reminders
- Add columns `meetings.reminder_sent_at timestamptz` and `followups.reminder_sent_at timestamptz` so each item emails at most once.
- New server route `POST /api/public/hooks/send-item-reminders` runs every 5 minutes via `pg_cron`.
- Query 1: meetings where `status='scheduled'`, `meeting_date BETWEEN now() AND now()+interval '65 minutes'`, `reminder_sent_at IS NULL` → send `meeting-reminder` to the owner (and co-owner for shared leads), then stamp `reminder_sent_at`.
- Query 2: follow-ups where `status='pending'`, `due_date::date = current_date`, `reminder_sent_at IS NULL` → send `followup-reminder` to the assignee.
- Idempotency key `meet-<id>` / `fup-<id>` guarantees no duplicate sends even on retry.

### Data considerations
- Every send is one recipient / one specific trigger → complies with app-email rules (no bulk / marketing).
- `co_owner_id` on leads: shared leads notify both parties.
- Users without `auth_user_id` (not yet onboarded) are silently skipped by the digest job.

## Technical notes

- **RLS**: `user_roles` gets `authenticated` SELECT only for the caller's own rows; `service_role` full access. `has_role()` is `SECURITY DEFINER`.
- **Cron auth**: `/api/public/hooks/*` bypasses auth at the edge; handlers verify the `apikey` header matches the Supabase anon key (canonical pattern) — no custom shared secret needed.
- **Email deep-links**: use `process.env.PUBLIC_APP_URL` (fallback to `project--<id>.lovable.app`) so links work in both preview and production.
- **Deploy order**: (1) migration for `user_roles` + reminder columns, (2) scaffold app-email templates, (3) create server routes + templates + admin UI, (4) install cron jobs via `supabase--insert`, (5) grant CEO the `system_admin` role.
- **Future domain switch**: when the Orbis email domain is added, no code change — Supabase auth emails and Lovable Emails both pick up the new sender from config.

## Out of scope for this task
- Editing/removing reminders per-user preference (can add a "notifications" tab later).
- SMS or push channels.
- Digest personalization beyond the fixed sections above.
