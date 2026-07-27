Finish the user onboarding and email reminder system for Orbis CRM.

## What is already built
- `user_roles` table + `system_admin` role; MD & CEO is the first admin.
- `inviteUser` server function using Supabase Auth admin invite.
- `/auth/set-password` public route for invited users to set/reset passwords.
- Users page with an "Invite User" dialog visible only to `system_admin`.
- `reminder_sent_at` columns added to `meetings` and `followups` to prevent duplicate sends.

## What still needs to be done

### 1. Set up email domain for app emails
- Required before any non-auth emails (daily digest, meeting reminders, follow-up reminders) can be sent.
- This is a one-time DNS verification step.
- Once verified, transactional email templates can be scaffolded.

### 2. Scaffold transactional email templates
- Daily 8:00 AM digest email: lists today's and overdue meetings, follow-ups, and tasks for the recipient.
- Meeting reminder email: sent 1 hour before a scheduled meeting.
- Follow-up reminder email: sent on the follow-up due date.

### 3. Create public cron hook endpoints
- `POST /api/public/hooks/send-daily-digests` — runs once per day at 8:00 AM IST, queries all users, gathers their day's items, sends one email per user, and records send time.
- `POST /api/public/hooks/send-item-reminders` — runs every 5 minutes, finds meetings starting within the next hour and follow-ups due today that have not yet been reminded, sends emails, and updates `reminder_sent_at`.

### 4. Schedule cron jobs in the database
- Use `pg_cron` to call the two public hook endpoints at the required cadence.
- Both endpoints will verify a shared secret header so only the cron caller can trigger sends.

### 5. Add UI controls for reminders (optional)
- A settings section where admins can toggle digest/reminder emails globally.

## Outcome
- Admins can invite real users from the Users page today (works immediately).
- Automated daily digests and per-item reminders start sending once the email domain is verified and the cron jobs are scheduled.

## Technical details
- Auth emails (invites, password resets) use Supabase's built-in sender and do not require a custom domain.
- App/transactional emails (reminders, digests) require the custom domain and will use the scaffolded Lovable email templates.
- Cron endpoints will be placed under `src/routes/api/public/hooks/` and protected by a secret token in the `Authorization` header.